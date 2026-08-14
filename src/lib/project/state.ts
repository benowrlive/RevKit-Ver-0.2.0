// src/lib/project/state.ts — Zustand store for the currently-open RevKit review.
//
// Adapted from master prompt §11 Phase 1 task 3. The store is the single
// source of truth for the in-memory review; persistence goes through the
// /api/reviews REST endpoints (SQLite via Prisma).

"use client";

import { create } from "zustand";
import type {
  Comparison,
  Outcome,
  Study,
  Reference,
  RobAssessment,
  Quadas3Workspace,
  Review,
  ReviewPhase,
  ReviewType,
  Subgroup,
  DataPoint,
} from "@/lib/types";
import { newId } from "@/lib/project/id";

export type ToastFn = (msg: string, opts?: { description?: string; variant?: "default" | "destructive" }) => void;

interface ReviewState {
  review: Review | null;
  isDirty: boolean;
  isSaving: boolean;
  /** Server-side ID assigned by SQLite on first save (null = unsaved). */
  dbId: string | null;
  /** Recently-loaded recent files list (mirror of localStorage). */
  recentFiles: import("@/lib/project/id").RecentFileEntry[];

  // Mutations — review-level
  setReview: (r: Review | null) => void;
  newReview: (input: { title: string; type: ReviewType; subType: Review["subType"]; researchQuestion?: string | null }) => Review;
  markDirty: () => void;
  markSaved: (dbId: string) => void;
  setSaving: (s: boolean) => void;
  setRecentFiles: (f: import("@/lib/project/id").RecentFileEntry[]) => void;

  // Review meta
  updateMeta: (patch: Partial<Pick<Review, "title" | "researchQuestion" | "status" | "phase" | "subType">>) => void;
  setPhase: (phase: ReviewPhase) => void;

  // Comparisons + Outcomes
  addComparison: (name: string) => string;
  renameComparison: (id: string, name: string) => void;
  deleteComparison: (id: string) => void;
  reorderComparisons: (ids: string[]) => void;
  addOutcome: (comparisonId: string, outcome: Omit<Outcome, "id" | "comparisonId" | "order" | "subgroups" | "dataPoints">) => string;
  updateOutcome: (outcomeId: string, patch: Partial<Outcome>) => void;
  deleteOutcome: (outcomeId: string) => void;
  addSubgroup: (outcomeId: string, name: string) => string;
  renameSubgroup: (subgroupId: string, name: string) => void;
  deleteSubgroup: (subgroupId: string) => void;

  // Data points
  upsertDataPoint: (outcomeId: string, subgroupId: string | null, studyId: string, patch: Partial<DataPoint>) => void;
  setDataPointValue: (dataPointId: string, field: keyof DataPoint, value: number | null) => void;
  deleteDataPoint: (dataPointId: string) => void;

  // Studies
  addStudy: (study: Omit<Study, "id" | "reviewId" | "createdAt" | "updatedAt">) => string;
  updateStudy: (studyId: string, patch: Partial<Study>) => void;
  deleteStudy: (studyId: string) => void;

  // References
  addReferences: (refs: Omit<Reference, "id" | "reviewId">[]) => number;
  updateReference: (refId: string, patch: Partial<Reference>) => void;
  deleteReference: (refId: string) => void;
  promoteReferenceToStudy: (refId: string) => string | null;

  // RoB
  upsertRobAssessment: (a: Omit<RobAssessment, "id" | "createdAt" | "updatedAt"> & { id?: string }) => string;
  deleteRobAssessment: (id: string) => void;
  setQuadas3Workspace: (workspace: Quadas3Workspace) => void;

  // PRISMA flow
  setPrismaBox: (boxId: string, count: number, autoCount?: boolean) => void;
  initPrismaFlow: () => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  review: null,
  isDirty: false,
  isSaving: false,
  dbId: null,
  recentFiles: [],

  setReview: (r) => set({ review: r, isDirty: false, dbId: r ? get().dbId : null }),

  newReview: (input) => {
    const now = new Date().toISOString();
    const review: Review = {
      id: newId("rev"),
      title: input.title,
      researchQuestion: input.researchQuestion ?? null,
      type: input.type,
      subType: input.subType ?? null,
      status: "draft",
      phase: "scoping",
      createdAt: now,
      updatedAt: now,
      comparisons: [],
      studies: [],
      references: [],
      robAssessments: [],
      quadas3: null,
      prismaFlow: null,
    };
    set({ review, isDirty: true, dbId: null });
    return review;
  },

