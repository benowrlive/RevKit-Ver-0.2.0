import { downloadText, slugify } from "@/lib/export/download";
import { newId } from "@/lib/project/id";
import type {
  DtaProtocolQuestion,
  ProsperoFieldId,
  ProtocolWorkspace,
  Review,
  ReviewType,
} from "@/lib/types";

export type ProtocolSectionId = "basics" | "eligibility" | "methods" | "administration";

export interface ProsperoFieldDefinition {
  id: ProsperoFieldId;
  section: ProtocolSectionId;
  prompt: string;
  help: string;
  example: string;
  required?: boolean;
  short?: boolean;
}

export const PROSPERO_FIELDS: ProsperoFieldDefinition[] = [
  { id: "condition", section: "basics", prompt: "What condition or health area is being studied?", help: "Name the target condition and the clinical domain in plain language.", example: "Sepsis across adult, pregnant, paediatric, and neonatal populations", required: true, short: true },
  { id: "rationale", section: "basics", prompt: "Why is this review needed now?", help: "Explain the evidence gap, clinical uncertainty, and who will benefit from the answer.", example: "Rapid bedside tests may shorten time to treatment where laboratory confirmation is delayed or unavailable.", required: true },
  { id: "objective", section: "basics", prompt: "What will the review determine?", help: "State one primary objective. For diagnostic reviews, name accuracy measures and the target condition.", example: "To estimate the sensitivity and specificity of clinical scores and point-of-care tests for diagnosing sepsis.", required: true },
  { id: "keywords", section: "basics", prompt: "Which keywords describe the review?", help: "Use semicolon-separated terms that another researcher would search for.", example: "Sepsis; diagnostic test accuracy; point-of-care test; clinical score", short: true },
  { id: "country", section: "basics", prompt: "Which country is the review team based in?", help: "Use the country requested in the registration record.", example: "India", short: true },

  { id: "populationIncluded", section: "eligibility", prompt: "Who will be included?", help: "Describe suspected-condition criteria, age groups, settings, timing, and important treatment restrictions.", example: "People with suspected sepsis in hospital or community settings, assessed early in the illness.", required: true },
  { id: "populationExcluded", section: "eligibility", prompt: "Who or what will be excluded?", help: "List exclusions that could change test accuracy or make studies inapplicable.", example: "Healthy controls, late sepsis testing, unclear populations, or prolonged antibiotics before reference testing." },
  { id: "indexTests", section: "eligibility", prompt: "Which index tests will be evaluated?", help: "Group tests where useful, then list named tests, scores, signs, or thresholds.", example: "Clinical scores; CRP; procalcitonin; lactate; total leukocyte count", required: true },
  { id: "referenceStandards", section: "eligibility", prompt: "What will count as the reference standard?", help: "List each acceptable reference standard. Separate analyses can be planned for each one.", example: "Blood culture; pre-specified clinical consensus definition", required: true },
  { id: "studyDesignIncluded", section: "eligibility", prompt: "Which study designs will be included?", help: "Describe the design and whether index and reference tests must be applied to the same participants.", example: "Prospective or cross-sectional fully paired diagnostic-accuracy studies.", required: true },
  { id: "studyDesignExcluded", section: "eligibility", prompt: "Which study designs will be excluded?", help: "Explain exclusions such as two-gate case-control designs or studies without an adequate reference standard.", example: "Healthy-control case-control studies, laboratory-only comparisons, and prognostic-only studies." },
  { id: "context", section: "eligibility", prompt: "In which settings will the evidence apply?", help: "Describe clinical setting, level of care, geography, and resource constraints.", example: "Emergency, ward, intensive-care, maternity, paediatric, and neonatal settings, including LMICs." },

  { id: "databases", section: "methods", prompt: "Which databases and registers will be searched?", help: "Give the platform when it matters, for example MEDLINE via Ovid.", example: "MEDLINE, Embase, CENTRAL, Scopus, and relevant trial registers", required: true },
  { id: "searchLimits", section: "methods", prompt: "Will language or date limits be used?", help: "State and justify restrictions. Write 'None' when there are no limits.", example: "No date restrictions; English-language reports only." },
  { id: "otherSources", section: "methods", prompt: "How else will studies be found?", help: "Include citation searching, expert contact, reference lists, grey literature, or study registers.", example: "Backward and forward citation searching, author contact, and reference-list checking." },
  { id: "selectionProcess", section: "methods", prompt: "How will studies be selected?", help: "State the number of reviewers and how disagreements will be resolved.", example: "Two reviewers will screen independently; disagreements will be resolved by discussion or a third reviewer.", required: true },
  { id: "extractionProcess", section: "methods", prompt: "How will data be extracted and checked?", help: "Describe duplicate extraction or checking, missing-data contact, and the main data groups.", example: "One reviewer will extract and a second will check; authors will be contacted for missing 2 x 2 data.", required: true },
  { id: "riskOfBiasTool", section: "methods", prompt: "Which risk-of-bias tool will be used?", help: "Choose a tool that matches the unit being appraised. DTA primary studies use QUADAS-3; systematic reviews may use AMSTAR 2 or ROBIS.", example: "QUADAS-3 v1.2, completed independently by two reviewers", required: true, short: true },
  { id: "reportingBias", section: "methods", prompt: "How will missing results or reporting bias be considered?", help: "Diagnostic publication-bias methods are limited, so describe a cautious, pre-specified approach.", example: "We will compare protocols with reports and discuss selective non-reporting; formal funnel methods will be used only when defensible." },
  { id: "certaintyAssessment", section: "methods", prompt: "How will certainty in the evidence be judged?", help: "Describe the framework and whether sensitivity and specificity will be assessed separately.", example: "GRADE for diagnostic test accuracy, considering risk of bias, indirectness, inconsistency, imprecision, and publication bias." },
  { id: "mainOutcomes", section: "methods", prompt: "What are the main outcomes?", help: "Prioritise the measures that answer the objective. Avoid listing measures that will not be synthesised.", example: "Sensitivity, specificity, likelihood ratios, diagnostic odds ratio, and 2 x 2 data", required: true },
  { id: "additionalOutcomes", section: "methods", prompt: "What additional outcomes will be collected?", help: "Include operational or clinical outcomes only when they are part of the protocol.", example: "Time to result, test failure, antibiotic exposure, and setting-specific feasibility." },
  { id: "synthesisPlan", section: "methods", prompt: "How will results be combined and differences explored?", help: "Name the model, minimum conditions for pooling, planned subgroups, and sensitivity analyses.", example: "Use bivariate random-effects or HSROC models where clinically appropriate; stratify by population and reference standard.", required: true },

  { id: "timeline", section: "administration", prompt: "What are the planned start and completion dates?", help: "Use clear dates and make sure the review has not progressed beyond PROSPERO eligibility.", example: "Start: 1 September 2026; completion: 31 August 2027", required: true, short: true },
  { id: "protocolAvailability", section: "administration", prompt: "Where will the full protocol be available?", help: "State whether it is uploaded, published, embargoed, or available on request.", example: "The full protocol will be uploaded to PROSPERO and deposited in an institutional repository." },
  { id: "reviewStage", section: "administration", prompt: "What work has started or finished?", help: "Record pilot searching, formal searching, screening, extraction, risk-of-bias assessment, and synthesis separately.", example: "Pilot searches started; formal screening, extraction, appraisal, and synthesis not started.", required: true },
  { id: "teamMembers", section: "administration", prompt: "Who is on the review team?", help: "List each member, affiliation, email, country, role, and conflict-of-interest status.", example: "Name - Institution - email - country - role - conflict declaration", required: true },
  { id: "affiliationFunding", section: "administration", prompt: "What are the affiliation and funding arrangements?", help: "Name the lead organisation, funder, grant number, and the funder's role.", example: "Lead institution: ...; funder: ...; grant: ...; funder had no role in protocol decisions.", required: true },
  { id: "peerReviewConflicts", section: "administration", prompt: "Has the protocol been peer reviewed, and are there conflicts?", help: "Describe peer review and any team-level interests not already recorded for individuals.", example: "Protocol reviewed internally by a diagnostic-methods specialist; no additional conflicts." },
  { id: "meshTerms", section: "administration", prompt: "Which MeSH terms fit the review?", help: "Use controlled vocabulary for the condition, population, index tests, and reference standards.", example: "Sepsis; Blood Culture; Point-of-Care Testing; C-Reactive Protein", short: true },
  { id: "similarReviews", section: "administration", prompt: "Which similar reviews or registrations were found?", help: "Record identifiers and explain why this review is still needed or how its scope differs.", example: "CRD... - differs by population, reference standard, index tests, or planned synthesis.", required: true },
];

