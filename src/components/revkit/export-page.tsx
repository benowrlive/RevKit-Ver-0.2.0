// src/components/revkit/export-page.tsx — Export hub for RevKit reviews.
//
// Three main cards in a responsive grid:
//   1. Word Document (.doc)        — full narrative with per-outcome pooled
//                                     effects computed via the stats engine.
//   2. CSV                          — combined CSV file with all four tables
//                                     (studies, references, data points, rob
//                                     assessments) + PRISMA flow JSON.
//   3. Plot PNG/SVG                 — picker that renders a forest plot inline
//                                     for any outcome; the ForestPlot component
//                                     already provides Download PNG / SVG buttons.
//
// All file generation is client-side (Blob + URL.createObjectURL). Toasts on
// success ("Exported <filename>") and on error ("Export failed: <message>").

"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import {
  FileText,
  Table2,
  Image as ImageIcon,
  Download,
  Settings,
  Info,
  Loader2,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";

import { useReviewStore } from "@/lib/project/state";
import type { Outcome, Review } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ForestPlot } from "@/components/forest-plot/forest-plot";
import { effectMeasureLabel } from "@/components/forest-plot/pooling";
import { downloadText, slugify } from "@/lib/export/download";
import { buildCombinedCsv } from "@/lib/export/csv";
import { exportReviewAsDoc } from "@/lib/export/docx";
import { exportProsperoDraft } from "@/lib/protocol/prospero";

/** Flatten the review into a list of (comparison, outcome) pairs. */
function listAllOutcomes(
  review: Review,
): Array<{ comparisonName: string; outcome: Outcome }> {
  const out: Array<{ comparisonName: string; outcome: Outcome }> = [];
  for (const cmp of review.comparisons) {
    for (const o of cmp.outcomes) {
      out.push({ comparisonName: cmp.name, outcome: o });
    }
  }
  return out;
}

interface ExportCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

function ExportCard({
  icon,
  iconBg,
  title,
  description,
  footer,
  children,
}: ExportCardProps) {
  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-md shrink-0"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      <div className="flex-1">{children}</div>
      {footer && <div className="pt-1 border-t">{footer}</div>}
    </Card>
  );
}

