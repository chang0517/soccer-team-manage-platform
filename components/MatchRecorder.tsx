"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { haptic } from "@/components/ui/haptic";
import { applyRecordOp, summarizeRecordLog } from "@/lib/records";
import type { RecordOp } from "@/lib/records";
import { FORMATION_SLOTS, slotFinalPosition } from "@/lib/squad";
import type { SlotCategory } from "@/lib/squad";
import { POS_CATEGORY, POS_SHORT } from "@/lib/types";
import type { EventItem, Member, PosCategory, QuarterRecordEntry } from "@/lib/types";

interface Chip {
  id: number;
  name: string;
  sub: string;
}

const SLOT_GROUP: Record<SlotCategory, PosCategory> = {
  FW: "ATT",
  MF: "MID",
  DF: "DEF",
  GK: "DEF",
};
const GROUP_LABEL: Record<PosCategory, string> = { ATT: "공격", MID: "미드필더", DEF: "수비" };
const GROUP_ORDER: PosCategory[] = ["ATT", "MID", "DEF"];

/**
 * 경기 기록 입력 — "골 기록하기 → 득점자 → 어시스트" 세 번 탭으로 골 하나를
 * 기록하고, 누를 때마다 서버에 동작 단위로 자동 저장한다. 쿼터 득점은 골 기록
 * 수로 자동 계산되고, 실점만 버튼으로 올리고 내린다.
 */
