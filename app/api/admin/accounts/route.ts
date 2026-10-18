import { requireAdmin } from "@/lib/auth";
import { deleteAccount, listMembers, listUsersByStatus } from "@/lib/db";

// 운영진 "계정 관리" — 이 팀의 모든 가입 계정(승인·대기·거절)을 보고 지운다.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  const [approved, pending, rejected, members] = await Promise.all([
    listUsersByStatus(admin.teamId, "approved"),
    listUsersByStatus(admin.teamId, "pending"),
    listUsersByStatus(admin.teamId, "rejected"),
    listMembers(admin.teamId),
  ]);
  const nameOf = new Map(members.map((m) => [m.id, m.name]));
  return Response.json(
    [...approved, ...pending, ...rejected].map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      memberId: u.memberId,
      memberName: u.memberId != null ? (nameOf.get(u.memberId) ?? null) : null,
      createdAt: u.createdAt,
    }))
  );
}

// ?id=계정&withMember=1 이면 연결된 선수 프로필과 그 선수의 모든 기록까지 지운다.
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const id = Number(params.get("id"));
  if (!id) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  if (id === admin.id) {
    return Response.json({ error: "내 계정은 여기서 지울 수 없어요." }, { status: 400 });
  }
  const result = await deleteAccount(admin.teamId, id, params.get("withMember") === "1");
  if (!result) return Response.json({ error: "계정을 찾을 수 없어요." }, { status: 404 });
  return Response.json({ ok: true, memberDeleted: result.memberDeleted });
}
