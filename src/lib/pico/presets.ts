// src/lib/pico/presets.ts — PICO dropdown data + structured title formats.
//
// Curated lists of common clinical/research terms so users can pick from a
// dropdown instead of typing. Inspired by Rayyan's autocomplete + Cochrane's
// standardized PICO vocabulary. Lists are deliberately short (8-30 items)
// to keep the dropdowns fast + the cognitive load low.
//
// Users can ALWAYS type a custom value — presets are a speed-up, not a
// constraint. The ComboboxInput component handles the free-text fallback.

import type { ReviewType } from "@/lib/types";

// ─── Common health conditions / problems ────────────────────────────────────
// Pulled from the most-frequent Cochrane review topics (heart disease,
// infection, mental health, pain, cancer, etc.).
export const COMMON_CONDITIONS: string[] = [
  "acute sinusitis",
  "asthma",
  "atrial fibrillation",
  "breast cancer",
  "cardiovascular disease",
  "chronic kidney disease",
  "chronic obstructive pulmonary disease",
  "colorectal cancer",
  "community-acquired pneumonia",
  "coronary artery disease",
  "depression",
  "diabetes mellitus type 2",
  "dysmenorrhea",
  "heart failure",
  "hypertension",
  "influenza",
  "low back pain",
  "major depressive disorder",
  "malaria",
  "migraine",
  "multiple sclerosis",
  "osteoarthritis",
  "Parkinson's disease",
  "postpartum hemorrhage",
  "prostate cancer",
  "rheumatoid arthritis",
  "schizophrenia",
  "sepsis",
  "stroke",
  "tuberculosis",
];

// ─── Common interventions (treatments under study) ──────────────────────────
export const COMMON_INTERVENTIONS: string[] = [
  "acetaminophen (paracetamol)",
  "acupuncture",
  "aspirin",
  "beta-blockers",
  "cognitive behavioral therapy",
  "corticosteroids (systemic)",
  "corticosteroids (inhaled)",
  "exercise training",
  "metformin",
  "NSAIDs (non-selective)",
  "NSAIDs (COX-2 selective)",
  "omega-3 fatty acids",
  "probiotics",
  "statins",
  "treatment-as-usual / waiting list",
  "vitamin D supplementation",
  "warfarin",
  "direct oral anticoagulants (DOACs)",
  "ACE inhibitors",
  "angiotensin II receptor blockers (ARBs)",
  "selective serotonin reuptake inhibitors (SSRIs)",
  "serotonin-norepinephrine reuptake inhibitors (SNRIs)",
  "psychodynamic therapy",
  "mindfulness-based stress reduction",
  "surgical resection",
  "radiotherapy",
  "chemotherapy",
];

// ─── Common comparators ──────────────────────────────────────────────────────
export const COMMON_COMPARATORS: string[] = [
  "placebo",
  "no intervention",
  "usual care",
  "standard care",
  "waitlist control",
  "sham procedure",
  "active comparator",
  // Named drugs/interventions are usually picked from COMMON_INTERVENTIONS
];

// ─── Common populations / participant groups ────────────────────────────────
export const COMMON_POPULATIONS: string[] = [
  "adults",
  "older adults (≥ 65 years)",
  "children (under 12)",
  "adolescents (12-18)",
  "pregnant women",
  "postpartum women",
  "neonates",
  "infants (1-23 months)",
  "critically ill patients",
  "community-dwelling adults",
  "hospitalized adults",
  "outpatients",
  "high-risk patients",
  "patients with prior cardiovascular events",
  "patients with chronic kidney disease",
  "patients with heart failure",
  "patients with COPD",
  "patients with type 2 diabetes",
  "patients with cancer",
  "patients with depression",
];

// ─── Common settings ─────────────────────────────────────────────────────────
export const COMMON_SETTINGS: string[] = [
  "low- and middle-income countries (LMICs)",
  "high-income countries",
  "primary care",
  "secondary care",
  "tertiary care",
  "hospital settings",
  "community settings",
  "rural settings",
  "urban settings",
  "low-resource settings",
];