export const PROSPERO_SECTION_LABELS: Record<ProtocolSectionId, string> = {
  basics: "Purpose",
  eligibility: "Eligibility",
  methods: "Methods",
  administration: "Registration",
};

function defaultRiskTool(type: ReviewType): string {
  if (type === "DTA") return "QUADAS-3 v1.2";
  if (type === "OVERVIEW") return "AMSTAR 2 and/or ROBIS, selected according to the review question";
  if (type === "INTERVENTION") return "RoB 2 for randomized studies and ROBINS-I for non-randomized studies";
  return "Select a validated tool that matches the included evidence";
}

export function buildDtaQuestion(question: DtaProtocolQuestion, workspace: ProtocolWorkspace): string {
  const condition = workspace.answers.condition?.trim() || "the target condition";
  const tests = workspace.answers.indexTests?.trim() || "the index test(s)";
  const population = question.population.trim() || "the target population";
  const reference = question.referenceStandard.trim() || "the reference standard";
  return `In ${population}, how accurately do ${tests} identify ${condition} compared with ${reference}?`;
}

export function createProtocolWorkspace(
  input: { title: string; type: ReviewType; researchQuestion?: string | null },
  pico: Record<string, string> = {},
): ProtocolWorkspace {
  const population = pico.population?.trim() ?? "";
  const reference = (pico.referenceStandard || pico.comparator)?.trim() ?? "";
  const question: DtaProtocolQuestion[] = input.type === "DTA" && (population || reference)
    ? [{ id: newId("pird"), population, referenceStandard: reference, notes: "" }]
    : [];
  return {
    version: "1.0",
    framework: input.type === "DTA" ? "PIRD" : "PICO",
    answers: {
      condition: pico.condition ?? "",
      objective: input.researchQuestion ?? "",
      populationIncluded: population,
      indexTests: pico.test || pico.intervention || "",
      referenceStandards: reference,
      riskOfBiasTool: defaultRiskTool(input.type),
    },
    dtaQuestions: question,
    updatedAt: new Date().toISOString(),
  };
}