function WordCard({ review }: { review: Review }) {
  const [busy, setBusy] = useState(false);

  const handleExport = () => {
    setBusy(true);
    try {
      exportReviewAsDoc(review);
      const filename = `${slugify(review.title)}.doc`;
      toast.success("Exported Word document", { description: filename });
    } catch (e) {
      toast.error("Export failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      // give the browser a tick to release the click handler
      setTimeout(() => setBusy(false), 300);
    }
  };

  return (
    <ExportCard
      icon={<FileText className="size-5 text-blue-700" />}
      iconBg="#dbeafe"
      title="Word Document"
      description="A full narrative report including title page, abstract, methods, per-outcome meta-analysis results, risk-of-bias summary, references, and PRISMA flow counts."
      footer={
        <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
          <span>.doc (Word-compatible HTML)</span>
          <span>{review.comparisons.length} comparison(s)</span>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Generated client-side. The pooled effects in the Results table are
          computed using the same stats engine that powers the forest plots
          (MH / Peto / IV / DL).
        </p>
        <Button
          onClick={handleExport}
          disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export to Word
        </Button>
      </div>
    </ExportCard>
  );
}

function ProtocolCard({ review }: { review: Review }) {
  const ready = Boolean(review.protocol);
  const handleExport = () => {
    try {
      exportProsperoDraft(review);
      toast.success("Exported PROSPERO preparation draft", {
        description: `${slugify(review.title)}-prospero-draft.doc`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <ExportCard
      icon={<ClipboardCheck className="size-5 text-violet-700" />}
      iconBg="#ede9fe"
      title="Protocol / PROSPERO draft"
      description="An editable question-by-question working document with PICO/PIRD, eligibility, methods, administration, and planned DTA strata."
      footer={<div className="pt-3 text-xs text-muted-foreground">.doc · Word-compatible · review before submission</div>}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Complete or update the answers in the Protocol workspace, then use this draft while entering the live registration form.
        </p>
        <Button onClick={handleExport} disabled={!ready} className="w-full bg-violet-600 text-white hover:bg-violet-700">
          <Download className="size-4" />
          {ready ? "Download protocol draft" : "Start the protocol first"}
        </Button>
      </div>
    </ExportCard>
  );
}

function CsvCard({ review }: { review: Review }) {
  const [busy, setBusy] = useState(false);

  const handleExport = () => {
    setBusy(true);
    try {
      const csv = buildCombinedCsv(review);
      const filename = `${slugify(review.title)}-export.csv`;
      downloadText(filename, csv, "text/csv;charset=utf-8");
      toast.success("Exported CSV", {
        description: `${filename} (${(csv.length / 1024).toFixed(1)} KB)`,
      });
    } catch (e) {
      toast.error("Export failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setTimeout(() => setBusy(false), 300);
    }
  };

  const studies = review.studies.length;
  const refs = review.references.length;
  const dataPoints = review.comparisons.reduce(
    (acc, c) =>
      acc +
      c.outcomes.reduce(
        (a, o) => a + o.dataPoints.length + o.subgroups.reduce((s, sg) => s + sg.dataPoints.length, 0),
        0,
      ),
    0,
  );
  const rob = review.robAssessments.length;

  return (
    <ExportCard
      icon={<Table2 className="size-5 text-teal-700" />}
      iconBg="color-mix(in oklab, #14b8a6, transparent 88%)"
      title="CSV (combined)"
      description="A single CSV file with section headers for studies, references, data points, risk-of-bias assessments, and the PRISMA flow as JSON. Opens in Excel / Numbers / Google Sheets."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
          <span>UTF-8 CSV · Excel-friendly</span>
          <span>
            {studies} std · {refs} ref · {dataPoints} dp · {rob} rob
          </span>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          The combined CSV concatenates each table with a{" "}
          <code className="px-1 py-0.5 bg-muted rounded text-[10px]">
            # Section: &lt;name&gt;
          </code>{" "}
          header row. PRISMA flow is included as a JSON string.
        </p>
        <Button
          onClick={handleExport}
          disabled={busy}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export CSV
        </Button>
      </div>
    </ExportCard>
  );
}

function PlotCard({ review }: { review: Review }) {
  const outcomes = useMemo(() => listAllOutcomes(review), [review]);
  const [selectedKey, setSelectedKey] = useState<string>("");

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return outcomes.find(
      (o) => `${o.outcome.id}` === selectedKey,
    ) ?? null;
  }, [outcomes, selectedKey]);

  if (outcomes.length === 0) {
    return (
      <ExportCard
        icon={<ImageIcon className="size-5 text-amber-700" />}
        iconBg="#fef3c7"
        title="Plot PNG / SVG"
        description="Render any outcome's forest plot inline and use its Download PNG / SVG buttons."
      >
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3">
          <Info className="size-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">No outcomes yet</p>
            <p className="mt-0.5">
              Add a comparison and an outcome with data points on the{" "}
              <strong>Comparisons &amp; Outcomes</strong> tab to enable plot
              export.
            </p>
          </div>
        </div>
      </ExportCard>
    );
  }

  return (
    <ExportCard
      icon={<ImageIcon className="size-5 text-amber-700" />}
      iconBg="#fef3c7"
      title="Plot PNG / SVG"
      description="Render any outcome's forest plot inline. Use the Download SVG / PNG buttons in the top-right of the rendered plot."
      footer={
        <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
          <span>ForestPlot · D3-free SVG</span>
          <span>{outcomes.length} outcome(s)</span>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="plot-outcome" className="text-xs font-medium">
            Outcome
          </Label>
          <Select value={selectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger id="plot-outcome" size="sm">
              <SelectValue placeholder="Pick an outcome…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Outcomes</SelectLabel>
                {outcomes.map((o) => (
                  <SelectItem key={o.outcome.id} value={o.outcome.id}>
                    {o.comparisonName} → {o.outcome.name}
                    <span className="text-muted-foreground ml-1">
                      ({effectMeasureLabel(o.outcome)})
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {selected ? (
          <div className="border rounded-md p-2 bg-background">
            <ForestPlot outcome={selected.outcome} />
          </div>
        ) : (
          <div className="flex items-center justify-center text-xs text-muted-foreground bg-muted/40 border border-dashed rounded-md p-6">
            Pick an outcome above to render its forest plot.
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border rounded-md p-2.5">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          <span>
            Tip: every plot on the <strong>Comparisons</strong> tab has its own
            Download PNG / SVG buttons — use those for SROC, funnel, and DTA
            forest plots too.
          </span>
        </div>
      </div>
    </ExportCard>
  );
}

function SettingsCard() {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-md shrink-0 bg-muted"
        >
          <Settings className="size-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Word formatting</h3>
            <Badge variant="outline" className="text-[10px] py-0 h-4">
              Coming soon
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Future versions will allow choosing page size (A4 / Letter),
            margin, font (Calibri / Times), numbered headings, table styling,
            and which sections to include / exclude.
          </p>
        </div>
      </div>
      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        {[
          { label: "Page size", value: "A4" },
          { label: "Margin", value: "2.5 cm" },
          { label: "Font", value: "Calibri 11pt" },
        ].map((opt) => (
          <div key={opt.label} className="rounded-md border bg-muted/30 p-3 opacity-60">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {opt.label}
            </div>
            <div className="text-sm font-medium mt-0.5">{opt.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ExportPage() {
  const review = useReviewStore((s) => s.review);
  if (!review) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Export</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generate downloadable artifacts of your review — all client-side, no
          server round-trip. Files are written to your browser&apos;s download
          folder.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <WordCard review={review} />
        <ProtocolCard review={review} />
        <CsvCard review={review} />
        <PlotCard review={review} />
      </div>

      <SettingsCard />

      <Card className="p-4 bg-muted/30">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          <div>
            <strong className="text-foreground">Privacy note:</strong> no data
            leaves your browser. All exports are generated from the in-memory
            review state. If your review is large (thousands of references),
            the export may take a few seconds.
          </div>
        </div>
      </Card>
    </div>
  );
}
