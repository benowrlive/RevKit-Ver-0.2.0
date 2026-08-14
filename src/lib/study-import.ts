export type StudyImportKind = "doi" | "url" | "pdf";

export interface StudyImportSuggestion {
  label: string;
  year: number | null;
  authors: string;
  doi: string;
  design: string;
  indexTest: string;
  referenceStandard: string;
  notes: string;
}

export interface StudyImportResult {
  source: StudyImportKind;
  sourceName: string;
  suggestion: StudyImportSuggestion;
  warnings: string[];
}
