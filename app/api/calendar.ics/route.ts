import { getTeamBySlug, listEvents } from "@/lib/db";
import { icsFeedResponse } from "@/lib/ics";

// 쿼리 토큰 버전. 경로가 실제로 ".ics"로 끝나야 확인이 통과되는 캘린더
// 구독 검증기가 있어서, 실사용은 /api/calendar/[token].ics 쪽을 쓴다
// (이 라우트는 과거 링크 호환용으로 남겨둔다).
// 토큰 형식: "<팀slug>.<CALENDAR_FEED_SECRET>" — 멀티테넌트에서 이 secret은
// 배포 전체가 공유하므로, 어느 팀 피드인지는 slug로 구분한다.
export async function GET(request: Request) {
  const secret = process.env.CALENDAR_FEED_SECRET;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const dot = token.lastIndexOf(".");
  const teamSlug = dot > 0 ? token.slice(0, dot) : "";
  const provided = dot > 0 ? token.slice(dot + 1) : "";
  if (!secret || provided !== secret) {
    return Response.json({ error: "권한이 없어요." }, { status: 403 });
  }
  const team = await getTeamBySlug(teamSlug);
  if (!team) return Response.json({ error: "권한이 없어요." }, { status: 403 });

  return icsFeedResponse(await listEvents(team.id));
}
