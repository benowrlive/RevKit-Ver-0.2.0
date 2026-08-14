// src/lib/export/docx.ts — Word-compatible export builder for RevKit reviews.
//
// Since the `docx` npm package is not installed in this project, we generate
// an HTML document with Word-compatible styling (Word happily opens
// well-formed HTML with `application/msword` MIME). The output is a single
// `.doc` file with the full review narrative: title page, abstract,
// background, methods, results (per-outcome meta-analysis summaries —
// computed using the same stats engine the forest plot uses), risk of bias
// summary table, references, and PRISMA flow counts.

import type { Outcome, Review, RobJudgement } from "@/lib/types";
import {
  REVIEW_TYPES,
  REVIEW_SUBTYPES,
  REVIEW_PHASES,
} from "@/lib/types";
import { PRISMA_TEMPLATE } from "@/lib/prisma-flow/template";
import { getEstimateJudgements } from "@/lib/quadas3/config";
import {
  buildPerStudyEffects,
  effectMeasureLabel,
  poolOutcomeEffects,
} from "@/components/forest-plot/pooling";
import {
  formatEffectWithCI,
  formatNumber,
  formatP,
} from "@/components/forest-plot/plot-utils";
import { downloadText, slugify } from "./download";

/** Escape HTML special characters in a string. */
function escapeHtml(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a date string (ISO) as a readable "March 5, 2026 · 14:32 UTC". */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

/** Human-readable label for a RoB judgement. */
function judgementLabel(j: RobJudgement | null | undefined): string {
  if (!j) return "Not assessed";
  return j
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Build the per-outcome meta-analysis summary row. */
function buildOutcomeSummary(outcome: Outcome): {
  name: string;
  effectMeasure: string;
  method: string;
  model: string;
  studies: number;
  pooled: string;
  ci: string;
  i2: string;
  pValue: string;
  heterogeneityP: string;
  z: string;
  tau2: string;
} {
  const { effects } = buildPerStudyEffects(outcome, outcome.dataPoints);
  const pooled = poolOutcomeEffects(outcome, effects, []);
  const label = effectMeasureLabel(outcome);
  const k = effects.length;
  if (!pooled || k === 0) {
    return {
      name: outcome.name,
      effectMeasure: label,
      method: outcome.method,
      model: outcome.model,
      studies: k,
      pooled: "—",
      ci: "—",
      i2: "—",
      pValue: "—",
      heterogeneityP: "—",
      z: "—",
      tau2: "—",
    };
  }
  const pooledDisplay = pooled.isLogScale
    ? pooled.effectOnOriginalScale
    : pooled.effect;
  const loDisplay = pooled.isLogScale ? pooled.ciLowerOriginal : pooled.ciLower;
  const hiDisplay = pooled.isLogScale ? pooled.ciUpperOriginal : pooled.ciUpper;
  return {
    name: outcome.name,
    effectMeasure: label,
    method: outcome.method,
    model: outcome.model,
    studies: k,
    pooled: formatNumber(pooledDisplay),
    ci: formatEffectWithCI(pooledDisplay, loDisplay, hiDisplay),
    i2: `${(pooled.I2 * 100).toFixed(0)}%`,
    pValue: formatP(pooled.pValue),
    heterogeneityP: formatP(pooled.pValueHeterogeneity),
    z: formatNumber(pooled.z),
    tau2: formatNumber(pooled.tau2),
  };
}

/** Build the abstract paragraph from review summary counts. */
function buildAbstract(review: Review): string {
  const nStudies = review.studies.length;
  const nRefs = review.references.length;
  const nIncludedRefs = review.references.filter((r) => r.decision === "INCLUDE").length;
  const nExcludedRefs = review.references.filter((r) => r.decision === "EXCLUDE").length;
  const nComparisons = review.comparisons.length;
  const nOutcomes = review.comparisons.reduce((acc, c) => acc + c.outcomes.length, 0);
  const typeMeta = REVIEW_TYPES.find((t) => t.value === review.type);
  const subMeta = review.subType
    ? REVIEW_SUBTYPES.find((s) => s.value === review.subType)
    : null;
  const phaseMeta = REVIEW_PHASES.find((p) => p.value === review.phase);
  const parts: string[] = [];
  parts.push(
    `<strong>Background.</strong> ${escapeHtml(review.title)}. ` +
      `Type: ${escapeHtml(typeMeta?.label ?? review.type)}` +
      (subMeta ? ` (${escapeHtml(subMeta.label)})` : "") +
      `. Current phase: ${escapeHtml(phaseMeta?.label ?? review.phase)}.`,
  );
  if (review.researchQuestion) {
    parts.push(
      `<strong>Research question.</strong> ${escapeHtml(review.researchQuestion)}`,
    );
  }
  parts.push(
    `<strong>Methods.</strong> ${nStudies} studies and ${nRefs} references ` +
      `(${nIncludedRefs} included, ${nExcludedRefs} excluded) were screened. ` +
      `${nComparisons} comparison(s) and ${nOutcomes} outcome(s) were analyzed.`,
  );
  parts.push(`<strong>Results.</strong> See Results section for pooled-effect estimates.`);
  return parts.join(" ");
}

/** Build the references numbered list HTML. */
function buildReferencesHtml(review: Review): string {
  if (review.references.length === 0) {
    return `<p><em>No references imported.</em></p>`;
  }
  const items = review.references.map((r) => {
    const parts: string[] = [];
    if (r.authors) parts.push(escapeHtml(r.authors));
    if (r.year) parts.push(`(${r.year})`);
    if (r.title) parts.push(escapeHtml(r.title));
    if (r.journal) parts.push(`<em>${escapeHtml(r.journal)}</em>`);
    const body = parts.join(" ");
    const doi = r.doi ? ` DOI: <a href="https://doi.org/${escapeHtml(r.doi)}">${escapeHtml(r.doi)}</a>` : "";
    const pmid = r.pmid ? ` PMID: ${escapeHtml(r.pmid)}` : "";
    const decision = r.decision ? ` <strong>[${escapeHtml(r.decision)}]</strong>` : "";
    return `<li>${body}.${doi}${pmid}${decision}</li>`;
  });
  return `<ol>${items.join("")}</ol>`;
}

/** Build the comparisons / outcomes methods list HTML. */
function buildMethodsHtml(review: Review): string {
  if (review.comparisons.length === 0) {
    return `<p><em>No comparisons defined.</em></p>`;
  }
  const items = review.comparisons.map((c) => {
    const outs = c.outcomes
      .map(
        (o) =>
          `<li>${escapeHtml(o.name)} — ` +
          `${escapeHtml(effectMeasureLabel(o))}, ${escapeHtml(o.method)}, ` +
          `${escapeHtml(o.model)} model, ${escapeHtml(o.dataType)} data` +
          (o.unit ? `, unit: ${escapeHtml(o.unit)}` : "") +
          (o.timeFrame ? `, time frame: ${escapeHtml(o.timeFrame)}` : "") +
          `</li>`,
      )
      .join("");
    const designs = Array.from(
      new Set(
        review.studies
          .map((s) => s.design)
          .filter((d): d is string => Boolean(d)),
      ),
    );
    const designLine =
      designs.length > 0
        ? `<p>Study designs included: ${designs.map(escapeHtml).join(", ")}.</p>`
        : "";
    return `<li><strong>${escapeHtml(c.name)}</strong><ul>${outs}</ul></li>` + designLine;
  });
  return `<ul>${items.join("")}</ul>`;
}

/** Build the per-outcome results table HTML. */
function buildResultsTableHtml(review: Review): string {
  if (review.comparisons.length === 0) {
    return `<p><em>No outcomes pooled yet.</em></p>`;
  }
  const rows: string[] = [];
  for (const c of review.comparisons) {
    for (const o of c.outcomes) {
      const s = buildOutcomeSummary(o);
      rows.push(
        `<tr>` +
          `<td>${escapeHtml(c.name)}</td>` +
          `<td>${escapeHtml(s.name)}</td>` +
          `<td>${escapeHtml(s.effectMeasure)}</td>` +
          `<td>${escapeHtml(s.method)}</td>` +
          `<td>${escapeHtml(s.model)}</td>` +
          `<td>${s.studies}</td>` +
          `<td>${escapeHtml(s.pooled)}</td>` +
          `<td>${escapeHtml(s.ci)}</td>` +
          `<td>${escapeHtml(s.i2)}</td>` +
          `<td>${escapeHtml(s.pValue)}</td>` +
          `<td>${escapeHtml(s.heterogeneityP)}</td>` +
          `<td>${escapeHtml(s.z)}</td>` +
          `<td>${escapeHtml(s.tau2)}</td>` +
          `</tr>`,
      );
    }
  }
  if (rows.length === 0) {
    return `<p><em>No outcomes with data points.</em></p>`;
  }
  return `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">` +
    `<thead><tr style="background: #f1f5f9;">` +
    `<th>Comparison</th><th>Outcome</th><th>Effect measure</th><th>Method</th><th>Model</th>` +
    `<th>Studies</th><th>Pooled effect</th><th>95% CI</th><th>I²</th>` +
    `<th>P (effect)</th><th>P (heterogeneity)</th><th>Z</th><th>τ²</th>` +
    `</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

/** Build the risk-of-bias summary table HTML. */
function buildRobTableHtml(review: Review): string {
  if (review.robAssessments.length === 0) {
    return `<p><em>No legacy study-level risk-of-bias assessments recorded.</em></p>`;
  }
  const studyLabelById = new Map(review.studies.map((s) => [s.id, s.label]));
  const rows = review.robAssessments.map((a) => {
    const label = studyLabelById.get(a.studyId) ?? a.studyId;
    const domains = Object.entries(a.domainJudgements ?? {})
      .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(judgementLabel(v))}`)
      .join("; ");
    return (
      `<tr>` +
      `<td>${escapeHtml(label)}</td>` +
      `<td>${escapeHtml(a.tool)}</td>` +
      `<td><strong>${escapeHtml(judgementLabel(a.overallJudgement))}</strong></td>` +
      `<td>${domains}</td>` +
      `</tr>`
    );
  });
  return `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">` +
    `<thead><tr style="background: #f1f5f9;"><th>Study</th><th>Tool</th><th>Overall judgement</th><th>Domain judgements</th></tr></thead>` +
    `<tbody>${rows.join("")}</tbody></table>`;
}

