import { requireAdmin } from "@/lib/auth";
import { deleteHallOfFame } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 삭제할 수 있어요." }, { status: 403 });
  }
  const { id } = await params;
  await deleteHallOfFame(admin.teamId, Number(id));
  return Response.json({ ok: true });
}
