"use client";

// src/components/revkit/new-review-wizard.tsx
//
// 4-step wizard with structured PICO title builder.
//
// Steps:
//   1. Choose review type (5 Cochrane types)
//   2. Sub-type (optional — Prognosis/Etiology/Qualitative)
//   3. PICO title — structured format picker + autocomplete fields + live preview
//   4. Confirm + auto-composed research question
//
// Inspired by:
//   • Legacy Cochrane RevMan 5 wizard (4 title-format options with conjunctions)
//   • Rayyan (autocomplete everywhere, keyboard-friendly, reduce typing)
//   • Cochrane PICO framework (Population/Intervention/Comparator/Outcome)

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InfoTooltip } from "@/components/revkit/info-tooltip";
import { PicoTitleBuilder } from "@/components/revkit/pico-title-builder";
import {
  defaultFormatForType,
  formatsForType,
  SAMPLE_PICO,
} from "@/lib/pico/presets";
import {
  REVIEW_TYPES,
  REVIEW_SUBTYPES,
  type ReviewType,
  type ReviewSubType,
} from "@/lib/types";
import {
  Pulse,
  Microscope,
  Flask,
  Stack,
  Gear,
  CaretLeft,
  CaretRight,
  Check,
  X,
} from "@phosphor-icons/react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    type: ReviewType;
    subType: ReviewSubType;
    researchQuestion: string;
  }) => void;
}

// Phosphor icon mapping (the installed v2.1.10 uses these names).
const TYPE_ICONS: Record<ReviewType, React.ElementType> = {
  INTERVENTION: Pulse,
  DTA: Microscope,
  METHODOLOGY: Flask,
  OVERVIEW: Stack,
  FLEXIBLE: Gear,
};

const STEP_EYEBROWS = [
  "STEP 1 OF 4 · CHOOSE TYPE",
  "STEP 2 OF 4 · SUB-TYPE",
  "STEP 3 OF 4 · PICO TITLE",
  "STEP 4 OF 4 · CONFIRM",
];
const STEP_LABELS = [
  "Choose review type",
  "Sub-type (optional)",
  "Build the review title",
  "Confirm and create",
];
// Apple-style ease (Emil Kowalski's --ease-out value).
const EMIL_EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

