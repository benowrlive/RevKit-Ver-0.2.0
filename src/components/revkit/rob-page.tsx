// src/components/revkit/rob-page.tsx
//
// Risk-of-Bias page. Renders the per-study assessment list, the RoB
// signalling-question editor (RoB 2 / ROBINS-I / QUADAS-2), a traffic-light
// plot and a summary bar chart.
//
// All mutations go through the Zustand store. The RoB algorithm + tool
// definitions live in `src/lib/rob/config.ts`.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  HelpCircle,
  Ban,
  ChevronDown,
  ClipboardList,
  FileText,
} from "lucide-react";

import { useReviewStore } from "@/lib/project/state";
import { Quadas3WorkspacePanel } from "@/components/revkit/quadas3-workspace";
import type {
  RobAssessment,
  RobJudgement,
  RobTool,
  ReviewType,
  Study,
} from "@/lib/types";
import {
  ROB_TOOLS,
  computeDomainJudgement,
  type RobAnswer,
  type RobToolDef,
} from "@/lib/rob/config";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Constants & helpers
// -----------------------------------------------------------------------------

type StudyFilter = "all" | "assessed" | "unassessed";

const STUDY_FILTER_OPTIONS: { value: StudyFilter; label: string }[] = [
  { value: "all", label: "All studies" },
  { value: "assessed", label: "Studies with assessments" },
  { value: "unassessed", label: "Studies without assessments" },
];

const ANSWER_OPTIONS: { value: RobAnswer; label: string; short: string; Icon: React.ElementType }[] = [
  { value: "yes", label: "Yes", short: "Y", Icon: Check },
  { value: "py", label: "Probably Yes", short: "PY", Icon: Check },
  { value: "pn", label: "Probably No", short: "PN", Icon: X },
  { value: "no", label: "No", short: "N", Icon: X },
  { value: "ni", label: "No Info", short: "NI", Icon: HelpCircle },
  { value: "na", label: "N/A", short: "NA", Icon: Ban },
];

const TOOL_SHORT_NAME: Record<RobTool, string> = {
  ROB2: "RoB 2",
  ROBINS_I: "ROBINS-I",
  QUADAS_2: "QUADAS-2",
};

const TOOL_BADGE_CLASS: Record<RobTool, string> = {
  ROB2: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200 border-sky-200 dark:border-sky-900",
  ROBINS_I:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200 border-violet-200 dark:border-violet-900",
  QUADAS_2:
    "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 border-teal-200 dark:border-teal-900",
};

/** Bucket every judgement into one of 4 visual categories (used by summary bar). */
type JudgementBucket = "low" | "mid" | "high" | "unclear";

const BUCKET_META: Record<JudgementBucket, { color: string; label: string }> = {
  low: { color: "#22c55e", label: "Low" },
  mid: { color: "#f59e0b", label: "Some concerns / Moderate / Serious" },
  high: { color: "#ef4444", label: "High / Critical" },
  unclear: { color: "#94a3b8", label: "Unclear / No info" },
};

function bucket(j: RobJudgement): JudgementBucket {
  switch (j) {
    case "low":
      return "low";
    case "moderate":
    case "some_concerns":
    case "serious":
      return "mid";
    case "high":
    case "critical":
      return "high";
    case "unclear":
    case "no_information":
      return "unclear";
  }
}

/** Tools applicable to a review type, in display order. */
function applicableTools(reviewType: ReviewType): RobToolDef[] {
  return Object.values(ROB_TOOLS).filter((t) => t.appliesToReviewTypes.includes(reviewType));
}

/** Lookup judgement option by value, falling back to a gray pill. */
function judgementOption(
  tool: RobToolDef,
  j: RobJudgement
): { label: string; color: string } {
  return tool.judgementOptions.find((o) => o.value === j) ?? { label: j.replace(/_/g, " "), color: "#94a3b8" };
}

function shortToolName(toolId: RobTool): string {
  return TOOL_SHORT_NAME[toolId];
}

// -----------------------------------------------------------------------------
// Pill components
// -----------------------------------------------------------------------------

