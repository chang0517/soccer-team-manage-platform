import { getSessionUser } from "@/lib/auth";
import { getTeamById, getUserById } from "@/lib/db";
import { isMasterIdentity, masterConfigured } from "@/lib/master";

// 마스터 설정을 도와주는 진단. 로그인한 사람 본인의 "팀코드:아이디"만 돌려주고,
// 마스터 목록 자체는 밝히지 않는다(설정됐는지 여부만 알려준다).
export async function GET() {
  const session = await getSessionUser();
  if (!session || session.masterOf) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const [user, team] = await Promise.all([
    getUserById(session.teamId, session.id),
    getTeamById(session.teamId),
  ]);
  if (!user || !team || user.status !== "approved") {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  return Response.json({
    identity: `${team.slug}:${user.username}`,
    configured: masterConfigured(),
    isMaster: user.role === "admin" && isMasterIdentity(team.slug, user.username),
    isAdmin: user.role === "admin",
  });
}
