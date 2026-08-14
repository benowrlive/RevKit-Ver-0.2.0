"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  ChartBar,
  CheckCircle,
  FileText,
  Flask,
  FolderOpen,
  Gear,
  Plus,
  Pulse,
  ShieldCheck,
  Sparkle,
  Stack,
  Trash,
  TrendUp,
} from "@phosphor-icons/react";
import { RevKitIcon } from "@/components/revkit/icons";
import { NewReviewWizard } from "@/components/revkit/new-review-wizard";
import { ThemeToggle } from "@/components/revkit/theme-toggle";
import type { ReviewType, ReviewSubType } from "@/lib/types";
import { EXAMPLE_REVIEWS } from "@/lib/project/example-reviews";
import { removeRecentFile } from "@/lib/project/id";

interface Props {
  onNew: (input: {
    title: string;
    type: ReviewType;
    subType: ReviewSubType;
    researchQuestion: string;
    picoValues: Record<string, string>;
  }) => void;
  onOpen: (id: string) => void;
  onLoadExample: (type: ReviewType) => void;
  refreshKey: number;
}

interface SavedReviewMeta {
  id: string;
  title: string;
  type: string;
  subType: string | null;
  status: string;
  phase: string;
  updatedAt: string;
  researchQuestion: string | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  INTERVENTION: Pulse,
  DTA: ShieldCheck,
  METHODOLOGY: Flask,
  OVERVIEW: Stack,
  FLEXIBLE: Gear,
};

const TYPE_LABELS: Record<string, string> = {
  INTERVENTION: "Intervention",
  DTA: "Diagnostic test",
  METHODOLOGY: "Methods",
  OVERVIEW: "Overview",
  FLEXIBLE: "Flexible",
};

const PHASES = [
  { value: "scoping", label: "Planning", icon: FileText },
  { value: "screening", label: "Choosing studies", icon: FolderOpen },
  { value: "extraction", label: "Collecting data", icon: Stack },
  { value: "analysis", label: "Results", icon: ChartBar },
  { value: "writing", label: "Writing", icon: FileText },
  { value: "complete", label: "Complete", icon: CheckCircle },
] as const;

