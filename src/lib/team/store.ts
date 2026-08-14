// src/lib/team/store.ts - reviewer identity, team, and settings.

"use client";

import { create } from "zustand";
import { newId } from "@/lib/project/id";

export interface TeamMember {
  id: string;
  name: string;
  email?: string | null;
  role: TeamRole;
  initials: string;
  color: string;
  isCurrentUser: boolean;
  affiliation?: string | null;
  country?: string | null;
  contribution?: string | null;
  conflictOfInterest?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TeamRole = "lead_reviewer" | "reviewer" | "methodologist" | "statistician" | "librarian" | "consumer";

export const TEAM_ROLES: { value: TeamRole; label: string; description: string }[] = [
  { value: "lead_reviewer", label: "Lead reviewer", description: "Owns the review, makes final calls on disputes." },
  { value: "reviewer", label: "Reviewer", description: "Screens references, extracts data, runs RoB assessments." },
  { value: "methodologist", label: "Methodologist", description: "Designs the search strategy + analysis plan." },
  { value: "statistician", label: "Statistician", description: "Reviews the meta-analysis + heterogeneity plan." },
  { value: "librarian", label: "Librarian", description: "Runs the literature search + dedup." },
  { value: "consumer", label: "Consumer", description: "Patient / public representative. Reviews plain-language summary." },
];

export const TEAM_COLORS = ["#14b8a6", "#6366f1", "#f59e0b", "#ec4899", "#84cc16", "#3b82f6", "#a855f7", "#f97316"];

export interface UserProfile {
  density: "compact" | "default" | "dense";
  fontScale: "small" | "medium" | "large";
  reduceMotion: boolean;
  tooltipsEnabled: boolean;
  tooltipsDensity: "minimal" | "detailed";
  defaultEffectMeasure: string;
  defaultMethod: string;
  defaultModel: "fixed" | "random";
  defaultConfidence: number;
  decimalPlaces: number;
  autoBackupMinutes: number;
  maxRecentFiles: number;
}

export const DEFAULT_PROFILE: UserProfile = {
  density: "compact",
  fontScale: "medium",
  reduceMotion: false,
  tooltipsEnabled: true,
  tooltipsDensity: "detailed",
  defaultEffectMeasure: "OR",
  defaultMethod: "MH",
  defaultModel: "fixed",
  defaultConfidence: 0.95,
  decimalPlaces: 2,
  autoBackupMinutes: 15,
  maxRecentFiles: 20,
};

interface ReviewScope {
  members: TeamMember[];
  saveMembers: (members: TeamMember[]) => void;
  saveProfile: (profile: UserProfile) => void;
}

interface TeamState {
  members: TeamMember[];
  currentMember: TeamMember | null;
  profile: UserProfile;
  loading: boolean;
  reviewScope: ReviewScope | null;

  setMembers: (members: TeamMember[]) => void;
  setCurrentMember: (m: TeamMember | null) => void;
  setProfile: (p: UserProfile) => void;
  setLoading: (b: boolean) => void;
  setReviewScope: (scope: ReviewScope | null) => void;

  addMember: (input: Omit<TeamMember, "id" | "createdAt" | "updatedAt">) => Promise<TeamMember | null>;
  updateMember: (id: string, patch: Partial<TeamMember>) => Promise<boolean>;
  deleteMember: (id: string) => Promise<boolean>;
  setCurrent: (id: string) => Promise<boolean>;
  saveProfile: (p: UserProfile) => Promise<boolean>;
}

function randomColor(): string {
  return TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)] ?? "#14b8a6";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function currentFrom(members: TeamMember[]): TeamMember | null {
  return members.find((m) => m.isCurrentUser) ?? null;
}

