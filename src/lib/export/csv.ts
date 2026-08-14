// src/lib/export/csv.ts — CSV export builders for RevKit reviews.
//
// Pure TypeScript (no React). Each `build*` function returns a 2D array of
// cell values (header row + data rows) suitable for `toCsv()` (see
// `./download.ts`). `exportCombinedCsv` walks all four tables + the PRISMA
// flow JSON and concatenates them into a single CSV string with section
// header rows — the simplest fallback when `jszip` is not installed.
//
// Per spec:
//   studies.csv:        id, label, year, authors, doi, design, status,
//                       indexTest, referenceStandard
//   references.csv:     id, title, authors, year, journal, doi, pmid,
//                       decision, excludeReason
//   data-points.csv:    outcomeId, comparisonName, outcomeName, studyId,
//                       studyLabel, all numeric fields
//   rob-assessments.csv: studyId, studyLabel, tool, overallJudgement,
//                       domainJudgements (as JSON string)
//   prisma-flow.json:    the prismaFlow object as JSON

import type {
  Comparison,
  DataPoint,
  Outcome,
  Reference,
  Review,
  RobAssessment,
  Study,
} from "@/lib/types";
import { PRISMA_TEMPLATE } from "@/lib/prisma-flow/template";
import { getEstimateJudgements } from "@/lib/quadas3/config";
import { toCsv } from "./download";

/** Studies table (header + 1 row per study). */
export function buildStudiesCsv(review: Review): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = [[
    "id",
    "label",
    "year",
    "authors",
    "doi",
    "design",
    "status",
    "indexTest",
    "referenceStandard",
  ]];
  for (const s of review.studies) {
    rows.push([
      s.id,
      s.label,
      s.year ?? "",
      s.authors ?? "",
      s.doi ?? "",
      s.design ?? "",
      s.status,
      s.indexTest ?? "",
      s.referenceStandard ?? "",
    ]);
  }
  return rows;
}

/** References table (header + 1 row per reference). */
export function buildReferencesCsv(review: Review): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = [[
    "id",
    "title",
    "authors",
    "year",
    "journal",
    "doi",
    "pmid",
    "decision",
    "excludeReason",
  ]];
  for (const r of review.references) {
    rows.push([
      r.id,
      r.title,
      r.authors,
      r.year ?? "",
      r.journal ?? "",
      r.doi ?? "",
      r.pmid ?? "",
      r.decision ?? "",
      r.excludeReason ?? "",
    ]);
  }
  return rows;
}

/** Flatten a single outcome's data points (from both top-level + subgroups). */
function flattenOutcomeDataPoints(
  comparison: Comparison,
  outcome: Outcome,
  studyLabelById: Map<string, Study>,
): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = [];
  const collect = (dp: DataPoint) => {
    const study = studyLabelById.get(dp.studyId);
    rows.push([
      outcome.id,
      comparison.name,
      outcome.name,
      dp.studyId,
      study?.label ?? "",
      dp.subgroupId ?? "",
      dp.events1 ?? "",
      dp.total1 ?? "",
      dp.events2 ?? "",
      dp.total2 ?? "",
      dp.mean1 ?? "",
      dp.sd1 ?? "",
      dp.n1 ?? "",
      dp.mean2 ?? "",
      dp.sd2 ?? "",
      dp.n2 ?? "",
      dp.oE ?? "",
      dp.v ?? "",
      dp.effect ?? "",
      dp.se ?? "",
      dp.tp ?? "",
      dp.fp ?? "",
      dp.fn ?? "",
      dp.tn ?? "",
    ]);
  };
  for (const dp of outcome.dataPoints) collect(dp);
  for (const sg of outcome.subgroups) {
    for (const dp of sg.dataPoints) collect(dp);
  }
  return rows;
}

/**
 * Data-points table (header + 1 row per data point). Walks every outcome in
 * every comparison, including subgroup-scoped points. Includes the
 * comparison/outcome names and study label as human-readable context.
 */
export function buildDataPointsCsv(review: Review): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = [[
    "outcomeId",
    "comparisonName",
    "outcomeName",
    "studyId",
    "studyLabel",
    "subgroupId",
    "events1",
    "total1",
    "events2",
    "total2",
    "mean1",
    "sd1",
    "n1",
    "mean2",
    "sd2",
    "n2",
    "oE",
    "v",
    "effect",
    "se",
    "tp",
    "fp",
    "fn",
    "tn",
  ]];
  const studyLabelById = new Map<string, Study>(
    review.studies.map((s) => [s.id, s]),
  );
  for (const cmp of review.comparisons) {
    for (const out of cmp.outcomes) {
      const dpRows = flattenOutcomeDataPoints(cmp, out, studyLabelById);
      for (const r of dpRows) rows.push(r);
    }
  }
  return rows;
}

