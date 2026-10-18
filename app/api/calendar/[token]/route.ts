import { getTeamById, getTeamBySlug, getTeamIdByCalendarToken, listEvents } from "@/lib/db";
import { icsFeedResponse } from "@/lib/ics";

// 일정 구독(.ics) 피드. 일부 캘린더 구독 검증기가 URL이 실제로 ".ics"로
// 끝나는지 보기 때문에 토큰을 파일명 자리에 넣는다.
// - 기본: "<팀별 캘린더 토큰>.ics" — 일정 화면의 "내 캘린더에 추가"가 주는 주소.
//   팀마다 다른 무작위 토큰이라 다른 팀 일정을 엿볼 수 없다.
// - 예전 형식: "<팀slug>.<CALENDAR_FEED_SECRET>.ics" — 이미 등록해둔 구독 호환용.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await params;
  if (!raw.endsWith(".ics")) return Response.json({ error: "권한이 없어요." }, { status: 403 });
  const withoutExt = raw.slice(0, -4);

  const teamId = await getTeamIdByCalendarToken(withoutExt);
  if (teamId != null) {
    const team = await getTeamById(teamId);
    return icsFeedResponse(await listEvents(teamId), team?.name);
  }

  const secret = process.env.CALENDAR_FEED_SECRET;
  const dot = withoutExt.lastIndexOf(".");
  if (!secret || dot <= 0 || withoutExt.slice(dot + 1) !== secret) {
    return Response.json({ error: "권한이 없어요." }, { status: 403 });
  }
  const team = await getTeamBySlug(withoutExt.slice(0, dot));
  if (!team) return Response.json({ error: "권한이 없어요." }, { status: 403 });
  return icsFeedResponse(await listEvents(team.id), team.name);
}
