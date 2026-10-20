import { createSessionToken, requireMaster, setSessionCookie } from "@/lib/auth";
import { getTeamById, getUserById } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

// 마스터가 승인 절차 없이 다른 팀에 운영진으로 들어간다. 그 팀에는 마스터의
// 계정이 없으니 id -1인 가상 사용자로 들어가고, 원래 계정은 masterOf에 담아
// 요청마다 requireAdmin이 다시 확인한다. 자기 팀을 고르면 평소 세션으로 돌아온다.
export async function POST(request: Request) {
  const master = await requireMaster();
  if (!master) return Response.json({ error: "마스터만 이용할 수 있어요." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const teamId = Number(body?.teamId);
  const [team, home] = await Promise.all([
    Number.isInteger(teamId) ? getTeamById(teamId) : null,
    getUserById(master.origin.teamId, master.origin.id),
  ]);
  if (!team || !home) return Response.json({ error: "팀을 찾을 수 없어요." }, { status: 404 });

  const session: SessionUser =
    team.id === home.teamId
      ? {
          id: home.id,
          teamId: home.teamId,
          username: home.username,
          displayName: home.displayName,
          role: home.role,
          memberId: home.memberId,
        }
      : {
          id: -1,
          teamId: team.id,
          username: home.username,
          displayName: home.displayName,
          role: "admin",
          memberId: null,
          masterOf: { teamId: home.teamId, id: home.id },
        };
  await setSessionCookie(session);
  return Response.json({ ok: true, teamId: team.id, token: createSessionToken(session) });
}