function JudgementPill({
  tool,
  judgement,
  size = "sm",
}: {
  tool: RobToolDef;
  judgement: RobJudgement;
  size?: "sm" | "md";
}) {
  const opt = judgementOption(tool, judgement);
  const sizeCls = size === "md" ? "text-xs px-2 py-0.5" : "text-[10px] px-1.5 py-0";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        sizeCls
      )}
      style={{
        backgroundColor: `${opt.color}22`,
        color: opt.color,
        borderColor: `${opt.color}66`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: opt.color }}
        aria-hidden
      />
      {opt.label}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Answer picker (segmented control)
// -----------------------------------------------------------------------------

function AnswerPicker({
  value,
  onChange,
}: {
  value: RobAnswer | undefined;
  onChange: (v: RobAnswer) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {ANSWER_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        const Icon = opt.Icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
              isActive
                ? "border-teal-500 bg-teal-50 text-teal-900 dark:bg-teal-950/60 dark:text-teal-100 font-medium"
                : "border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// RoB editor dialog
// -----------------------------------------------------------------------------

interface EditorState {
  studyId: string;
  tool: RobTool;
  assessmentId?: string;
  targetDomainId?: string;
}

function RobEditorDialog({
  state,
  onClose,
}: {
  state: EditorState | null;
  onClose: () => void;
}) {
  const review = useReviewStore((s) => s.review);
  const open = state !== null;

  const studyId = state?.studyId;
  const assessmentId = state?.assessmentId;
  const study = studyId
    ? review?.studies.find((s) => s.id === studyId) ?? null
    : null;
  const existing = assessmentId
    ? review?.robAssessments.find((a) => a.id === assessmentId) ?? null
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden p-0 flex flex-col gap-0">
        {study && state ? (
          <RobEditorForm
            key={`${state.studyId}-${state.tool}-${state.assessmentId ?? "new"}`}
            study={study}
            tool={state.tool}
            existing={existing}
            targetDomainId={state.targetDomainId}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RobEditorForm({
  study,
  tool,
  existing,
  targetDomainId,
  onClose,
}: {
  study: Study;
  tool: RobTool;
  existing: RobAssessment | null;
  targetDomainId?: string;
  onClose: () => void;
}) {
  const upsertRobAssessment = useReviewStore((s) => s.upsertRobAssessment);
  const toolDef = ROB_TOOLS[tool];

  // Lazy initial state — re-initialised by the parent's `key` prop whenever
  // (study, tool, assessmentId) changes. Avoids setState-in-effect.
  const [answers, setAnswers] = useState<Record<string, RobAnswer>>(
    () => existing?.signallingAnswers ?? {}
  );
  const [overrideEnabled, setOverrideEnabled] = useState<boolean>(() => {
    if (!existing?.overallJudgement) return false;
    return toolDef.algorithm(existing.signallingAnswers) !== existing.overallJudgement;
  });
  const [overrideJudgement, setOverrideJudgement] = useState<RobJudgement | null>(
    () => existing?.overallJudgement ?? null
  );
  const [overrideReason, setOverrideReason] = useState("");
  const domainRefs = useRef<Record<string, HTMLElement | null>>({});

  // Scroll to a target domain on mount (cell-click navigation).
  useEffect(() => {
    if (!targetDomainId) return;
    const id = targetDomainId;
    const raf = requestAnimationFrame(() => {
      const el = domainRefs.current[id];
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [targetDomainId]);

  const domainJudgements = useMemo(() => {
    const out: Record<string, RobJudgement> = {};
    for (const d of toolDef.domains) {
      out[d.id] = computeDomainJudgement(tool, d, answers);
    }
    return out;
  }, [answers, toolDef, tool]);

  const algorithmOverall = useMemo(
    () => toolDef.algorithm(answers),
    [answers, toolDef]
  );

  const overallJudgement: RobJudgement =
    overrideEnabled && overrideJudgement ? overrideJudgement : algorithmOverall;

  function setAnswer(qId: string, v: RobAnswer) {
    setAnswers((a) => ({ ...a, [qId]: v }));
  }

  function scrollToDomain(domainId: string) {
    const el = domainRefs.current[domainId];
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSave() {
    upsertRobAssessment({
      id: existing?.id,
      studyId: study.id,
      tool,
      domainJudgements,
      signallingAnswers: answers,
      overallJudgement,
    });
    toast.success("Risk of bias assessment saved", {
      description: `${study.label} — ${shortToolName(tool)}`,
    });
    onClose();
  }

  const shortName = toolDef.name.split("—")[0].trim();

  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
        <DialogTitle className="flex items-center gap-2 text-base pr-8">
          <ShieldCheck className="size-5 text-teal-600 shrink-0" />
          <span className="truncate">Risk of Bias: {study.label}</span>
          <span className="text-muted-foreground font-normal text-sm shrink-0">— {shortName}</span>
        </DialogTitle>
        <DialogDescription>
          Answer each signalling question. Domain and overall judgements are
          computed live using the official {shortName} algorithm. The overall
          judgement can be overridden if needed.
        </DialogDescription>
      </DialogHeader>

      {/* Domain quick-nav */}
      <div className="px-6 py-2 border-b bg-muted/30 flex flex-wrap items-center gap-1.5 shrink-0">
        <span className="text-[11px] text-muted-foreground mr-1">Jump to:</span>
        {toolDef.domains.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => scrollToDomain(d.id)}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-0.5 text-[11px] hover:bg-muted transition-colors"
            title={d.name}
          >
            <span className="font-mono">{d.id}</span>
            <span
              className="size-2 rounded-full"
              style={{
                backgroundColor: judgementOption(toolDef, domainJudgements[d.id]).color,
              }}
            />
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {toolDef.domains.map((domain, dIdx) => (
          <section
            key={domain.id}
            ref={(el) => {
              domainRefs.current[domain.id] = el;
            }}
            className="space-y-3 scroll-mt-2"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-[10px]">
                {domain.id}
              </Badge>
              <h3 className="text-sm font-semibold">{domain.name}</h3>
              <JudgementPill
                tool={toolDef}
                judgement={domainJudgements[domain.id]}
                size="md"
              />
            </div>
            <div className="space-y-3">
              {domain.questions.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="rounded-lg border bg-muted/20 p-3 space-y-2"
                >
                  <div className="text-sm leading-relaxed">
                    <span className="text-muted-foreground text-xs mr-2 font-mono">
                      {domain.id}.Q{qIdx + 1}
                    </span>
                    {q.text}
                  </div>
                  <AnswerPicker
                    value={answers[q.id]}
                    onChange={(v) => setAnswer(q.id, v)}
                  />
                </div>
              ))}
            </div>
            {dIdx < toolDef.domains.length - 1 && <Separator className="!my-1" />}
          </section>
        ))}

        <Separator />

        {/* Overall + override */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">Overall judgement</h3>
            <JudgementPill
              tool={toolDef}
              judgement={overallJudgement}
              size="md"
            />
            {!overrideEnabled && (
              <span className="text-xs text-muted-foreground">
                (auto-computed from answers)
              </span>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-dashed p-3">
            <Checkbox
              id="rob-override"
              checked={overrideEnabled}
              onCheckedChange={(c) => {
                const checked = c === true;
                setOverrideEnabled(checked);
                if (checked && !overrideJudgement) {
                  setOverrideJudgement(algorithmOverall);
                }
              }}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="rob-override" className="text-xs font-medium">
                Override overall judgement
              </Label>
              {overrideEnabled && (
                <div className="space-y-2">
                  <Select
                    value={overrideJudgement ?? "__none__"}
                    onValueChange={(v) =>
                      setOverrideJudgement(
                        v === "__none__" ? null : (v as RobJudgement)
                      )
                    }
                  >
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue placeholder="Select judgement" />
                    </SelectTrigger>
                    <SelectContent>
                      {toolDef.judgementOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span
                            className="size-2 rounded-full inline-block mr-1.5 align-middle"
                            style={{ backgroundColor: o.color }}
                          />
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    rows={2}
                    placeholder="Reason for override (e.g. unreported randomisation method despite otherwise Low answers)"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    The override reason is not persisted with the assessment —
                    keep a note in your review document if needed.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <DialogFooter className="px-6 py-4 border-t bg-background shrink-0">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          <Check className="size-4" />
          Save assessment
        </Button>
      </DialogFooter>
    </>
  );
}

// -----------------------------------------------------------------------------
// Traffic-light plot (pure SVG, one panel per tool)
// -----------------------------------------------------------------------------

function TrafficLightPlot({
  assessments,
  studies,
  onCellClick,
}: {
  assessments: RobAssessment[];
  studies: Study[];
  onCellClick: (study: Study, assessment: RobAssessment, domainId?: string) => void;
}) {
  // Group assessments by tool, then sort studies by label within each tool.
  const grouped = useMemo(() => {
    const map = new Map<RobTool, { study: Study; assessment: RobAssessment }[]>();
    for (const a of assessments) {
      const study = studies.find((s) => s.id === a.studyId);
      if (!study) continue;
      const list = map.get(a.tool) ?? [];
      list.push({ study, assessment: a });
      map.set(a.tool, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.study.label.localeCompare(b.study.label));
    }
    return map;
  }, [assessments, studies]);

  // Legend: union of judgement options across visible tools.
  const legendItems = useMemo(() => {
    const seen = new Set<string>();
    const items: { value: RobJudgement; label: string; color: string }[] = [];
    for (const toolId of grouped.keys()) {
      for (const opt of ROB_TOOLS[toolId].judgementOptions) {
        if (!seen.has(opt.value)) {
          seen.add(opt.value);
          items.push(opt);
        }
      }
    }
    return items;
  }, [grouped]);

  if (assessments.length === 0) return null;

  const LABEL_W = 200;
  const CELL = 36;
  const HEADER_H = 24;
  const ROW_H = 28;

  return (
    <Card className="p-5 gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Traffic-light plot</h3>
          <p className="text-xs text-muted-foreground">
            One row per study × tool, one column per domain. Click a cell or
            study label to open the editor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {legendItems.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 text-[11px]"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: opt.color }}
              />
              {opt.label}
            </span>
          ))}
        </div>
      </div>
      <Separator />
      <div className="max-h-96 overflow-y-auto pr-1 space-y-5">
        {[...grouped.entries()].map(([toolId, rows]) => {
          const tool = ROB_TOOLS[toolId];
          const cols = tool.domains;
          const width = LABEL_W + cols.length * CELL + 8;
          const height = HEADER_H + rows.length * ROW_H + 4;
          return (
            <div key={toolId} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={TOOL_BADGE_CLASS[toolId]}>
                  {shortToolName(toolId)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {rows.length} {rows.length === 1 ? "study" : "studies"} · {cols.length} domains
                </span>
              </div>
              <div className="overflow-x-auto">
                <svg
                  width="100%"
                  height={height}
                  viewBox={`0 0 ${width} ${height}`}
                  preserveAspectRatio="xMinYMin meet"
                  className="block max-w-full"
                  role="img"
                  aria-label={`${shortToolName(toolId)} traffic-light plot`}
                >
                  {/* Column header */}
                  {cols.map((d, i) => (
                    <text
                      key={d.id}
                      x={LABEL_W + i * CELL + CELL / 2}
                      y={HEADER_H - 8}
                      textAnchor="middle"
                      className="fill-muted-foreground font-mono"
                      style={{ fontSize: 10 }}
                    >
                      {d.id}
                    </text>
                  ))}
                  {rows.map(({ study, assessment }, r) => {
                    const y = HEADER_H + r * ROW_H;
                    const label = study.label.length > 28 ? study.label.slice(0, 27) + "…" : study.label;
                    return (
                      <g key={assessment.id}>
                        <text
                          x={4}
                          y={y + ROW_H / 2 + 4}
                          className="fill-foreground cursor-pointer"
                          style={{ fontSize: 11 }}
                          onClick={() => onCellClick(study, assessment)}
                        >
                          {label}
                        </text>
                        {cols.map((d, c) => {
                          const j = assessment.domainJudgements[d.id] ?? "low";
                          const opt = judgementOption(tool, j);
                          const cx = LABEL_W + c * CELL + CELL / 2;
                          const cy = y + ROW_H / 2;
                          return (
                            <g
                              key={d.id}
                              className="cursor-pointer"
                              onClick={() => onCellClick(study, assessment, d.id)}
                            >
                              <circle
                                cx={cx}
                                cy={cy}
                                r={9}
                                fill={opt.color}
                                stroke="rgba(0,0,0,0.15)"
                                strokeWidth={1}
                              />
                              <title>
                                {`${study.label} — ${d.name}: ${opt.label}`}
                              </title>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Summary bar plot (stacked div bars, toggle combined / by-tool)
// -----------------------------------------------------------------------------

function SummaryBarPlot({
  assessments,
}: {
  assessments: RobAssessment[];
}) {
  const [view, setView] = useState<"combined" | "byTool">("combined");

  /** Counts per domain id, per bucket. */
  type DomainCounts = Record<JudgementBucket, number> & { total: number };

  const emptyCounts = (): DomainCounts => ({
    low: 0,
    mid: 0,
    high: 0,
    unclear: 0,
    total: 0,
  });

  const combined = useMemo(() => {
    const byDomain = new Map<string, DomainCounts>();
    for (const a of assessments) {
      const tool = ROB_TOOLS[a.tool];
      for (const d of tool.domains) {
        const j = a.domainJudgements[d.id] ?? "low";
        const cur = byDomain.get(d.id) ?? emptyCounts();
        cur[bucket(j)] += 1;
        cur.total += 1;
        byDomain.set(d.id, cur);
      }
    }
    // Sort by domain id (D1, D2, ...) — natural sort.
    return [...byDomain.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true })
    );
  }, [assessments]);

  const byTool = useMemo(() => {
    const out: { tool: RobToolDef; domains: { domainId: string; domainName: string; counts: DomainCounts }[] }[] = [];
    for (const toolId of ["ROB2", "ROBINS_I", "QUADAS_2"] as RobTool[]) {
      const tool = ROB_TOOLS[toolId];
      const list = assessments.filter((a) => a.tool === toolId);
      if (list.length === 0) continue;
      const domains = tool.domains.map((d) => {
        const counts = emptyCounts();
        for (const a of list) {
          const j = a.domainJudgements[d.id] ?? "low";
          counts[bucket(j)] += 1;
          counts.total += 1;
        }
        return { domainId: d.id, domainName: d.name, counts };
      });
      out.push({ tool, domains });
    }
    return out;
  }, [assessments]);

  if (assessments.length === 0) return null;

  const maxTotal = Math.max(
    1,
    ...combined.map(([, c]) => c.total),
    ...byTool.flatMap((t) => t.domains.map((d) => d.counts.total))
  );

  return (
    <Card className="p-5 gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Summary bar plot</h3>
          <p className="text-xs text-muted-foreground">
            Stacked counts of domain judgements per domain. Toggle between a
            combined view (all assessments) or grouped by tool.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border p-0.5 bg-muted/40">
          <button
            type="button"
            onClick={() => setView("combined")}
            className={cn(
              "px-2.5 py-1 text-xs rounded transition-colors",
              view === "combined"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Combined
          </button>
          <button
            type="button"
            onClick={() => setView("byTool")}
            className={cn(
              "px-2.5 py-1 text-xs rounded transition-colors",
              view === "byTool"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            By tool
          </button>
        </div>
      </div>
      <Separator />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {(Object.keys(BUCKET_META) as JudgementBucket[]).map((b) => (
          <span key={b} className="inline-flex items-center gap-1 text-[11px]">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: BUCKET_META[b].color }}
            />
            {BUCKET_META[b].label}
          </span>
        ))}
      </div>

      {view === "combined" ? (
        <div className="space-y-2">
          {combined.map(([domainId, counts]) => (
            <BarRow
              key={domainId}
              label={domainId}
              sublabel=""
              counts={counts}
              maxTotal={maxTotal}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {byTool.map(({ tool, domains }) => (
            <div key={tool.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={TOOL_BADGE_CLASS[tool.id]}>
                  {shortToolName(tool.id)}
                </Badge>
              </div>
              {domains.map((d) => (
                <BarRow
                  key={d.domainId}
                  label={d.domainId}
                  sublabel={d.domainName}
                  counts={d.counts}
                  maxTotal={maxTotal}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function BarRow({
  label,
  sublabel,
  counts,
  maxTotal,
}: {
  label: string;
  sublabel: string;
  counts: { low: number; mid: number; high: number; unclear: number; total: number };
  maxTotal: number;
}) {
  const pct = (n: number) => (counts.total > 0 ? (n / counts.total) * 100 : 0);
  const widthPct = (counts.total / maxTotal) * 100;
  return (
    <div className="grid grid-cols-[60px_1fr_56px] items-center gap-2">
      <div className="text-xs">
        <div className="font-mono font-medium">{label}</div>
        {sublabel && (
          <div className="text-[10px] text-muted-foreground truncate" title={sublabel}>
            {sublabel}
          </div>
        )}
      </div>
      <div
        className="h-5 rounded bg-muted overflow-hidden relative"
        style={{ width: `${Math.max(8, widthPct)}%`, minWidth: 32 }}
      >
        <div className="flex h-full w-full">
          {(["low", "mid", "high", "unclear"] as JudgementBucket[]).map((b) => {
            const w = pct(counts[b]);
            if (w === 0) return null;
            return (
              <div
                key={b}
                className="h-full flex items-center justify-center text-[9px] text-white font-medium"
                style={{ width: `${w}%`, backgroundColor: BUCKET_META[b].color }}
                title={`${BUCKET_META[b].label}: ${counts[b]}`}
              >
                {counts[b] >= 1 ? counts[b] : ""}
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-xs text-muted-foreground tabular-nums text-right">
        n={counts.total}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Study assessment card
// -----------------------------------------------------------------------------

function StudyAssessmentCard({
  study,
  assessments,
  reviewType,
  onEdit,
  onDelete,
}: {
  study: Study;
  assessments: RobAssessment[];
  reviewType: ReviewType;
  onEdit: (tool: RobTool, assessmentId?: string) => void;
  onDelete: (assessment: RobAssessment) => void;
}) {
  const tools = applicableTools(reviewType);
  const studyAssessments = assessments.filter((a) => a.studyId === study.id);
  const unassessedTools = tools.filter(
    (t) => !studyAssessments.some((a) => a.tool === t.id)
  );

  return (
    <Card className="p-4 gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-sm truncate">{study.label}</h3>
            {study.year && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {study.year}
              </span>
            )}
            {study.design && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {study.design}
              </Badge>
            )}
          </div>
          {study.authors && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {study.authors}
            </p>
          )}
        </div>

        {/* Start / + Assessment dropdown */}
        {unassessedTools.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="size-3.5" />
                Assessment
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Start assessment</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {unassessedTools.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => onEdit(t.id)}>
                  <ShieldCheck className="size-3.5" />
                  {shortToolName(t.id)}
                  <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[180px]">
                    {t.name.split("—")[0].trim()}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {studyAssessments.length === 0 ? (
        <div className="text-xs text-muted-foreground italic flex items-center gap-1.5">
          <ClipboardList className="size-3.5" />
          No assessments yet.
          {unassessedTools.length > 0 && " Click “+ Assessment” to start one."}
          {unassessedTools.length === 0 && " No tools apply to this review type."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {studyAssessments.map((a) => {
            const toolDef = ROB_TOOLS[a.tool];
            const overall = a.overallJudgement ?? toolDef.algorithm(a.signallingAnswers);
            return (
              <div
                key={a.id}
                className="rounded-md border bg-muted/20 p-2.5 flex items-center gap-2 flex-wrap"
              >
                <Badge variant="outline" className={TOOL_BADGE_CLASS[a.tool]}>
                  {shortToolName(a.tool)}
                </Badge>
                <JudgementPill tool={toolDef} judgement={overall} size="md" />
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => onEdit(a.tool, a.id)}
                  >
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    onClick={() => onDelete(a)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Main RobPage
// -----------------------------------------------------------------------------

export function RobPage() {
  const review = useReviewStore((s) => s.review);
  const deleteRobAssessment = useReviewStore((s) => s.deleteRobAssessment);

  const [filter, setFilter] = useState<StudyFilter>("all");
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RobAssessment | null>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);

  if (!review) return null;

  const studies = review.studies;
  const assessments = review.robAssessments;
  const assessedStudyIds = new Set(assessments.map((a) => a.studyId));
  const assessedCount = studies.filter((s) => assessedStudyIds.has(s.id)).length;

  const filteredStudies = studies.filter((s) => {
    if (filter === "assessed") return assessedStudyIds.has(s.id);
    if (filter === "unassessed") return !assessedStudyIds.has(s.id);
    return true;
  });

  function openEditor(study: Study, tool: RobTool, assessmentId?: string, targetDomainId?: string) {
    setEditorState({
      studyId: study.id,
      tool,
      assessmentId,
      targetDomainId,
    });
  }

  function openFromCell(study: Study, assessment: RobAssessment, domainId?: string) {
    openEditor(study, assessment.tool, assessment.id, domainId);
  }

  function confirmDelete() {
    if (!deleteTarget || !review) return;
    const study = review.studies.find((s) => s.id === deleteTarget.studyId);
    deleteRobAssessment(deleteTarget.id);
    toast.success("Assessment deleted", {
      description: `${study?.label ?? "Study"} — ${shortToolName(deleteTarget.tool)}`,
    });
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="size-6 text-teal-600" />
            Risk of Bias
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {review.type === "DTA"
              ? "Use QUADAS-3 for estimate-level risk of bias and applicability. QUADAS-2 remains available for older protocols."
              : "Assess included studies with RoB 2 or ROBINS-I. Answers drive live domain and overall judgements."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="h-7 px-2.5">
            {review.type === "DTA"
              ? `${review.quadas3?.estimates.length ?? 0} selected ${(review.quadas3?.estimates.length ?? 0) === 1 ? "estimate" : "estimates"}`
              : `${assessedCount} of ${studies.length} ${studies.length === 1 ? "study" : "studies"} assessed`}
          </Badge>
          <Select value={filter} onValueChange={(v) => setFilter(v as StudyFilter)}>
            <SelectTrigger className="w-56" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STUDY_FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {review.type === "DTA" && (
        <>
          <Quadas3WorkspacePanel />
          <div className="flex flex-col gap-2 border-y bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xs font-semibold">QUADAS-2 legacy assessments</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Open only when an older protocol explicitly requires QUADAS-2. Existing records are preserved and are not converted.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setLegacyOpen((open) => !open)}>
              {legacyOpen ? "Hide legacy tool" : "Open legacy tool"}
              {assessments.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 font-mono text-[9px]">{assessments.length}</span>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Study-level tools and preserved QUADAS-2 legacy records */}
      {(review.type !== "DTA" || legacyOpen) && (studies.length === 0 ? (
        <Card className="p-10 text-center border-dashed bg-muted/20">
          <div className="mx-auto max-w-md space-y-3">
            <div className="mx-auto size-12 rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center">
              <FileText className="size-6 text-teal-600" />
            </div>
            <h3 className="text-lg font-semibold">No studies yet</h3>
            <p className="text-sm text-muted-foreground">
              Add studies first from the Studies tab, then assess their risk of
              bias using RoB 2, ROBINS-I, or the selected legacy tool.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Study list */}
          <div className="space-y-3">
            {filteredStudies.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No studies match this filter.
              </Card>
            ) : (
              filteredStudies.map((study) => (
                <StudyAssessmentCard
                  key={study.id}
                  study={study}
                  assessments={assessments}
                  reviewType={review.type}
                  onEdit={(tool, assessmentId) => openEditor(study, tool, assessmentId)}
                  onDelete={(a) => setDeleteTarget(a)}
                />
              ))
            )}
          </div>

          {/* Plots */}
          {assessments.length > 0 && (
            <div className="grid lg:grid-cols-2 gap-4 items-start">
              <TrafficLightPlot
                assessments={assessments}
                studies={studies}
                onCellClick={openFromCell}
              />
              <SummaryBarPlot assessments={assessments} />
            </div>
          )}
        </>
      ))}

      {/* Editor dialog */}
      <RobEditorDialog state={editorState} onClose={() => setEditorState(null)} />

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete risk of bias assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the{" "}
              <strong>{deleteTarget ? shortToolName(deleteTarget.tool) : ""}</strong>{" "}
              assessment for{" "}
              <strong>
                {deleteTarget
                  ? review.studies.find((s) => s.id === deleteTarget.studyId)?.label ?? "this study"
                  : "this study"}
              </strong>
              . All saved signalling answers and judgements will be lost. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Trash2 className="size-4" />
              Delete assessment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
