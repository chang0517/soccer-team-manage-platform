"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";

interface CurrentMvp {
  eventId: number;
  label: string;
  phase: "open" | "closed";
  deadlineLabel: string;
  amAttendee: boolean;
  myVoteName: string | null;
  voterCount: number;
  attendCount: number;
  leaders: { name: string; count: number }[];
}

// 홈 화면 MVP 카드 — 투표 중이면 투표하러 가기, 마감됐으면 결과를 보여준다.
export default function MvpHomeCard() {
  const [mvp, setMvp] = useState<CurrentMvp | null>(null);

  useEffect(() => {
    fetch("/api/mvp/current")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMvp)
      .catch(() => {});
  }, []);

  if (!mvp) return null;
  const href = `/events/${mvp.eventId}#mvp`;

  if (mvp.phase === "closed") {
    if (mvp.leaders.length === 0) return null;
    return (
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href={href}
          className="pressable flex items-center gap-3 rounded-3xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 p-4 text-amber-950 shadow-lg shadow-amber-500/25"
        >
          <span className="text-4xl" aria-hidden="true">
            🏆
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold opacity-80">{mvp.label} MVP</p>
            <p className="truncate text-xl font-extrabold tracking-tight">
              {mvp.leaders.map((l) => l.name).join(", ")}
            </p>
            <p className="text-xs font-semibold opacity-80">
              {mvp.leaders[0].count}표 · {mvp.voterCount}명 투표
            </p>
          </div>
        </Link>
      </motion.section>
    );
  }

  if (mvp.myVoteName) {
    return (
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Link href={href} className="pressable flex items-center gap-3 card p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">MVP 투표 완료 · {mvp.myVoteName}</p>
            <p className="text-xs text-zinc-500">
              {mvp.voterCount}/{mvp.attendCount}명 참여 · 결과는 {mvp.deadlineLabel} 마감 후 공개
            </p>
          </div>
        </Link>
      </motion.section>
    );
  }

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-5 text-white shadow-lg shadow-blue-900/20">
        <p className="text-xs font-bold text-blue-200">{mvp.label}</p>
        <p className="mt-0.5 text-lg font-extrabold tracking-tight">
          🏆 오늘 경기 MVP는 누구였나요?
        </p>
        <p className="mt-1 text-sm text-blue-100">
          {mvp.deadlineLabel} 마감 · {mvp.voterCount}/{mvp.attendCount}명 참여
        </p>
        {mvp.amAttendee ? (
          <Link
            href={href}
            className="pressable mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-blue-900"
          >
            투표하러 가기
          </Link>
        ) : (
          <p className="mt-3 text-xs text-blue-200">경기 참석자만 투표할 수 있어요.</p>
        )}
      </div>
    </motion.section>
  );
}
