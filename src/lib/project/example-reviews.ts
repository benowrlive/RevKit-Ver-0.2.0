import { newId } from "@/lib/project/id";
import type {
  Comparison,
  DataPoint,
  DataType,
  EffectMeasure,
  MethodType,
  ModelType,
  Outcome,
  Reference,
  Review,
  ReviewSubType,
  ReviewType,
  Study,
} from "@/lib/types";

export interface ExampleReviewDefinition {
  type: ReviewType;
  label: string;
  title: string;
  description: string;
  studyCount: number;
}

export const EXAMPLE_REVIEWS: ExampleReviewDefinition[] = [
  {
    type: "INTERVENTION",
    label: "Intervention",
    title: "Aspirin after myocardial infarction",
    description: "Compare treatment effects with dichotomous outcome data.",
    studyCount: 5,
  },
  {
    type: "DTA",
    label: "Diagnostic test",
    title: "Rapid tests for influenza",
    description: "Explore 2 x 2 accuracy data and diagnostic pooling.",
    studyCount: 4,
  },
  {
    type: "METHODOLOGY",
    label: "Methodology",
    title: "Machine-assisted study screening",
    description: "Compare review methods and screening performance.",
    studyCount: 4,
  },
  {
    type: "OVERVIEW",
    label: "Overview of reviews",
    title: "Exercise for chronic low back pain",
    description: "Bring findings from several systematic reviews together.",
    studyCount: 4,
  },
  {
    type: "FLEXIBLE",
    label: "Flexible / qualitative",
    title: "Experiences of remote primary care",
    description: "Organise study notes, themes, and a custom synthesis.",
    studyCount: 4,
  },
];

interface StudySeed {
  label: string;
  year: number;
  authors: string;
  design: string;
  notes?: string;
  indexTest?: string;
  referenceStandard?: string;
}

interface OutcomeSeed {
  name: string;
  dataType: DataType;
  effectMeasure: EffectMeasure;
  method: MethodType;
  model: ModelType;
  timeFrame?: string;
  unit?: string;
}

function makeStudy(reviewId: string, seed: StudySeed, now: string): Study {
  return {
    id: newId("std"),
    reviewId,
    label: seed.label,
    year: seed.year,
    authors: seed.authors,
    doi: null,
    pdfPath: null,
    status: "included",
    excludeReason: null,
    design: seed.design,
    picos: null,
    indexTest: seed.indexTest ?? null,
    referenceStandard: seed.referenceStandard ?? null,
    notes: seed.notes ?? "Illustrative example data.",
    createdAt: now,
    updatedAt: now,
  };
}

function makeReference(reviewId: string, study: Study): Reference {
  return {
    id: newId("ref"),
    reviewId,
    title: `${study.label}: illustrative report`,
    authors: study.authors ?? "Example research group",
    year: study.year,
    journal: "Example Evidence Journal",
    doi: null,
    pmid: null,
    rawRis: null,
    stage: "full_text",
    decision: "INCLUDE",
    excludeReason: null,
  };
}

function makeComparison(
  reviewId: string,
  name: string,
  outcomeSeed: OutcomeSeed,
  studies: Study[],
  values: Partial<DataPoint>[],
): Comparison {
  const comparisonId = newId("cmp");
  const outcomeId = newId("out");
  const dataPoints: DataPoint[] = studies.map((study, index) => ({
    id: newId("dp"),
    outcomeId,
    subgroupId: null,
    studyId: study.id,
    order: index,
    ...values[index],
  }));
  const outcome: Outcome = {
    id: outcomeId,
    comparisonId,
    name: outcomeSeed.name,
    dataType: outcomeSeed.dataType,
    effectMeasure: outcomeSeed.effectMeasure,
    method: outcomeSeed.method,
    model: outcomeSeed.model,
    unit: outcomeSeed.unit ?? null,
    timeFrame: outcomeSeed.timeFrame ?? null,
    order: 0,
    subgroups: [],
    dataPoints,
  };
  return {
    id: comparisonId,
    reviewId,
    name,
    order: 0,
    outcomes: [outcome],
  };
}

