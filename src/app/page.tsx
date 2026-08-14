"use client";

import { useEffect, useState } from "react";
import { WelcomeScreen } from "@/components/revkit/welcome-screen";
import { WorkspaceShell, OverviewPage, type WorkspaceTab } from "@/components/revkit/workspace-shell";
import { StudiesPage } from "@/components/revkit/studies-page";
import { ReferencesPage } from "@/components/revkit/references-page";
import { ComparisonsPage } from "@/components/revkit/comparisons-page";
import { RobPage } from "@/components/revkit/rob-page";
import { PrismaPage } from "@/components/revkit/prisma-page";
import { ExportPage } from "@/components/revkit/export-page";
import { SettingsPage } from "@/components/revkit/settings-page";
import { useReviewStore } from "@/lib/project/state";
import { useTeamStore, DEFAULT_PROFILE } from "@/lib/team/store";
import type { ReviewType, ReviewSubType } from "@/lib/types";
import { createExampleReview } from "@/lib/project/example-reviews";
import { toast } from "sonner";

export default function Home() {
  const [view, setView] = useState<"welcome" | "workspace">("welcome");
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [welcomeRefreshKey, setWelcomeRefreshKey] = useState(0);

  const review = useReviewStore((s) => s.review);
  const setReview = useReviewStore((s) => s.setReview);
  const newReviewAction = useReviewStore((s) => s.newReview);

  // Load team + profile on first mount.
  const setMembers = useTeamStore((s) => s.setMembers);
  const setProfile = useTeamStore((s) => s.setProfile);
  const setLoading = useTeamStore((s) => s.setLoading);
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    Promise.all([
      fetch("/api/team", { signal: ctrl.signal }).then((r) => r.json()),
      fetch("/api/team/profile", { signal: ctrl.signal }).then((r) => r.json()),
    ])
      .then(([teamData, profileData]) => {
        if (cancelled) return;
        setMembers(teamData.members ?? []);
        // NEVER pass null — the store type is UserProfile (non-nullable).
        // If the API hasn't created the singleton yet, fall back to DEFAULT_PROFILE.
        setProfile(profileData.profile ?? DEFAULT_PROFILE);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || cancelled) return;
        setLoading(false);
        console.error("Failed to load team/profile", err);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [setMembers, setProfile, setLoading]);

  async function handleNew(input: {
    title: string;
    type: ReviewType;
    subType: ReviewSubType;
    researchQuestion: string;
  }) {
    newReviewAction(input);
    setView("workspace");
    setTab("overview");
    toast.success("New review created", { description: input.title });
  }

  async function handleOpen(id: string) {
    try {
      const res = await fetch(`/api/reviews/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { review: Parameters<typeof setReview>[0] };
      if (data.review) {
        setReview(data.review);
        useReviewStore.setState({ dbId: id });
        setView("workspace");
        setTab("overview");
      }
    } catch (e) {
      toast.error("Failed to open review", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  function handleExample(type: ReviewType) {
    const example = createExampleReview(type);
    useReviewStore.setState({ review: example, isDirty: true, dbId: null });
    setView("workspace");
    setTab("overview");
    toast.success("Example review opened", { description: example.title });
  }

  function handleExit() {
    if (useReviewStore.getState().isDirty) {
      if (!confirm("You have unsaved changes. Exit to library anyway?")) return;
    }
    setView("welcome");
    setWelcomeRefreshKey((k) => k + 1);
    setReview(null);
    useReviewStore.setState({ dbId: null });
  }

  // Keyboard shortcuts — ⌘S to save
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (view !== "workspace") return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key === "s") {
        e.preventDefault();
        const btn = document.querySelector<HTMLButtonElement>("[data-save-btn]");
        btn?.click();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view]);

  if (view === "welcome" || !review) {
    return (
      <WelcomeScreen
        onNew={handleNew}
        onOpen={handleOpen}
        onLoadExample={handleExample}
        refreshKey={welcomeRefreshKey}
      />
    );
  }

  return (
    <WorkspaceShell active={tab} onTabChange={setTab} onExit={handleExit}>
      {tab === "overview" && <OverviewPage />}
      {tab === "studies" && <StudiesPage />}
      {tab === "references" && <ReferencesPage />}
      {tab === "comparisons" && <ComparisonsPage />}
      {tab === "rob" && <RobPage />}
      {tab === "prisma" && <PrismaPage />}
      {tab === "export" && <ExportPage />}
      {tab === "settings" && <SettingsPage />}
    </WorkspaceShell>
  );
}