// ─── Common outcomes (per Cochrane core outcome set themes) ────────────────
export const COMMON_OUTCOMES: string[] = [
  "all-cause mortality",
  "cardiovascular mortality",
  "serious adverse events",
  "any adverse event",
  "symptom resolution",
  "disease-specific mortality",
  "quality of life",
  "functional capacity",
  "hospitalization",
  "length of hospital stay",
  "healthcare utilization",
  "treatment adherence",
  "cognitive function",
  "mental health status",
  "social functioning",
  "pain intensity",
  "depression severity",
  "anxiety severity",
];

// ─── Common timepoints ──────────────────────────────────────────────────────
export const COMMON_TIMEPOINTS: string[] = [
  "immediate (same day)",
  "short-term (≤ 7 days)",
  "medium-term (8-30 days)",
  "long-term (> 30 days, ≤ 6 months)",
  "very long-term (> 6 months)",
  "at end of treatment",
  "at end of follow-up",
];

// ─── Common study designs ───────────────────────────────────────────────────
export const COMMON_STUDY_DESIGNS: string[] = [
  "RCT — parallel-group",
  "RCT — crossover",
  "RCT — cluster",
  "RCT — factorial",
  "Quasi-experimental",
  "Prospective cohort",
  "Retrospective cohort",
  "Case-control",
  "Cross-sectional",
  "Case series",
  "DTA — cohort",
  "DTA — case-control",
];

// ─── Common exclusion reasons (Cochrane Handbook v6.4 §4) ───────────────────
export const COMMON_EXCLUDE_REASONS: string[] = [
  "Wrong population",
  "Wrong intervention",
  "Wrong comparator",
  "Wrong outcome",
  "Wrong study design",
  "Not an RCT",
  "Duplicate publication",
  "Withdrawn",
  "Insufficient data",
  "Conference abstract only",
  "Not in English",
  "Protocol-only",
  "Non-human / preclinical",
  "Wrong setting",
  "Wrong timeframe",
];

// ─── Common journals (for references page autocomplete) ─────────────────────
export const COMMON_JOURNALS: string[] = [
  "BMJ",
  "JAMA",
  "The Lancet",
  "NEJM",
  "BMJ Open",
  "PLOS Medicine",
  "BMC Medicine",
  "Cochrane Database of Systematic Reviews",
  "Journal of Clinical Epidemiology",
  "Systematic Reviews",
  "Annals of Internal Medicine",
  "JAMA Internal Medicine",
  "The BMJ",
  "Lancet Public Health",
  "International Journal of Epidemiology",
];

// ─── Common funding sources ─────────────────────────────────────────────────
export const COMMON_FUNDING_SOURCES: string[] = [
  "Government grant",
  "Industry-sponsored",
  "Non-profit foundation",
  "Academic institution",
  "No specific funding",
  "Multiple sources",
  "Investigator-initiated",
  "Co-funded (industry + government)",
];

// ─── PICO structured title formats ─────────────────────────────────────────
//
// Modeled on the legacy RevMan 5 wizard's 4 title-format options, but
// expanded to handle DTA + Methodology + Overview review types.
//
// Each format describes:
//   - id: stable string identifier
//   - label: short user-facing name
//   - description: longer helper text
//   - fields: ordered list of {key, label, conjunctionBefore, suggestionsFrom}
//   - compose: function that builds the title string from field values
//   - appliesTo: review types this format is suggested for (others can pick
//     the Free-form fallback)

export interface PicoFieldDef {
  /** Stable field key (used as state key). */
  key: string;
  /** Label shown above the input. */
  label: string;
  /** Lowercase conjunction shown BEFORE the input (e.g. "for", "versus", "in").
   *  Empty string for the first field. */
  conjunctionBefore: string;
  /** Placeholder text. */
  placeholder: string;
  /** Source list for the autocomplete dropdown. */
  suggestionsFrom?: string[];
  /** Plain-language helper shown beside the field. */
  help?: string;
  /** Concrete example shown in the helper. */
  example?: string;
  /** Required for the format to compose a valid title. */
  required?: boolean;
}

export interface PicoTitleFormat {
  id: string;
  label: string;
  description: string;
  fields: PicoFieldDef[];
  /** Composes the final title string from field values. Empty fields skipped. */
  compose: (values: Record<string, string>) => string;
  /** Suggested for these review types (others use Free-form). */
  appliesTo: ReviewType[];
}

