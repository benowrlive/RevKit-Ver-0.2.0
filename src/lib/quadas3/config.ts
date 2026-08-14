import type {
  Quadas3Answer,
  Quadas3DomainAssessment,
  Quadas3DomainId,
  Quadas3Judgement,
  Quadas3Workspace,
} from "@/lib/types";

export const QUADAS3_VERSION = "1.2" as const;
export const QUADAS3_SOURCE_URL =
  "https://www.bristol.ac.uk/population-health-sciences/projects/quadas/quadas-3/";

export interface Quadas3DomainDefinition {
  id: Quadas3DomainId;
  name: string;
  descriptionPrompt: string;
  questions: { id: string; text: string }[];
  applicabilityPrompt?: string;
}

export const QUADAS3_DOMAINS: Quadas3DomainDefinition[] = [
  {
    id: "D1",
    name: "Participants",
    descriptionPrompt:
      "Describe enrolment, sampling, and any restrictions. Note whether the design was single-gate or multi-gate and prospective or retrospective.",
    questions: [
      { id: "Q3_D1_Q1", text: "Was a single-gate design used?" },
      { id: "Q3_D1_Q2", text: "Were participants prospectively enrolled?" },
      { id: "Q3_D1_Q3", text: "Was a consecutive or random sample of participants included?" },
      { id: "Q3_D1_Q4", text: "Is the study group a representative sample of the intended-use population?" },
    ],
    applicabilityPrompt:
      "Do the included participants match those in the ideal test accuracy trial?",
  },
  {
    id: "D2",
    name: "Index test",
    descriptionPrompt:
      "Describe the index test, how it was conducted and interpreted, what information was available, and how any threshold was selected.",
    questions: [
      { id: "Q3_D2_Q1", text: "Was the index test conducted and interpreted according to the recommended instructions?" },
      { id: "Q3_D2_Q2", text: "Were the index test results interpreted without knowledge of the reference standard results?" },
      { id: "Q3_D2_Q3", text: "Were the index test results interpreted with the same information as would be available in practice?" },
      { id: "Q3_D2_Q4", text: "If a threshold was used, was it standard or pre-specified?" },
    ],
    applicabilityPrompt:
      "Do the index test, its conduct, and interpretation match the ideal test accuracy trial?",
  },
  {
    id: "D3",
    name: "Target condition",
    descriptionPrompt:
      "Define the target condition, reference standard, conduct and interpretation, and the interval between index test and reference standard.",
    questions: [
      { id: "Q3_D3_Q1", text: "Does the reference standard adequately identify those with and without the target condition?" },
      { id: "Q3_D3_Q2", text: "Was the target condition assessed in all participants?" },
      { id: "Q3_D3_Q3", text: "Was the target condition assessed in the same way in all participants?" },
      { id: "Q3_D3_Q4", text: "Did the reference standard avoid incorporating the index test?" },
      { id: "Q3_D3_Q5", text: "Was the reference standard conducted and interpreted according to the recommended instructions?" },
      { id: "Q3_D3_Q6", text: "Were reference standard results interpreted without knowledge of the index test results?" },
      { id: "Q3_D3_Q7", text: "If a reference-standard threshold was used, was it standard or pre-specified?" },
      { id: "Q3_D3_Q8", text: "Was there an appropriate interval between index test and reference standard?" },
    ],
    applicabilityPrompt:
      "Does the target condition defined by the reference standard match the ideal test accuracy trial?",
  },
  {
    id: "D4",
    name: "Analysis",
    descriptionPrompt:
      "Describe exclusions from the 2x2 table, handling of missing data, the unit of analysis, and any non-standard analysis methods.",
    questions: [
      { id: "Q3_D4_Q1", text: "Were all participants included in the analysis?" },
      { id: "Q3_D4_Q2", text: "Were missing data handled appropriately?" },
      { id: "Q3_D4_Q3", text: "Does the unit of analysis match the ideal test accuracy trial?" },
      { id: "Q3_D4_Q4", text: "Were sensitivity and specificity calculated appropriately?" },
    ],
  },
];

export const QUADAS3_ANSWER_OPTIONS: {
  value: Quadas3Answer;
  short: string;
  label: string;
}[] = [
  { value: "yes", short: "Y", label: "Yes" },
  { value: "py", short: "PY", label: "Probably yes" },
  { value: "pn", short: "PN", label: "Probably no" },
  { value: "no", short: "N", label: "No" },
  { value: "ni", short: "NI", label: "No information" },
];

export const QUADAS3_JUDGEMENTS: {
  value: Quadas3Judgement;
  label: string;
  color: string;
}[] = [
  { value: "low", label: "Low", color: "#10b981" },
  { value: "high", label: "High", color: "#f43f5e" },
  {
    value: "insufficient_information",
    label: "Insufficient information",
    color: "#94a3b8",
  },
];

export function createQuadas3Workspace(
  researchQuestion?: string | null,
): Quadas3Workspace {
  const now = new Date().toISOString();
  return {
    version: QUADAS3_VERSION,
    synthesisQuestions: researchQuestion
      ? [
          {
            id: "q3q_1",
            label: "Synthesis question 1",
            question: researchQuestion,
            population: "",
            indexTests: "",
            targetCondition: "",
          },
        ]
      : [],
    idealTrials: [],
    studyFlows: [],
    estimates: [],
    domainAssessments: [],
    overallJudgements: [],
    updatedAt: now,
  };
}

export function quadas3OverallJudgement(
  values: Array<Quadas3Judgement | undefined>,
): Quadas3Judgement {
  if (values.some((value) => value === "high")) return "high";
  if (values.length > 0 && values.every((value) => value === "low")) return "low";
  return "insufficient_information";
}

export function getEstimateJudgements(
  assessments: Quadas3DomainAssessment[],
  estimateId: string,
): { risk: Quadas3Judgement; applicability: Quadas3Judgement } {
  const estimateAssessments = assessments.filter(
    (assessment) => assessment.estimateId === estimateId,
  );
  const risk = quadas3OverallJudgement(
    QUADAS3_DOMAINS.map(
      (domain) =>
        estimateAssessments.find((assessment) => assessment.domainId === domain.id)
          ?.riskJudgement,
    ),
  );
  const applicability = quadas3OverallJudgement(
    QUADAS3_DOMAINS.filter((domain) => Boolean(domain.applicabilityPrompt)).map(
      (domain) =>
        estimateAssessments.find((assessment) => assessment.domainId === domain.id)
          ?.applicabilityJudgement,
    ),
  );
  return { risk, applicability };
}
