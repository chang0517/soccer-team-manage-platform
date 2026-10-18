import type { TeamReminder } from "./types";

const KST_OFFSET = 9 * 3600_000;

// 그 달에 그 날짜가 없으면(예: 31일 알림의 2월) 그 달 마지막 날로 본다.
function openAtFor(r: TeamReminder, year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(r.dayOfMonth, lastDay);
  const [hh, mm] = r.openTime.split(":").map(Number);
  return Date.UTC(year, month, day, hh, mm) - KST_OFFSET;
}

/**
 * 지금 보내야 하는 알림인지 — "오픈 lead분 전 ~ 오픈 시각" 사이면 보낼 때다.
 * 크론이 최대 59분 늦게 돌 수 있어서(무료 플랜), 정각에 맞추지 않고 이
 * 구간 안에 한 번 돌면 보내고, 같은 달(period)에는 다시 보내지 않는다.
 * 1일 00:30 오픈처럼 알림 시각이 전달로 넘어가는 경우도 있어 이번 달과
 * 다음 달 오픈을 함께 본다.
 */
export function dueReminder(
  r: TeamReminder,
  now = Date.now()
): { period: string; openAt: number } | null {
  const kst = new Date(now + KST_OFFSET);
  for (const add of [0, 1]) {
    const y = kst.getUTCFullYear();
    const m = kst.getUTCMonth() + add;
    const openAt = openAtFor(r, y, m);
    const notifyAt = openAt - r.leadMinutes * 60_000;
    if (now >= notifyAt && now < openAt) {
      const d = new Date(Date.UTC(y, m, 1));
      return {
        period: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
        openAt,
      };
    }
  }
  return null;
}

export function leadLabel(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}시간`;
  if (minutes > 60) return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  return `${minutes}분`;
}

export function openTimeLabel(openTime: string): string {
  const [h, m] = openTime.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(m).padStart(2, "0")}`;
}
