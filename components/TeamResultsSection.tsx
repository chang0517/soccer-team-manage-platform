"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { seasonLabel } from "@/lib/season";
import { computeTeamResults } from "@/lib/results";
import type { Outcome } from "@/lib/results";
import type { EventItem } from "@/lib/types";

const OUTCOME_STYLE: Record<Outcome, { label: string; cls: string }> = {
  W: { label: "승", cls: "bg-blue-600 text-white" },
  D: { label: "무", cls: "bg-zinc-400 text-white" },
  L: { label: "패", cls: "bg-rose-500 text-white" },
};

const pct = (n: number | null) => (n == null ? "-" : `${n % 1 === 0 ? n : n.toFixed(1)}%`);

export default function TeamResultsSection() {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEvents)
      .catch(() => setEvents([]));
    fetch("/api/ranking/seasons")
      .then((r) => (r.ok ? r.json() : []))
      .then(setSeasons)
      .catch(() => {});
  }, []);

  const data = useMemo(() => (events ? computeTeamResults(events, season) : null), [events, season]);

  if (!data) return <div className="card h-40 animate-pulse bg-zinc-100" />;
  const { overall, opponents, recent, noOpponent, excluded } = data;

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-[22px] font-extrabold tracking-tight">팀 승률</h1>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
        {[{ key: null, label: "전체" }, ...seasons.map((s) => ({ key: s as number | null, label: seasonLabel(s) }))].map(
          (s) => (
            <button
              key={String(s.key)}
              onClick={() => setSeason(s.key)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold ${
                season === s.key ? "bg-blue-900 text-white" : "bg-zinc-200/60 text-zinc-600"
              }`}
            >
              {s.label}
            </button>
          )
        )}
      </div>

      {overall.games === 0 ? (
        <div className="card p-8 text-center text-sm text-zinc-400">
          아직 결과가 입력된 경기가 없어요. 경기 기록에서 득점과 쿼터별 실점을 입력하면 여기에 나와요.
        </div>
      ) : (
        <>
          <section className="card space-y-4 p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold text-zinc-400">전체 승률</p>
                <p className="text-[44px] font-extrabold leading-none tracking-tight text-blue-800">
                  {pct(overall.winRate)}
                </p>
              </div>
              <p className="pb-1 text-right text-sm text-zinc-600">
                <b>{overall.games}</b>전 <b className="text-blue-700">{overall.wins}</b>승{" "}
                <b>{overall.draws}</b>무 <b className="text-rose-600">{overall.losses}</b>패
              </p>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-100">
              <div className="bg-blue-600" style={{ width: `${(overall.wins / overall.games) * 100}%` }} />
              <div className="bg-zinc-300" style={{ width: `${(overall.draws / overall.games) * 100}%` }} />
              <div className="bg-rose-400" style={{ width: `${(overall.losses / overall.games) * 100}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["득점", overall.goalsFor],
                ["실점", overall.goalsAgainst],
                ["득실차", `${overall.goalsFor - overall.goalsAgainst > 0 ? "+" : ""}${overall.goalsFor - overall.goalsAgainst}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-zinc-50 py-2.5">
                  <p className="text-[11px] font-semibold text-zinc-400">{k}</p>
                  <p className="text-lg font-extrabold">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-400">최근 {recent.length}경기</span>
              <div className="flex gap-1">
                {recent.map((r) => (
                  <span
                    key={r.eventId}
                    title={`${r.date} ${r.opponent} ${r.scored}:${r.conceded}`}
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${OUTCOME_STYLE[r.outcome].cls}`}
                  >
                    {OUTCOME_STYLE[r.outcome].label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="px-1 text-sm font-bold text-zinc-500">상대팀별 전적</h2>
            {opponents.length === 0 ? (
              <div className="card p-6 text-center text-sm text-zinc-400">상대팀이 입력된 경기가 없어요.</div>
            ) : (
              <ul className="space-y-2">
                {opponents.map((o) => (
                  <li key={o.name} className="card space-y-2 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-[15px] font-extrabold">{o.name}</p>
                      <p className="shrink-0 text-lg font-extrabold text-blue-800">{pct(o.winRate)}</p>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div className="bg-blue-600" style={{ width: `${(o.wins / o.games) * 100}%` }} />
                      <div className="bg-zinc-300" style={{ width: `${(o.draws / o.games) * 100}%` }} />
                      <div className="bg-rose-400" style={{ width: `${(o.losses / o.games) * 100}%` }} />
                    </div>
                    <p className="text-xs text-zinc-500">
                      {o.games}전 {o.wins}승 {o.draws}무 {o.losses}패 · 득점 {o.goalsFor} 실점 {o.goalsAgainst}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {excluded.length > 0 && (
            <details className="card p-4 text-sm">
              <summary className="cursor-pointer font-bold text-zinc-600">
                집계에서 빠진 경기 {excluded.length}개 (이유 보기)
              </summary>
              <ul className="mt-3 space-y-1.5">
                {excluded.map((x) => (
                  <li key={x.eventId} className="text-xs leading-relaxed">
                    <Link href={`/events/${x.eventId}`} className="font-bold text-blue-700">
                      {x.date} {x.title}
                      {x.opponent ? ` vs ${x.opponent}` : ""}
                    </Link>
                    <span className="block text-zinc-500">{x.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="px-1 text-xs leading-relaxed text-zinc-400">
            득점과 쿼터별 실점이 모두 입력된 경기만 집계해요. 내전·훈련은 빼고, 무승부도 한 경기로 세요(승률 = 승 ÷ 전체 경기).
            {noOpponent > 0 && ` 상대팀이 비어 있는 ${noOpponent}경기는 전체 전적에만 들어가요.`}
          </p>
        </>
      )}
    </div>
  );
}
