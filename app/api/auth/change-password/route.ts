import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { getUserByUsername, updateUserPassword } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  if (session.masterOf) {
    return Response.json(
      { error: "마스터 방문 중에는 비밀번호를 바꿀 수 없어요. 내 팀으로 돌아가서 바꿔 주세요." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");
  if (newPassword.length < 4) {
    return Response.json(
      { error: "새 비밀번호는 4자 이상이어야 해요." },
      { status: 400 }
    );
  }

  const user = await getUserByUsername(session.teamId, session.username);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return Response.json({ error: "현재 비밀번호가 올바르지 않아요." }, { status: 401 });
  }

  await updateUserPassword(session.teamId, user.id, await hashPassword(newPassword));
  return Response.json({ ok: true });
}