function makeReviewBase(input: {
  type: ReviewType;
  subType?: ReviewSubType;
  title: string;
  researchQuestion: string;
  phase?: Review["phase"];
  studySeeds: StudySeed[];
  comparison?: {
    name: string;
    outcome: OutcomeSeed;
    values: Partial<DataPoint>[];
  };
}): Review {
  const now = new Date().toISOString();
  const reviewId = newId("rev");
  const studies = input.studySeeds.map((seed) => makeStudy(reviewId, seed, now));
  const comparisons = input.comparison
    ? [makeComparison(reviewId, input.comparison.name, input.comparison.outcome, studies, input.comparison.values)]
    : [];
  return {
    id: reviewId,
    title: `${input.title} (example)`,
    researchQuestion: input.researchQuestion,
    type: input.type,
    subType: input.subType ?? null,
    status: "in_progress",
    phase: input.phase ?? "analysis",
    createdAt: now,
    updatedAt: now,
    comparisons,
    studies,
    references: studies.map((study) => makeReference(reviewId, study)),
    robAssessments: [],
    prismaFlow: null,
  };
}

function interventionExample(): Review {
  return makeReviewBase({
    type: "INTERVENTION",
    title: "Aspirin after myocardial infarction",
    researchQuestion: "In adults with a previous myocardial infarction, does aspirin reduce all-cause mortality compared with placebo?",
    studySeeds: [
      { label: "Northfield Trial 1974", year: 1974, authors: "Example Cardiology Group", design: "RCT — parallel" },
      { label: "Harbour Trial 1976", year: 1976, authors: "Harbour Collaborative", design: "RCT — parallel" },
      { label: "Westbridge Trial 1979", year: 1979, authors: "Westbridge Investigators", design: "RCT — parallel" },
      { label: "Multicentre Trial 1980", year: 1980, authors: "Example Multicentre Group", design: "RCT — parallel" },
      { label: "International Trial 1988", year: 1988, authors: "International Example Collaborative", design: "RCT — parallel" },
    ],
    comparison: {
      name: "Aspirin vs placebo",
      outcome: {
        name: "All-cause mortality",
        dataType: "DICHOTOMOUS",
        effectMeasure: "OR",
        method: "MH",
        model: "fixed",
        timeFrame: "6 months or longer",
      },
      values: [
        { events1: 18, total1: 615, events2: 22, total2: 624 },
        { events1: 7, total1: 758, events2: 10, total2: 771 },
        { events1: 49, total1: 832, events2: 49, total2: 850 },
        { events1: 237, total1: 2267, events2: 220, total2: 2257 },
        { events1: 110, total1: 8587, events2: 175, total2: 8600 },
      ],
    },
  });
}

function dtaExample(): Review {
  return makeReviewBase({
    type: "DTA",
    title: "Rapid antigen tests for influenza",
    researchQuestion: "How accurately do rapid antigen tests identify influenza in people with acute respiratory symptoms?",
    studySeeds: [
      { label: "City Clinic 2018", year: 2018, authors: "City Diagnostics Group", design: "DTA — cohort", indexTest: "Rapid antigen test", referenceStandard: "RT-PCR" },
      { label: "Winter Study 2019", year: 2019, authors: "Winter Surveillance Network", design: "DTA — cohort", indexTest: "Rapid antigen test", referenceStandard: "RT-PCR" },
      { label: "Community Study 2020", year: 2020, authors: "Community Health Collaborative", design: "DTA — cohort", indexTest: "Rapid antigen test", referenceStandard: "RT-PCR" },
      { label: "Urgent Care Study 2021", year: 2021, authors: "Urgent Care Research Group", design: "DTA — cohort", indexTest: "Rapid antigen test", referenceStandard: "RT-PCR" },
    ],
    comparison: {
      name: "Rapid antigen test vs RT-PCR",
      outcome: {
        name: "Influenza diagnosis",
        dataType: "DTA_2x2",
        effectMeasure: "DOR",
        method: "LOGIT_UNIVARIATE",
        model: "random",
      },
      values: [
        { tp: 82, fp: 18, fn: 16, tn: 184 },
        { tp: 64, fp: 12, fn: 21, tn: 153 },
        { tp: 103, fp: 27, fn: 24, tn: 246 },
        { tp: 71, fp: 9, fn: 19, tn: 171 },
      ],
    },
  });
}

