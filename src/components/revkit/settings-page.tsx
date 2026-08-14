"use client";

// src/components/revkit/settings-page.tsx
//
// Compact, tabbed Settings page for RevKit. Seven sections:
//   Profile · Team · Preferences · Display · Tooltips · Backups · About
//
// Design system tokens used (from globals.css v2 — compact / teal / dark-first):
//   - .btn-compact + .btn-primary / .btn-secondary / .btn-ghost / .btn-danger
//   - .input-compact, .card-compact, .badge-tiny (+ .badge-teal / .badge-neutral)
//   - .eyebrow, .section-header, .text-fg-2 / .text-meta / .text-accent / .text-muted-fg
//   - .bg-surface, .bg-surface-hover, .bg-accent-subtle
//
// All mutations flow through the Zustand `useTeamStore` (which writes through to
// the /api/team + /api/team/profile endpoints). Toasts surface success/failure.
// Profile edits auto-commit on blur (no explicit Save button needed once a
// current reviewer exists; the initial create button uses addMember).

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  User,
  Users,
  SlidersHorizontal,
  Monitor,
  Question,
  Database,
  Info,
  Plus,
  Pencil,
  Trash,
  Check,
  X,
} from "@phosphor-icons/react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  useTeamStore,
  TEAM_ROLES,
  TEAM_COLORS,
  DEFAULT_PROFILE,
  type TeamMember,
  type TeamRole,
  type UserProfile,
} from "@/lib/team/store";
import { PresetSelect, type PresetGroup } from "@/components/revkit/preset-select";
import { InfoTooltip } from "@/components/revkit/info-tooltip";
import { ThemeToggle } from "@/components/revkit/theme-toggle";
import { loadRecentFiles, removeRecentFile } from "@/lib/project/id";
import { useReviewStore } from "@/lib/project/state";

// ─── Tabs ────────────────────────────────────────────────────────────────

type SettingsTab =
  | "profile"
  | "team"
  | "preferences"
  | "display"
  | "tooltips"
  | "backups"
  | "about";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "team", label: "Team", icon: Users },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "display", label: "Display", icon: Monitor },
  { id: "tooltips", label: "Tooltips", icon: Question },
  { id: "backups", label: "Backups", icon: Database },
  { id: "about", label: "About", icon: Info },
];

// ─── Preset group builders (with InfoTooltips per option) ───────────────

function roleGroups(): PresetGroup[] {
  return [
    {
      label: "Roles",
      options: TEAM_ROLES.map((r) => ({
        value: r.value,
        label: r.label,
        description: r.description,
        info: {
          title: r.label,
          what: r.description,
          why: "Attributed to decisions this member makes (RoB, screening, extraction).",
        },
      })),
    },
  ];
}

function effectMeasureGroups(): PresetGroup[] {
  return [
    {
      label: "Ratio measures",
      options: [
        {
          value: "OR",
          label: "Odds Ratio (OR)",
          info: {
            title: "Odds Ratio",
            what: "Ratio of the odds of the event in the two arms.",
            why: "Default for case-control and rare outcomes. Combines well with Mantel-Haenszel.",
            formula: "OR = (a·d) / (b·c)",
            example: "Use for case-control or when outcome prevalence is < 10%.",
          },
        },
        {
          value: "RR",
          label: "Risk Ratio (RR)",
          info: {
            title: "Risk Ratio",
            what: "Ratio of event proportions (risks) in the two arms.",
            why: "More intuitive than OR for common outcomes; non-collapsible otherwise.",
            formula: "RR = [a/(a+b)] / [c/(c+d)]",
            example: "Use for cohort / RCT data when the outcome isn't rare.",
          },
        },
        {
          value: "PETO_OR",
          label: "Peto OR",
          info: {
            title: "Peto Odds Ratio",
            what: "One-step OR approximation using observed-minus-expected.",
            why: "Stable for very rare events across many sparse RCT datasets (e.g. mortality).",
            formula: "Peto OR = exp( Σ(O−E) / ΣV )",
            example: "Use for mortality endpoints pooled across many small trials.",
          },
        },
        {
          value: "DOR",
          label: "Diagnostic OR (DOR)",
          info: {
            title: "Diagnostic Odds Ratio",
            what: "Single ratio combining sensitivity and specificity.",
            why: "Standard summary for DTA reviews — higher = better discrimination.",
            formula: "DOR = (TP·TN) / (FP·FN)",
            example: "Use for diagnostic test accuracy meta-analyses.",
          },
        },
      ],
    },
    {
      label: "Difference measures",
      options: [
        {
          value: "RD",
          label: "Risk Difference (RD)",
          info: {
            title: "Risk Difference",
            what: "Absolute difference in event proportions.",
            why: "Required for absolute-effect estimates (NNT = 1 / |RD|).",
            formula: "RD = a/(a+b) − c/(c+d)",
            example: "Use for high-prevalence outcomes or to compute NNT.",
          },
        },
        {
          value: "MD",
          label: "Mean Difference (MD)",
          info: {
            title: "Mean Difference",
            what: "Difference in group means on the original scale.",
            why: "Use only when all studies report the same outcome scale.",
            formula: "MD = mean₁ − mean₂",
            example: "Blood pressure (mmHg) across RCTs reporting mmHg.",
          },
        },
        {
          value: "SMD",
          label: "Std. Mean Diff. (SMD)",
          info: {
            title: "Standardized Mean Difference",
            what: "Mean difference divided by pooled SD — scale-free.",
            why: "Lets you pool studies that used different measurement instruments.",
            formula: "SMD = (mean₁ − mean₂) / SD_pooled",
            example: "Depression scores from PHQ-9, HAM-D, BDI pooled together.",
          },
        },
      ],
    },
  ];
}

