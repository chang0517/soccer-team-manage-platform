import { getTeamBySlug, listEvents } from "@/lib/db";
import { icsFeedResponse } from "@/lib/ics";

// /api/calendar.ics?token=... 대신 이 경로를 쓴다. 일부 캘린더 구독 검증기가
// URL이 실제로 ".ics"로 끝나는지를 보는데, 쿼리스트링 버전은 토큰 값으로
// 끝나서 실패하는 경우가 있었다. 토큰을 파일명 앞부분에 넣어서
// "<token>.ics"로 URL이 진짜 .ics로 끝나게 한다.
// 토큰 형식: "<팀slug>.<CALENDAR_FEED_SECRET>.ics".
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await params;
  const secret = process.env.CALENDAR_FEED_SECRET;
  if (!raw.endsWith(".ics") || !secret) {
    return Response.json({ error: "권한이 없어요." }, { status: 403 });
  }
  const withoutExt = raw.slice(0, -4);
  const dot = withoutExt.lastIndexOf(".");
  const teamSlug = dot > 0 ? withoutExt.slice(0, dot) : "";
  const provided = dot > 0 ? withoutExt.slice(dot + 1) : "";
  if (provided !== secret) {
    return Response.json({ error: "권한이 없어요." }, { status: 403 });
  }
  const team = await getTeamBySlug(teamSlug);
  if (!team) return Response.json({ error: "권한이 없어요." }, { status: 403 });

  return icsFeedResponse(await listEvents(team.id));
}