/** Build the QUADAS-3 estimate-level summary table HTML. */
function buildQuadas3TableHtml(review: Review): string {
  const workspace = review.quadas3;
  if (!workspace || workspace.estimates.length === 0) {
    return `<p><em>No QUADAS-3 estimates recorded.</em></p>`;
  }
  const rows = workspace.estimates.map((estimate) => {
    const study = review.studies.find((item) => item.id === estimate.studyId);
    const question = workspace.synthesisQuestions.find((item) => item.id === estimate.questionId);
    const overall = getEstimateJudgements(workspace.domainAssessments, estimate.id);
    const domains = workspace.domainAssessments
      .filter((item) => item.estimateId === estimate.id)
      .map((item) => `${item.domainId}: ${item.riskJudgement.replace(/_/g, " ")}`)
      .join("; ");
    return `<tr><td>${escapeHtml(study?.label ?? estimate.studyId)}</td><td>${escapeHtml(estimate.label)}</td><td>${escapeHtml(question?.label ?? "")}</td><td>${escapeHtml(overall.risk.replace(/_/g, " "))}</td><td>${escapeHtml(overall.applicability.replace(/_/g, " "))}</td><td>${escapeHtml(domains)}</td></tr>`;
  });
  return `<h3>QUADAS-3 v${escapeHtml(workspace.version)}</h3>` +
    `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">` +
    `<thead><tr style="background: #f1f5f9;"><th>Study</th><th>Estimate</th><th>Synthesis question</th><th>Overall risk of bias</th><th>Applicability</th><th>Domains</th></tr></thead>` +
    `<tbody>${rows.join("")}</tbody></table>`;
}

