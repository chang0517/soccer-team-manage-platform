"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { toast } from "sonner";
import { confirmSheet } from "@/components/ui/ConfirmSheet";
import { haptic } from "@/components/ui/haptic";
import {
  asDraft,
  fillEmptySlots,
  FORMATION_SLOTS,
  memberQuarterRoles,
  SLOT_CATEGORY_COLORS,
  SQUAD_APPROVAL_THRESHOLD,
  slotFit,
  squadPlayCounts,
  squadStatus,
} from "@/lib/squad";
import type { SquadAction } from "@/lib/squad";
import { POS_SHORT } from "@/lib/types";
import type { Member, QuarterSquad, SquadData, SquadSlotAssign } from "@/lib/types";

type Half = "full" | "first" | "second";
type Sel = { t: "slot"; id: string; half: Half } | { t: "bench"; mid: number } | null;

const POS_ORDER = ["GK", "CB", "WB", "DM", "AM", "WG", "ST"];
const fmtCount = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
const slotLabel = (id: string) => FORMATION_SLOTS.find((s) => s.id === id)?.label ?? id;

/**
 * 스쿼드 편집 — 선수를 누르고 → 바꿀 자리나 벤치 선수를 누르는 "탭-탭"
 * 방식이라 휴대폰에서도 드래그 없이 옮길 수 있다. 누르는 즉시 화면에
 * 반영하고 서버에 라인업을 자동 저장한다(되돌리기 가능). 위쪽 상태 바에서
 * 제출 → 운영진 승인 → 확정까지 진행한다.
 */
