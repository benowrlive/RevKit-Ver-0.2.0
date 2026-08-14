// src/app/api/reviews/route.ts — CRUD for reviews in SQLite.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Review, ReviewType, ReviewSubType } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ReviewRow {
  id: string;
  title: string;
  researchQuestion: string | null;
  type: string;
  subType: string | null;
  status: string;
  phase: string;
  createdAt: string;
  updatedAt: string;
}

function newUuid(): string {
  return "r_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

export async function loadReviewTree(reviewRow: ReviewRow): Promise<Review> {
  const comparisons = await db.comparison.findMany({
    where: { reviewId: reviewRow.id },
    orderBy: { order: "asc" },
    include: {
      outcomes: {
        orderBy: { order: "asc" },
        include: {
          subgroups: {
            orderBy: { order: "asc" },
            include: { dataPoints: true },
          },
          dataPoints: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  const studies = await db.study.findMany({
    where: { reviewId: reviewRow.id },
    orderBy: { createdAt: "asc" },
    include: { dataPoints: true, robAssessments: true },
  });

  const references = await db.reference.findMany({
    where: { reviewId: reviewRow.id },
    orderBy: { id: "asc" },
  });

  const prismaFlow = await db.prismaFlow.findUnique({
    where: { reviewId: reviewRow.id },
  });

  const quadas3Workspace = await db.quadas3Workspace.findUnique({
    where: { reviewId: reviewRow.id },
  });

  const review: Review = {
    id: reviewRow.id,
    title: reviewRow.title,
    researchQuestion: reviewRow.researchQuestion,
    type: reviewRow.type as ReviewType,
    subType: (reviewRow.subType as ReviewSubType) ?? null,
    status: reviewRow.status as Review["status"],
    phase: reviewRow.phase as Review["phase"],
    createdAt: reviewRow.createdAt,
    updatedAt: reviewRow.updatedAt,
    comparisons: comparisons.map((c) => ({
      id: c.id,
      reviewId: c.reviewId,
      name: c.name,
      order: c.order,
      outcomes: c.outcomes.map((o) => ({
        id: o.id,
        comparisonId: o.comparisonId,
        name: o.name,
        dataType: o.dataType as Review["comparisons"][number]["outcomes"][number]["dataType"],
        effectMeasure: o.effectMeasure as Review["comparisons"][number]["outcomes"][number]["effectMeasure"],
        method: o.method as Review["comparisons"][number]["outcomes"][number]["method"],
        model: o.model as "fixed" | "random",
        unit: o.unit,
        timeFrame: o.timeFrame,
        order: o.order,
        subgroups: o.subgroups.map((sg) => ({
          id: sg.id,
          outcomeId: sg.outcomeId,
          name: sg.name,
          order: sg.order,
          dataPoints: sg.dataPoints.map((dp) => ({
            ...dp,
            oE: dp.oE ?? null,
            v: dp.v ?? null,
          })),
        })),
        dataPoints: o.dataPoints.map((dp) => ({
          ...dp,
          oE: dp.oE ?? null,
          v: dp.v ?? null,
        })),
      })),
    })),
    studies: studies.map((st) => ({
      id: st.id,
      reviewId: st.reviewId,
      label: st.label,
      year: st.year ?? null,
      authors: st.authors ?? null,
      doi: st.doi ?? null,
      pdfPath: st.pdfPath ?? null,
      status: st.status,
      excludeReason: st.excludeReason ?? null,
      design: st.design ?? null,
      picos: st.picos ?? null,
      indexTest: st.indexTest ?? null,
      referenceStandard: st.referenceStandard ?? null,
      notes: st.notes ?? null,
      createdAt: st.createdAt,
      updatedAt: st.updatedAt,
    })),
    references: references.map((r) => ({
      id: r.id,
      reviewId: r.reviewId,
      title: r.title,
      authors: r.authors,
      year: r.year ?? null,
      journal: r.journal ?? null,
      doi: r.doi ?? null,
      pmid: r.pmid ?? null,
      rawRis: r.rawRis ?? null,
      stage: r.stage ?? null,
      decision: r.decision ?? null,
      excludeReason: r.excludeReason ?? null,
    })),
    robAssessments: studies.flatMap((st) =>
      st.robAssessments.map((a) => ({
        id: a.id,
        studyId: a.studyId,
        tool: a.tool as "ROB2" | "ROBINS_I" | "QUADAS_2",
        domainJudgements: JSON.parse(a.domainJudgements) as Record<string, Review["robAssessments"][number]["domainJudgements"][string]>,
        signallingAnswers: JSON.parse(a.signallingAnswers) as Record<
          string,
          "yes" | "no" | "py" | "pn" | "ni" | "na"
        >,
        overallJudgement: (a.overallJudgement ?? null) as Review["robAssessments"][number]["overallJudgement"],
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      }))
    ),
    quadas3: quadas3Workspace
      ? (JSON.parse(quadas3Workspace.payload) as NonNullable<Review["quadas3"]>)
      : null,
    prismaFlow: prismaFlow
      ? {
          reviewId: prismaFlow.reviewId,
          boxes: JSON.parse(prismaFlow.boxes),
        }
      : null,
  };

  return review;
}

// GET /api/reviews — list all saved reviews (metadata only)
export async function GET() {
  try {
    const rows = await db.review.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        subType: true,
        status: true,
        phase: true,
        createdAt: true,
        updatedAt: true,
        researchQuestion: true,
      },
    });
    return NextResponse.json({ reviews: rows });
  } catch (e) {
    console.error("[GET /api/reviews]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/reviews — create new review (persist full tree)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { review: Review };
    const review = body.review;
    const now = new Date().toISOString();

    await db.review.create({
      data: {
        id: review.id,
        title: review.title,
        researchQuestion: review.researchQuestion ?? null,
        type: review.type,
        subType: review.subType ?? null,
        status: review.status,
        phase: review.phase,
        createdAt: review.createdAt,
        updatedAt: now,
      },
    });

    await persistReviewTree(review);

    return NextResponse.json({ review: { id: review.id, updatedAt: now } });
  } catch (e) {
    console.error("[POST /api/reviews]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PUT /api/reviews?id=<reviewId> — update existing review (full overwrite)
export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id query param" }, { status: 400 });
    }
    const body = (await req.json()) as { review: Review };
    const review = body.review;
    if (review.id !== id) {
      return NextResponse.json({ error: "id mismatch" }, { status: 400 });
    }
    const now = new Date().toISOString();

    await db.review.update({
      where: { id },
      data: {
        title: review.title,
        researchQuestion: review.researchQuestion ?? null,
        type: review.type,
        subType: review.subType ?? null,
        status: review.status,
        phase: review.phase,
        updatedAt: now,
      },
    });

    // Wipe THIS review's children and re-write.
    // CRITICAL: All deletes MUST be scoped by reviewId to avoid wiping
    // data belonging to OTHER reviews (RB-1 fix, Phase 2A-stabilize).
    // Comparison + Study cascade to outcomes/subgroups/dataPoints/
    // robAssessments per the Prisma schema's onDelete: Cascade rules.
    // RobAssessment has its own reviewId FK so we scope it directly.
    // Wrap in $transaction so a failure rolls back partial state.
    await db.$transaction([
      db.comparison.deleteMany({ where: { reviewId: id } }),
      db.study.deleteMany({ where: { reviewId: id } }),
      db.reference.deleteMany({ where: { reviewId: id } }),
      db.prismaFlow.deleteMany({ where: { reviewId: id } }),
      db.robAssessment.deleteMany({ where: { reviewId: id } }),
      db.quadas3Workspace.deleteMany({ where: { reviewId: id } }),
    ]);

    await persistReviewTree(review);

    return NextResponse.json({ review: { id, updatedAt: now } });
  } catch (e) {
    console.error("[PUT /api/reviews]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function persistReviewTree(review: Review) {
  // Order: comparisons/outcomes/subgroups (no FK on studyId at this stage) →
  // studies → data points (FK on studyId) → RoB assessments (FK on studyId) →
  // references → PRISMA flow. SQLite enforces foreign keys, so we must insert
  // parents before children.

  // 1) Comparisons + outcomes + subgroups (these don't reference studies).
  for (const c of review.comparisons) {
    await db.comparison.create({
      data: { id: c.id, reviewId: review.id, name: c.name, order: c.order },
    });
    for (const o of c.outcomes) {
      await db.outcome.create({
        data: {
          id: o.id,
          comparisonId: c.id,
          name: o.name,
          dataType: o.dataType,
          effectMeasure: o.effectMeasure,
          method: o.method,
          model: o.model,
          unit: o.unit ?? null,
          timeFrame: o.timeFrame ?? null,
          order: o.order,
        },
      });
      for (const sg of o.subgroups) {
        await db.subgroup.create({
          data: { id: sg.id, outcomeId: o.id, name: sg.name, order: sg.order },
        });
      }
    }
  }

  // 2) Studies (parent of dataPoints + robAssessments).
  for (const st of review.studies) {
    await db.study.create({
      data: {
        id: st.id,
        reviewId: review.id,
        label: st.label,
        year: st.year ?? null,
        authors: st.authors ?? null,
        doi: st.doi ?? null,
        pdfPath: st.pdfPath ?? null,
        status: st.status,
        excludeReason: st.excludeReason ?? null,
        design: st.design ?? null,
        picos: st.picos ?? null,
        indexTest: st.indexTest ?? null,
        referenceStandard: st.referenceStandard ?? null,
        notes: st.notes ?? null,
        createdAt: st.createdAt,
        updatedAt: st.updatedAt,
      },
    });
  }

  // 3) Data points (now that studies exist).
  for (const c of review.comparisons) {
    for (const o of c.outcomes) {
      for (const sg of o.subgroups) {
        for (const dp of sg.dataPoints) {
          await db.dataPoint.create({
            data: dpData(review, o, sg.id, dp),
          });
        }
      }
      for (const dp of o.dataPoints) {
        if (dp.subgroupId) continue;
        await db.dataPoint.create({ data: dpData(review, o, null, dp) });
      }
    }
  }

  // 4) RoB assessments.
  for (const a of review.robAssessments) {
    await db.robAssessment.create({
      data: {
        id: a.id,
        studyId: a.studyId,
        reviewId: review.id,
        tool: a.tool,
        domainJudgements: JSON.stringify(a.domainJudgements),
        signallingAnswers: JSON.stringify(a.signallingAnswers),
        overallJudgement: a.overallJudgement ?? null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      },
    });
  }

  // 5) QUADAS-3 workspace (versioned JSON containing all six phases).
  if (review.quadas3) {
    await db.quadas3Workspace.create({
      data: {
        reviewId: review.id,
        payload: JSON.stringify(review.quadas3),
        updatedAt: review.quadas3.updatedAt,
      },
    });
  }

  // 6) References.
  for (const r of review.references) {
    await db.reference.create({
      data: {
        id: r.id,
        reviewId: review.id,
        title: r.title,
        authors: r.authors,
        year: r.year ?? null,
        journal: r.journal ?? null,
        doi: r.doi ?? null,
        pmid: r.pmid ?? null,
        rawRis: r.rawRis ?? null,
        stage: r.stage ?? null,
        decision: r.decision ?? null,
        excludeReason: r.excludeReason ?? null,
      },
    });
  }

  // 7) PRISMA flow.
  if (review.prismaFlow) {
    await db.prismaFlow.create({
      data: {
        id: newUuid(),
        reviewId: review.id,
        boxes: JSON.stringify(review.prismaFlow.boxes),
      },
    });
  }
}

function dpData(
  _review: Review,
  o: Review["comparisons"][number]["outcomes"][number],
  subgroupId: string | null,
  dp: Review["comparisons"][number]["outcomes"][number]["dataPoints"][number]
) {
  return {
    id: dp.id,
    outcomeId: o.id,
    subgroupId,
    studyId: dp.studyId,
    events1: dp.events1 ?? null,
    total1: dp.total1 ?? null,
    events2: dp.events2 ?? null,
    total2: dp.total2 ?? null,
    mean1: dp.mean1 ?? null,
    sd1: dp.sd1 ?? null,
    n1: dp.n1 ?? null,
    mean2: dp.mean2 ?? null,
    sd2: dp.sd2 ?? null,
    n2: dp.n2 ?? null,
    oE: dp.oE ?? null,
    v: dp.v ?? null,
    effect: dp.effect ?? null,
    se: dp.se ?? null,
    tp: dp.tp ?? null,
    fp: dp.fp ?? null,
    fn: dp.fn ?? null,
    tn: dp.tn ?? null,
    order: dp.order,
  };
}
