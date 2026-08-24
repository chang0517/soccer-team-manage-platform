import { requireAdmin } from "@/lib/auth";
import { getTeamBySlug, listEvents, listMembers, getVotesForEvents } from "@/lib/db";
import { computeMonthlyNonVoters } from "@/lib/fines";

// 운영진 세션 또는 FINE_NOTICE_SECRET 베어러 토큰(맥미니 자동발송 스크립트용)
// 둘 중 하나로 인증한다. 전화번호 등 개인정보가 포함돼서 둘 다 없으면 거부.
// 베어러 토큰 경로는 세션이 없어 팀을 알 수 없으므로 teamSlug 쿼리파라미터가
// 필수다 — 운영진 세션 경로에서도 teamSlug가 세션의 팀과 일치하는지 검증해서
// 다른 팀 slug를 끼워 넣는 걸 막는다.
async function resolveTeamId(request: Request, teamSlug: string): Promise<number | null> {
  const team = teamSlug ? await getTeamBySlug(teamSlug) : null;
  const admin = await requireAdmin();
  if (admin) return team && team.id !== admin.teamId ? null : admin.teamId;
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.FINE_NOTICE_SECRET;
  const secretOk = !!secret && auth === `Bearer ${secret}`;
  return secretOk && team ? team.id : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamSlug = url.searchParams.get("teamSlug") ?? "";
  const teamId = await resolveTeamId(request, teamSlug);
  if (!teamId) {
    return Response.json({ error: "권한이 없어요." }, { status: 403 });
  }

  const now = new Date();
  const year = Number(url.searchParams.get("year")) || now.getFullYear();
  const month = Number(url.searchParams.get("month")) || now.getMonth() + 1;

  const [events, members] = await Promise.all([listEvents(teamId), listMembers(teamId)]);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthEventIds = events
    .filter((e) => e.type === "match" && e.date.startsWith(monthPrefix))
    .map((e) => e.id);
  const votes = await getVotesForEvents(teamId, monthEventIds);
  const votesByEvent = new Map<number, typeof votes>();
  for (const v of votes) {
    const list = votesByEvent.get(v.eventId) ?? [];
    list.push(v);
    votesByEvent.set(v.eventId, list);
  }

  const notices = computeMonthlyNonVoters(year, month, events, votesByEvent, members);
  return Response.json({ year, month, notices });
}