/** Build the PRISMA flow counts summary table HTML. */
function buildPrismaTableHtml(review: Review): string {
  const flow =
    review.prismaFlow && review.prismaFlow.boxes.length > 0
      ? review.prismaFlow
      : { reviewId: review.id, boxes: [] };
  const countById = new Map(flow.boxes.map((b) => [b.id, b.count]));
  const autoById = new Map(flow.boxes.map((b) => [b.id, Boolean(b.autoCount)]));
  const rows = PRISMA_TEMPLATE.map((def) => {
    const count = countById.get(def.id) ?? 0;
    const auto = autoById.get(def.id) ? "auto" : "manual";
    return (
      `<tr>` +
      `<td>${escapeHtml(def.id)}</td>` +
      `<td>${escapeHtml(def.label)}</td>` +
      `<td>${count}</td>` +
      `<td>${auto}</td>` +
      `<td>${escapeHtml(def.stage)}</td>` +
      `</tr>`
    );
  });
  return `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">` +
    `<thead><tr style="background: #f1f5f9;"><th>Box ID</th><th>Label</th><th>Count</th><th>Source</th><th>Stage</th></tr></thead>` +
    `<tbody>${rows.join("")}</tbody></table>`;
}

/** Build the complete HTML document string for the Word export. */
export function buildReviewHtml(review: Review): string {
  const typeMeta = REVIEW_TYPES.find((t) => t.value === review.type);
  const subMeta = review.subType
    ? REVIEW_SUBTYPES.find((s) => s.value === review.subType)
    : null;
  const phaseMeta = REVIEW_PHASES.find((p) => p.value === review.phase);

  const titlePage = `
    <div style="text-align: center; padding: 60pt 0; page-break-after: always;">
      <h1 style="font-size: 28pt; margin-bottom: 12pt;">${escapeHtml(review.title)}</h1>
      <p style="font-size: 14pt; color: #475569; margin-bottom: 24pt;">
        ${escapeHtml(typeMeta?.label ?? review.type)}${subMeta ? ` · ${escapeHtml(subMeta.label)}` : ""}
      </p>
      <p style="font-size: 11pt; color: #64748b;">
        Phase: ${escapeHtml(phaseMeta?.label ?? review.phase)}<br/>
        Status: ${escapeHtml(review.status)}<br/>
        Review ID: ${escapeHtml(review.id)}<br/>
        Created: ${escapeHtml(formatDate(review.createdAt))}<br/>
        Last updated: ${escapeHtml(formatDate(review.updatedAt))}
      </p>
    </div>
  `;

  const abstractSection = `
    <h2 style="font-size: 18pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 6pt;">Abstract</h2>
    <p>${buildAbstract(review)}</p>
  `;

  const backgroundSection = `
    <h2 style="font-size: 18pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 6pt;">Background</h2>
    <p>${review.researchQuestion ? escapeHtml(review.researchQuestion) : "<em>No research question recorded.</em>"}</p>
  `;

  const methodsSection = `
    <h2 style="font-size: 18pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 6pt;">Methods</h2>
    ${buildMethodsHtml(review)}
  `;

  const resultsSection = `
    <h2 style="font-size: 18pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 6pt;">Results</h2>
    <p>Per-outcome meta-analysis summaries (pooled effect, 95% CI, I², p-values). All estimates computed with the RevKit stats engine using the configured effect measure, method, and model.</p>
    ${buildResultsTableHtml(review)}
  `;

  const robSection = `
    <h2 style="font-size: 18pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 6pt;">Risk of Bias</h2>
    ${review.quadas3 ? buildQuadas3TableHtml(review) : ""}
    ${buildRobTableHtml(review)}
  `;

  const prismaSection = `
    <h2 style="font-size: 18pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 6pt;">PRISMA Flow</h2>
    ${buildPrismaTableHtml(review)}
  `;

  const referencesSection = `
    <h2 style="font-size: 18pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 6pt;">References</h2>
    ${buildReferencesHtml(review)}
  `;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(review.title)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
@page WordSection1 {
  size: 21cm 29.7cm;
  margin: 2.5cm 2.5cm 2.5cm 2.5cm;
}
div.WordSection1 { page: WordSection1; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; line-height: 1.45; }
h1, h2, h3 { font-family: Calibri, Arial, sans-serif; }
table { font-size: 10pt; }
th { background: #f1f5f9; text-align: left; }
td, th { padding: 6px 8px; border: 1px solid #cbd5e1; vertical-align: top; }
em { color: #64748b; }
a { color: #1d4ed8; }
</style>
</head>
<body>
<div class="WordSection1">
${titlePage}
${abstractSection}
${backgroundSection}
${methodsSection}
${resultsSection}
${robSection}
${prismaSection}
${referencesSection}
</div>
</body>
</html>`;
}

/**
 * Generate the Word document and trigger a browser download. Filename is
 * `<slugified-title>.doc`. Uses the Word-compatible HTML format (no `docx`
 * library required).
 */
export function exportReviewAsDoc(review: Review): void {
  const html = buildReviewHtml(review);
  const filename = `${slugify(review.title)}.doc`;
  downloadText(filename, html, "application/msword;charset=utf-8");
}