const composeFielded = (
  fields: PicoFieldDef[],
  values: Record<string, string>
): string => {
  const parts: string[] = [];
  for (const f of fields) {
    const v = (values[f.key] ?? "").trim();
    if (!v) continue;
    if (f.conjunctionBefore) {
      parts.push(f.conjunctionBefore);
    }
    parts.push(v);
  }
  return parts.join(" ");
};

export const PICO_TITLE_FORMATS: PicoTitleFormat[] = [
  {
    id: "intervention_for_condition",
    label: "Intervention for condition",
    description: "Single intervention vs placebo/usual care.",
    fields: [
      {
        key: "intervention",
        label: "Intervention",
        conjunctionBefore: "",
        placeholder: "e.g. aspirin",
        suggestionsFrom: COMMON_INTERVENTIONS,
        required: true,
      },
      {
        key: "condition",
        label: "Condition",
        conjunctionBefore: "for",
        placeholder: "e.g. secondary prevention of cardiovascular events",
        suggestionsFrom: COMMON_CONDITIONS,
        required: true,
      },
    ],
    compose: (v) => composeFielded(PICO_TITLE_FORMATS[0].fields, v),
    appliesTo: ["INTERVENTION", "METHODOLOGY"],
  },
  {
    id: "intervention_versus_intervention_for_condition",
    label: "Intervention versus intervention for condition",
    description: "Head-to-head comparison of two active interventions.",
    fields: [
      {
        key: "intervention1",
        label: "Intervention A",
        conjunctionBefore: "",
        placeholder: "e.g. SSRIs",
        suggestionsFrom: COMMON_INTERVENTIONS,
        required: true,
      },
      {
        key: "intervention2",
        label: "Intervention B",
        conjunctionBefore: "versus",
        placeholder: "e.g. SNRIs",
        suggestionsFrom: COMMON_INTERVENTIONS,
        required: true,
      },
      {
        key: "condition",
        label: "Condition",
        conjunctionBefore: "for",
        placeholder: "e.g. major depressive disorder",
        suggestionsFrom: COMMON_CONDITIONS,
        required: true,
      },
    ],
    compose: (v) => composeFielded(PICO_TITLE_FORMATS[1].fields, v),
    appliesTo: ["INTERVENTION"],
  },
  {
    id: "intervention_for_condition_in_population",
    label: "Intervention for condition in population",
    description: "Adds a specific population or setting.",
    fields: [
      {
        key: "intervention",
        label: "Intervention",
        conjunctionBefore: "",
        placeholder: "e.g. metformin",
        suggestionsFrom: COMMON_INTERVENTIONS,
        required: true,
      },
      {
        key: "condition",
        label: "Condition",
        conjunctionBefore: "for",
        placeholder: "e.g. type 2 diabetes",
        suggestionsFrom: COMMON_CONDITIONS,
        required: true,
      },
      {
        key: "population",
        label: "Population / setting",
        conjunctionBefore: "in",
        placeholder: "e.g. adults in LMICs",
        suggestionsFrom: [...COMMON_POPULATIONS, ...COMMON_SETTINGS],
      },
    ],
    compose: (v) => composeFielded(PICO_TITLE_FORMATS[2].fields, v),
    appliesTo: ["INTERVENTION", "METHODOLOGY"],
  },
  {
    id: "test_for_condition",
    label: "Diagnostic question (PIRD)",
    description: "Population, index test, reference standard, and target condition.",
    fields: [
      {
        key: "population",
        label: "Population",
        conjunctionBefore: "",
        placeholder: "e.g. adults with suspected sepsis",
        suggestionsFrom: COMMON_POPULATIONS,
        help: "Who will receive the test? Include age group, pregnancy status, setting, and suspected condition when relevant.",
        example: "adults with suspected sepsis",
        required: true,
      },
      {
        key: "test",
        label: "Index test(s)",
        conjunctionBefore: "",
        placeholder: "e.g. clinical scores and point-of-care tests",
        help: "Name the test, sign, score, biomarker, or group of tests being evaluated.",
        example: "procalcitonin and bedside sepsis scores",
        required: true,
      },
      {
        key: "referenceStandard",
        label: "Reference standard",
        conjunctionBefore: "",
        placeholder: "e.g. blood culture",
        help: "What method will classify whether the target condition is present or absent?",
        example: "blood culture or a pre-specified consensus definition",
        required: true,
      },
      {
        key: "condition",
        label: "Target condition",
        conjunctionBefore: "",
        placeholder: "e.g. sepsis",
        suggestionsFrom: COMMON_CONDITIONS,
        help: "State the condition the index test is intended to identify.",
        example: "sepsis",
        required: true,
      },
    ],
    compose: (v) => {
      const test = v.test?.trim();
      const condition = v.condition?.trim();
      if (!test || !condition) return "";
      const population = v.population?.trim();
      const reference = v.referenceStandard?.trim();
      return `Diagnostic accuracy of ${test} for ${condition}` +
        (population ? ` in ${population}` : "") +
        (reference ? ` using ${reference} as the reference standard` : "");
    },
    appliesTo: ["DTA"],
  },
  {
    id: "methodology_review",
    label: "Methodology review",
    description: "Methodological quality or research-on-research.",
    fields: [
      {
        key: "topic",
        label: "Methodological topic",
        conjunctionBefore: "",
        placeholder: "e.g. adherence to CONSORT reporting",
        required: true,
      },
    ],
    compose: (v) => composeFielded(PICO_TITLE_FORMATS[4].fields, v),
    appliesTo: ["METHODOLOGY"],
  },
  {
    id: "overview_of_reviews",
    label: "Overview of reviews",
    description: "Summary of multiple existing systematic reviews.",
    fields: [
      {
        key: "topic",
        label: "Topic",
        conjunctionBefore: "",
        placeholder: "e.g. antihypertensives in pregnancy",
        required: true,
      },
    ],
    compose: (v) => composeFielded(PICO_TITLE_FORMATS[5].fields, v),
    appliesTo: ["OVERVIEW"],
  },
  {
    id: "free_form",
    label: "Free-form title",
    description: "Use if none of the structured formats fit.",
    fields: [
      {
        key: "title",
        label: "Review title",
        conjunctionBefore: "",
        placeholder: "Enter the full review title",
        required: true,
      },
    ],
    compose: (v) => v.title?.trim() ?? "",
    appliesTo: ["INTERVENTION", "DTA", "METHODOLOGY", "OVERVIEW", "FLEXIBLE"],
  },
];