export function createSepsisDtaTemplate(base: ProtocolWorkspace): ProtocolWorkspace {
  const pairs = [
    ["adults with suspected sepsis", "blood culture"],
    ["adults with suspected sepsis", "a pre-specified clinical consensus definition"],
    ["pregnant people with suspected sepsis", "blood culture"],
    ["pregnant people with suspected sepsis", "a pre-specified clinical consensus definition"],
    ["children with suspected sepsis", "blood culture"],
    ["children with suspected sepsis", "a pre-specified clinical consensus definition"],
    ["neonates with suspected sepsis", "blood culture"],
  ] as const;
  return {
    ...base,
    framework: "PIRD",
    answers: {
      ...base.answers,
      condition: "sepsis",
      rationale: "Clinical scores and rapid point-of-care tests may support earlier diagnosis and treatment where microbiological confirmation is delayed, insensitive, or unavailable. Accuracy may differ by age, pregnancy status, clinical setting, and reference standard.",
      objective: "To determine the diagnostic accuracy of clinical scores, clinical signs, and point-of-care tests for diagnosing sepsis, stratified by population and reference standard.",
      keywords: "Sepsis; diagnostic test accuracy; clinical score; point-of-care test; blood culture; consensus definition",
      populationIncluded: "Adults, pregnant people, children, and neonates with suspected sepsis, analysed as separate populations.",
      populationExcluded: "Healthy controls, laboratory-only comparisons, prognostic-only studies, unclear populations, and studies in which prior treatment or timing makes the reference standard unreliable.",
      indexTests: "Clinical signs and scores; C-reactive protein; procalcitonin; lactate; total leukocyte count; other eligible point-of-care tests",
      referenceStandards: "Blood culture; pre-specified clinical consensus definition",
      studyDesignIncluded: "Prospective cohort or cross-sectional fully paired diagnostic-accuracy studies in which the index test and reference standard are applied to the same participants within an appropriate interval.",
      studyDesignExcluded: "Two-gate healthy-control case-control studies, retrospective studies without reliable test timing, test comparisons without a concurrent reference standard, and prognostic-only studies.",
      context: "Emergency, ward, intensive-care, maternity, paediatric, neonatal, and resource-constrained settings.",
      databases: "MEDLINE, Embase, CENTRAL, Scopus, and relevant study registers",
      selectionProcess: "Two reviewers will screen records independently. Disagreements will be resolved by discussion or a third reviewer.",
      extractionProcess: "One reviewer will extract study, participant, index-test, reference-standard, timing, threshold, and 2 x 2 accuracy data; a second reviewer will check all entries. Authors will be contacted when essential data are missing.",
      riskOfBiasTool: "QUADAS-3 v1.2, completed independently by two reviewers with consensus or third-reviewer resolution",
      certaintyAssessment: "GRADE for diagnostic test accuracy, with sensitivity and specificity considered across risk of bias, indirectness, inconsistency, imprecision, and publication bias.",
      mainOutcomes: "Sensitivity, specificity, positive and negative likelihood ratios, diagnostic odds ratio, and extractable true-positive, false-positive, false-negative, and true-negative counts.",
      synthesisPlan: "Use bivariate random-effects or HSROC models when clinical and methodological homogeneity is adequate. Keep population and reference-standard strata separate, and explore index test, threshold, setting, prior antibiotics, and study quality as pre-specified sources of heterogeneity.",
    },
    dtaQuestions: pairs.map(([population, referenceStandard]) => ({
      id: newId("pird"),
      population,
      referenceStandard,
      notes: "Analyse as a distinct sepsis stratum",
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function protocolCompletion(workspace: ProtocolWorkspace): { complete: number; total: number; percent: number } {
  const required = PROSPERO_FIELDS.filter((field) => field.required);
  const answered = required.filter((field) => Boolean(workspace.answers[field.id]?.trim())).length;
  const dtaPoint = workspace.framework === "PIRD" ? (workspace.dtaQuestions.length > 0 ? 1 : 0) : 0;
  const total = required.length + (workspace.framework === "PIRD" ? 1 : 0);
  const complete = answered + dtaPoint;
  return { complete, total, percent: total ? Math.round((complete / total) * 100) : 0 };
}

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>");
}

export function buildProsperoDraftHtml(review: Review): string {
  const workspace = review.protocol;
  if (!workspace) throw new Error("Start the protocol builder before exporting.");
  const questionRows = workspace.dtaQuestions.map((question, index) =>
    `<tr><td>${index + 1}</td><td>${escapeHtml(question.population)}</td><td>${escapeHtml(question.referenceStandard)}</td><td>${escapeHtml(buildDtaQuestion(question, workspace))}</td></tr>`,
  ).join("");
  const sections = (Object.keys(PROSPERO_SECTION_LABELS) as ProtocolSectionId[]).map((section) => {
    const fields = PROSPERO_FIELDS.filter((field) => field.section === section);
    return `<h2>${escapeHtml(PROSPERO_SECTION_LABELS[section])}</h2>${fields.map((field) => `<h3>${escapeHtml(field.prompt)}</h3><p>${escapeHtml(workspace.answers[field.id]) || "<em>Not completed</em>"}</p>`).join("")}`;
  }).join("");
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>${escapeHtml(review.title)} - PROSPERO draft</title><style>@page{size:A4;margin:2.3cm}body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#10233f;line-height:1.45}h1{font-size:24pt}h2{font-size:17pt;border-bottom:2px solid #1aa7a1;padding-bottom:5pt;margin-top:24pt}h3{font-size:11pt;margin:14pt 0 3pt}p{margin:0 0 8pt}table{border-collapse:collapse;width:100%;font-size:9.5pt}th,td{border:1px solid #b9c7d8;padding:6px;vertical-align:top}th{background:#eaf7f6}em{color:#66758a}.note{padding:10pt;background:#f1f5f9;border-left:4px solid #1aa7a1}</style></head><body><h1>${escapeHtml(review.title)}</h1><p><strong>RevKit protocol and PROSPERO preparation draft</strong></p><p class="note">This working document helps prepare a registration. It is not an official PROSPERO form and should be checked against the live registration fields before submission.</p><h2>Review question</h2><p><strong>Framework:</strong> ${escapeHtml(workspace.framework)}</p><p><strong>Parent question:</strong> ${escapeHtml(review.researchQuestion)}</p>${questionRows ? `<h3>Planned diagnostic strata</h3><table><thead><tr><th>#</th><th>Population</th><th>Reference standard</th><th>Generated question</th></tr></thead><tbody>${questionRows}</tbody></table>` : ""}${sections}<p style="margin-top:28pt;color:#66758a">Generated by RevKit on ${escapeHtml(new Date().toLocaleDateString())}. Review and edit before registration.</p></body></html>`;
}

export function exportProsperoDraft(review: Review): void {
  downloadText(`${slugify(review.title)}-prospero-draft.doc`, buildProsperoDraftHtml(review), "application/msword;charset=utf-8");
}
