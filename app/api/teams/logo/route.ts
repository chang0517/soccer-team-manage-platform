import { requireAdmin } from "@/lib/auth";
import { updateTeamLogo } from "@/lib/db";

// 팀 로고는 별도 오브젝트 스토리지 없이 data: URI(base64)로 DB에 그대로
// 저장한다 — 팀당 1장짜리 작은 이미지라 이 정도로 충분하다고 판단했다.
// 너무 큰 이미지를 그대로 저장하지 않도록 대략 800KB(원본 600KB 안팎)
// 선에서 막는다.
const MAX_DATA_URI_LENGTH = 800_000;
const DATA_URI_RE = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 변경할 수 있어요." }, { status: 403 });
  }

  const body = await request.json();
  const logoDataUri = body?.logoDataUri;

  if (logoDataUri === null) {
    await updateTeamLogo(admin.teamId, null);
    return Response.json({ ok: true });
  }

  if (typeof logoDataUri !== "string" || !DATA_URI_RE.test(logoDataUri)) {
    return Response.json(
      { error: "이미지 형식이 올바르지 않아요 (PNG/JPEG/WebP)." },
      { status: 400 }
    );
  }
  if (logoDataUri.length > MAX_DATA_URI_LENGTH) {
    return Response.json(
      { error: "이미지 용량이 너무 커요. 더 작은 이미지로 시도해 주세요." },
      { status: 400 }
    );
  }

  await updateTeamLogo(admin.teamId, logoDataUri);
  return Response.json({ ok: true });
}
