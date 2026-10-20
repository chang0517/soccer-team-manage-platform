"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import MvpHomeCard from "@/components/MvpHomeCard";
import VoteButtons from "@/components/VoteButtons";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { haptic } from "@/components/ui/haptic";
import { useSession } from "@/components/useSession";
import { dDayLabel, formatDate, todayStr } from "@/lib/format";
import { ATTEND_CAP } from "@/lib/rules";
import { currentSeason } from "@/lib/season";
import { WEATHER_EMOJI } from "@/lib/weather";
import type { MatchWeather } from "@/lib/weather";
import type { EventItem, OpponentKitRow, RankingRow, VoteRow, VoteStatus } from "@/lib/types";

const DUTY_FIELDS: { key: keyof DutyDraft; label: string }[] = [
  { key: "dutyOffense", label: "공가방" },
  { key: "supplyBag", label: "비품 가방" },
  { key: "vestBag", label: "조끼 가방" },
  { key: "waterDuty", label: "물/음료" },
  { key: "iceboxDuty", label: "아이스박스" },
];

interface DutyDraft {
  dutyOffense: string;
  dutyDefense: string;
  dutyBag3: string;
  supplyBag: string;
  vestBag: string;
  waterDuty: string;
  iceboxDuty: string;
}

const EMPTY_DUTY: DutyDraft = {
  dutyOffense: "",
  dutyDefense: "",
  dutyBag3: "",
  supplyBag: "",
  vestBag: "",
  waterDuty: "",
  iceboxDuty: "",
};

const VOTE_LABEL: Record<VoteStatus, string> = { attend: "참석", maybe: "미정", absent: "불참" };

// 우리 팀이 실제로 보유한 유니폼 두 벌 — 상대팀 색과 대비(WCAG 명암비)가
// 더 큰 쪽을 추천한다. 정확한 색상은 나중에 실제 유니폼 색에 맞춰 바꾸면 됨.
const OUR_KITS = [
  { label: "하늘색 유니폼", hex: "#38bdf8" },
  { label: "검정 유니폼", hex: "#111111" },
];

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function recommendKit(opponentHex: string): { label: string; swatch: string } {
  const best = OUR_KITS.reduce((a, b) =>
    contrastRatio(opponentHex, b.hex) > contrastRatio(opponentHex, a.hex) ? b : a
  );
  return { label: `${best.label}을 추천해요`, swatch: best.hex };
}

const EASE = [0.22, 1, 0.36, 1] as const;

const COLOR_INPUT =
  "h-9 w-9 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-2 [&::-moz-color-swatch]:border-white [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white [&::-webkit-color-swatch]:shadow";

