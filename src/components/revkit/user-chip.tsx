// src/components/revkit/user-chip.tsx — small avatar shown in topbar
// representing the current reviewer (their decisions get attributed).

"use client";

import { useTeamStore, initialsFrom } from "@/lib/team/store";
import { useReviewStore } from "@/lib/project/state";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { UserCircle } from "@phosphor-icons/react";

export function UserChip({ onClick }: { onClick?: () => void }) {
  const globalCurrent = useTeamStore((s) => s.currentMember);
  const review = useReviewStore((s) => s.review);
  const current = review
    ? review.protocol?.team?.members.find((member) => member.isCurrentUser) ?? null
    : globalCurrent;

  if (!current) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClick}
              className="btn-ghost flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px]"
              aria-label="Set up your reviewer profile"
            >
              <UserCircle size={16} weight="regular" />
              <span className="hidden sm:inline text-muted-fg">Set profile</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="tooltip-origin">
            <span className="text-xs">Click to set up your reviewer profile.</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[12px] transition-colors hover:bg-surface-hover"
            aria-label={`Current reviewer: ${current.name}`}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: current.color }}
            >
              {initialsFrom(current)}
            </span>
            <span className="hidden sm:inline font-medium text-fg-2">{current.name.split(" ")[0]}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="tooltip-origin">
          <div className="text-xs space-y-0.5">
            <div className="font-semibold text-foreground">{current.name}</div>
            <div className="text-muted-foreground capitalize">{current.role.replace("_", " ")}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}