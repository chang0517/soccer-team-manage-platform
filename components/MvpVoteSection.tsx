"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { haptic } from "@/components/ui/haptic";
import { mvpDeadlineLabel, mvpLeaders, mvpPhase } from "@/lib/mvp";
import type { EventItem, Member, MvpVoteRow } from "@/lib/types";

/**
 * MVP 투표 — 드롭다운 대신 그날 참석자 카드(골·어시 함께 표시)를 한 번
 * 눌러 투표한다. 다른 카드를 누르면 바로 바뀐다. 투표 중에는 내가 투표하기
 * 전까지 집계를 숨겨서 남의 표에 휩쓸리지 않게 하고, 마감되면 MVP를 발표한다.
 */
export default function MvpVoteSection({
  eventId,
  event,
  members,
  attendIds,
  myId,
  loggedIn,
  mvpVotes,
  onMvpVotesChange,
  goals,
  assists,
}: {
  eventId: number;
  event: EventItem;
  members: Member[];
  attendIds: number[];
  myId: number | null;
  loggedIn: boolean;
  mvpVotes: MvpVoteRow[];
  onMvpVotesChange: (v: MvpVoteRow[]) => void;
  goals: Map<number, number>;
  assists: Map<number, number>;
}) {
  const [saving, setSaving] = useState(false);
  const phase = mvpPhase(event);
  const amAttendee = myId != null && attendIds.includes(myId);
  const myVote = mvpVotes.find((v) => v.voterId === myId)?.voteeId ?? null;
  const memberById = new Map(members.map((m) => [m.id, m]));

  const tally = new Map<number, number>();
  for (const v of mvpVotes) tally.set(v.voteeId, (tally.get(v.voteeId) ?? 0) + 1);
  const maxVotes = Math.max(0, ...tally.values());
  const leaders = mvpLeaders(mvpVotes);
  const showTally = phase === "closed" || myVote != null || !amAttendee;

  // 그날 활약(골+어시)이 큰 순서로 — 투표할 때 후보를 찾기 쉽게.
  const candidates = attendIds
    .filter((id) => id !== myId && memberById.has(id))
    .map((id) => memberById.get(id)!)
    .sort(
      (a, b) =>
        (goals.get(b.id) ?? 0) + (assists.get(b.id) ?? 0) -
          ((goals.get(a.id) ?? 0) + (assists.get(a.id) ?? 0)) ||
        (goals.get(b.id) ?? 0) - (goals.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name, "ko")
    );

  const vote = async (voteeId: number) => {
    if (!myId || saving || voteeId === myVote) return;
    const prev = mvpVotes;
    haptic(10);
    onMvpVotesChange([
      ...prev.filter((v) => v.voterId !== myId),
      { eventId, voterId: myId, voteeId },
    ]);
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/mvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteeId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "투표에 실패했어요.");
      }
      toast.success(`${memberById.get(voteeId)?.name}에게 MVP 투표했어요`);
    } catch (e) {
      onMvpVotesChange(prev);
      toast.error(e instanceof Error ? e.message : "투표에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const statLine = (id: number) => {
    const g = goals.get(id) ?? 0;
    const a = assists.get(id) ?? 0;
    const parts = [g ? `${g}골` : "", a ? `${a}어시` : ""].filter(Boolean);
    return parts.length ? parts.join(" ") : "";
  };

  return (
    <section id="mvp" className="card scroll-mt-20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold tracking-tight">MVP 투표</h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            phase === "open"
              ? "bg-blue-50 text-blue-700"
              : phase === "closed"
                ? "bg-zinc-100 text-zinc-500"
                : "bg-amber-50 text-amber-700"
          }`}
        >
          {phase === "open"
            ? `${mvpDeadlineLabel(event)} 마감`
            : phase === "closed"
              ? "마감됨"
              : "경기 끝나면 열려요"}
        </span>
      </div>

      {phase === "closed" && leaders.length > 0 && (
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 p-4 text-amber-950"
        >
          <span className="text-4xl" aria-hidden="true">
            🏆
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold opacity-80">이번 경기 MVP</p>
            <p className="truncate text-xl font-extrabold">
              {leaders.map((l) => memberById.get(l.memberId)?.name ?? "?").join(", ")}
            </p>
            <p className="text-xs font-semibold opacity-80">
              {leaders[0].count}표 · {mvpVotes.length}명 투표
            </p>
          </div>
        </motion.div>
      )}

      {phase === "open" && amAttendee && (
        <>
          <p className="mb-2 text-xs text-zinc-500">
            {myVote != null
              ? "다른 선수를 누르면 투표가 바뀌어요."
              : "오늘 가장 잘한 선수를 한 번 눌러주세요."}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {candidates.map((m) => {
              const picked = myVote === m.id;
              const stat = statLine(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => vote(m.id)}
                  aria-pressed={picked}
                  className={`relative flex min-h-[64px] flex-col items-center justify-center rounded-2xl px-1 py-2 transition-colors ${
                    picked ? "text-white" : "bg-zinc-100 text-zinc-900"
                  }`}
                >
                  {picked && (
                    <motion.span
                      layoutId="mvp-pick"
                      className="absolute inset-0 rounded-2xl bg-blue-700 shadow-lg shadow-blue-700/30"
                      transition={{ type: "spring", stiffness: 500, damping: 36 }}
                    />
                  )}
                  <span className="relative w-full truncate text-center text-[15px] font-bold">
                    {m.name}
                  </span>
                  <span
                    className={`relative text-[11px] font-semibold ${picked ? "text-blue-100" : stat ? "text-blue-700" : "text-zinc-400"}`}
                  >
                    {picked ? "내 투표" : stat || (m.isGuest ? "용병" : " ")}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {!amAttendee && phase !== "closed" && (
        <p className="text-xs text-zinc-500">
          {!loggedIn
            ? "투표하려면 먼저 로그인해 주세요."
            : myId == null
              ? "아직 멤버 프로필과 연결되지 않았어요."
              : "경기 참여자(참석 투표)만 MVP 투표를 할 수 있어요."}
        </p>
      )}

      {phase === "before" && amAttendee && (
        <p className="text-xs text-zinc-500">
          경기가 끝나면 투표가 열리고, 참석자에게 알림이 가요.
        </p>
      )}

      {phase === "open" && amAttendee && myVote == null && mvpVotes.length > 0 && (
        <p className="mt-3 text-xs text-zinc-400">
          지금까지 {mvpVotes.length}명 투표 · 투표하면 현황을 볼 수 있어요.
        </p>
      )}

      {showTally && tally.size > 0 && phase !== "before" && (
        <div className="mt-4 space-y-1.5">
          <AnimatePresence initial={false}>
            {[...tally.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([memberId, count]) => (
                <motion.div key={memberId} layout className="flex items-center gap-2 text-sm">
                  <span className={`w-16 shrink-0 truncate ${count === maxVotes ? "font-bold" : ""}`}>
                    {memberById.get(memberId)?.name ?? "?"}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <motion.div
                      className={`h-full rounded-full ${count === maxVotes ? "bg-amber-400" : "bg-zinc-300"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / Math.max(1, maxVotes)) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs text-zinc-500">{count}표</span>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