export function WelcomeScreen({ onNew, onOpen, onLoadExample, refreshKey }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [saved, setSaved] = useState<SavedReviewMeta[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);

    fetch("/api/reviews", { signal: ctrl.signal })
      .then((response) => response.json())
      .then((data: { reviews?: SavedReviewMeta[] }) => {
        if (cancelled) return;
        setSaved(data.reviews ?? []);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (ctrl.signal.aborted || cancelled) return;
        setLoading(false);
        console.error("Failed to load saved reviews", error);
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [refreshKey]);

  function handleDelete(id: string) {
    if (!confirm("Delete this review permanently? This cannot be undone.")) return;

    fetch(`/api/reviews/${id}`, { method: "DELETE" })
      .then(() => {
        setSaved((previous) => previous?.filter((review) => review.id !== id) ?? []);
        removeRecentFile(id);
        toast.success("Review deleted");
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(`Failed to delete: ${message}`);
      });
  }

  function scrollTo(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  }


  const reviews = saved ?? [];
  const savedCount = reviews.length;
  const completedCount = reviews.filter(
    (review) => review.status === "completed" || review.phase === "complete",
  ).length;
  const activeCount = savedCount - completedCount;
  const recentCount = reviews.filter((review) => {
    const age = Date.now() - new Date(review.updatedAt).getTime();
    return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const typeBreakdown = Object.entries(
    reviews.reduce<Record<string, number>>((counts, review) => {
      counts[review.type] = (counts[review.type] ?? 0) + 1;
      return counts;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const phaseCounts = reviews.reduce<Record<string, number>>((counts, review) => {
    counts[review.phase] = (counts[review.phase] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className="premium-dashboard min-h-screen bg-background">
      <div className="dashboard-ambient" aria-hidden="true" />

      <div className="dashboard-stage">
        <header className="premium-topbar">
          <div className="premium-topbar-inner">
            <button
              type="button"
              onClick={() => scrollTo("dashboard-overview")}
              className="topbar-brand"
              aria-label="RevKit home"
            >
              <RevKitIcon className="size-8" />
              <span>RevKit</span>
            </button>
            <div
              className="topbar-evidence"
              aria-label="Systematic reviews, meta-analysis, and evidence synthesis"
            >
              <span>Systematic reviews</span>
              <i aria-hidden="true" />
              <span>Meta-analysis</span>
              <i aria-hidden="true" />
              <span>Evidence synthesis</span>
            </div>
            <div className="topbar-actions">
              <span className="topbar-version">v0.2.0</span>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main id="dashboard-overview" className="dashboard-content">
          <section className="dashboard-heading">
            <div className="dashboard-intro">
              <div className="eyebrow">Your workspace</div>
              <h1>Your reviews</h1>
              <p>Start a review, continue where you left off, or check how your work is progressing.</p>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="dashboard-primary-cta"
              >
                <span className="primary-cta-icon">
                  <Plus size={20} weight="bold" />
                </span>
                <span className="primary-cta-copy">
                  <strong>Create a review</strong>
                  <small>We will guide you step by step</small>
                </span>
                <ArrowRight size={18} className="primary-cta-arrow" />
              </button>
            </div>

          </section>

          <section className="metric-grid" aria-label="Review metrics">
            <DashboardMetric icon={FolderOpen} label="Total reviews" value={savedCount} tone="cyan" />
            <DashboardMetric icon={Pulse} label="In progress" value={activeCount} tone="violet" />
            <DashboardMetric icon={CheckCircle} label="Finished" value={completedCount} tone="green" />
            <DashboardMetric icon={TrendUp} label="Worked on this week" value={recentCount} tone="amber" />
          </section>

          <div className="dashboard-grid">
            <section id="review-library" className="dashboard-glass dashboard-library">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Saved work</span>
                  <h2>Saved reviews</h2>
                </div>
                <span className="panel-count">{savedCount} total</span>
              </div>

              <div className="library-content">
                {loading ? (
                  <div className="grid gap-2">
                    {[0, 1, 2, 3].map((item) => (
                      <Skeleton key={item} className="h-[74px] rounded-md" />
                    ))}
                  </div>
                ) : reviews.length > 0 ? (
                  <div className="review-list enter-pop">
                    {reviews.map((review, index) => (
                      <ReviewLibraryRow
                        key={review.id}
                        review={review}
                        stagger={index < 6}
                        onOpen={onOpen}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="library-empty enter-pop">
                    <span className="empty-icon">
                      <FolderOpen size={26} weight="duotone" />
                    </span>
                    <h3>No reviews yet</h3>
                    <p>Your saved reviews will show here.</p>
                  </div>
                )}
              </div>
            </section>

            <aside className="dashboard-side-stack">
              <section className="dashboard-glass example-panel">
                <div className="liquid-highlight-content">
                  <div className="liquid-brand-orbit">
                    <RevKitIcon className="size-10" />
                  </div>
                  <span className="eyebrow">See an example</span>
                  <h2>Explore a ready-made review.</h2>
                  <p>See how RevKit works with an example that is ready to explore.</p>
                  <button type="button" onClick={() => setExamplesOpen(true)} className="demo-action">
                    <Sparkle size={16} weight="fill" />
                    Choose an example
                    <ArrowRight size={15} />
                  </button>
                </div>
              </section>

              <section id="review-portfolio" className="dashboard-glass portfolio-panel">
                <div className="panel-heading compact">
                  <div>
                    <span className="eyebrow">At a glance</span>
                    <h2>Review types</h2>
                  </div>
                  <ChartBar size={19} weight="duotone" className="text-accent" />
                </div>
                <div className="portfolio-breakdown">
                  {typeBreakdown.length > 0 ? (
                    typeBreakdown.map(([type, count], index) => (
                      <TypeBreakdownRow
                        key={type}
                        type={type}
                        count={count}
                        total={savedCount}
                        index={index}
                      />
                    ))
                  ) : (
                    <div className="portfolio-empty">Review types will show here after your first review.</div>
                  )}
                </div>
              </section>
            </aside>
          </div>

          <section id="review-pipeline" className="dashboard-glass pipeline-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Progress</span>
                <h2>Where your reviews are</h2>
              </div>
              <span className="panel-note">Number of reviews at each step</span>
            </div>
            <div className="pipeline-grid">
              {PHASES.map((phase, index) => (
                <div key={phase.value} className="pipeline-stage">
                  <div className="pipeline-icon">
                    <phase.icon size={17} weight="duotone" />
                  </div>
                  <div>
                    <strong>{phaseCounts[phase.value] ?? 0}</strong>
                    <span>{phase.label}</span>
                  </div>
                  {index < PHASES.length - 1 && <span className="pipeline-connector" aria-hidden="true" />}
                </div>
              ))}
            </div>
          </section>

        </main>
      </div>

      <NewReviewWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={(input) => {
          setWizardOpen(false);
          onNew({
            title: input.title,
            type: input.type,
            subType: input.subType,
            researchQuestion: input.researchQuestion,
            picoValues: input.picoValues,
          });
        }}
      />

      <Dialog open={examplesOpen} onOpenChange={setExamplesOpen}>
        <DialogContent className="max-w-2xl gap-4 rounded-lg border-border p-5">
          <DialogHeader className="pr-8">
            <span className="eyebrow">EXAMPLE LIBRARY</span>
            <DialogTitle>Choose a review to explore</DialogTitle>
            <DialogDescription>
              Each example contains editable studies and data suited to that review type.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            {EXAMPLE_REVIEWS.map((example) => {
              const Icon = TYPE_ICONS[example.type] ?? FileText;
              return (
                <button
                  key={example.type}
                  type="button"
                  onClick={() => {
                    setExamplesOpen(false);
                    onLoadExample(example.type);
                  }}
                  className="group grid min-h-16 grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent-subtle/40 sm:grid-cols-[38px_minmax(0,1fr)_auto]"
                >
                  <span className="grid size-9 place-items-center rounded-md bg-surface-hover text-accent">
                    <Icon size={18} weight="duotone" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase text-accent">{example.label}</span>
                    <strong className="block truncate text-[13px] font-semibold">{example.title}</strong>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-fg">{example.description}</span>
                  </span>
                  <span className="hidden items-center gap-2 pl-2 text-[10px] text-muted-fg sm:flex">
                    {example.studyCount} studies
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DashboardMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "cyan" | "violet" | "green" | "amber";
}) {
  return (
    <div className="dashboard-metric premium-metric">
      <div className={`metric-icon metric-${tone}`}>
        <Icon size={18} weight="duotone" />
      </div>
      <div className="metric-copy">
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
      <div className={`metric-spark metric-${tone}`} aria-hidden="true" />
    </div>
  );
}

function ReviewLibraryRow({
  review,
  stagger,
  onOpen,
  onDelete,
}: {
  review: SavedReviewMeta;
  stagger: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = TYPE_ICONS[review.type] ?? FileText;
  const progress = getPhaseProgress(review.phase);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(review.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(review.id);
        }
      }}
      className={`library-row premium-review-row group${stagger ? " stagger-item" : ""}`}
    >
      <div className="review-type-icon">
        <Icon size={19} weight="duotone" />
      </div>
      <div className="review-main">
        <div className="review-title-line">
          <strong>{review.title}</strong>
          <span className="review-type-label">{TYPE_LABELS[review.type] ?? toTitleCase(review.type)}</span>
        </div>
        <p>{review.researchQuestion || "No review question added yet"}</p>
        <div className="review-progress-mobile">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="review-stage">
        <span>{toTitleCase(review.phase)}</span>
        <div className="review-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <time dateTime={review.updatedAt}>{formatRelativeDate(review.updatedAt)}</time>
      <ArrowRight size={16} className="row-arrow" />
      <button
        type="button"
        aria-label={`Delete ${review.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onDelete(review.id);
        }}
        className="delete-review-button"
      >
        <Trash size={14} />
      </button>
    </div>
  );
}

function TypeBreakdownRow({
  type,
  count,
  total,
  index,
}: {
  type: string;
  count: number;
  total: number;
  index: number;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="portfolio-row">
      <div className="portfolio-label">
        <span className={`portfolio-dot portfolio-dot-${(index % 4) + 1}`} />
        <span>{TYPE_LABELS[type] ?? toTitleCase(type)}</span>
        <strong>{count}</strong>
      </div>
      <div className="portfolio-bar">
        <span
          className={`portfolio-fill portfolio-fill-${(index % 4) + 1}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function getPhaseProgress(phase: string) {
  const index = PHASES.findIndex((item) => item.value === phase);
  if (index < 0) return 8;
  return Math.round(((index + 1) / PHASES.length) * 100);
}

function toTitleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const difference = Date.now() - date.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (!Number.isFinite(difference) || difference < 0) return date.toLocaleDateString();
  if (difference < day) return "Today";
  if (difference < 2 * day) return "Yesterday";
  if (difference < 7 * day) return `${Math.floor(difference / day)} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
