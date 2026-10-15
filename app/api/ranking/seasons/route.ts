import { getSessionUser } from "@/lib/auth";
import { getAllHistoricalStats, listEvents } from "@/lib/db";
import { seasonOf } from "@/lib/season";

// 랭킹 페이지의 시즌 탭 목록. 경기가 열린 시즌(매년 12월 15일~다음해
// 12월 14일 기준)과 과거 누적 기록이 있는 시즌을 합쳐 내림차순으로 준다.
// historical_stats의 DB 컬럼명은 예전 이름(year) 그대로지만 값 자체는
// 시즌 번호를 뜻한다.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const [events, historical] = await Promise.all([
    listEvents(session.teamId),
    getAllHistoricalStats(session.teamId),
  ]);
  const seasons = new Set<number>();
  for (const e of events) seasons.add(seasonOf(e.date));
  for (const h of historical) seasons.add(h.year);
  return Response.json([...seasons].sort((a, b) => b - a));
}