function localMember(input: Omit<TeamMember, "id" | "createdAt" | "updatedAt">): TeamMember {
  const now = new Date().toISOString();
  return {
    id: newId("member"),
    name: input.name,
    email: input.email ?? null,
    role: input.role,
    initials: input.initials || initialsFromName(input.name),
    color: input.color || randomColor(),
    isCurrentUser: input.isCurrentUser,
    affiliation: input.affiliation ?? null,
    country: input.country ?? null,
    contribution: input.contribution ?? null,
    conflictOfInterest: input.conflictOfInterest ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function dbMemberPayload(input: Omit<TeamMember, "id" | "createdAt" | "updatedAt">) {
  return {
    name: input.name,
    email: input.email ?? null,
    role: input.role,
    initials: input.initials || initialsFromName(input.name),
    color: input.color || randomColor(),
    isCurrentUser: input.isCurrentUser,
  };
}

function dbPatch(patch: Partial<TeamMember>) {
  return {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.email !== undefined ? { email: patch.email ?? null } : {}),
    ...(patch.role !== undefined ? { role: patch.role } : {}),
    ...(patch.initials !== undefined ? { initials: patch.initials } : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
    ...(patch.isCurrentUser !== undefined ? { isCurrentUser: patch.isCurrentUser } : {}),
  };
}

export const useTeamStore = create<TeamState>((set, get) => ({
  members: [],
  currentMember: null,
  profile: DEFAULT_PROFILE,
  loading: true,
  reviewScope: null,

  setMembers: (members) => set({ members, currentMember: currentFrom(members) }),
  setCurrentMember: (m) => set({ currentMember: m }),
  setProfile: (p) => set({ profile: p }),
  setLoading: (b) => set({ loading: b }),
  setReviewScope: (scope) => set({ reviewScope: scope }),

  addMember: async (input) => {
    const scope = get().reviewScope;
    if (scope) {
      const member = localMember(input);
      const members = member.isCurrentUser ? [member, ...scope.members.map((m) => ({ ...m, isCurrentUser: false, updatedAt: member.updatedAt }))] : [...scope.members, member];
      scope.saveMembers(members);
      set({ members, currentMember: currentFrom(members), reviewScope: { ...scope, members }, loading: false });
      return member;
    }
    try {
      const res = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dbMemberPayload(input)) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { member: TeamMember };
      set((s) => {
        const members = input.isCurrentUser ? [data.member, ...s.members.map((m) => ({ ...m, isCurrentUser: false }))] : [...s.members, data.member];
        return { members, currentMember: currentFrom(members) };
      });
      return data.member;
    } catch (e) {
      console.error("addMember failed", e);
      return null;
    }
  },

  updateMember: async (id, patch) => {
    const scope = get().reviewScope;
    if (scope) {
      const now = new Date().toISOString();
      const members = scope.members.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: now } : patch.isCurrentUser ? { ...m, isCurrentUser: false, updatedAt: now } : m));
      scope.saveMembers(members);
      set({ members, currentMember: currentFrom(members), reviewScope: { ...scope, members }, loading: false });
      return true;
    }
    try {
      const res = await fetch("/api/team", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, patch: dbPatch(patch) }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      set((s) => {
        const members = s.members.map((m) => (m.id === id ? { ...m, ...patch } : patch.isCurrentUser ? { ...m, isCurrentUser: false } : m));
        return { members, currentMember: currentFrom(members) };
      });
      return true;
    } catch (e) {
      console.error("updateMember failed", e);
      return false;
    }
  },

  deleteMember: async (id) => {
    const scope = get().reviewScope;
    if (scope) {
      const members = scope.members.filter((m) => m.id !== id);
      scope.saveMembers(members);
      set({ members, currentMember: currentFrom(members), reviewScope: { ...scope, members }, loading: false });
      return true;
    }
    try {
      const res = await fetch(`/api/team?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      set((s) => {
        const members = s.members.filter((m) => m.id !== id);
        return { members, currentMember: currentFrom(members) };
      });
      return true;
    } catch (e) {
      console.error("deleteMember failed", e);
      return false;
    }
  },

  setCurrent: async (id) => get().updateMember(id, { isCurrentUser: true }),

  saveProfile: async (p) => {
    const scope = get().reviewScope;
    if (scope) {
      scope.saveProfile(p);
      set({ profile: p, loading: false });
      return true;
    }
    try {
      const res = await fetch("/api/team/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      set({ profile: p });
      return true;
    } catch (e) {
      console.error("saveProfile failed", e);
      return false;
    }
  },
}));

export function initialsFrom(member: { name: string; initials?: string } | null | undefined): string {
  if (!member) return "?";
  if (member.initials && member.initials.length > 0) return member.initials.toUpperCase();
  return initialsFromName(member.name);
}