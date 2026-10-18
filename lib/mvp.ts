import { MATCH_DURATION_HOURS } from "./rules";
import type { EventItem, MvpVoteRow } from "./types";

const DAY = 24 * 3600_000;

// MVP 투표는 경기가 끝나면(시작 + MATCH_DURATION_HOURS) 열리고, 경기 다음 날
// 자정(한국 시간)에 닫힌다. 시작 시각이 없는 경기는 정오 시작으로 본다.
export type MvpPhase = "before" | "open" | "closed";

type MatchTime = Pick<EventItem, "date" | "time">;

export function mvpOpensAt(ev: MatchTime): number {
  const start = new Date(`${ev.date}T${ev.time || "12:00"}:00+09:00`).getTime();
  return start + MATCH_DURATION_HOURS * 3600_000;
}

export function mvpClosesAt(ev: MatchTime): number {
  return new Date(`${ev.date}T00:00:00+09:00`).getTime() + 2 * DAY;
}

export function mvpPhase(ev: MatchTime, now = Date.now()): MvpPhase {
  if (now < mvpOpensAt(ev)) return "before";
  if (now < mvpClosesAt(ev)) return "open";
  return "closed";
}

// "10월 19일(일) 밤 12시" — 마감 시각(경기 다음 날 자정)을 사람이 읽는 말로.
export function mvpDeadlineLabel(ev: MatchTime): string {
  const [y, m, d] = ev.date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const wd = "일월화수목금토"[next.getUTCDay()];
  return `${next.getUTCMonth() + 1}월 ${next.getUTCDate()}일(${wd}) 밤 12시`;
}

// 최다 득표자(동률이면 모두). 표가 없으면 빈 배열.
export function mvpLeaders(votes: MvpVoteRow[]): { memberId: number; count: number }[] {
  const tally = new Map<number, number>();
  for (const v of votes) tally.set(v.voteeId, (tally.get(v.voteeId) ?? 0) + 1);
  const max = Math.max(0, ...tally.values());
  if (max === 0) return [];
  return [...tally.entries()]
    .filter(([, c]) => c === max)
    .map(([memberId, count]) => ({ memberId, count }));
}

export function matchLabel(ev: Pick<EventItem, "opponent" | "title">): string {
  return ev.opponent ? `vs ${ev.opponent}` : ev.title;
}