export default function MatchRecorder({
  eventId,
  event,
  members,
  attendIds,
  recordLog,
  onRecordLogChange,
}: {
  eventId: number;
  event: EventItem;
  members: Member[];
  attendIds: number[];
  recordLog: QuarterRecordEntry[];
  onRecordLogChange: (log: QuarterRecordEntry[]) => void;
}) {
  const [qi, setQi] = useState(0);
  const [step, setStep] = useState<null | "scorer" | "assist">(null);
  const [scorer, setScorer] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  // 연달아 빠르게 누를 때 아직 다시 그려지기 전의 최신 기록을 기준으로
  // 다음 동작을 적용하려고 ref에도 들고 있는다.
  const latestLog = useRef(recordLog);
  const seq = useRef(0);
  useEffect(() => {
    latestLog.current = recordLog;
  }, [recordLog]);
  const setLog = (log: QuarterRecordEntry[]) => {
    latestLog.current = log;
    onRecordLogChange(log);
  };

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const nameOf = (id: number | null) =>
    id == null ? "득점자 미기록" : (memberById.get(id)?.name ?? "?");

  // 시트에 띄울 선수: 그 쿼터 스쿼드에 들어간 선수를 자리별로, 스쿼드가
  // 없으면 참석자를 1순위 포지션별로 묶는다. 스쿼드 밖 참석자(교체 등)도
  // 빠짐없이 고를 수 있게 "그 외 참석자"로 붙인다.
  const groups = useMemo(() => {
    const placed = new Map<number, { cat: PosCategory; sub: string; order: number }>();
    for (const squad of [event.squad, event.scrimmageSquad]) {
      const q = squad?.quarters[qi];
      for (const s of q?.starters ?? []) {
        const slotIdx = FORMATION_SLOTS.findIndex((d) => d.id === s.slotId);
        const slot = FORMATION_SLOTS[slotIdx];
        if (!slot) continue;
        for (const mid of [s.memberId, s.memberId2]) {
          if (mid == null || placed.has(mid) || !memberById.has(mid)) continue;
          placed.set(mid, { cat: SLOT_GROUP[slot.category], sub: slot.label, order: slotIdx });
        }
      }
    }
    const result: { label: string; chips: Chip[] }[] = [];
    if (placed.size > 0) {
      for (const cat of GROUP_ORDER) {
        const chips = [...placed.entries()]
          .filter(([, p]) => p.cat === cat)
          .sort((a, b) => a[1].order - b[1].order)
          .map(([id, p]) => ({ id, name: memberById.get(id)!.name, sub: p.sub }));
        if (chips.length) result.push({ label: GROUP_LABEL[cat], chips });
      }
      const rest = attendIds
        .filter((id) => !placed.has(id) && memberById.has(id))
        .map((id) => memberById.get(id)!)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"))
        .map((m) => ({ id: m.id, name: m.name, sub: m.isGuest ? "용병" : POS_SHORT[m.pos1] }));
      if (rest.length) result.push({ label: "그 외 참석자", chips: rest });
    } else {
      for (const cat of GROUP_ORDER) {
        const chips = attendIds
          .map((id) => memberById.get(id))
          .filter((m): m is Member => !!m && POS_CATEGORY[m.pos1] === cat)
          .sort((a, b) => a.name.localeCompare(b.name, "ko"))
          .map((m) => ({ id: m.id, name: m.name, sub: m.isGuest ? "용병" : POS_SHORT[m.pos1] }));
        if (chips.length) result.push({ label: GROUP_LABEL[cat], chips });
      }
    }
    return result;
  }, [event.squad, event.scrimmageSquad, qi, attendIds, memberById]);

  // 누르자마자 화면에 반영하고(낙관적), 서버 응답이 오면 서버 기록으로 맞춘다.
  // 연달아 누른 경우엔 마지막 요청의 응답만 반영해서 화면이 되돌아가지 않게 한다.
  const send = async (op: RecordOp, successMsg?: string) => {
    const prev = latestLog.current;
    setLog(applyRecordOp(prev, op));
    haptic(8);
    const mySeq = ++seq.current;
    setPending((n) => n + 1);
    try {
      const res = await fetch(`/api/events/${eventId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.recordLog) throw new Error(data?.error || "저장에 실패했어요.");
      if (mySeq === seq.current) setLog(data.recordLog);
      if (successMsg) toast.success(successMsg);
    } catch (e) {
      if (mySeq === seq.current) setLog(prev);
      toast.error(e instanceof Error ? e.message : "저장에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setPending((n) => n - 1);
    }
  };

  const closeSheet = () => {
    setStep(null);
    setScorer(null);
  };

  const pickScorer = (id: number | null) => {
    if (id == null) {
      // 득점자를 모르거나 상대 자책골이면 어시스트도 없으니 바로 기록한다.
      closeSheet();
      send({ op: "addGoal", quarter: qi, scorerId: null, assistId: null }, `${qi + 1}쿼터 골 기록`);
      return;
    }
    haptic(6);
    setScorer(id);
    setStep("assist");
  };

  const pickAssist = (id: number | null) => {
    const s = scorer;
    closeSheet();
    send(
      { op: "addGoal", quarter: qi, scorerId: s, assistId: id },
      `${nameOf(s)} 골${id != null ? ` · ${nameOf(id)} 어시` : ""}`
    );
  };

  const removeGoal = (index: number) => {
    const g = recordLog[qi].goals[index];
    const quarter = qi;
    send({ op: "removeGoal", quarter, index, scorerId: g.scorerId, assistId: g.assistId });
    toast(`${nameOf(g.scorerId)} 골을 지웠어요`, {
      action: {
        label: "되돌리기",
        onClick: () =>
          send({ op: "addGoal", quarter, scorerId: g.scorerId, assistId: g.assistId }),
      },
    });
  };

  const setConceded = (conceded: number | null) =>
    send({ op: "setConceded", quarter: qi, conceded });

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSheet();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const q = recordLog[qi];
  const total = summarizeRecordLog(recordLog);

  // 무실점 쿼터에 그 쿼터 스쿼드로 뛴 GK·센터백·윙백·수미 — 클린시트 미리보기.
  const cleanSheetLines = recordLog.flatMap((rq, i) => {
    if (rq.conceded !== 0 || !event.squad?.quarters[i]) return [];
    const names = event.squad.quarters[i].starters.flatMap((slot) => {
      const pos = slotFinalPosition(slot.slotId);
      if (!["GK", "CB", "WB", "DM"].includes(pos)) return [];
      return [slot.memberId, slot.memberId2]
        .filter((v): v is number => v != null && memberById.has(v))
        .map((v) => memberById.get(v)!.name);
    });
    return names.length ? [`${i + 1}쿼터 무실점 클린시트: ${names.join(", ")}`] : [];
  });

  const sheetChips = groups.map((g) => ({
    ...g,
    chips: step === "assist" ? g.chips.filter((c) => c.id !== scorer) : g.chips,
  }));

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold tracking-tight">경기 기록</h2>
        <span
          className={`flex items-center gap-1 text-xs font-bold ${pending > 0 ? "text-zinc-400" : "text-emerald-700"}`}
          aria-live="polite"
        >
          {pending > 0 ? (
            "저장 중…"
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 7" />
              </svg>
              자동 저장됨
            </>
          )}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {recordLog.map((rq, i) => {
          const active = qi === i;
          const label =
            rq.scored == null && rq.conceded == null
              ? "기록 전"
              : `${rq.scored ?? 0} : ${rq.conceded ?? "-"}`;
          return (
            <button
              key={i}
              onClick={() => setQi(i)}
              className={`relative flex flex-col items-center rounded-2xl py-2 ${active ? "text-white" : "bg-zinc-100 text-zinc-600"}`}
            >
              {active && (
                <motion.span
                  layoutId="record-quarter-pill"
                  className="absolute inset-0 rounded-2xl bg-blue-700"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative text-sm font-bold">{i + 1}쿼터</span>
              <span className={`relative text-[11px] font-medium ${active ? "text-blue-100" : "text-zinc-500"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-zinc-50 px-3 py-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-zinc-500">우리 득점</span>
          <motion.span
            key={`f${qi}-${q.goals.length}`}
            initial={{ scale: 1.25, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-extrabold leading-none text-blue-700 tabular-nums"
          >
            {q.goals.length}
          </motion.span>
          <span className="text-[11px] text-zinc-500">골 기록 수로 자동 계산</span>
        </div>
        <span className="text-2xl font-extrabold text-zinc-300">:</span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-zinc-500">실점</span>
          <motion.span
            key={`a${qi}-${q.conceded}`}
            initial={{ scale: 1.25, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-extrabold leading-none tabular-nums"
          >
            {q.conceded ?? "–"}
          </motion.span>
          {q.conceded == null ? (
            <div className="flex gap-1.5">
              <button
                onClick={() => setConceded(0)}
                className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-sky-700 shadow-sm ring-1 ring-zinc-200"
              >
                무실점
              </button>
              <button
                onClick={() => setConceded(1)}
                className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-700 shadow-sm ring-1 ring-zinc-200"
              >
                +1 실점
              </button>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={() => setConceded(q.conceded! - 1)}
                disabled={q.conceded === 0}
                aria-label="실점 1 빼기"
                className="h-8 w-11 rounded-lg bg-white text-lg font-bold text-zinc-700 shadow-sm ring-1 ring-zinc-200 disabled:opacity-40"
              >
                −
              </button>
              <button
                onClick={() => setConceded(q.conceded! + 1)}
                aria-label="실점 1 더하기"
                className="h-8 w-11 rounded-lg bg-white text-lg font-bold text-zinc-700 shadow-sm ring-1 ring-zinc-200"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {q.goals.length === 0 && (
          <p className="py-3 text-center text-sm text-zinc-400">
            {qi + 1}쿼터에 기록된 골이 없어요.
          </p>
        )}
        <AnimatePresence initial={false}>
          {q.goals.map((g, i) => (
            <motion.div
              key={`${qi}-${i}-${g.scorerId}-${g.assistId}`}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-extrabold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[15px] font-bold ${g.scorerId == null ? "text-zinc-500" : ""}`}>
                  {nameOf(g.scorerId)}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {g.assistId != null ? `${nameOf(g.assistId)} 어시스트` : "어시스트 없음"}
                </p>
              </div>
              <button
                onClick={() => removeGoal(i)}
                aria-label="이 골 지우기"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <button
        onClick={() => {
          if (groups.length === 0) {
            toast.error("참석자가 없어요. 먼저 참석 명단을 채워주세요.");
            return;
          }
          haptic(8);
          setStep("scorer");
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 py-3.5 text-[15px] font-extrabold text-white shadow-lg shadow-blue-700/25"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {qi + 1}쿼터 골 기록하기
      </button>

      <div className="mt-4 space-y-1 rounded-xl bg-zinc-50 p-3 text-sm">
        <p className="font-semibold text-zinc-700">
          전체 스코어 {total.scored ?? "?"} : {total.conceded ?? "?"}
          {total.conceded === 0 && (
            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
              무실점
            </span>
          )}
        </p>
        {total.goals.size > 0 && (
          <p className="text-xs text-zinc-500">
            득점:{" "}
            {[...total.goals.entries()].map(([mid, n]) => `${nameOf(mid)} ${n}`).join(", ")}
          </p>
        )}
        {total.assists.size > 0 && (
          <p className="text-xs text-zinc-500">
            어시스트:{" "}
            {[...total.assists.entries()].map(([mid, n]) => `${nameOf(mid)} ${n}`).join(", ")}
          </p>
        )}
        {cleanSheetLines.map((line) => (
          <p key={line} className="text-xs text-sky-700">
            {line}
          </p>
        ))}
        <p className="pt-1 text-[11px] leading-relaxed text-zinc-400">
          참석으로 등록된 선수는 골·어시가 없어도 출전·클린시트 점수를 받아요.
          실점은 쿼터마다 &lsquo;무실점&rsquo; 또는 실점 수를 꼭 눌러주세요.
        </p>
      </div>

      <AnimatePresence>
        {step && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSheet}
            />
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center md:items-center">
              <motion.div
                key="sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="goal-sheet-title"
                className="pointer-events-auto flex max-h-[85vh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-white shadow-2xl md:mx-4 md:rounded-[1.75rem]"
                initial={{ y: "100%", opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
              >
                <div className="px-5 pt-3">
                  <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-200 md:hidden" />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-blue-700">
                        {qi + 1}쿼터 · {step === "scorer" ? "1 / 2" : `2 / 2 · ${nameOf(scorer)} 골`}
                      </p>
                      <p id="goal-sheet-title" className="text-[19px] font-extrabold tracking-tight">
                        {step === "scorer" ? "누가 골을 넣었나요?" : "어시스트는 누구였나요?"}
                      </p>
                    </div>
                    {step === "assist" && (
                      <button
                        onClick={() => setStep("scorer")}
                        className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-bold text-zinc-600"
                      >
                        득점자 다시
                      </button>
                    )}
                  </div>
                </div>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: step === "assist" ? 24 : -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3"
                >
                  {sheetChips.map((g) => (
                    <div key={g.label}>
                      <p className="mb-1.5 text-[11px] font-bold text-zinc-500">{g.label}</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {g.chips.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => (step === "scorer" ? pickScorer(c.id) : pickAssist(c.id))}
                            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl bg-zinc-100 px-1 py-1.5 active:bg-blue-100"
                          >
                            <span className="w-full truncate text-center text-sm font-bold">{c.name}</span>
                            <span className="text-[10px] font-medium text-zinc-500">{c.sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {step === "scorer" ? (
                    <button
                      onClick={() => pickScorer(null)}
                      className="w-full rounded-xl border border-dashed border-zinc-300 py-3 text-sm font-semibold text-zinc-600"
                    >
                      득점자 모름 · 상대 자책골
                    </button>
                  ) : (
                    <button
                      onClick={() => pickAssist(null)}
                      className="w-full rounded-xl border-[1.5px] border-dashed border-zinc-400 py-3.5 text-sm font-bold text-zinc-700"
                    >
                      어시스트 없음 (단독 골)
                    </button>
                  )}
                </motion.div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
