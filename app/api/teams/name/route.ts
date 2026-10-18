import { requireAdmin } from "@/lib/auth";
import { updateTeamName } from "@/lib/db";

// 운영진이 자기 팀의 표시 이름을 바꾼다(로그인용 팀 코드는 그대로).
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 변경할 수 있어요." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 40) {
    return Response.json({ error: "팀 이름은 1~40자로 입력해 주세요." }, { status: 400 });
  }
  await updateTeamName(admin.teamId, name);
  return Response.json({ ok: true, name });
}
