import { getSessionUser, requireAdmin } from "@/lib/auth";
import { deleteMember, updateMember } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const isSelf = session.memberId === Number(id);
  if (!isSelf && !(await requireAdmin())) {
    return Response.json({ error: "권한이 없어요." }, { status: 403 });
  }
  const body = await request.json();
  await updateMember(session.teamId, Number(id), {
    name: body.name,
    backNo: body.backNo ?? null,
    pos1: body.pos1,
    pos2: body.pos2,
    isGuest: !!body.isGuest,
    phone: body.phone?.trim() || null,
  });
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return Response.json({ error: "운영진만 삭제할 수 있어요." }, { status: 403 });
  }
  const { id } = await params;
  await deleteMember(session.teamId, Number(id));
  return Response.json({ ok: true });
}
