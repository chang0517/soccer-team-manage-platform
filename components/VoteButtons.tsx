"use client";

import { useId } from "react";
import { motion } from "motion/react";
import type { VoteStatus } from "@/lib/types";
import AnimatedNumber from "./ui/AnimatedNumber";
import { haptic } from "./ui/haptic";

const OPTIONS: { status: VoteStatus; label: string; emoji: string; pill: string }[] = [
  { status: "attend", label: "참석", emoji: "🙋", pill: "bg-blue-600 shadow-blue-600/30" },
  { status: "maybe", label: "미정", emoji: "🤔", pill: "bg-amber-500 shadow-amber-500/30" },
  { status: "absent", label: "불참", emoji: "🙅", pill: "bg-zinc-500 shadow-zinc-500/30" },
];

// 세그먼트 컨트롤 — 선택이 바뀌면 색 배경이 다음 칸으로 미끄러져 간다.
export default function VoteButtons({
  myStatus,
  counts,
  disabled,
  onVote,
}: {
  myStatus: VoteStatus | null;
  counts: Record<VoteStatus, number>;
  disabled?: boolean;
  onVote: (s: VoteStatus) => void;
}) {
  const pillId = useId();
  return (
    <div
      className={`grid grid-cols-3 gap-1 rounded-2xl bg-zinc-100 p-1 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      {OPTIONS.map((o) => {
        const selected = myStatus === o.status;
        return (
          <button
            key={o.status}
            disabled={disabled}
            onClick={() => {
              if (selected) return;
              haptic(12);
              onVote(o.status);
            }}
            className={`pressable relative flex items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-bold ${
              selected ? "text-white" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {selected && (
              <motion.span
                layoutId={`vote-pill-${pillId}`}
                transition={{ type: "spring", stiffness: 520, damping: 36 }}
                className={`absolute inset-0 rounded-xl shadow-lg ${o.pill}`}
              />
            )}
            <span className="relative">
              {selected ? `${o.emoji} ` : ""}
              {o.label}
            </span>
            <AnimatedNumber
              value={counts[o.status]}
              format={(v) => String(Math.round(v))}
              className={`relative text-xs ${selected ? "text-white/85" : "text-zinc-400"}`}
            />
          </button>
        );
      })}
    </div>
  );
}