export function NewReviewWizard({ open, onClose, onCreate }: Props) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ReviewType | null>(null);
  const [subType, setSubType] = useState<ReviewSubType>(null);
  // PICO title state — format id + structured field values.
  const [formatId, setFormatId] = useState<string>("");
  const [picoValues, setPicoValues] = useState<Record<string, string>>({});
  // Research question — auto-composed from PICO, editable.
  const [rq, setRq] = useState("");

  // Reset state when the wizard closes.
  useEffect(() => {
    if (!open) {
      setStep(0);
      setType(null);
      setSubType(null);
      setFormatId("");
      setPicoValues({});
      setRq("");
    }
  }, [open]);

  // When the user picks a review type, set the default PICO format + seed sample values.
  useEffect(() => {
    if (!type) return;
    const defaultFormat = defaultFormatForType(type);
    setFormatId(defaultFormat.id);
    // Pre-fill with sample values so the preview shows a realistic title immediately.
    const sample = SAMPLE_PICO[type] ?? {};
    const seeded: Record<string, string> = {};
    for (const f of defaultFormat.fields) {
      seeded[f.key] = sample[f.key] ?? "";
    }
    setPicoValues(seeded);
    // Reset the research question — it'll be auto-composed on step 3.
    setRq("");
  }, [type]);

  function next() {
    setStep((s) => Math.min(s + 1, 3));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // Resolve the composed title from the active format + values.
  function composedTitle(): string {
    if (!type) return "";
    const formats = formatsForType(type);
    const active = formats.find((f) => f.id === formatId) ?? formats[0];
    if (!active) return "";
    return active.compose(picoValues).trim();
  }

  // Auto-compose a draft research question from the PICO fields.
  function autoComposeRq(): string {
    if (!type) return "";
    const sample = SAMPLE_PICO[type] ?? {};
    const v = { ...sample, ...picoValues };
    if (type === "DTA") {
      const test = v.test || "the index test";
      const condition = v.condition || "the condition";
      return `How accurate is ${test} for diagnosing ${condition}?`;
    }
    if (type === "METHODOLOGY") {
      return `What is the methodological quality of ${v.topic || "the topic"}?`;
    }
    if (type === "OVERVIEW") {
      return `What do existing systematic reviews conclude about ${v.topic || "the topic"}?`;
    }
    if (type === "INTERVENTION" || type === "FLEXIBLE") {
      const intervention = v.intervention || v.intervention1 || "the intervention";
      const comparator = v.intervention2 || "placebo";
      const condition = v.condition || "the condition";
      const population = v.population || "adults";
      return `In ${population} with ${condition}, does ${intervention} compared to ${comparator} improve outcomes?`;
    }
    return "";
  }

  function finish() {
    if (!type) return;
    const title = composedTitle();
    if (!title) return;
    // If the user hasn't edited rq, use the auto-composed draft.
    const finalRq = rq.trim() || autoComposeRq();
    onCreate({
      title,
      type,
      subType,
      researchQuestion: finalRq,
    });
  }

  // Validity per step — used to enable/disable Next.
  const stepValid: boolean[] = [
    Boolean(type), // Step 0: type picked
    true, // Step 1: sub-type always optional
    composedTitle().length > 0, // Step 2: title composed
    true, // Step 3: confirm
  ];

  const progressPct = ((step + 1) / 4) * 100;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="modal-origin max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin rounded-[10px] border border-border bg-background p-6">
        <DialogHeader className="space-y-1">
          <span className="eyebrow">{STEP_EYEBROWS[step]}</span>
          <DialogTitle className="text-xl font-display font-semibold tracking-display">
            {STEP_LABELS[step]}
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="h-0.5 rounded-full bg-surface-hover overflow-hidden">
          <motion.div
            className="h-full bg-accent"
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.22, ease: EMIL_EASE }}
          />
        </div>

        {/* Step content */}
        <div className="min-h-[280px] max-h-[55vh] overflow-y-auto pr-1 -mr-1 scrollbar-thin">
          <AnimatePresence mode="wait">
            {/* ─── Step 1: Choose review type ─────────────────────────────── */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22, ease: EMIL_EASE }}
                className="space-y-2"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">Which type of review?</span>
                  <InfoTooltip
                    title="Review type"
                    what="Pick the Cochrane review type. Determines available RoB tools, default effect measures, and analysis methods."
                    why="Type locks in defaults that match Cochrane Handbook conventions."
                    example="Intervention → RoB 2 + MH/OR; DTA → QUADAS-2 + logit pooling"
                    side="right"
                  />
                </div>
                <RadioGroup
                  value={type ?? ""}
                  onValueChange={(v) => setType(v as ReviewType)}
                  className="grid gap-1.5"
                >
                  {REVIEW_TYPES.map((t) => {
                    const Icon = TYPE_ICONS[t.value];
                    const checked = type === t.value;
                    return (
                      <label
                        key={t.value}
                        className={`cursor-pointer rounded-[8px] border p-2.5 transition-all ${
                          checked
                            ? "border-accent bg-accent-subtle"
                            : "border-border hover:border-muted-fg hover:bg-surface-hover"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <RadioGroupItem value={t.value} className="mt-0.5 sr-only" tabIndex={-1} />
                          <div
                            className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                              checked ? "bg-accent-subtle text-accent" : "bg-surface-hover text-fg-2"
                            }`}
                          >
                            <Icon size={16} weight="duotone" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="text-[13px] font-medium leading-tight">{t.label}</div>
                            <p className="text-[11px] text-muted-fg leading-snug">{t.description}</p>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {t.usesRob2 && <span className="badge-tiny badge-neutral">RoB 2</span>}
                              {t.usesRobinsI && <span className="badge-tiny badge-neutral">ROBINS-I</span>}
                              {t.usesQuadas2 && <span className="badge-tiny badge-neutral">QUADAS-2</span>}
                              {t.usesDta && <span className="badge-tiny badge-neutral">DTA</span>}
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </motion.div>
            )}

            {/* ─── Step 2: Sub-type (optional) ────────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22, ease: EMIL_EASE }}
                className="space-y-3"
              >
                <div className="flex items-center gap-1.5">
                  <label className="text-sm font-medium">Sub-type (optional)</label>
                  <InfoTooltip
                    title="Sub-type"
                    what="Sub-types are tags that affect suggested fields."
                    why="Prognosis, Etiology, and Qualitative reviews have different defaults."
                    example="Pick None if unsure — you can change later."
                    side="right"
                  />
                </div>
                <Select
                  value={subType ?? "none"}
                  onValueChange={(v) =>
                    setSubType(v === "none" ? null : (v as ReviewSubType))
                  }
                >
                  <SelectTrigger className="input-compact h-8 w-full justify-between font-normal">
                    <SelectValue placeholder="None (default)" />
                  </SelectTrigger>
                  <SelectContent className="popover-origin">
                    <SelectItem value="none">None (default)</SelectItem>
                    {REVIEW_SUBTYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-fg">
                  Sub-types are tags that affect suggested fields. You can change later.
                </p>
              </motion.div>
            )}

            {/* ─── Step 3: PICO title + research question ─────────────────── */}
            {step === 2 && type && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22, ease: EMIL_EASE }}
                className="space-y-4"
              >
                <PicoTitleBuilder
                  reviewType={type}
                  formatId={formatId}
                  onFormatChange={setFormatId}
                  values={picoValues}
                  onValuesChange={setPicoValues}
                />

                {/* Research question — auto-composed draft, editable */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="rev-rq" className="text-sm font-medium">
                      Research question
                    </label>
                    <InfoTooltip
                      title="Research question"
                      what="Auto-composed from your PICO fields. Edit if needed."
                      why="A clear PICO question guides the comparison and outcome structure."
                      formula="P + I + C + O"
                      example="In adults with prior MI [P], does aspirin [I] vs placebo [C] reduce all-cause mortality [O]?"
                      side="right"
                    />
                  </div>
                  <Textarea
                    id="rev-rq"
                    value={rq}
                    onChange={(e) => setRq(e.target.value)}
                    onFocus={() => {
                      if (!rq.trim()) setRq(autoComposeRq());
                    }}
                    placeholder={autoComposeRq() || "Type or edit the research question…"}
                    rows={2}
                    className="input-compact min-h-[60px] resize-y text-[13px]"
                  />
                  <p className="text-[11px] text-muted-fg">
                    <span className="text-accent">P</span>opulation ·{" "}
                    <span className="text-accent">I</span>ntervention ·{" "}
                    <span className="text-accent">C</span>omparator ·{" "}
                    <span className="text-accent">O</span>utcome — auto-drafted, edit freely.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ─── Step 4: Confirm ────────────────────────────────────────── */}
            {step === 3 && type && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22, ease: EMIL_EASE }}
                className="space-y-3"
              >
                <div className="card-compact p-3 space-y-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="eyebrow shrink-0">Type</span>
                    <span className="text-[13px] font-medium text-right">
                      {REVIEW_TYPES.find((t) => t.value === type)?.label}
                    </span>
                  </div>
                  <div className="h-px bg-border-soft" />
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="eyebrow shrink-0">Sub-type</span>
                    <span className="text-[13px] text-right">
                      {subType
                        ? REVIEW_SUBTYPES.find((s) => s.value === subType)?.label
                        : "None"}
                    </span>
                  </div>
                  <div className="h-px bg-border-soft" />
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="eyebrow shrink-0">Title</span>
                    <span className="text-[13px] font-medium text-right">
                      {composedTitle() || "(no title)"}
                    </span>
                  </div>
                  <div className="h-px bg-border-soft" />
                  <div className="flex items-start justify-between gap-3">
                    <span className="eyebrow shrink-0 mt-0.5">Question</span>
                    <span className="text-[11px] text-right italic">
                      {rq || autoComposeRq()}
                    </span>
                  </div>
                </div>
                <div className="rounded-md bg-surface p-2 text-[11px] text-muted-fg">
                  <span className="text-accent font-medium">Defaults:</span> OR · MH ·
                  fixed-effect · 95% CI · 2 decimal places. Change later in
                  Settings → Preferences.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer — buttons */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border-soft">
          <Button
            variant="ghost"
            onClick={onClose}
            className="btn-compact btn-ghost h-8 text-[12px]"
          >
            <X size={14} />
            <span className="hidden sm:inline">Cancel</span>
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={back}
                className="btn-compact btn-secondary h-8 px-3 text-[12px]"
              >
                <CaretLeft size={14} />
                Back
              </Button>
            )}
            {step < 3 && (
              <Button
                onClick={next}
                disabled={!stepValid[step]}
                className="btn-compact btn-primary h-8 px-3 text-[12px]"
              >
                Next
                <CaretRight size={14} />
              </Button>
            )}
            {step === 3 && (
              <Button
                onClick={finish}
                disabled={!composedTitle()}
                className="btn-compact btn-primary h-8 px-3 text-[12px]"
              >
                <Check size={14} />
                Create review
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