/** RoB assessments table (header + 1 row per assessment). */
export function buildRobAssessmentsCsv(review: Review): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = [[
    "studyId",
    "studyLabel",
    "tool",
    "overallJudgement",
    "domainJudgements",
    "signallingAnswers",
  ]];
  const studyLabelById = new Map<string, Study>(
    review.studies.map((s) => [s.id, s]),
  );
  for (const a of review.robAssessments) {
    const study = studyLabelById.get(a.studyId);
    rows.push([
      a.studyId,
      study?.label ?? "",
      a.tool,
      a.overallJudgement ?? "",
      JSON.stringify(a.domainJudgements ?? {}),
      JSON.stringify(a.signallingAnswers ?? {}),
    ]);
  }
  return rows;
}

/** QUADAS-3 estimate-level assessment table. */
export function buildQuadas3Csv(review: Review): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = [[
    "studyId",
    "studyLabel",
    "question",
    "estimate",
    "numericalResult",
    "overallRiskOfBias",
    "overallApplicability",
    "domainAssessments",
  ]];
  const workspace = review.quadas3;
  if (!workspace) return rows;
  for (const estimate of workspace.estimates) {
    const overall = getEstimateJudgements(workspace.domainAssessments, estimate.id);
    rows.push([
      estimate.studyId,
      review.studies.find((study) => study.id === estimate.studyId)?.label ?? "",
      workspace.synthesisQuestions.find((question) => question.id === estimate.questionId)?.question ?? "",
      estimate.label,
      estimate.numericalResult,
      overall.risk,
      overall.applicability,
      JSON.stringify(workspace.domainAssessments.filter((assessment) => assessment.estimateId === estimate.id)),
    ]);
  }
  return rows;
}

/**
 * Build the PRISMA flow as a JSON string. Falls back to the canonical 11-box
 * template with 0 counts if the review has no flow yet.
 */
export function buildPrismaFlowJson(review: Review): string {
  const flow =
    review.prismaFlow && review.prismaFlow.boxes.length > 0
      ? review.prismaFlow
      : {
          reviewId: review.id,
          boxes: PRISMA_TEMPLATE.map((def) => ({
            id: def.id,
            label: def.label,
            count: 0,
            autoCount: false,
          })),
        };
  return JSON.stringify(flow, null, 2);
}

/**
 * Build a single combined CSV file with all four tables concatenated. Each
 * section is preceded by a `# Section: <name>` header row and a blank
 * separator row so Excel/Numbers render it readably. The PRISMA flow is
 * included as a JSON-stringified row block.
 */
export function buildCombinedCsv(review: Review): string {
  const sections: Array<{ name: string; rows: Array<Array<string | number | null>> }> = [
    { name: "studies", rows: buildStudiesCsv(review) },
    { name: "references", rows: buildReferencesCsv(review) },
    { name: "data-points", rows: buildDataPointsCsv(review) },
    { name: "rob-assessments", rows: buildRobAssessmentsCsv(review) },
    { name: "quadas-3", rows: buildQuadas3Csv(review) },
  ];

  const lines: string[] = [];
  lines.push(`# RevKit export — review: ${review.title} (${review.id})`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Type: ${review.type} · Status: ${review.status} · Phase: ${review.phase}`);
  lines.push("");

  for (const section of sections) {
    lines.push(`# Section: ${section.name}`);
    lines.push(toCsv(section.rows));
    lines.push("");
  }

  // PRISMA flow as JSON (kept on a single line so CSV parsers don't get confused).
  const prismaJson = buildPrismaFlowJson(review).replace(/\r?\n\s*/g, " ");
  lines.push("# Section: prisma-flow (JSON)");
  lines.push("reviewId,boxes");
  lines.push(`"${(prismaJson).replace(/"/g, '""')}",`);
  lines.push("");

  return lines.join("\r\n");
}

/**
 * Build a flat list of {filename, content} pairs for all individual CSV
 * exports. Useful if a caller wants to trigger multiple downloads (or wrap
 * them in a future jszip-based zip).
 */
export function buildIndividualCsvFiles(
  review: Review,
): Array<{ filename: string; content: string; mime: string }> {
  return [
    {
      filename: "studies.csv",
      content: toCsv(buildStudiesCsv(review)),
      mime: "text/csv;charset=utf-8",
    },
    {
      filename: "references.csv",
      content: toCsv(buildReferencesCsv(review)),
      mime: "text/csv;charset=utf-8",
    },
    {
      filename: "data-points.csv",
      content: toCsv(buildDataPointsCsv(review)),
      mime: "text/csv;charset=utf-8",
    },
    {
      filename: "rob-assessments.csv",
      content: toCsv(buildRobAssessmentsCsv(review)),
      mime: "text/csv;charset=utf-8",
    },
    {
      filename: "prisma-flow.json",
      content: buildPrismaFlowJson(review),
      mime: "application/json;charset=utf-8",
    },
  ];
}

/** Type re-exports for callers who need the helper return shapes. */
export type { Reference, RobAssessment };