  markDirty: () => set({ isDirty: true }),
  markSaved: (dbId) => set({ isDirty: false, isSaving: false, dbId }),
  setSaving: (s) => set({ isSaving: s }),
  setRecentFiles: (f) => set({ recentFiles: f }),

  updateMeta: (patch) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: { ...s.review, ...patch, updatedAt: new Date().toISOString() },
        isDirty: true,
      };
    }),

  setPhase: (phase) =>
    set((s) => {
      if (!s.review) return s;
      return { review: { ...s.review, phase, updatedAt: new Date().toISOString() }, isDirty: true };
    }),

  addComparison: (name) => {
    const id = newId("cmp");
    set((s) => {
      if (!s.review) return s;
      const order = s.review.comparisons.length;
      const comparison: Comparison = {
        id,
        reviewId: s.review.id,
        name,
        order,
        outcomes: [],
      };
      return {
        review: { ...s.review, comparisons: [...s.review.comparisons, comparison], updatedAt: new Date().toISOString() },
        isDirty: true,
      };
    });
    return id;
  },

  renameComparison: (id, name) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          comparisons: s.review.comparisons.map((c) => (c.id === id ? { ...c, name } : c)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  deleteComparison: (id) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          comparisons: s.review.comparisons.filter((c) => c.id !== id),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  reorderComparisons: (ids) =>
    set((s) => {
      if (!s.review) return s;
      const byId = new Map(s.review.comparisons.map((c) => [c.id, c]));
      const next = ids.map((id, i) => ({ ...(byId.get(id) as Comparison), order: i }));
      return {
        review: { ...s.review, comparisons: next, updatedAt: new Date().toISOString() },
        isDirty: true,
      };
    }),

  addOutcome: (comparisonId, outcome) => {
    const id = newId("out");
    set((s) => {
      if (!s.review) return s;
      const comparison = s.review.comparisons.find((c) => c.id === comparisonId);
      if (!comparison) return s;
      const order = comparison.outcomes.length;
      const newOutcome: Outcome = {
        id,
        comparisonId,
        name: outcome.name,
        dataType: outcome.dataType,
        effectMeasure: outcome.effectMeasure,
        method: outcome.method,
        model: outcome.model,
        unit: outcome.unit ?? null,
        timeFrame: outcome.timeFrame ?? null,
        order,
        subgroups: [],
        dataPoints: [],
      };
      return {
        review: {
          ...s.review,
          comparisons: s.review.comparisons.map((c) =>
            c.id === comparisonId ? { ...c, outcomes: [...c.outcomes, newOutcome] } : c
          ),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
    return id;
  },

  updateOutcome: (outcomeId, patch) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          comparisons: s.review.comparisons.map((c) => ({
            ...c,
            outcomes: c.outcomes.map((o) => (o.id === outcomeId ? { ...o, ...patch } : o)),
          })),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  deleteOutcome: (outcomeId) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          comparisons: s.review.comparisons.map((c) => ({
            ...c,
            outcomes: c.outcomes.filter((o) => o.id !== outcomeId),
          })),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  addSubgroup: (outcomeId, name) => {
    const id = newId("sg");
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          comparisons: s.review.comparisons.map((c) => ({
            ...c,
            outcomes: c.outcomes.map((o) => {
              if (o.id !== outcomeId) return o;
              const order = o.subgroups.length;
              const sg: Subgroup = { id, outcomeId, name, order, dataPoints: [] };
              return { ...o, subgroups: [...o.subgroups, sg] };
            }),
          })),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
    return id;
  },

  renameSubgroup: (subgroupId, name) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          comparisons: s.review.comparisons.map((c) => ({
            ...c,
            outcomes: c.outcomes.map((o) => ({
              ...o,
              subgroups: o.subgroups.map((sg) => (sg.id === subgroupId ? { ...sg, name } : sg)),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  deleteSubgroup: (subgroupId) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          comparisons: s.review.comparisons.map((c) => ({
            ...c,
            outcomes: c.outcomes.map((o) => ({
              ...o,
              subgroups: o.subgroups.filter((sg) => sg.id !== subgroupId),
              dataPoints: o.dataPoints.filter((dp) => dp.subgroupId !== subgroupId),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  upsertDataPoint: (outcomeId, subgroupId, studyId, patch) =>
    set((s) => {
      if (!s.review) return s;
      let found = false;
      const nextComparisons = s.review.comparisons.map((c) => ({
        ...c,
        outcomes: c.outcomes.map((o) => {
          if (o.id !== outcomeId) return o;
          const existingIdx = o.dataPoints.findIndex(
            (dp) => dp.studyId === studyId && dp.subgroupId === subgroupId
          );
          if (existingIdx >= 0) {
            found = true;
            const next = [...o.dataPoints];
            next[existingIdx] = { ...next[existingIdx], ...patch };
            return { ...o, dataPoints: next };
          }
          const newDp: DataPoint = {
            id: newId("dp"),
            outcomeId,
            subgroupId,
            studyId,
            order: o.dataPoints.length,
            ...patch,
          };
          return { ...o, dataPoints: [...o.dataPoints, newDp] };
        }),
      }));
      if (!found) {
        // already added new dp above; nothing else
      }
      return {
        review: { ...s.review, comparisons: nextComparisons, updatedAt: new Date().toISOString() },
        isDirty: true,
      };
    }),

  setDataPointValue: (dataPointId, field, value) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          comparisons: s.review.comparisons.map((c) => ({
            ...c,
            outcomes: c.outcomes.map((o) => ({
              ...o,
              dataPoints: o.dataPoints.map((dp) =>
                dp.id === dataPointId ? { ...dp, [field]: value } : dp
              ),
              subgroups: o.subgroups.map((sg) => ({
                ...sg,
                dataPoints: sg.dataPoints.map((dp) =>
                  dp.id === dataPointId ? { ...dp, [field]: value } : dp
                ),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  deleteDataPoint: (dataPointId) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          comparisons: s.review.comparisons.map((c) => ({
            ...c,
            outcomes: c.outcomes.map((o) => ({
              ...o,
              dataPoints: o.dataPoints.filter((dp) => dp.id !== dataPointId),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  addStudy: (study) => {
    const id = newId("std");
    const now = new Date().toISOString();
    set((s) => {
      if (!s.review) return s;
      const newStudy: Study = {
        ...study,
        id,
        reviewId: s.review.id,
        createdAt: now,
        updatedAt: now,
      };
      return {
        review: { ...s.review, studies: [...s.review.studies, newStudy], updatedAt: now },
        isDirty: true,
      };
    });
    return id;
  },

  updateStudy: (studyId, patch) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          studies: s.review.studies.map((st) =>
            st.id === studyId ? { ...st, ...patch, updatedAt: new Date().toISOString() } : st
          ),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  deleteStudy: (studyId) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          studies: s.review.studies.filter((st) => st.id !== studyId),
          robAssessments: s.review.robAssessments.filter((a) => a.studyId !== studyId),
          quadas3: s.review.quadas3
            ? (() => {
                const removedEstimateIds = new Set(
                  s.review.quadas3.estimates
                    .filter((estimate) => estimate.studyId === studyId)
                    .map((estimate) => estimate.id),
                );
                return {
                  ...s.review.quadas3,
                  studyFlows: s.review.quadas3.studyFlows.filter((flow) => flow.studyId !== studyId),
                  estimates: s.review.quadas3.estimates.filter((estimate) => estimate.studyId !== studyId),
                  domainAssessments: s.review.quadas3.domainAssessments.filter(
                    (assessment) => !removedEstimateIds.has(assessment.estimateId),
                  ),
                  overallJudgements: s.review.quadas3.overallJudgements.filter(
                    (judgement) => !removedEstimateIds.has(judgement.estimateId),
                  ),
                  updatedAt: new Date().toISOString(),
                };
              })()
            : null,
          // Note: data points become orphaned in the outcome tree; clean them up:
          comparisons: s.review.comparisons.map((c) => ({
            ...c,
            outcomes: c.outcomes.map((o) => ({
              ...o,
              dataPoints: o.dataPoints.filter((dp) => dp.studyId !== studyId),
              subgroups: o.subgroups.map((sg) => ({
                ...sg,
                dataPoints: sg.dataPoints.filter((dp) => dp.studyId !== studyId),
              })),
            })),
          })),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  addReferences: (refs) => {
    let added = 0;
    set((s) => {
      if (!s.review) return s;
      const newRefs: Reference[] = refs.map((r) => ({
        ...r,
        id: newId("ref"),
        reviewId: s.review!.id,
      }));
      added = newRefs.length;
      // Dedup by (lowercase title + year) — skip if already present.
      const existing = new Set(
        s.review.references.map((r) => `${r.title.toLowerCase().trim()}|${r.year ?? ""}`)
      );
      const filtered = newRefs.filter(
        (r) => !existing.has(`${r.title.toLowerCase().trim()}|${r.year ?? ""}`)
      );
      added = filtered.length;
      return {
        review: { ...s.review, references: [...s.review.references, ...filtered], updatedAt: new Date().toISOString() },
        isDirty: true,
      };
    });
    return added;
  },

  updateReference: (refId, patch) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          references: s.review.references.map((r) => (r.id === refId ? { ...r, ...patch } : r)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  deleteReference: (refId) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          references: s.review.references.filter((r) => r.id !== refId),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  promoteReferenceToStudy: (refId) => {
    const state = get();
    if (!state.review) return null;
    const ref = state.review.references.find((r) => r.id === refId);
    if (!ref) return null;
    // Don't promote if a study already exists with this DOI/label.
    const label = ref.title.slice(0, 60);
    const existing = state.review.studies.find(
      (st) => st.doi && ref.doi && st.doi.toLowerCase() === ref.doi.toLowerCase()
    );
    if (existing) return existing.id;
    const id = state.addStudy({
      label,
      year: ref.year ?? null,
      authors: ref.authors,
      doi: ref.doi ?? null,
      pdfPath: null,
      status: "included",
      excludeReason: null,
      design: null,
      picos: null,
      indexTest: null,
      referenceStandard: null,
      notes: null,
    });
    return id;
  },

  upsertRobAssessment: (a) => {
    const id = a.id ?? newId("rob");
    const now = new Date().toISOString();
    set((s) => {
      if (!s.review) return s;
      const existingIdx = s.review.robAssessments.findIndex(
        (x) => x.id === id || (x.studyId === a.studyId && x.tool === a.tool)
      );
      const newAssessment: RobAssessment = {
        ...a,
        id,
        createdAt: existingIdx >= 0 ? s.review.robAssessments[existingIdx].createdAt : now,
        updatedAt: now,
      };
      const next =
        existingIdx >= 0
          ? s.review.robAssessments.map((x, i) => (i === existingIdx ? newAssessment : x))
          : [...s.review.robAssessments, newAssessment];
      return {
        review: { ...s.review, robAssessments: next, updatedAt: now },
        isDirty: true,
      };
    });
    return id;
  },

  deleteRobAssessment: (id) =>
    set((s) => {
      if (!s.review) return s;
      return {
        review: {
          ...s.review,
          robAssessments: s.review.robAssessments.filter((a) => a.id !== id),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setQuadas3Workspace: (workspace) =>
    set((s) => {
      if (!s.review) return s;
      const now = new Date().toISOString();
      return {
        review: { ...s.review, quadas3: workspace, updatedAt: now },
        isDirty: true,
      };
    }),

  setPrismaBox: (boxId, count, autoCount) =>
    set((s) => {
      if (!s.review) return s;
      const flow = s.review.prismaFlow ?? { reviewId: s.review.id, boxes: [] };
      const nextBoxes = (() => {
        const idx = flow.boxes.findIndex((b) => b.id === boxId);
        if (idx >= 0) {
          return flow.boxes.map((b) =>
            b.id === boxId ? { ...b, count, autoCount: autoCount ?? b.autoCount } : b
          );
        }
        return [...flow.boxes, { id: boxId, label: boxId, count, autoCount: autoCount ?? false }];
      })();
      return {
        review: { ...s.review, prismaFlow: { reviewId: s.review.id, boxes: nextBoxes }, updatedAt: new Date().toISOString() },
        isDirty: true,
      };
    }),

  initPrismaFlow: () =>
    set((s) => {
      if (!s.review) return s;
      if (s.review.prismaFlow && s.review.prismaFlow.boxes.length > 0) return s;
      // Lazy-load the template to avoid SSR cycle.
      // (Real init done in component on mount; here we just no-op.)
      return s;
    }),
}));
