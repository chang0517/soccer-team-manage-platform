import { getAppSetting, setAppSetting } from "./db";

// 미투표자 문자를 보낼 수 있는 날(매월 며칠). 팀마다 운영진이 정하고, 달마다 며칠이
// 있는지 몰라도 되도록 1~28일 중에서 고른다. 정하지 않았으면 1일.
export const DEFAULT_SMS_DAY = 1;
export const smsDayKey = (teamId: number) => `nonvoter_sms_day_${teamId}`;

export function clampSmsDay(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 28 ? n : DEFAULT_SMS_DAY;
}

export async function getSmsDay(teamId: number): Promise<number> {
  const raw = await getAppSetting(smsDayKey(teamId)).catch(() => null);
  return raw ? clampSmsDay(raw) : DEFAULT_SMS_DAY;
}

export async function setSmsDay(teamId: number, day: number) {
  await setAppSetting(smsDayKey(teamId), String(clampSmsDay(day)));
}
