"use client";

import { useMemo } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ComboboxInput } from "@/components/revkit/combobox-input";
import { InfoTooltip } from "@/components/revkit/info-tooltip";
import {
  PICO_TITLE_FORMATS,
  formatsForType,
  defaultFormatForType,
  SAMPLE_PICO,
  type PicoTitleFormat,
} from "@/lib/pico/presets";
import type { ReviewType } from "@/lib/types";

/**
 * PicoTitleBuilder — structured PICO title picker.
 *
 * Modeled on the legacy Cochrane RevMan 5 wizard's 4 title-format options
 * (single intervention vs head-to-head vs population-specific vs free-form),
 * expanded to support DTA, Methodology, and Overview review types.
 *
 * Layout:
 *   1. Format picker (radio cards — one per applicable format).
 *   2. Structured fields with autocomplete dropdowns (ComboboxInput).
 *   3. Live title preview (composes in real time).
 *
 * Borrowed from Rayyan's "autocomplete everywhere" UX principle: every
 * text field offers a `<datalist>` of common terms to reduce typing.
 */
export interface PicoTitleBuilderProps {
  reviewType: ReviewType;
  formatId: string;
  onFormatChange: (formatId: string) => void;
  values: Record<string, string>;
  onValuesChange: (next: Record<string, string>) => void;
}

export function PicoTitleBuilder({
  reviewType,
  formatId,
  onFormatChange,
  values,
  onValuesChange,
}: PicoTitleBuilderProps) {
  // Available formats for this review type (always includes Free-form).
  const formats = useMemo(() => formatsForType(reviewType), [reviewType]);
  // Default format for the review type (used as initial fallback).
  const defaultFormat = useMemo(
    () => defaultFormatForType(reviewType),
    [reviewType]
  );

  // Currently-selected format (resolve from id; fall back to default).
  const activeFormat: PicoTitleFormat =
    formats.find((f) => f.id === formatId) ?? defaultFormat;

  // Live title preview.
  const previewTitle = activeFormat.compose(values).trim() || "(title preview)";

  function handleFieldChange(key: string, v: string) {
    onValuesChange({ ...values, [key]: v });
  }

  // Sample placeholder values for the current review type — used when fields
  // are empty to give a realistic preview of the format.
  const sample = SAMPLE_PICO[reviewType] ?? {};

  return (
    <div className="space-y-4">
      {/* ─── Format picker ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <label className="text-sm font-medium">Question structure</label>
          <InfoTooltip
            title="Question structure"
            what={reviewType === "DTA" ? "Use PIRD: Population, Index test, Reference standard, and target Diagnosis." : "Use a structured PICO format for the review title and question."}
            why="A structured question keeps eligibility, extraction, and registration language consistent."
            example={reviewType === "DTA" ? "Adults · procalcitonin · blood culture · sepsis" : "Aspirin for secondary prevention of cardiovascular events"}
            side="right"
          />
        </div>
        <RadioGroup
          value={formatId}
          onValueChange={onFormatChange}
          className="grid gap-1.5"
        >
          {formats.map((f) => {
            const checked = f.id === activeFormat.id;
            return (
              <label
                key={f.id}
                className={`cursor-pointer rounded-[8px] border p-2.5 transition-all ${
                  checked
                    ? "border-accent bg-accent-subtle"
                    : "border-border hover:border-muted-fg hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem
                    value={f.id}
                    className="mt-0.5 sr-only"
                    tabIndex={-1}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium leading-tight">{f.label}</div>
                    <p className="text-[11px] text-muted-fg mt-0.5 leading-snug">
                      {f.description}
                    </p>
                  </div>
                </div>
              </label>
            );
          })}
        </RadioGroup>
      </div>

      {/* ─── Structured fields ───────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="eyebrow">{reviewType === "DTA" ? "PIRD fields" : "PICO fields"}</div>
        <div className="space-y-2">
          {activeFormat.fields.map((field) => {
            const fieldValue = values[field.key] ?? "";
            const placeholder =
              field.placeholder ||
              sample[field.key] ||
              `Enter ${field.label.toLowerCase()}`;
            return (
              <div
                key={field.key}
                className="flex items-start gap-1.5 flex-wrap sm:flex-nowrap"
              >
                {field.conjunctionBefore && (
                  <span className="text-[12px] text-muted-fg font-mono pt-1.5 w-14 shrink-0 text-right">
                    {field.conjunctionBefore}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <label
                      htmlFor={`pico-${field.key}`}
                      className="text-[10px] uppercase tracking-wider text-muted-fg font-semibold"
                    >
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </label>
                    {field.help && (
                      <InfoTooltip
                        title={field.label}
                        what={field.help}
                        why="A precise answer creates a clearer title and protocol question."
                        example={field.example ?? field.placeholder}
                      />
                    )}
                  </div>
                  <ComboboxInput
                    id={`pico-${field.key}`}
                    value={fieldValue}
                    onChange={(v) => handleFieldChange(field.key, v)}
                    suggestions={field.suggestionsFrom}
                    placeholder={placeholder}
                    required={field.required}
                    className="input-compact h-8"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Live title preview ──────────────────────────────────────── */}
      <div className="rounded-md border border-border bg-surface p-3 space-y-1">
        <div className="eyebrow">Preview</div>
        <div className="text-md font-display tracking-display leading-snug">
          {previewTitle}
        </div>
        {previewTitle === "(title preview)" && (
          <p className="text-[11px] text-meta">
            Start typing in the fields above to see your composed title here.
          </p>
        )}
      </div>
    </div>
  );
}

// Re-export for callers that need the full format list (e.g. tests).
export { PICO_TITLE_FORMATS };
