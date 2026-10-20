import { createSessionToken, requireMaster, setSessionCookie } from "@/lib/auth";
import { getUserById } from "@/lib/db";

// 방문 중이던 팀에서 나와 마스터 본인 팀의 평소 세션으로 돌아온다.
export async function POST() {
  const master = await requireMaster();
  if (!master) return Response.json({ error: "마스터만 이용할 수 있어요." }, { status: 403 });
  const home = await getUserById(master.origin.teamId, master.origin.id);
  if (!home) return Response.json({ error: "계정을 찾을 수 없어요." }, { status: 404 });
  const session = {
    id: home.id,
    teamId: home.teamId,
    username: home.username,
    displayName: home.displayName,
    role: home.role,
    memberId: home.memberId,
  };
  await setSessionCookie(session);
  return Response.json({ ok: true, token: createSessionToken(session) });
}
