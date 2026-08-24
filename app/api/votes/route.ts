import { getSessionUser } from "@/lib/auth";
import { getVotesForEvents } from "@/lib/db";
import type { VoteRow } from "@/lib/types";

// 홈 화면 등에서 여러 일정의 투표 현황을 한 번에 가져오기 위한 배치 엔드포인트.
// (일정별로 /api/events/:id를 반복 호출하면 스쿼드 재생성 로직까지 매번 타서 느려진다.)
export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const idsParam = new URL(request.url).searchParams.get("eventIds") ?? "";
  const eventIds = idsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n));

  const votes = await getVotesForEvents(session.teamId, eventIds);
  const byEvent: Record<number, VoteRow[]> = {};
  for (const id of eventIds) byEvent[id] = [];
  for (const v of votes) (byEvent[v.eventId] ??= []).push(v);

  return Response.json(byEvent);
}
