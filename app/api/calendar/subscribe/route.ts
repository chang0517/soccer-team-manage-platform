import { getSessionUser } from "@/lib/auth";
import { getCalendarToken } from "@/lib/db";

// 로그인한 팀원에게 우리 팀 일정 구독 주소를 준다.
export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const token = await getCalendarToken(session.teamId);
  const origin = new URL(request.url).origin;
  return Response.json({ url: `${origin}/api/calendar/${token}.ics` });
}