export default function SquadEditor({
  eventId,
  team,
  squad,
  members,
  rosterIds,
  isAdmin,
  myId,
  onSquadChange,
}: {
  eventId: number;
  team: "A" | "B";
  squad: SquadData;
  members: Member[];
  rosterIds: number[];
  isAdmin: boolean;
  myId: number | null;
  onSquadChange: (s: SquadData) => void;
}) {
  const [view, setView] = useState<"field" | "table">("field");
  const [qi, setQi] = useState(0);
  const [sel, setSel] = useState<Sel>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(squad);
  const seq = useRef(0);
  useEffect(() => {
    latest.current = squad;
  }, [squad]);

  const status = squadStatus(squad);
  const editable = isAdmin && status !== "confirmed";
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const nameOf = (id: number | null | undefined) =>
    id == null ? "비어 있음" : (memberById.get(id)?.name ?? "?");
  const counts = squadPlayCounts(squad);
  const q = squad.quarters[qi];
  const assignOf = (slotId: string) => q.starters.find((s) => s.slotId === slotId);

  // ---------- 저장 ----------
  const withBench = (starters: SquadSlotAssign[]): QuarterSquad => {
    const on = new Set(
      starters.flatMap((s) => [s.memberId, s.memberId2]).filter((v): v is number => v != null)
    );
    return { starters, bench: rosterIds.filter((id) => !on.has(id)) };
  };

  const saveQuarters = async (quarters: QuarterSquad[], msg: string) => {
    const prev = latest.current;
    if (squadStatus(prev) === "confirmed") return;
    if (
      squadStatus(prev) === "submitted" &&
      !(await confirmSheet({
        title: "제출된 스쿼드를 고칠까요?",
        description: "받은 승인이 초기화되고, 다 고친 뒤 다시 제출해야 해요.",
        confirmText: "고치기",
      }))
    ) {
      setSel(null);
      return;
    }
    const next = { ...asDraft(prev), quarters };
    latest.current = next;
    onSquadChange(next);
    setSel(null);
    haptic(8);
    const mySeq = ++seq.current;
    try {
      const res = await fetch(`/api/events/${eventId}/squad?team=${team}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarters }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.squad) throw new Error(data?.error || "저장에 실패했어요.");
      if (mySeq === seq.current) {
        latest.current = data.squad;
        onSquadChange(data.squad);
      }
      toast(msg, {
        duration: 3000,
        action: {
          label: "되돌리기",
          onClick: () => saveQuarters(prev.quarters, "되돌렸어요"),
        },
      });
    } catch (e) {
      if (mySeq === seq.current) {
        latest.current = prev;
        onSquadChange(prev);
      }
      toast.error(e instanceof Error ? e.message : "저장에 실패했어요.");
    }
  };

  const editQuarter = (fn: (starters: SquadSlotAssign[]) => SquadSlotAssign[], msg: string) => {
    const cur = latest.current;
    const quarters = cur.quarters.map((qq, i) =>
      i === qi ? withBench(fn(qq.starters.map((s) => ({ ...s })))) : qq
    );
    saveQuarters(quarters, msg);
  };

  // ---------- 조작 ----------
  const clearElsewhere = (starters: SquadSlotAssign[], mid: number) =>
    starters.map((s) => ({
      ...s,
      memberId: s.memberId === mid ? null : s.memberId,
      ...(s.memberId2 !== undefined ? { memberId2: s.memberId2 === mid ? null : s.memberId2 } : {}),
    }));

  const putInto = (slotId: string, half: Half, mid: number) => {
    const a = assignOf(slotId);
    const out = half === "second" ? a?.memberId2 : a?.memberId;
    editQuarter((starters) => {
      const next = clearElsewhere(starters, mid);
      return next.map((s) => {
        if (s.slotId !== slotId) return s;
        return half === "second" ? { ...s, memberId2: mid } : { ...s, memberId: mid };
      });
    }, `${nameOf(mid)} 투입${out != null ? ` · ${nameOf(out)} 벤치로` : ""}`);
  };

  const swap = (a: string, b: string) => {
    const sa = assignOf(a);
    const sb = assignOf(b);
    editQuarter(
      (starters) =>
        starters.map((s) => {
          const from = s.slotId === a ? sb : s.slotId === b ? sa : null;
          if (!from) return s;
          return from.memberId2 !== undefined
            ? { slotId: s.slotId, memberId: from.memberId, memberId2: from.memberId2 }
            : { slotId: s.slotId, memberId: from.memberId };
        }),
      `${nameOf(sa?.memberId)}(${slotLabel(a)}) ↔ ${nameOf(sb?.memberId)}(${slotLabel(b)})`
    );
  };

  const toggleSplit = (slotId: string) => {
    const a = assignOf(slotId);
    const isSplit = a?.memberId2 !== undefined;
    editQuarter(
      (starters) =>
        starters.map((s) =>
          s.slotId !== slotId
            ? s
            : isSplit
              ? { slotId: s.slotId, memberId: s.memberId }
              : { ...s, memberId2: null }
        ),
      isSplit ? `${slotLabel(slotId)} 나누기 취소` : `${slotLabel(slotId)} 전·후반 나눔 — 후반 선수를 골라주세요`
    );
  };

  const clearSlot = (slotId: string, half: Half) =>
    editQuarter(
      (starters) =>
        starters.map((s) =>
          s.slotId !== slotId ? s : half === "second" ? { ...s, memberId2: null } : { ...s, memberId: null }
        ),
      `${slotLabel(slotId)} 비웠어요`
    );

  const tapSlot = (slotId: string) => {
    if (!editable) return;
    haptic(6);
    const a = assignOf(slotId);
    const split = a?.memberId2 !== undefined;
    if (!sel) {
      setSel({ t: "slot", id: slotId, half: split ? "first" : "full" });
      return;
    }
    if (sel.t === "slot") {
      if (sel.id === slotId) {
        if (split) setSel({ ...sel, half: sel.half === "first" ? "second" : "first" });
        else setSel(null);
        return;
      }
      swap(sel.id, slotId);
      return;
    }
    // 벤치 선수 → 이 자리. 나눈 자리면 비어 있는 쪽(둘 다 차 있으면 전반)에 넣는다.
    const half: Half = !split
      ? "full"
      : a?.memberId != null && a?.memberId2 == null
        ? "second"
        : "first";
    putInto(slotId, half, sel.mid);
  };

  const tapBench = (mid: number) => {
    if (!editable) return;
    haptic(6);
    if (sel?.t === "slot") {
      putInto(sel.id, sel.half, mid);
      return;
    }
    setSel(sel?.t === "bench" && sel.mid === mid ? null : { t: "bench", mid });
  };

  const copyPrev = () => {
    const cur = latest.current;
    const prevQ = cur.quarters[qi - 1];
    const quarters = cur.quarters.map((qq, i) =>
      i === qi ? withBench(prevQ.starters.map((s) => ({ ...s }))) : qq
    );
    saveQuarters(quarters, `${qi}쿼터 라인업을 복사했어요`);
  };

  const fillEmpty = () => {
    const roster = rosterIds.map((id) => memberById.get(id)).filter((m): m is Member => !!m);
    const { squad: filled, filled: n } = fillEmptySlots(latest.current, roster);
    if (n === 0) {
      toast("채울 수 있는 빈 자리가 없어요 (맞는 포지션의 벤치 선수가 없음)");
      return;
    }
    saveQuarters(filled.quarters, `빈 자리 ${n}곳을 채웠어요`);
  };

  // ---------- 제출 · 승인 · 확정 ----------
  const runAction = async (action: SquadAction) => {
    if (action === "unlock") {
      const ok = await confirmSheet({
        title: "확정을 해제할까요?",
        description: "다시 확정하려면 제출하고 운영진 승인을 처음부터 받아야 해요.",
        confirmText: "해제",
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/squad/status?team=${team}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.squad) throw new Error(data?.error || "요청에 실패했어요.");
      latest.current = data.squad;
      onSquadChange(data.squad);
      setSel(null);
      haptic(12);
      if (data.justConfirmed) {
        toast.success(
          `스쿼드 확정! 알림을 켠 참석자 ${data.notified}명에게 알림을 보냈어요`
        );
      } else {
        toast.success(
          {
            submit: "제출했어요. 운영진 승인을 기다려요",
            withdraw: "제출을 취소했어요",
            approve: "승인했어요",
            unapprove: "승인을 취소했어요",
            unlock: "확정을 해제했어요",
          }[action as SquadAction]
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "요청에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const approvers = squad.approvedBy ?? [];
  const iApproved = myId != null && approvers.includes(myId);
  const emptyByQuarter = squad.quarters.map(
    (qq) =>
      qq.starters.filter((s) => s.memberId == null || (s.memberId2 !== undefined && s.memberId2 == null))
        .length
  );
  const anyEmpty = emptyByQuarter.some((n) => n > 0);
  const inRoster = myId != null && rosterIds.includes(myId);

  // ---------- 벤치 ----------
  const selSlot = sel?.t === "slot" ? sel.id : null;
  const benchIds = [...q.bench].filter((id) => memberById.has(id));
  benchIds.sort((a, b) => {
    if (selSlot) {
      const d = slotFit(selSlot, memberById.get(a)!) - slotFit(selSlot, memberById.get(b)!);
      if (d) return d;
    }
    return (counts.get(a) ?? 0) - (counts.get(b) ?? 0) || nameOf(a).localeCompare(nameOf(b), "ko");
  });

  // ---------- 안내 문구 ----------
  let hint = "선수를 누른 뒤, 바꿀 자리나 교체 선수를 누르세요";
  if (!editable) {
    hint =
      status === "confirmed"
        ? "확정된 스쿼드예요."
        : "운영진이 짜는 중인 스쿼드예요. 바뀔 수 있어요.";
  } else if (sel?.t === "slot") {
    const a = assignOf(sel.id);
    const who = sel.half === "second" ? a?.memberId2 : a?.memberId;
    hint = `${who != null ? nameOf(who) : "빈 자리"}(${slotLabel(sel.id)}${sel.half === "first" ? " 전반" : sel.half === "second" ? " 후반" : ""}) 선택 · 맞바꿀 선수나 교체 선수를 누르세요`;
  } else if (sel?.t === "bench") {
    hint = `${nameOf(sel.mid)} 선택 · 들어갈 자리를 누르세요`;
  }
  const selectedAssign = selSlot ? assignOf(selSlot) : undefined;
  const selectedIsSplit = selectedAssign?.memberId2 !== undefined;

  // ---------- 출전표 ----------
  const tableRows = rosterIds
    .map((id) => memberById.get(id))
    .filter((m): m is Member => !!m)
    .sort(
      (a, b) =>
        POS_ORDER.indexOf(a.pos1) - POS_ORDER.indexOf(b.pos1) || a.name.localeCompare(b.name, "ko")
    );

  return (
    <div>
      {/* 상태 바: 작성 중 → 승인 대기 → 확정 */}
      <div
        className={`mb-3 rounded-2xl p-3 ${
          status === "confirmed"
            ? "bg-emerald-50 ring-1 ring-emerald-200"
            : status === "submitted"
              ? "bg-blue-50 ring-1 ring-blue-200"
              : "bg-zinc-50 ring-1 ring-zinc-200"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${
                status === "confirmed"
                  ? "bg-emerald-600 text-white"
                  : status === "submitted"
                    ? "bg-blue-700 text-white"
                    : "bg-zinc-200 text-zinc-700"
              }`}
            >
              {status === "confirmed" ? "확정" : status === "submitted" ? "승인 대기" : "작성 중"}
            </span>
            {status !== "draft" && (
              <div className="flex items-center gap-1" aria-label={`승인 ${approvers.length}/${SQUAD_APPROVAL_THRESHOLD}`}>
                {Array.from({ length: SQUAD_APPROVAL_THRESHOLD }, (_, i) => (
                  <motion.span
                    key={i}
                    initial={false}
                    animate={{ scale: i < approvers.length ? 1 : 0.8 }}
                    className={`h-2.5 w-2.5 rounded-full ${
                      i < approvers.length
                        ? status === "confirmed"
                          ? "bg-emerald-500"
                          : "bg-blue-600"
                        : "bg-zinc-300"
                    }`}
                  />
                ))}
                <span className="ml-1 text-xs font-bold text-zinc-600">
                  {Math.min(approvers.length, SQUAD_APPROVAL_THRESHOLD)}/{SQUAD_APPROVAL_THRESHOLD}
                </span>
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="flex shrink-0 items-center gap-1.5">
              {status === "draft" && (
                <button
                  onClick={() => runAction("submit")}
                  disabled={busy || myId == null}
                  className="rounded-xl bg-blue-700 px-3.5 py-2 text-sm font-extrabold text-white shadow-md shadow-blue-700/20 disabled:opacity-40"
                >
                  제출하기
                </button>
              )}
              {status === "submitted" && (
                <>
                  <button
                    onClick={() => runAction("withdraw")}
                    disabled={busy}
                    className="rounded-xl px-2 py-2 text-xs font-semibold text-zinc-500 disabled:opacity-40"
                  >
                    제출 취소
                  </button>
                  <button
                    onClick={() => runAction(iApproved ? "unapprove" : "approve")}
                    disabled={busy || myId == null}
                    className={`rounded-xl px-3.5 py-2 text-sm font-extrabold disabled:opacity-40 ${
                      iApproved
                        ? "bg-white text-blue-700 ring-1 ring-blue-300"
                        : "bg-blue-700 text-white shadow-md shadow-blue-700/20"
                    }`}
                  >
                    {iApproved ? "승인 취소" : "승인하기"}
                  </button>
                </>
              )}
              {status === "confirmed" && (
                <button
                  onClick={() => runAction("unlock")}
                  disabled={busy}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-zinc-600 ring-1 ring-zinc-200 disabled:opacity-40"
                >
                  확정 해제
                </button>
              )}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          {status === "draft" &&
            (isAdmin
              ? `다 짰으면 제출하세요. 운영진 ${SQUAD_APPROVAL_THRESHOLD}명이 승인하면 확정되고, 참석자 휴대폰으로 알림이 가요.`
              : "운영진이 스쿼드를 짜는 중이에요. 확정되면 알림으로 알려드려요.")}
          {status === "submitted" &&
            `${nameOf(squad.submittedBy)}님이 제출 · 승인: ${
              approvers.length ? approvers.map((m) => nameOf(m)).join(", ") : "아직 없음"
            }`}
          {status === "confirmed" &&
            `${
              squad.confirmedAt
                ? new Date(squad.confirmedAt).toLocaleString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }) + " 확정 · "
                : ""
            }승인: ${approvers.map((m) => nameOf(m)).join(", ") || "-"}`}
        </p>
        {isAdmin && myId == null && status !== "confirmed" && (
          <p className="mt-1 text-[11px] text-amber-700">
            멤버 프로필과 연결된 계정만 제출·승인할 수 있어요.
          </p>
        )}
      </div>

      {/* 내 출전 */}
      {inRoster && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-2xl bg-blue-700 px-3 py-2.5 text-white">
          <span className="mr-1 text-xs font-bold text-blue-100">내 출전</span>
          {memberQuarterRoles(squad, myId!).map((r, i) => (
            <span
              key={i}
              className={`rounded-lg px-2 py-0.5 text-xs font-bold ${r === "휴식" ? "bg-white/15 text-blue-100" : "bg-white text-blue-800"}`}
            >
              {i + 1}Q {r}
            </span>
          ))}
        </div>
      )}

      {/* 필드 / 출전표 전환 */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="grid grid-cols-2 gap-0.5 rounded-xl bg-zinc-100 p-0.5">
          {(["field", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setSel(null);
              }}
              className="relative rounded-[10px] px-3.5 py-1.5 text-sm font-bold"
            >
              {view === v && (
                <motion.span
                  layoutId={`squad-view-${team}`}
                  className="absolute inset-0 rounded-[10px] bg-white shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className={`relative ${view === v ? "text-zinc-900" : "text-zinc-500"}`}>
                {v === "field" ? "필드" : "출전표"}
              </span>
            </button>
          ))}
        </div>
        {editable && anyEmpty && (
          <button
            onClick={fillEmpty}
            className="rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800"
          >
            빈 자리 자동 채우기
          </button>
        )}
      </div>

      {view === "field" ? (
        <LayoutGroup id={`squad-${team}`}>
          <div className="mb-2 grid grid-cols-4 gap-1.5">
            {squad.quarters.map((_, i) => {
              const active = qi === i;
              return (
                <button
                  key={i}
                  onClick={() => {
                    setQi(i);
                    setSel(null);
                  }}
                  className={`relative flex flex-col items-center rounded-2xl py-1.5 ${active ? "text-white" : "bg-zinc-100 text-zinc-600"}`}
                >
                  {active && (
                    <motion.span
                      layoutId={`squad-quarter-${team}`}
                      className="absolute inset-0 rounded-2xl bg-blue-700"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                  <span className="relative text-sm font-bold">{i + 1}쿼터</span>
                  <span
                    className={`relative text-[11px] font-semibold ${
                      active ? "text-blue-100" : emptyByQuarter[i] ? "text-amber-700" : "text-zinc-500"
                    }`}
                  >
                    {emptyByQuarter[i] ? `빈 자리 ${emptyByQuarter[i]}` : "11명"}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className={`mb-2 flex min-h-9 flex-wrap items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold ${
              sel ? "bg-yellow-100 text-yellow-900" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            <span className={sel && editable ? "min-w-0 basis-full" : "min-w-0 flex-1"}>{hint}</span>
            {editable && !sel && qi > 0 && (
              <button
                onClick={copyPrev}
                className="rounded-lg bg-white px-2 py-1 text-[11.5px] font-bold text-blue-700 shadow-sm"
              >
                {qi}쿼터와 같게
              </button>
            )}
            {editable && selSlot && (
              <>
                {selectedIsSplit && (
                  <div className="flex rounded-lg bg-white/70 p-0.5">
                    {(["first", "second"] as const).map((h) => (
                      <button
                        key={h}
                        onClick={() => setSel({ t: "slot", id: selSlot, half: h })}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${sel?.t === "slot" && sel.half === h ? "bg-yellow-400 text-yellow-950" : "text-yellow-900"}`}
                      >
                        {h === "first" ? "전반" : "후반"}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => toggleSplit(selSlot)}
                  className="rounded-lg bg-white px-2 py-1 text-[11.5px] font-bold text-zinc-700 shadow-sm"
                >
                  {selectedIsSplit ? "나누기 취소" : "전·후반 나누기"}
                </button>
                {(sel?.t === "slot" && (sel.half === "second" ? selectedAssign?.memberId2 : selectedAssign?.memberId)) != null && (
                  <button
                    onClick={() => sel?.t === "slot" && clearSlot(selSlot, sel.half)}
                    className="rounded-lg bg-white px-2 py-1 text-[11.5px] font-bold text-red-600 shadow-sm"
                  >
                    비우기
                  </button>
                )}
              </>
            )}
            {sel && (
              <button
                onClick={() => setSel(null)}
                aria-label="선택 해제"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-yellow-900"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>

          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-blue-700" style={{ aspectRatio: "3 / 3.4" }}>
            <div className="absolute inset-2.5 rounded-xl border-2 border-blue-300/45" />
            <div className="absolute left-2.5 right-2.5 top-1/2 border-t-2 border-blue-300/45" />
            <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-300/45" />
            {FORMATION_SLOTS.map((slot) => {
              const a = assignOf(slot.id);
              const split = a?.memberId2 !== undefined;
              const isSel = sel?.t === "slot" && sel.id === slot.id;
              const colors = SLOT_CATEGORY_COLORS[slot.category];
              const ids = split ? [a?.memberId ?? null, a?.memberId2 ?? null] : [a?.memberId ?? null];
              const empty = ids.every((v) => v == null);
              const offPos = ids.some((v) => v != null && slotFit(slot.id, memberById.get(v)!) >= 2);
              const mine = myId != null && ids.includes(myId);
              return (
                <div
                  key={slot.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  <button
                    onClick={() => tapSlot(slot.id)}
                    aria-label={`${slot.label} ${ids.map((v) => nameOf(v)).join(" / ")}`}
                    aria-pressed={isSel}
                    disabled={!editable}
                    className="flex w-[78px] flex-col items-center gap-0.5 disabled:cursor-default"
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-extrabold transition-shadow ${
                        empty ? "border-2 border-dashed border-white/70 bg-white/15 text-white" : `${colors.bg} ${colors.text}`
                      } ${isSel ? "ring-[3px] ring-yellow-300 ring-offset-2 ring-offset-blue-700" : ""}`}
                    >
                      {slot.label}
                    </span>
                    <motion.span
                      layoutId={!split && a?.memberId != null ? `squad-${team}-p-${a.memberId}` : undefined}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className={`max-w-[78px] truncate rounded-md px-1.5 py-px text-[11px] font-bold ${
                        mine
                          ? "bg-white text-blue-800"
                          : offPos
                            ? "bg-amber-400 text-amber-950"
                            : empty
                              ? "bg-white/20 text-white"
                              : "bg-blue-950/70 text-white"
                      }`}
                    >
                      {split
                        ? ids
                            .map((v, i) =>
                              isSel && ((i === 0 && sel?.half === "first") || (i === 1 && sel?.half === "second"))
                                ? `[${v == null ? "?" : nameOf(v)}]`
                                : v == null
                                  ? "?"
                                  : nameOf(v)
                            )
                            .join("/")
                        : empty
                          ? "비어 있음"
                          : nameOf(a?.memberId)}
                    </motion.span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />원래 포지션 아님
            </span>
            {inRoster && (
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-white ring-1 ring-zinc-300" />나
              </span>
            )}
            <span>A/B = 전·후반 나눠 뜀</span>
          </div>

          <div className="mt-3 rounded-2xl bg-zinc-50 p-3">
            <p className="mb-2 text-xs font-extrabold text-zinc-600">
              {selSlot
                ? `교체 후보 — ${slotLabel(selSlot)} 자리에 맞는 순서`
                : `${qi + 1}쿼터 벤치 ${benchIds.length}명 — 출전 적은 순서`}
            </p>
            {benchIds.length === 0 ? (
              <p className="text-xs text-zinc-400">벤치에 남은 선수가 없어요.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {benchIds.map((id) => {
                  const m = memberById.get(id)!;
                  const fit = selSlot ? slotFit(selSlot, m) : null;
                  const c = counts.get(id) ?? 0;
                  const isSel = sel?.t === "bench" && sel.mid === id;
                  const sub =
                    fit === 0
                      ? `추천 · ${fmtCount(c)}쿼터`
                      : fit === 1
                        ? `2순위 · ${fmtCount(c)}쿼터`
                        : `${m.isGuest ? "용병" : POS_SHORT[m.pos1]} · ${fmtCount(c)}쿼터 출전`;
                  return (
                    <motion.button
                      key={id}
                      layoutId={`squad-${team}-p-${id}`}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      onClick={() => tapBench(id)}
                      disabled={!editable}
                      className={`flex min-h-[50px] flex-col items-center justify-center rounded-xl px-1 py-1.5 disabled:cursor-default ${
                        isSel
                          ? "bg-yellow-100 ring-2 ring-yellow-400"
                          : fit === 0
                            ? "bg-blue-100 ring-1 ring-blue-300"
                            : "bg-white ring-1 ring-zinc-200"
                      }`}
                    >
                      <span className={`w-full truncate text-center text-sm font-bold ${myId === id ? "text-blue-700" : ""}`}>
                        {m.name}
                      </span>
                      <span
                        className={`text-[10.5px] font-semibold ${
                          fit === 0 ? "text-blue-700" : fit === 1 ? "text-indigo-700" : c <= 2 ? "text-amber-700" : "text-zinc-500"
                        }`}
                      >
                        {sub}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </LayoutGroup>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-zinc-50 p-3">
          <div className="grid min-w-[300px] grid-cols-[minmax(72px,1fr)_repeat(4,minmax(44px,1fr))_36px] items-center gap-1 text-[11px] font-extrabold text-zinc-500">
            <span>선수</span>
            {squad.quarters.map((_, i) => (
              <span key={i} className="text-center">
                {i + 1}Q
              </span>
            ))}
            <span className="text-right">출전</span>
            {tableRows.map((m) => {
              const roles = memberQuarterRoles(squad, m.id);
              const c = counts.get(m.id) ?? 0;
              return (
                <div key={m.id} className="contents">
                  <span className={`truncate text-[13px] font-bold ${myId === m.id ? "text-blue-700" : "text-zinc-900"}`}>
                    {m.name}{" "}
                    <span className="text-[10px] font-semibold text-zinc-400">{POS_SHORT[m.pos1]}</span>
                  </span>
                  {roles.map((r, i) => {
                    const slot = squad.quarters[i].starters.find(
                      (s) => s.memberId === m.id || s.memberId2 === m.id
                    );
                    const cat = slot ? FORMATION_SLOTS.find((d) => d.id === slot.slotId)?.category : null;
                    const colors = cat ? SLOT_CATEGORY_COLORS[cat] : null;
                    const half = r.endsWith("전반") ? "½" : r.endsWith("후반") ? "½" : "";
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setView("field");
                          setQi(i);
                          setSel(
                            editable
                              ? slot
                                ? {
                                    t: "slot",
                                    id: slot.slotId,
                                    half: slot.memberId2 === undefined ? "full" : slot.memberId2 === m.id ? "second" : "first",
                                  }
                                : { t: "bench", mid: m.id }
                              : null
                          );
                        }}
                        aria-label={`${m.name} ${i + 1}쿼터 ${r}`}
                        className={`h-8 rounded-lg text-[10.5px] font-extrabold ${colors ? `${colors.bg} ${colors.text}` : "bg-white text-zinc-300 ring-1 ring-zinc-200"}`}
                      >
                        {slot ? `${slotLabel(slot.slotId)}${half}` : "–"}
                      </button>
                    );
                  })}
                  <span className={`text-right text-[13px] font-extrabold ${c <= 2 ? "text-amber-700" : "text-zinc-900"}`}>
                    {fmtCount(c)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            칸을 누르면 그 쿼터 필드로 이동해요. 출전 2쿼터 이하는 주황색, ½은 전·후반 나눠 뛰는 쿼터예요.
          </p>
        </div>
      )}
    </div>
  );
}
