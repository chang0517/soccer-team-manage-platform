import { requireAdmin } from "@/lib/auth";
import { repairEventMemberIds } from "@/lib/migrate";

// 이미 이관된 팀의 일정 JSON(스쿼드·쿼터 기록) 속 선수 번호를 원본 DB와
// 대조해 바로잡는 1회성 관리자 도구. 여러 번 실행해도 안전하다.
export const maxDuration = 300;

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const sourceUrl = String(body?.sourceUrl ?? "").trim();
  const teamId = Number(body?.teamId);
  if (!sourceUrl || !teamId) {
    return Response.json({ error: "원본 DB 주소와 팀을 골라주세요." }, { status: 400 });
  }
  try {
    return Response.json(await repairEventMemberIds({ sourceUrl, teamId }));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "복구에 실패했어요." },
      { status: 500 }
    );
  }
}