/** Returns the default format for a given review type. */
export function defaultFormatForType(type: ReviewType): PicoTitleFormat {
  return (
    PICO_TITLE_FORMATS.find((f) => f.appliesTo.includes(type) && f.id !== "free_form") ??
    PICO_TITLE_FORMATS.find((f) => f.id === "free_form")!
  );
}

/** Returns the formats applicable for a given review type (always includes Free-form). */
export function formatsForType(type: ReviewType): PicoTitleFormat[] {
  const applicable = PICO_TITLE_FORMATS.filter((f) => f.appliesTo.includes(type));
  // Always include Free-form at the end.
  if (!applicable.some((f) => f.id === "free_form")) {
    applicable.push(PICO_TITLE_FORMATS.find((f) => f.id === "free_form")!);
  }
  return applicable;
}

// ─── Sample PICO completions for placeholder hints ──────────────────────────
//
// Used by the wizard when no PICO values have been entered yet — the
// placeholder previews the structure with a realistic example.

export const SAMPLE_PICO: Record<ReviewType, Record<string, string>> = {
  INTERVENTION: {
    intervention: "aspirin",
    condition: "secondary prevention of cardiovascular events",
    population: "adults with prior myocardial infarction",
  },
  DTA: {
    population: "people with suspected sepsis",
    test: "clinical scores and point-of-care tests",
    referenceStandard: "blood culture",
    condition: "sepsis",
  },
  METHODOLOGY: {
    topic: "adherence to CONSORT reporting",
  },
  OVERVIEW: {
    topic: "antihypertensives in pregnancy",
  },
  FLEXIBLE: {
    title: "Custom review title",
  },
};