function EventSkeleton() {
  return (
    <div className="card space-y-3 p-4">
      <div className="flex justify-between">
        <div className="skeleton h-5 w-12 rounded-full" />
        <div className="skeleton h-4 w-32" />
      </div>
      <div className="skeleton h-5 w-2/3" />
      <div className="skeleton h-4 w-1/3" />
      <div className="skeleton h-11 w-full rounded-2xl" />
    </div>
  );
}

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingLoaded, setRankingLoaded] = useState(false);
  const [votesByEvent, setVotesByEvent] = useState<Record<number, VoteRow[]>>({});
  const [weatherByEvent, setWeatherByEvent] = useState<Record<number, MatchWeather | null>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, DutyDraft>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [noteSavingId, setNoteSavingId] = useState<number | null>(null);
  const [opponentKits, setOpponentKits] = useState<Record<string, string>>({});
  const [kitDrafts, setKitDrafts] = useState<Record<string, string>>({});
  const [kitSavingTeam, setKitSavingTeam] = useState<string | null>(null);
  const { user, loading: sessionLoading } = useSession();
  const myId = user?.memberId ?? null;

  const upcoming = events
    .filter((e) => e.date >= todayStr())
    .sort((a, b) => a.date.localeCompare(b.date));

  const loadVotes = useCallback(async (eventIds: number[]) => {
    if (eventIds.length === 0) {
      setVotesByEvent({});
      return;
    }
    const res = await fetch(`/api/votes?eventIds=${eventIds.join(",")}`);
    if (!res.ok) return;
    setVotesByEvent(await res.json());
  }, []);

  const loadWeather = useCallback(async (eventIds: number[]) => {
    if (eventIds.length === 0) {
      setWeatherByEvent({});
      return;
    }
    const pairs = await Promise.all(
      eventIds.map(async (eid) => {
        const d: { weather?: MatchWeather | null } = await fetch(`/api/events/${eid}/weather`)
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}));
        return [eid, d.weather ?? null] as const;
      })
    );
    setWeatherByEvent(Object.fromEntries(pairs));
  }, []);

  useEffect(() => {
    // 로그인 전(팀 미소속) 방문자에게는 /api/ranking, /api/events가 둘 다
    // 401을 준다 — 이때 응답 바디는 배열이 아니라 {error: "..."}라서, 그걸
    // 그대로 배열 메서드에 넘기면 TypeError가 나서 홈 화면 전체가 죽는다.
    fetch(`/api/ranking?season=${currentSeason()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: RankingRow[]) => {
        setRanking(rows);
        setRankingLoaded(true);
      });
    fetch("/api/opponent-kits")
      .then((r) => (r.ok ? r.json() : []))
      .then((kits: OpponentKitRow[]) =>
        setOpponentKits(Object.fromEntries(kits.map((k) => [k.teamName, k.color])))
      );
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : []))
      .then((evs: EventItem[]) => {
        setEvents(evs);
        setEventsLoaded(true);
        const ids = evs
          .filter((e) => e.date >= todayStr())
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((e) => e.id);
        loadVotes(ids);
        loadWeather(ids);
        setNoteDrafts(
          Object.fromEntries(
            evs.map((e) => [
              e.id,
              {
                // 공가방은 한 칸으로 통일 — 예전에 따로 적은 공가방2·3 값은 이어 붙여
                // 보여주고, 저장할 때 그 칸들은 비운다.
                dutyOffense: [e.dutyOffense, e.dutyDefense, e.dutyBag3].filter(Boolean).join(", "),
                dutyDefense: "",
                dutyBag3: "",
                supplyBag: e.supplyBag ?? "",
                vestBag: e.vestBag ?? "",
                waterDuty: e.waterDuty ?? "",
                iceboxDuty: e.iceboxDuty ?? "",
              },
            ])
          )
        );
      });
  }, [loadVotes, loadWeather]);

  const saveNote = async (eventId: number) => {
    setNoteSavingId(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteDrafts[eventId] ?? EMPTY_DUTY),
      });
      if (!res.ok) throw new Error();
      setEditingId(null);
      toast.success("비고를 저장했어요");
    } catch {
      toast.error("비고 저장에 실패했어요");
    }
    setNoteSavingId(null);
  };

  const saveKit = async (teamName: string) => {
    const color = kitDrafts[teamName] ?? "#1e3a8a";
    setKitSavingTeam(teamName);
    try {
      const res = await fetch("/api/opponent-kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, color }),
      });
      if (!res.ok) throw new Error();
      setOpponentKits((prev) => ({ ...prev, [teamName]: color }));
      haptic(15);
      toast.success(`${teamName} 유니폼 색을 기억해 둘게요`);
    } catch {
      toast.error("저장에 실패했어요");
    }
    setKitSavingTeam(null);
  };

  // 낙관적 업데이트: 누르는 즉시 화면에 반영하고, 서버가 거절하면 되돌린다.
  const vote = async (eventId: number, status: VoteStatus) => {
    if (!myId) return;
    const prev = votesByEvent[eventId] ?? [];
    setVotesByEvent((s) => ({
      ...s,
      [eventId]: [...prev.filter((v) => v.memberId !== myId), { eventId, memberId: myId, status }],
    }));
    try {
      const res = await fetch(`/api/events/${eventId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: myId, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "투표에 실패했어요.");
      }
      toast.success(`${VOTE_LABEL[status]}으로 투표했어요`);
    } catch (e) {
      setVotesByEvent((s) => ({ ...s, [eventId]: prev }));
      toast.error(e instanceof Error ? e.message : "투표에 실패했어요.");
    }
  };

  const voteCounts = (eventId: number): Record<VoteStatus, number> => {
    const vs = votesByEvent[eventId] ?? [];
    return {
      attend: vs.filter((v) => v.status === "attend").length,
      maybe: vs.filter((v) => v.status === "maybe").length,
      absent: vs.filter((v) => v.status === "absent").length,
    };
  };

  const myStatus = (eventId: number): VoteStatus | null =>
    (votesByEvent[eventId] ?? []).find((v) => v.memberId === myId)?.status ?? null;

  const myRank = myId ? ranking.findIndex((r) => r.member.id === myId) : -1;

  return (
    <div className="space-y-7">
      {/* 인사 / 로그인 유도 */}
      {!sessionLoading && !user && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-5 text-white shadow-lg shadow-blue-900/20"
        >
          <p className="text-lg font-extrabold">우리 팀 일정, 한 곳에서 ⚽</p>
          <p className="mt-1 text-sm text-blue-100">
            로그인하면 참석 투표·기록·랭킹을 바로 확인할 수 있어요.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/login"
              className="pressable rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-900"
            >
              로그인
            </Link>
            <Link
              href="/teams/new"
              className="pressable rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white"
            >
              새 팀 만들기
            </Link>
            <Link
              href="/about"
              className="pressable rounded-full px-3 py-2 text-sm font-semibold text-blue-100 underline-offset-2 hover:underline"
            >
              기능 소개
            </Link>
          </div>
        </motion.section>
      )}
      {user && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-1"
        >
          <p className="text-[22px] font-extrabold tracking-tight">
            안녕하세요, {user.displayName}님 👋
          </p>
          <p className="mt-0.5 text-sm text-zinc-500">
            {upcoming[0]
              ? `다음 일정까지 ${dDayLabel(upcoming[0].date)} · ${upcoming[0].title}`
              : "오늘도 좋은 하루 보내세요."}
            {myRank >= 0 && ` · 시즌 랭킹 ${myRank + 1}위`}
          </p>
        </motion.section>
      )}
      {user && !myId && (
        <section className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          아직 멤버 프로필과 연결되지 않았어요. 운영진에게 연결을 요청해 주세요.
        </section>
      )}
      {user && <MvpHomeCard />}

      {/* 다가오는 일정 */}
      <section>
        <div className="mb-3 flex items-end justify-between px-1">
          <h2 className="text-lg font-extrabold tracking-tight">다가오는 일정</h2>
          <Link href="/schedule" className="pressable text-sm font-semibold text-blue-700">
            전체 보기
          </Link>
        </div>

        {!eventsLoaded && (
          <div className="space-y-4">
            <EventSkeleton />
            <EventSkeleton />
          </div>
        )}

        {eventsLoaded && upcoming.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card flex flex-col items-center gap-1 p-8 text-center"
          >
            <span className="text-3xl">🗓️</span>
            <p className="text-sm font-semibold text-zinc-700">예정된 일정이 없어요</p>
            <p className="text-xs text-zinc-400">일정 탭에서 다음 경기를 추가해 보세요.</p>
          </motion.div>
        )}

        <div className="space-y-4">
          {upcoming.map((e, idx) => {
            const w = weatherByEvent[e.id];
            const counts = voteCounts(e.id);
            const attendPct = Math.min(100, (counts.attend / ATTEND_CAP) * 100);
            const isNext = idx === 0;
            const editing = editingId === e.id;
            const duty = noteDrafts[e.id] ?? EMPTY_DUTY;
            const hasDuty = DUTY_FIELDS.some((f) => duty[f.key]);
            return (
              <motion.article
                key={e.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.07, ease: EASE }}
                className="card overflow-hidden"
              >
                <Link
                  href={`/events/${e.id}`}
                  className={`group block p-4 transition-colors ${
                    isNext
                      ? "bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white"
                      : "hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                        isNext ? "bg-white/15 text-white" : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {isNext ? `NEXT · ${dDayLabel(e.date)}` : dDayLabel(e.date)}
                    </span>
                    <span className={`text-xs ${isNext ? "text-blue-100" : "text-zinc-500"}`}>
                      {formatDate(e.date, e.time)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-start justify-between gap-2">
                    <p className={`font-extrabold tracking-tight ${isNext ? "text-xl" : "text-[17px]"}`}>
                      {e.title}
                      {e.opponent && (
                        <span className={`font-semibold ${isNext ? "text-blue-100" : "text-zinc-500"}`}>
                          {" "}
                          vs {e.opponent}
                        </span>
                      )}
                    </p>
                    <span
                      className={`mt-0.5 text-lg transition-transform group-hover:translate-x-0.5 ${
                        isNext ? "text-white/60" : "text-zinc-300"
                      }`}
                    >
                      ›
                    </span>
                  </div>
                  <div className={`mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm ${isNext ? "text-blue-100" : "text-zinc-500"}`}>
                    {e.location && <span>📍 {e.location}</span>}
                    {w && (
                      <span className="font-semibold">
                        {w.pty ? WEATHER_EMOJI[w.pty] : w.sky ? WEATHER_EMOJI[w.sky] : ""}{" "}
                        {w.pty ?? w.sky ?? ""}
                        {w.tmp != null && ` · ${w.tmp}°C`}
                        {w.pop != null && ` · 강수 ${w.pop}%`}
                      </span>
                    )}
                  </div>
                </Link>

                <div className="space-y-3 p-4 pt-3.5">
                  <VoteButtons
                    myStatus={myStatus(e.id)}
                    counts={counts}
                    disabled={!myId}
                    onVote={(s) => vote(e.id, s)}
                  />

                  {e.type === "match" && (
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] font-semibold text-zinc-400">
                        <span>참석 인원</span>
                        <span>
                          <AnimatedNumber
                            value={counts.attend}
                            format={(v) => String(Math.round(v))}
                            className="text-zinc-700"
                          />{" "}
                          / {ATTEND_CAP}명
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${attendPct}%` }}
                          transition={{ type: "spring", stiffness: 180, damping: 28 }}
                        />
                      </div>
                    </div>
                  )}

                  {e.opponent &&
                    (() => {
                      const teamName = e.opponent.trim();
                      const knownColor = opponentKits[teamName];
                      return (
                        <div className="rounded-2xl bg-zinc-50 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                            상대팀 유니폼
                          </p>
                          <AnimatePresence mode="wait" initial={false}>
                            {knownColor ? (
                              <motion.div
                                key="known"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mt-2 flex items-center gap-2 text-sm"
                              >
                                <span
                                  className="h-6 w-6 shrink-0 rounded-full shadow ring-2 ring-white"
                                  style={{ backgroundColor: knownColor }}
                                />
                                <span className="text-zinc-400">→</span>
                                <span
                                  className="h-6 w-6 shrink-0 rounded-full shadow ring-2 ring-white"
                                  style={{ backgroundColor: recommendKit(knownColor).swatch }}
                                />
                                <span className="font-bold text-blue-700">
                                  {recommendKit(knownColor).label}
                                </span>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="input"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, y: -6 }}
                                className="mt-2 flex items-center gap-2.5"
                              >
                                <input
                                  type="color"
                                  aria-label={`${teamName} 유니폼 색`}
                                  className={COLOR_INPUT}
                                  value={kitDrafts[teamName] ?? "#1e3a8a"}
                                  onChange={(ev) =>
                                    setKitDrafts((d) => ({ ...d, [teamName]: ev.target.value }))
                                  }
                                />
                                <p className="flex-1 text-xs leading-snug text-zinc-500">
                                  {teamName} 유니폼 색을 기록해 두면 다음에 자동으로 추천해 드려요.
                                </p>
                                <button
                                  onClick={() => saveKit(teamName)}
                                  disabled={kitSavingTeam === teamName}
                                  className="pressable shrink-0 rounded-full bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                                >
                                  {kitSavingTeam === teamName ? "저장 중…" : "저장"}
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })()}

                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                        비고
                      </p>
                      {!editing && (
                        <button
                          onClick={() => setEditingId(e.id)}
                          className="pressable rounded-full px-2 py-0.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
                        >
                          수정
                        </button>
                      )}
                    </div>
                    <AnimatePresence mode="wait" initial={false}>
                      {editing ? (
                        <motion.div
                          key="edit"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-1.5">
                            {DUTY_FIELDS.map((f) => (
                              <div key={f.key} className="flex items-center gap-2">
                                <span className="w-16 shrink-0 text-xs text-zinc-500">{f.label}</span>
                                <input
                                  className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                  value={duty[f.key]}
                                  onChange={(ev) =>
                                    setNoteDrafts((d) => ({
                                      ...d,
                                      [e.id]: { ...(d[e.id] ?? EMPTY_DUTY), [f.key]: ev.target.value },
                                    }))
                                  }
                                />
                              </div>
                            ))}
                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                onClick={() => setEditingId(null)}
                                className="pressable rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100"
                              >
                                취소
                              </button>
                              <button
                                onClick={() => saveNote(e.id)}
                                disabled={noteSavingId === e.id}
                                className="pressable rounded-full bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                              >
                                {noteSavingId === e.id ? "저장 중…" : "저장"}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="view"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="mt-1.5"
                        >
                          {hasDuty ? (
                            <div className="flex flex-wrap gap-1.5">
                              {DUTY_FIELDS.filter((f) => duty[f.key]).map((f) => (
                                <span
                                  key={f.key}
                                  className="rounded-full bg-white px-2.5 py-1 text-xs shadow-sm ring-1 ring-zinc-200"
                                >
                                  <span className="font-semibold text-zinc-500">{f.label}</span>{" "}
                                  {duty[f.key]}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-400">아직 등록된 비고가 없어요.</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* 랭킹 */}
      <section>
        <div className="mb-3 flex items-end justify-between px-1">
          <h2 className="text-lg font-extrabold tracking-tight">이번 시즌 TOP 5</h2>
          <Link href="/ranking" className="pressable text-sm font-semibold text-blue-700">
            전체 보기
          </Link>
        </div>
        <div className="card overflow-hidden">
          {!rankingLoaded &&
            [0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="skeleton h-6 w-6 rounded-full" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-12" />
              </div>
            ))}
          {rankingLoaded && ranking.length === 0 && (
            <p className="p-6 text-center text-sm text-zinc-400">아직 기록이 없어요.</p>
          )}
          {ranking.slice(0, 5).map((r, i) => {
            const isMe = r.member.id === myId;
            return (
              <motion.div
                key={r.member.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.1 + i * 0.05, ease: EASE }}
                className={`flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-0 ${
                  isMe ? "bg-blue-50/70" : ""
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold ${
                    i < 3 ? "bg-amber-50" : "text-zinc-400"
                  }`}
                >
                  {["🥇", "🥈", "🥉"][i] ?? i + 1}
                </span>
                <span className="flex-1 text-[15px] font-bold">
                  {r.member.name}
                  {isMe && (
                    <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      나
                    </span>
                  )}
                </span>
                <span className="text-xs tabular-nums text-zinc-400">
                  ⚽{r.goals} 🎯{r.assists}
                </span>
                <span className="w-16 text-right text-[15px] font-extrabold text-blue-700">
                  <AnimatedNumber value={r.total} />
                  <span className="text-xs font-bold">점</span>
                </span>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