function methodGroups(): PresetGroup[] {
  return [
    {
      label: "Pooling methods",
      options: [
        {
          value: "MH",
          label: "Mantel-Haenszel (MH)",
          info: {
            title: "Mantel-Haenszel",
            what: "Stratified pooling of 2×2 tables.",
            why: "Default for dichotomous outcomes — robust with rare events and small studies.",
            example: "Use for RCT dichotomous outcomes with sparse cells.",
          },
        },
        {
          value: "PETO",
          label: "Peto",
          info: {
            title: "Peto method",
            what: "One-step pooling using (O−E) and variance.",
            why: "Stable for rare outcomes pooled across large sparse RCT datasets.",
            example: "Use for all-cause mortality pooled across many small RCTs.",
          },
        },
        {
          value: "IV",
          label: "Inverse Variance (IV)",
          info: {
            title: "Inverse Variance",
            what: "Generic fixed-effects pooling — weights = 1 / variance.",
            why: "Use for continuous outcomes, pre-computed effect sizes, or generic IV data.",
            example: "Use for MD, SMD, or when studies report a pre-computed logOR + SE.",
          },
        },
        {
          value: "DL",
          label: "DerSimonian-Laird (DL)",
          info: {
            title: "DerSimonian-Laird",
            what: "Classic random-effects estimator.",
            why: "Use when I² > 50% — accounts for between-study heterogeneity.",
            example: "Use when studies vary in design, population, or dose.",
          },
        },
        {
          value: "LOGIT_UNIVARIATE",
          label: "Logit Univariate",
          info: {
            title: "Logit Univariate",
            what: "Pools sensitivity and specificity separately via logit transform.",
            why: "Simpler alternative to HSROC for DTA meta-analyses.",
            example: "Use for diagnostic test accuracy reviews (univariate model).",
          },
        },
        {
          value: "HSROC",
          label: "HSROC",
          info: {
            title: "Hierarchical SROC",
            what: "Hierarchical summary ROC model.",
            why: "Reference standard for DTA meta-analyses with a positivity threshold.",
            example: "Use for DTA reviews where studies use different positivity thresholds.",
          },
        },
      ],
    },
  ];
}

function autoBackupGroups(): PresetGroup[] {
  return [
    {
      label: "Auto-backup interval",
      options: [
        { value: "5", label: "Every 5 minutes", description: "Paranoid — long sessions." },
        { value: "10", label: "Every 10 minutes", description: "Balanced." },
        { value: "15", label: "Every 15 minutes", description: "Recommended." },
        { value: "30", label: "Every 30 minutes", description: "Short sessions." },
        { value: "60", label: "Every hour", description: "Minimal autosave." },
      ],
    },
  ];
}

function maxRecentGroups(): PresetGroup[] {
  return [
    {
      label: "Max recent files",
      options: [
        { value: "10", label: "10 files", description: "Smaller list, less memory." },
        { value: "20", label: "20 files", description: "Default." },
        { value: "50", label: "50 files", description: "Deeper history." },
        { value: "100", label: "100 files", description: "Power users." },
      ],
    },
  ];
}

// ─── Small reusable bits ────────────────────────────────────────────────

interface InfoPayload {
  title: string;
  what?: string;
  why?: string;
  formula?: string;
  example?: string;
}

function FieldLabel({
  children,
  info,
}: {
  children: React.ReactNode;
  info: InfoPayload;
}) {
  return (
    <label className="flex items-center gap-1 text-[12px] font-medium text-fg-2">
      {children}
      <InfoTooltip
        title={info.title}
        what={info.what}
        why={info.why}
        formula={info.formula}
        example={info.example}
      />
    </label>
  );
}

