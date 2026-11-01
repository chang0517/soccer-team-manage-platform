import { todayStr } from "./format";
import { isOfficialMatch } from "./points";
import { normalizeRecordLog, summarizeRecordLog } from "./records";
import { seasonOf } from "./season";
import type { EventItem } from "./types";

export type Outcome = "W" | "D" | "L";

export interface MatchResult {
  eventId: number;
  date: string;
  opponent: string;
  scored: number;
  conceded: number;
  outcome: Outcome;
}

export interface Record3 {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  /** 승률(%) — 무승부도 한 경기로 세고 이긴 경기만 승으로 본다. 경기가 없으면 null. */
  winRate: number | null;
}

/**
 * 한 경기의 최종 스코어가 확정돼 있으면 승·무·패를 돌려준다. 내전·훈련은 상대팀과의
 * 정식 경기가 아니라서 빼고, 쿼터별 기록이 있는 경기는 네 쿼터 실점이 모두 입력돼
 * 있어야 한다(일부 쿼터만 입력된 경기의 스코어는 아직 미완성이라 세지 않는다).
 */
export function matchResultOf(ev: EventItem): MatchResult | null {
  if (!isOfficialMatch(ev) || ev.date > todayStr()) return null;
  let scored: number | null;
  let conceded: number | null;
  if (ev.recordLog) {
    const log = normalizeRecordLog(ev.recordLog);
    if (log.some((q) => q.conceded == null)) return null;
    const sum = summarizeRecordLog(log);
    scored = sum.scored ?? 0;
    conceded = sum.conceded;
  } else {
    scored = ev.scored;
    conceded = ev.conceded;
  }
  if (scored == null || conceded == null) return null;
  return {
    eventId: ev.id,
    date: ev.date,
    opponent: ev.opponent.trim().replace(/\s+/g, " "),
    scored,
    conceded,
    outcome: scored > conceded ? "W" : scored < conceded ? "L" : "D",
  };
}

export function tally(results: MatchResult[]): Record3 {
  const wins = results.filter((r) => r.outcome === "W").length;
  const draws = results.filter((r) => r.outcome === "D").length;
  return {
    games: results.length,
    wins,
    draws,
    losses: results.length - wins - draws,
    goalsFor: results.reduce((a, r) => a + r.scored, 0),
    goalsAgainst: results.reduce((a, r) => a + r.conceded, 0),
    winRate: results.length ? Math.round((wins / results.length) * 1000) / 10 : null,
  };
}

/** 전체 전적, 상대팀별 전적, 최근 경기 — season이 null이면 역대 전체. */
export function computeTeamResults(events: EventItem[], season: number | null) {
  const results = events
    .filter((e) => season == null || seasonOf(e.date) === season)
    .map(matchResultOf)
    .filter((r): r is MatchResult => r != null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.eventId - a.eventId));

  // 같은 상대는 대소문자·공백이 달라도 한 팀으로 묶고, 가장 최근에 쓴 표기를 이름으로 쓴다.
  const groups = new Map<string, { name: string; results: MatchResult[] }>();
  let noOpponent = 0;
  for (const r of results) {
    if (!r.opponent) {
      noOpponent++;
      continue;
    }
    const key = r.opponent.toLowerCase();
    const g = groups.get(key) ?? { name: r.opponent, results: [] };
    g.results.push(r);
    groups.set(key, g);
  }
  const opponents = [...groups.values()]
    .map((g) => ({ name: g.name, ...tally(g.results), last: g.results[0].outcome }))
    .sort((a, b) => b.games - a.games || (b.winRate ?? 0) - (a.winRate ?? 0) || a.name.localeCompare(b.name, "ko"));

  return { overall: tally(results), opponents, recent: results.slice(0, 5), noOpponent };
}
