import { getSessionUser } from "@/lib/auth";
import { getTeamById, getUserById } from "@/lib/db";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return Response.json({ user: null });

  // 세션 쿠키는 로그인 시점 정보를 담고 있으니, 승인/역할 변경을 바로
  // 반영하도록 DB에서 최신 상태를 다시 확인한다. 팀 이름도 쿠키에 굳이
  // 안 담고 매번 여기서 새로 읽어서, 팀 이름을 바꿔도 기존 세션이 옛
  // 이름을 계속 들고 있는 일이 없게 한다.
  const [user, team] = await Promise.all([
    getUserById(session.teamId, session.id),
    getTeamById(session.teamId),
  ]);
  if (!user || user.status !== "approved") {
    return Response.json({ user: null });
  }
  return Response.json({
    user: {
      id: user.id,
      teamId: user.teamId,
      teamName: team?.name ?? "",
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      memberId: user.memberId,
    },
  });
}