function SettingRow({
  label,
  info,
  children,
}: {
  label: string;
  info: InfoPayload;
  children: React.ReactNode;
}) {
  return (
    <div className="grid sm:grid-cols-[220px_1fr] gap-3 items-start py-3">
      <FieldLabel info={info}>{label}</FieldLabel>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TEAM_COLORS.map((c) => {
        const active = c.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Pick color ${c}`}
            aria-pressed={active}
            className={`relative size-7 rounded-full border transition-all ${
              active ? "border-foreground" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
          >
            {active && (
              <Check
                size={14}
                weight="bold"
                className="absolute inset-0 m-auto text-white"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Tiny inline radio with a label + optional description.
function RadioChoice({
  value,
  label,
  description,
}: {
  value: string;
  label: string;
  description?: string;
}) {
  return (
    <label
      htmlFor={`rc-${value}`}
      className="flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 cursor-pointer hover:bg-surface-hover transition-colors"
    >
      <RadioGroupItem value={value} id={`rc-${value}`} className="mt-0.5" />
      <div className="min-w-0">
        <div className="text-[13px] font-medium leading-tight">{label}</div>
        {description && (
          <div className="text-[11px] text-muted-fg mt-0.5">{description}</div>
        )}
      </div>
    </label>
  );
}

// ─── Member form dialog (shared by Add + Edit) ──────────────────────────

interface MemberFormState {
  name: string;
  email: string;
  role: TeamRole;
  initials: string;
  color: string;
  isCurrentUser: boolean;
  affiliation: string;
  country: string;
  contribution: string;
  conflictOfInterest: string;
}
const EMPTY_MEMBER: MemberFormState = {
  name: "",
  email: "",
  role: "reviewer",
  initials: "",
  color: TEAM_COLORS[0] ?? "#14b8a6",
  isCurrentUser: false,
  affiliation: "",
  country: "",
  contribution: "",
  conflictOfInterest: "",
};
function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function memberToForm(m: TeamMember): MemberFormState {
  return {
    name: m.name,
    email: m.email ?? "",
    role: m.role,
    initials: m.initials,
    color: m.color,
    isCurrentUser: m.isCurrentUser,
    affiliation: m.affiliation ?? "",
    country: m.country ?? "",
    contribution: m.contribution ?? "",
    conflictOfInterest: m.conflictOfInterest ?? "",
  };
}
function MemberFormDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "add" | "edit";
  initial: MemberFormState;
  onClose: () => void;
  onSubmit: (state: MemberFormState) => Promise<boolean>;
}) {
  const [form, setForm] = useState<MemberFormState>(initial);
  const [busy, setBusy] = useState(false);

  // No useEffect needed — the parent re-keys this component on every open
  // (see TeamSection's `dialogKey`), so `useState(initial)` re-initialises
  // correctly when the dialog re-opens with a different member.

  async function handleSubmit() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const initials =
      form.initials.trim().slice(0, 3).toUpperCase() || deriveInitials(name);
    setBusy(true);
    const ok = await onSubmit({
      ...form,
      name,
      initials,
      email: form.email.trim(),
      affiliation: form.affiliation.trim(),
      country: form.country.trim(),
      contribution: form.contribution.trim(),
      conflictOfInterest: form.conflictOfInterest.trim(),
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="modal-origin max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {mode === "add" ? "Add team member" : "Edit team member"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Each member can be attributed decisions — RoB assessments, screening,
            data extraction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <FieldLabel
              info={{
                title: "Name",
                what: "Display name for this team member.",
                why: "Shown next to decisions they make.",
              }}
            >
              Name <span className="text-destructive">*</span>
            </FieldLabel>
            <input
              className="input-compact h-8"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Jane Doe"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel
              info={{
                title: "Email",
                what: "Optional. Used for export attribution only.",
                why: "Not collected by any server.",
              }}
            >
              Email
            </FieldLabel>
            <input
              type="email"
              className="input-compact h-8"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jane@uni.edu"
            />
          </div>


          <div className="space-y-1.5">
            <FieldLabel
              info={{
                title: "Affiliation",
                what: "University, hospital, department, or organisation.",
                why: "PROSPERO asks who the team members are and where they are based.",
              }}
            >
              Affiliation
            </FieldLabel>
            <input
              className="input-compact h-8"
              value={form.affiliation}
              onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
              placeholder="e.g. Department of Critical Care, ABC Medical College"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel
                info={{
                  title: "Country",
                  what: "Country for this member or institution.",
                  why: "Useful for the registration record and reviewer contact details.",
                }}
              >
                Country
              </FieldLabel>
              <input
                className="input-compact h-8"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="e.g. India"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel
                info={{
                  title: "Review contribution",
                  what: "What this person will do in the review.",
                  why: "Makes the PROSPERO team section clearer and easier to edit later.",
                }}
              >
                Review role notes
              </FieldLabel>
              <input
                className="input-compact h-8"
                value={form.contribution}
                onChange={(e) => setForm({ ...form, contribution: e.target.value })}
                placeholder="e.g. Screening and data extraction"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel
              info={{
                title: "Conflict of interest",
                what: "Any personal, financial, or academic interest to declare.",
                why: "If none are known, write 'None declared' so the export is complete.",
              }}
            >
              Conflict of interest
            </FieldLabel>
            <input
              className="input-compact h-8"
              value={form.conflictOfInterest}
              onChange={(e) => setForm({ ...form, conflictOfInterest: e.target.value })}
              placeholder="e.g. None declared"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel
              info={{
                title: "Role",
                what: "Pick this member's review role.",
                why: "Used to attribute decisions correctly.",
              }}
            >
              Role
            </FieldLabel>
            <PresetSelect
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v as TeamRole })}
              groups={roleGroups()}
              placeholder="Pick a role"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel
              info={{
                title: "Initials",
                what: "Shown as a 2-3 char signature next to this member's decisions.",
                why: "Auto-derived from name on blur — edit if you need a custom signature.",
              }}
            >
              Initials
            </FieldLabel>
            <input
              className="input-compact h-8 max-w-[120px]"
              value={form.initials}
              maxLength={3}
              onChange={(e) =>
                setForm({ ...form, initials: e.target.value.slice(0, 3) })
              }
              onBlur={(e) =>
                setForm({
                  ...form,
                  initials:
                    e.target.value.trim().slice(0, 3).toUpperCase() ||
                    deriveInitials(form.name),
                })
              }
              placeholder="JD"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel
              info={{
                title: "Tag color",
                what: "Used in the RoB traffic-light plot and decision badges.",
                why: "Helps distinguish members at a glance.",
              }}
            >
              Color
            </FieldLabel>
            <ColorSwatchPicker
              value={form.color}
              onChange={(c) => setForm({ ...form, color: c })}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-surface-hover px-3 py-2">
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-medium">Set as current user</span>
              <InfoTooltip
                title="Current user"
                what="When on, decisions you make in this browser are attributed to this member."
                why="Only one member can be current at a time."
              />
            </div>
            <Switch
              checked={form.isCurrentUser}
              onCheckedChange={(v) => setForm({ ...form, isCurrentUser: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="btn-compact btn-secondary"
          >
            <X size={14} />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="btn-compact btn-primary"
          >
            <Check size={14} />
            {busy
              ? "Saving…"
              : mode === "add"
                ? "Add member"
                : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section: Profile (the current reviewer) ─────────────────────────────

function ProfileSection() {
  const currentMember = useTeamStore((s) => s.currentMember);
  const updateMember = useTeamStore((s) => s.updateMember);
  const addMember = useTeamStore((s) => s.addMember);
  const setCurrent = useTeamStore((s) => s.setCurrent);

  // Draft state — used ONLY when no currentMember exists yet (creation flow).
  // When a currentMember exists, the inputs are uncontrolled with a per-field
  // key based on the member's id+updatedAt so they re-mount on store changes
  // (matching the pattern used by OverviewBody in workspace-shell.tsx).
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("reviewer");
  const [newInitials, setNewInitials] = useState("");
  const [newColor, setNewColor] = useState<string>(
    TEAM_COLORS[0] ?? "#14b8a6",
  );

  function resetDraft() {
    setNewName("");
    setNewEmail("");
    setNewRole("reviewer");
    setNewInitials("");
    setNewColor(TEAM_COLORS[0] ?? "#14b8a6");
  }

  // Commit a single field to the store on blur (only if a member exists).
  async function commitField<K extends keyof TeamMember>(
    key: K,
    value: TeamMember[K],
    current: TeamMember,
  ) {
    if (current[key] === value) return;
    const ok = await updateMember(current.id, { [key]: value } as Partial<TeamMember>);
    if (ok) toast.success("Profile updated");
    else toast.error("Failed to update profile");
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const initials =
      newInitials.trim().slice(0, 3).toUpperCase() || deriveInitials(name);
    const member = await addMember({
      name,
      email: newEmail.trim() || null,
      role: newRole,
      initials,
      color: newColor,
      isCurrentUser: true,
    });
    if (member) {
      toast.success("Reviewer profile created");
      resetDraft();
    } else {
      toast.error("Failed to create reviewer profile");
    }
  }

  async function handleSetCurrent() {
    if (!currentMember) return;
    const ok = await setCurrent(currentMember.id);
    if (ok) toast.success("Marked as current reviewer");
    else toast.error("Failed to set current reviewer");
  }

  async function handleSaveAll() {
    if (!currentMember) return;
    const ok = await updateMember(currentMember.id, {
      name: currentMember.name,
      email: currentMember.email,
      role: currentMember.role,
      initials: currentMember.initials,
      color: currentMember.color,
    });
    if (ok) toast.success("Profile saved");
    else toast.error("Failed to save profile");
  }

  // Form key — inputs re-mount on current member change so uncontrolled
  // `defaultValue`s pick up the latest store values cleanly.
  const formKey = currentMember
    ? `${currentMember.id}-${currentMember.updatedAt}`
    : "new";

  return (
    <section className="card-compact p-4 space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Your reviewer identity</p>
          <h3 className="text-lg font-semibold mt-1">Profile</h3>
        </div>
        {currentMember?.isCurrentUser && (
          <span className="badge-tiny badge-teal">
            <Check size={10} weight="bold" />
            Current reviewer
          </span>
        )}
      </header>

      {!currentMember && (
        <div className="rounded-md border border-border bg-accent-subtle px-3 py-2.5 text-[12px] text-fg-2">
          Set up your reviewer profile to attribute decisions to you.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {/* ─── Name ─── */}
        <div className="space-y-1.5">
          <FieldLabel
            info={{
              title: "Name",
              what: "Your name. Will be shown next to decisions you make.",
              why: "RoB assessments, screening decisions, data extraction all get tagged with it.",
              example: "e.g. Jane Doe",
            }}
          >
            Name <span className="text-destructive">*</span>
          </FieldLabel>
          {currentMember ? (
            <input
              key={`${formKey}-name`}
              className="input-compact h-8"
              defaultValue={currentMember.name}
              onBlur={(e) =>
                commitField("name", e.target.value.trim(), currentMember)
              }
              placeholder="e.g. Jane Doe"
            />
          ) : (
            <input
              className="input-compact h-8"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Jane Doe"
              autoFocus
            />
          )}
        </div>

        {/* ─── Email ─── */}
        <div className="space-y-1.5">
          <FieldLabel
            info={{
              title: "Email",
              what: "Used for export attribution. Not collected by any server.",
              why: "Helps reviewers attribute exported Word / CSV files.",
            }}
          >
            Email
          </FieldLabel>
          {currentMember ? (
            <input
              key={`${formKey}-email`}
              type="email"
              className="input-compact h-8"
              defaultValue={currentMember.email ?? ""}
              onBlur={(e) =>
                commitField(
                  "email",
                  e.target.value.trim() || null,
                  currentMember,
                )
              }
              placeholder="jane@uni.edu"
            />
          ) : (
            <input
              type="email"
              className="input-compact h-8"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="jane@uni.edu"
            />
          )}
        </div>

        {/* ─── Role ─── */}
        <div className="space-y-1.5">
          <FieldLabel
            info={{
              title: "Role",
              what: "Pick your review role.",
              why: "Used to attribute decisions correctly (statistician vs reviewer vs librarian).",
            }}
          >
            Role
          </FieldLabel>
          {currentMember ? (
            <PresetSelect
              value={currentMember.role}
              onValueChange={(v) =>
                commitField("role", v as TeamRole, currentMember)
              }
              groups={roleGroups()}
              placeholder="Pick a role"
            />
          ) : (
            <PresetSelect
              value={newRole}
              onValueChange={(v) => setNewRole(v as TeamRole)}
              groups={roleGroups()}
              placeholder="Pick a role"
            />
          )}
        </div>

        {/* ─── Initials ─── */}
        <div className="space-y-1.5">
          <FieldLabel
            info={{
              title: "Initials",
              what: "Shown as a 2-3 char signature next to your decisions.",
              why: "Auto-derived from your name — edit if you need a custom signature.",
              example: "JD",
            }}
          >
            Initials
          </FieldLabel>
          {currentMember ? (
            <input
              key={`${formKey}-initials`}
              className="input-compact h-8 max-w-[120px]"
              defaultValue={currentMember.initials}
              maxLength={3}
              onBlur={(e) =>
                commitField(
                  "initials",
                  e.target.value.trim().slice(0, 3).toUpperCase() ||
                    deriveInitials(currentMember.name),
                  currentMember,
                )
              }
              placeholder="JD"
            />
          ) : (
            <input
              className="input-compact h-8 max-w-[120px]"
              value={newInitials}
              maxLength={3}
              onChange={(e) => setNewInitials(e.target.value.slice(0, 3))}
              onBlur={() => {
                if (!newInitials.trim() && newName.trim()) {
                  setNewInitials(deriveInitials(newName));
                }
              }}
              placeholder="JD"
            />
          )}
        </div>

        {/* ─── Color ─── */}
        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel
            info={{
              title: "Tag color",
              what: "Your tag color. Used in the RoB traffic-light plot and decision badges.",
              why: "Helps distinguish you from teammates at a glance.",
            }}
          >
            Color
          </FieldLabel>
          {currentMember ? (
            <ColorSwatchPicker
              value={currentMember.color}
              onChange={(c) => commitField("color", c, currentMember)}
            />
          ) : (
            <ColorSwatchPicker value={newColor} onChange={setNewColor} />
          )}
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 text-[12px] text-muted-fg">
          <InfoTooltip
            title="Current user"
            what="Only one team member is the 'current user' at a time."
            why="Decisions you make in this browser are attributed to them."
          />
          <span>
            {currentMember?.isCurrentUser
              ? "You are the current reviewer."
              : "Make this the current reviewer."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {currentMember && !currentMember.isCurrentUser && (
            <button
              type="button"
              onClick={handleSetCurrent}
              className="btn-compact btn-secondary"
            >
              <Check size={14} />
              Set as current user
            </button>
          )}

          {currentMember ? (
            <button
              type="button"
              onClick={handleSaveAll}
              className="btn-compact btn-primary"
            >
              <Check size={14} />
              Save profile
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              className="btn-compact btn-primary"
            >
              <Plus size={14} />
              Create reviewer profile
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Team ───────────────────────────────────────────────────────

function TeamSection() {
  const members = useTeamStore((s) => s.members);
  const addMember = useTeamStore((s) => s.addMember);
  const updateMember = useTeamStore((s) => s.updateMember);
  const deleteMember = useTeamStore((s) => s.deleteMember);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<MemberFormState>(EMPTY_MEMBER);
  // Bumped on every openAdd/openEdit so MemberFormDialog remounts with fresh
  // initial state — avoids needing a useEffect to re-sync the form.
  const [dialogKey, setDialogKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<TeamMember | null>(null);
  const [clearing, setClearing] = useState(false);

  function openAdd() {
    setDialogMode("add");
    setEditingId(null);
    setInitialForm(EMPTY_MEMBER);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(m: TeamMember) {
    setDialogMode("edit");
    setEditingId(m.id);
    setInitialForm(memberToForm(m));
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  async function handleSubmit(state: MemberFormState): Promise<boolean> {
    const payload = {
      name: state.name,
      email: state.email || null,
      role: state.role,
      initials: state.initials,
      color: state.color,
      isCurrentUser: state.isCurrentUser,
      affiliation: state.affiliation || null,
      country: state.country || null,
      contribution: state.contribution || null,
      conflictOfInterest: state.conflictOfInterest || null,
    };

    if (dialogMode === "edit" && editingId) {
      const ok = await updateMember(editingId, payload);
      if (ok) toast.success("Team member updated");
      else toast.error("Failed to update member");
      return ok;
    }

    const member = await addMember(payload);
    if (member) toast.success("Team member added");
    else toast.error("Failed to add member");
    return Boolean(member);
  }
  async function confirmDelete() {
    if (!pendingDelete) return;
    setClearing(true);
    const ok = await deleteMember(pendingDelete.id);
    setClearing(false);
    if (ok) toast.success("Team member deleted");
    else toast.error("Failed to delete member");
    setPendingDelete(null);
  }

  return (
    <section className="card-compact p-4 space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="eyebrow">Team management</p>
          <span className="badge-tiny badge-neutral">{members.length}</span>
        </div>
        <button type="button" onClick={openAdd} className="btn-compact btn-primary">
          <Plus size={14} />
          Add member
        </button>
      </header>

      {members.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface px-3 py-8 text-center">
          <Users size={20} className="text-muted-fg mx-auto mb-2" />
          <p className="text-[13px] font-medium">No team members yet</p>
          <p className="text-[12px] text-muted-fg mt-1">
            Add reviewers, methodologists, statisticians, and librarians to attribute
            decisions.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const roleLabel =
              TEAM_ROLES.find((r) => r.value === m.role)?.label ?? m.role;
            return (
              <li
                key={m.id}
                className="card-compact flex items-center gap-3 px-3 py-2.5"
              >
                <span
                  className="flex size-8 items-center justify-center rounded-full text-[10px] font-semibold text-white shrink-0"
                  style={{ backgroundColor: m.color }}
                  aria-hidden
                >
                  {m.initials || deriveInitials(m.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium truncate">{m.name}</span>
                    {m.isCurrentUser && (
                      <span className="badge-tiny badge-teal">
                        <Check size={10} weight="bold" />
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-fg truncate">
                    {roleLabel}
                  </div>
                </div>
                {m.email && (
                  <span className="text-[11px] text-meta truncate hidden md:block">
                    {m.email}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="btn-compact btn-ghost h-7 w-7 p-0"
                      aria-label={`Actions for ${m.name}`}
                    >
                      <SlidersHorizontal size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => openEdit(m)}>
                      <Pencil size={14} />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setPendingDelete(m)}
                    >
                      <Trash size={14} />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <MemberFormDialog
        key={dialogKey}
        open={dialogOpen}
        mode={dialogMode}
        initial={initialForm}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent className="modal-origin sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              Delete team member?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {pendingDelete && (
                <>
                  Permanently remove{" "}
                  <span className="font-medium text-foreground">
                    {pendingDelete.name}
                  </span>
                  ? This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="btn-compact btn-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={clearing}
              className="btn-compact btn-danger"
            >
              <Trash size={14} />
              {clearing ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// ─── Shared loading skeleton (shown when profile hasn't loaded yet) ──────

function ProfileSkeleton() {
  return (
    <section className="card-compact p-4">
      <div className="space-y-3">
        <div className="h-4 w-32 rounded bg-surface-hover animate-pulse" />
        <div className="h-8 w-full rounded bg-surface-hover animate-pulse" />
        <div className="h-8 w-full rounded bg-surface-hover animate-pulse" />
        <div className="h-8 w-full rounded bg-surface-hover animate-pulse" />
      </div>
    </section>
  );
}

// ─── Section: Preferences (review defaults) ──────────────────────────────

function PreferencesSection() {
  const profile = useTeamStore((s) => s.profile);
  const saveProfile = useTeamStore((s) => s.saveProfile);

  if (!profile) return <ProfileSkeleton />;
  async function patch(p: Partial<UserProfile>) {
    const next = { ...profile, ...p };
    const ok = await saveProfile(next);
    if (ok) toast.success("Preferences saved");
    else toast.error("Failed to save preferences");
  }

  return (
    <section className="card-compact p-4">
      <header className="mb-2">
        <p className="eyebrow">Review defaults</p>
        <h3 className="text-lg font-semibold mt-1">Preferences</h3>
        <p className="text-[12px] text-muted-fg mt-1">
          Defaults applied to newly created outcomes. Existing outcomes keep their own settings.
        </p>
      </header>

      <Separator />

      <SettingRow
        label="Effect measure"
        info={{
          title: "Default effect measure",
          what: "The summary statistic RevKit picks when you create a new outcome.",
          why: "Mismatched measures cause wrong pooling — pick the one matching your data type.",
          example: "OR for case-control; RR for cohort; MD for continuous on the same scale.",
        }}
      >
        <PresetSelect
          value={profile.defaultEffectMeasure}
          onValueChange={(v) => patch({ defaultEffectMeasure: v })}
          groups={effectMeasureGroups()}
          placeholder="Pick an effect measure"
          triggerInfo={{
            title: "Effect measure",
            what: "The summary statistic for an outcome.",
            why: "Picks how study results are combined. Mismatched measures cause wrong pooling.",
            example: "OR for case-control; RR for cohort; MD for continuous.",
          }}
        />
      </SettingRow>

      <Separator />

      <SettingRow
        label="Method"
        info={{
          title: "Default pooling method",
          what: "How RevKit combines effect sizes across studies.",
          why: "MH/Peto for dichotomous rare events; IV for continuous or generic; DL for random-effects.",
          example: "MH for RCT dichotomous; IV for continuous; DL when heterogeneity is high.",
        }}
      >
        <PresetSelect
          value={profile.defaultMethod}
          onValueChange={(v) => patch({ defaultMethod: v })}
          groups={methodGroups()}
          placeholder="Pick a pooling method"
          triggerInfo={{
            title: "Pooling method",
            what: "How effect sizes are combined across studies.",
            why: "Use MH/Peto for dichotomous, IV for continuous, DL when I² > 50%.",
          }}
        />
      </SettingRow>

      <Separator />

      <SettingRow
        label="Model"
        info={{
          title: "Pooling model",
          what: "Fixed assumes studies share one true effect.",
          why: "Random allows variation. Use Random if I² > 50%.",
          example: "Fixed for homogeneous RCT pools; Random for diverse designs / populations.",
        }}
      >
        <RadioGroup
          value={profile.defaultModel}
          onValueChange={(v) =>
            patch({ defaultModel: v as UserProfile["defaultModel"] })
          }
          className="grid grid-cols-2 gap-2"
        >
          <RadioChoice
            value="fixed"
            label="Fixed"
            description="One true effect. Use when I² < 50%."
          />
          <RadioChoice
            value="random"
            label="Random"
            description="Allows variation. Use when I² > 50%."
          />
        </RadioGroup>
      </SettingRow>

      <Separator />

      <SettingRow
        label="Confidence level"
        info={{
          title: "Confidence level",
          what: "95% is conventional.",
          why: "Use 99% for very high-stakes (drug safety); 90% for exploratory.",
          example: "Drug safety / mortality → 99%; exploratory → 90%; default → 95%.",
        }}
      >
        <RadioGroup
          value={String(profile.defaultConfidence)}
          onValueChange={(v) =>
            patch({ defaultConfidence: Number(v) as UserProfile["defaultConfidence"] })
          }
          className="grid grid-cols-3 gap-2"
        >
          <RadioChoice value="0.9" label="90%" description="Exploratory" />
          <RadioChoice value="0.95" label="95%" description="Conventional" />
          <RadioChoice value="0.99" label="99%" description="High-stakes" />
        </RadioGroup>
      </SettingRow>

      <Separator />

      <SettingRow
        label="Decimal places"
        info={{
          title: "Decimal places",
          what: "How many decimal places RevKit shows for effect sizes, CIs, p-values.",
          why: "2 is conventional for effect sizes; 3-4 for p-values.",
          example: "OR 0.78; p = 0.031; I² = 47%.",
        }}
      >
        <RadioGroup
          value={String(profile.decimalPlaces)}
          onValueChange={(v) =>
            patch({ decimalPlaces: Number(v) as UserProfile["decimalPlaces"] })
          }
          className="grid grid-cols-4 gap-2"
        >
          <RadioChoice value="1" label="1" description="Coarse" />
          <RadioChoice value="2" label="2" description="Default" />
          <RadioChoice value="3" label="3" description="P-values" />
          <RadioChoice value="4" label="4" description="Precise" />
        </RadioGroup>
      </SettingRow>
    </section>
  );
}

// ─── Section: Display ───────────────────────────────────────────────────

function DisplaySection() {
  const profile = useTeamStore((s) => s.profile);
  const saveProfile = useTeamStore((s) => s.saveProfile);

  // Defensive guard: if profile is null (e.g. API hasn't responded yet or
  // returned an unexpected shape), show a loading skeleton instead of crashing.
  if (!profile) {
    return (
      <section className="card-compact p-4">
        <div className="space-y-3">
          <div className="h-4 w-24 rounded bg-surface-hover animate-pulse" />
          <div className="h-8 w-full rounded bg-surface-hover animate-pulse" />
          <div className="h-8 w-full rounded bg-surface-hover animate-pulse" />
        </div>
      </section>
    );
  }

  async function patch(p: Partial<UserProfile>) {
    const next = { ...profile, ...p };
    const ok = await saveProfile(next);
    if (ok) toast.success("Display preferences saved");
    else toast.error("Failed to save display preferences");
  }

  return (
    <section className="card-compact p-4">
      <header className="mb-2">
        <p className="eyebrow">Appearance</p>
        <h3 className="text-lg font-semibold mt-1">Display</h3>
        <p className="text-[12px] text-muted-fg mt-1">
          Density, font scale, motion, and theme.
        </p>
      </header>

      <Separator />

      <SettingRow
        label="Density"
        info={{
          title: "UI density",
          what: "How tightly spaced the UI is.",
          why: "Compact = more data per screen. Dense = max data. Default = balanced.",
          example: "Compact recommended for laptops; Dense for very large reviews.",
        }}
      >
        <RadioGroup
          value={profile.density}
          onValueChange={(v) =>
            patch({ density: v as UserProfile["density"] })
          }
          className="grid grid-cols-3 gap-2"
        >
          <RadioChoice
            value="compact"
            label="Compact"
            description="Recommended"
          />
          <RadioChoice value="default" label="Default" description="Balanced" />
          <RadioChoice value="dense" label="Dense" description="Max data" />
        </RadioGroup>
      </SettingRow>

      <Separator />

      <SettingRow
        label="Font scale"
        info={{
          title: "Font scale",
          what: "Overall UI font size multiplier.",
          why: "Small for data-dense tables; medium default; large for accessibility.",
          example: "Small = 12px, Medium = 13px, Large = 14-16px.",
        }}
      >
        <RadioGroup
          value={profile.fontScale}
          onValueChange={(v) =>
            patch({ fontScale: v as UserProfile["fontScale"] })
          }
          className="grid grid-cols-3 gap-2"
        >
          <RadioChoice value="small" label="Small" description="12px" />
          <RadioChoice value="medium" label="Medium" description="13px" />
          <RadioChoice value="large" label="Large" description="14-16px" />
        </RadioGroup>
      </SettingRow>

      <Separator />

      <SettingRow
        label="Reduce motion"
        info={{
          title: "Reduce motion",
          what: "Replaces slides/springs with cross-fades.",
          why: "Follows prefers-reduced-motion.",
          example: "Helps vestibular sensitivity and battery life.",
        }}
      >
        <div className="flex items-center gap-2">
          <Switch
            checked={profile.reduceMotion}
            onCheckedChange={(v) => patch({ reduceMotion: v })}
          />
          <span className="text-[12px] text-muted-fg">
            {profile.reduceMotion ? "On" : "Off"}
          </span>
        </div>
      </SettingRow>

      <Separator />

      <SettingRow
        label="Theme"
        info={{
          title: "Theme",
          what: "Light, Dark, or follow your OS setting.",
          why: "Dark is default and recommended for prolonged review work.",
        }}
      >
        <ThemeToggle />
      </SettingRow>
    </section>
  );
}

// ─── Section: Tooltips ───────────────────────────────────────────────────

function TooltipsSection() {
  const profile = useTeamStore((s) => s.profile);
  const saveProfile = useTeamStore((s) => s.saveProfile);

  if (!profile) return <ProfileSkeleton />;
  async function patch(p: Partial<UserProfile>) {
    const next = { ...profile, ...p };
    const ok = await saveProfile(next);
    if (ok) toast.success("Tooltip preferences saved");
    else toast.error("Failed to save tooltip preferences");
  }

  return (
    <section className="card-compact p-4">
      <header className="mb-2">
        <p className="eyebrow">Contextual help</p>
        <h3 className="text-lg font-semibold mt-1">Tooltips</h3>
        <p className="text-[12px] text-muted-fg mt-1">
          The little ? icons next to fields. Hide them or simplify them if they get noisy.
        </p>
      </header>

      <Separator />

      <SettingRow
        label="Tooltips enabled"
        info={{
          title: "Tooltips enabled",
          what: "When off, the ? icons are hidden.",
          why: "Re-enable any time.",
          example: "Turn off once you're fluent in the tool; back on if you forget a formula.",
        }}
      >
        <div className="flex items-center gap-2">
          <Switch
            checked={profile.tooltipsEnabled}
            onCheckedChange={(v) => patch({ tooltipsEnabled: v })}
          />
          <span className="text-[12px] text-muted-fg">
            {profile.tooltipsEnabled ? "On" : "Off"}
          </span>
        </div>
      </SettingRow>

      <Separator />

      <SettingRow
        label="Tooltip density"
        info={{
          title: "Tooltip density",
          what: "Detailed shows the full What/Why/Formula/Example.",
          why: "Minimal shows just the formula or example.",
          example: "Detailed for learning; Minimal once you know the basics.",
        }}
      >
        <RadioGroup
          value={profile.tooltipsDensity}
          onValueChange={(v) =>
            patch({ tooltipsDensity: v as UserProfile["tooltipsDensity"] })
          }
          className="grid grid-cols-2 gap-2"
        >
          <RadioChoice
            value="minimal"
            label="Minimal"
            description="Formula / example only"
          />
          <RadioChoice
            value="detailed"
            label="Detailed"
            description="What / Why / Formula / Example"
          />
        </RadioGroup>
      </SettingRow>
    </section>
  );
}

// ─── Section: Backups ────────────────────────────────────────────────────

function BackupsSection() {
  const profile = useTeamStore((s) => s.profile);
  const saveProfile = useTeamStore((s) => s.saveProfile);

  // Hooks MUST be called before any early return (React rules-of-hooks).
  const [recentCount, setRecentCount] = useState<number>(() =>
    typeof window === "undefined" ? 0 : loadRecentFiles().length,
  );
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setRecentCount(loadRecentFiles().length);
  }, []);

  // Now safe to return early if profile hasn't loaded.
  if (!profile) return <ProfileSkeleton />;

  async function patch(p: Partial<UserProfile>) {
    const next = { ...profile, ...p };
    const ok = await saveProfile(next);
    if (ok) toast.success("Backup preferences saved");
    else toast.error("Failed to save backup preferences");
  }

  async function clearRecentFiles() {
    setClearing(true);
    try {
      const all = loadRecentFiles();
      for (const r of all) removeRecentFile(r.id);
      setRecentCount(0);
      toast.success("Recent files cleared");
    } catch (e) {
      toast.error("Failed to clear recent files", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  return (
    <section className="card-compact p-4 space-y-1">
      <header className="mb-2">
        <p className="eyebrow">Local data</p>
        <h3 className="text-lg font-semibold mt-1">Backups</h3>
        <p className="text-[12px] text-muted-fg mt-1">
          Reviews live on the server (SQLite). Auto-save + recent-file list live in your browser.
        </p>
      </header>

      <Separator />

      <SettingRow
        label="Auto-backup interval"
        info={{
          title: "Auto-backup interval",
          what: "Reviews are auto-saved this often when changes are detected.",
          why: "Manual save (Ctrl/Cmd+S) is always available.",
          example: "15 minutes is the recommended default.",
        }}
      >
        <PresetSelect
          value={String(profile.autoBackupMinutes)}
          onValueChange={(v) =>
            patch({ autoBackupMinutes: Number(v) as UserProfile["autoBackupMinutes"] })
          }
          groups={autoBackupGroups()}
          placeholder="Pick an interval"
        />
      </SettingRow>

      <Separator />

      <SettingRow
        label="Max recent files"
        info={{
          title: "Max recent files",
          what: "How many recent files to remember in the welcome screen.",
          why: "Higher = deeper history; lower = less memory.",
          example: "20 is the default.",
        }}
      >
        <PresetSelect
          value={String(profile.maxRecentFiles)}
          onValueChange={(v) =>
            patch({ maxRecentFiles: Number(v) as UserProfile["maxRecentFiles"] })
          }
          groups={maxRecentGroups()}
          placeholder="Pick a max"
        />
      </SettingRow>

      <Separator />

      <SettingRow
        label="Clear recent files"
        info={{
          title: "Clear recent files",
          what: "Wipes the recent-files list from your browser localStorage.",
          why: "Saved reviews on the server are not affected.",
          example: "Useful when sharing this browser between reviewers.",
        }}
      >
        <div className="space-y-2">
          <div className="text-[12px] text-muted-fg">
            {recentCount} entr{recentCount === 1 ? "y" : "ies"} in localStorage
          </div>
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={clearing || recentCount === 0}
            className="btn-compact btn-danger"
          >
            <Trash size={14} />
            Clear all recent files
          </button>
        </div>
      </SettingRow>

      <AlertDialog
        open={confirmClear}
        onOpenChange={(o) => !o && setConfirmClear(false)}
      >
        <AlertDialogContent className="modal-origin sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              Clear all recent files?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This removes {recentCount} entr{recentCount === 1 ? "y" : "ies"} from your
              browser&apos;s recent-files list. Saved reviews on the server are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="btn-compact btn-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={clearRecentFiles}
              disabled={clearing}
              className="btn-compact btn-danger"
            >
              <Trash size={14} />
              {clearing ? "Clearing…" : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// ─── Section: About ──────────────────────────────────────────────────────

const ABOUT_LINKS: { label: string; href: string; description: string }[] = [
  {
    label: "GitHub",
    href: "https://github.com",
    description: "Source code, issues, and releases.",
  },
  {
    label: "Cochrane Handbook",
    href: "https://training.cochrane.org/handbook",
    description: "Reference for systematic review methods.",
  },
  {
    label: "Documentation",
    href: "https://github.com",
    description: "How-tos, tutorials, and API reference.",
  },
];

function AboutSection() {
  const profile = useTeamStore((s) => s.profile);
  const saveProfile = useTeamStore((s) => s.saveProfile);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // About section can render without profile (it only uses profile for the
  // "reset preferences" button + a small status line). Guard the parts that
  // touch profile.

  async function resetPreferences() {
    setResetting(true);
    const ok = await saveProfile({ ...DEFAULT_PROFILE });
    setResetting(false);
    setConfirmReset(false);
    if (ok) toast.success("Preferences reset to defaults");
    else toast.error("Failed to reset preferences");
  }

  const facts: { label: string; value: string }[] = [
    { label: "App version", value: "0.2.0" },
    { label: "File format", value: "revkit-1 (v1.0.0)" },
    { label: "License", value: "MIT" },
    {
      label: "Built with",
      value: "Next.js 16 · Prisma 6 · Tailwind 4 · Phosphor Icons · Inter / JetBrains Mono",
    },
  ];

  return (
    <section className="card-compact p-4 space-y-4">
      <header>
        <p className="eyebrow">About this build</p>
        <h3 className="text-lg font-semibold mt-1">About</h3>
      </header>

      <dl className="grid sm:grid-cols-2 gap-3">
        {facts.map((f) => (
          <div
            key={f.label}
            className="rounded-md border border-border bg-surface px-3 py-2"
          >
            <dt className="eyebrow">{f.label}</dt>
            <dd className="text-[13px] font-medium text-fg-2 mt-1">{f.value}</dd>
          </div>
        ))}
      </dl>

      <Separator />

      <div>
        <p className="eyebrow mb-2">Links</p>
        <ul className="grid sm:grid-cols-3 gap-2">
          {ABOUT_LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md border border-border bg-surface px-3 py-2 hover:bg-surface-hover transition-colors"
              >
                <div className="text-[13px] font-medium text-accent">{link.label}</div>
                <div className="text-[11px] text-muted-fg mt-0.5">
                  {link.description}
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[12px] text-muted-fg">
          Reset all preferences back to RevKit defaults. Reviews on the server are not affected.
        </div>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="btn-compact btn-danger"
        >
          <Trash size={14} />
          Reset all preferences
        </button>
      </div>

      <AlertDialog
        open={confirmReset}
        onOpenChange={(o) => !o && setConfirmReset(false)}
      >
        <AlertDialogContent className="modal-origin sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              Reset all preferences?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This restores the default effect measure, method, model, confidence level,
              decimal places, density, font scale, tooltip settings, and backup intervals.
              Your team and reviews are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="btn-compact btn-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={resetPreferences}
              disabled={resetting}
              className="btn-compact btn-danger"
            >
              <Check size={14} />
              {resetting ? "Resetting…" : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {profile && (
        <p className="text-[11px] text-meta">
          Current profile snapshot: density={" "}
          <span className="font-mono">{profile.density}</span> · model={" "}
          <span className="font-mono">{profile.defaultModel}</span> · CI={" "}
          <span className="font-mono">{profile.defaultConfidence}</span> · decimals={" "}
          <span className="font-mono">{profile.decimalPlaces}</span>
        </p>
      )}
    </section>
  );
}

// ─── Main SettingsPage ──────────────────────────────────────────────────

export function SettingsPage() {
  const [active, setActive] = useState<SettingsTab>("profile");
  const loading = useTeamStore((s) => s.loading);
  const setMembers = useTeamStore((s) => s.setMembers);
  const setProfile = useTeamStore((s) => s.setProfile);
  const setLoading = useTeamStore((s) => s.setLoading);
  const setReviewScope = useTeamStore((s) => s.setReviewScope);
  const review = useReviewStore((s) => s.review);
  const setProtocolTeamMembers = useReviewStore((s) => s.setProtocolTeamMembers);
  const setProtocolTeamProfile = useReviewStore((s) => s.setProtocolTeamProfile);

  // Load team + profile from the active review, or from app-wide defaults on the welcome screen.
  useEffect(() => {
    if (review) {
      const team = review.protocol?.team;
      const members = team?.members ?? [];
      const profile = team?.profile ?? DEFAULT_PROFILE;
      setReviewScope({ members, saveMembers: setProtocolTeamMembers, saveProfile: setProtocolTeamProfile });
      setMembers(members);
      setProfile(profile);
      setLoading(false);
      return;
    }

    setReviewScope(null);
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    Promise.all([
      fetch("/api/team", { signal: ctrl.signal }).then((r) => r.json() as Promise<{ members: TeamMember[] }>),
      fetch("/api/team/profile", { signal: ctrl.signal }).then((r) => r.json() as Promise<{ profile: UserProfile }>),
    ])
      .then(([teamData, profileData]) => {
        if (cancelled) return;
        if (teamData?.members) setMembers(teamData.members);
        if (profileData?.profile) setProfile(profileData.profile);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || cancelled) return;
        console.error("[SettingsPage] failed to load", err);
        setLoading(false);
        toast.error("Failed to load settings", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [review, setMembers, setProfile, setLoading, setReviewScope, setProtocolTeamMembers, setProtocolTeamProfile]);

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">RevKit</p>
          <h2 className="text-xl font-semibold tracking-display mt-1">Settings</h2>
          <p className="text-[12px] text-muted-fg mt-1">
            Reviewer identity, team, defaults, display, tooltips, backups, and about.
          </p>
        </div>
        {review && (
          <span className="badge-tiny badge-teal">
            <Check size={10} />
            This review only
          </span>
        )}
        {loading && (
          <span className="badge-tiny badge-neutral">
            <Database size={10} />
            Loading…
          </span>
        )}
      </header>

      <Tabs value={active} onValueChange={(v) => setActive(v as SettingsTab)}>
        {/* Scrollable horizontal tab list — wraps to scroll on small screens */}
        <TabsList className="bg-transparent h-auto p-0 flex w-full overflow-x-auto scrollbar-thin rounded-none border-b border-border justify-start">
          {TABS.map((t) => {
            const isActive = active === t.id;
            const Icon = t.icon;
            return (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="btn-compact btn-ghost shrink-0 rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-accent data-[state=active]:shadow-none"
              >
                <Icon size={14} weight={isActive ? "fill" : "regular"} />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="profile" className="mt-3 enter-pop">
          <ProfileSection />
        </TabsContent>
        <TabsContent value="team" className="mt-3 enter-pop">
          <TeamSection />
        </TabsContent>
        <TabsContent value="preferences" className="mt-3 enter-pop">
          <PreferencesSection />
        </TabsContent>
        <TabsContent value="display" className="mt-3 enter-pop">
          <DisplaySection />
        </TabsContent>
        <TabsContent value="tooltips" className="mt-3 enter-pop">
          <TooltipsSection />
        </TabsContent>
        <TabsContent value="backups" className="mt-3 enter-pop">
          <BackupsSection />
        </TabsContent>
        <TabsContent value="about" className="mt-3 enter-pop">
          <AboutSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