function methodologyExample(): Review {
  return makeReviewBase({
    type: "METHODOLOGY",
    title: "Machine-assisted study screening",
    researchQuestion: "Does machine-assisted citation screening reduce workload without increasing missed eligible studies?",
    studySeeds: [
      { label: "Screening Methods Study A", year: 2019, authors: "Evidence Methods Lab", design: "Cohort — retrospective" },
      { label: "Screening Methods Study B", year: 2020, authors: "Review Science Unit", design: "Cohort — prospective" },
      { label: "Screening Methods Study C", year: 2022, authors: "Open Synthesis Group", design: "Cross-sectional" },
      { label: "Screening Methods Study D", year: 2023, authors: "Methods Evaluation Network", design: "Cohort — retrospective" },
    ],
    comparison: {
      name: "Machine-assisted vs manual screening",
      outcome: {
        name: "Eligible reports missed",
        dataType: "DICHOTOMOUS",
        effectMeasure: "RR",
        method: "MH",
        model: "random",
      },
      values: [
        { events1: 1, total1: 82, events2: 1, total2: 82 },
        { events1: 2, total1: 116, events2: 1, total2: 116 },
        { events1: 0, total1: 74, events2: 1, total2: 74 },
        { events1: 2, total1: 143, events2: 2, total2: 143 },
      ],
    },
  });
}

function overviewExample(): Review {
  return makeReviewBase({
    type: "OVERVIEW",
    title: "Exercise for chronic low back pain",
    researchQuestion: "What do existing systematic reviews conclude about exercise for adults with chronic low back pain?",
    studySeeds: [
      { label: "Strength Exercise Review 2018", year: 2018, authors: "Musculoskeletal Evidence Group", design: "Other", notes: "Systematic review of strengthening programmes. Illustrative example data." },
      { label: "Motor Control Review 2019", year: 2019, authors: "Movement Research Collaborative", design: "Other", notes: "Systematic review of motor control exercise. Illustrative example data." },
      { label: "Aerobic Exercise Review 2021", year: 2021, authors: "Rehabilitation Synthesis Unit", design: "Other", notes: "Systematic review of aerobic exercise. Illustrative example data." },
      { label: "Mixed Exercise Review 2023", year: 2023, authors: "Back Pain Review Network", design: "Other", notes: "Systematic review of mixed exercise programmes. Illustrative example data." },
    ],
    comparison: {
      name: "Exercise vs usual care",
      outcome: {
        name: "Pain intensity",
        dataType: "GIV",
        effectMeasure: "SMD",
        method: "IV",
        model: "random",
        timeFrame: "Short-term follow-up",
      },
      values: [
        { effect: -0.34, se: 0.11 },
        { effect: -0.27, se: 0.09 },
        { effect: -0.19, se: 0.08 },
        { effect: -0.31, se: 0.1 },
      ],
    },
  });
}

function flexibleExample(): Review {
  return makeReviewBase({
    type: "FLEXIBLE",
    subType: "QUALITATIVE",
    title: "Patient experiences of remote primary care",
    researchQuestion: "How do patients describe the barriers and facilitators to using remote primary care?",
    phase: "extraction",
    studySeeds: [
      { label: "Urban Interviews 2020", year: 2020, authors: "Patient Experience Unit", design: "Other", notes: "Theme: convenience and reduced travel. Illustrative example data." },
      { label: "Rural Focus Groups 2021", year: 2021, authors: "Rural Health Collaborative", design: "Other", notes: "Theme: connectivity and digital access. Illustrative example data." },
      { label: "Older Adults Study 2022", year: 2022, authors: "Healthy Ageing Research Group", design: "Other", notes: "Theme: confidence with technology and preference for continuity. Illustrative example data." },
      { label: "Mixed-Methods Survey 2023", year: 2023, authors: "Primary Care Innovation Lab", design: "Cross-sectional", notes: "Theme: speed of access balanced against communication quality. Illustrative example data." },
    ],
  });
}

export function createExampleReview(type: ReviewType): Review {
  switch (type) {
    case "DTA":
      return dtaExample();
    case "METHODOLOGY":
      return methodologyExample();
    case "OVERVIEW":
      return overviewExample();
    case "FLEXIBLE":
      return flexibleExample();
    case "INTERVENTION":
    default:
      return interventionExample();
  }
}
