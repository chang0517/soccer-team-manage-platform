import { requireAdmin } from "@/lib/auth";
import { createMember } from "@/lib/db";
import { POS_GROUPS } from "@/lib/types";
import type { PosGroup } from "@/lib/types";

interface ImportRow {
  name: string;
  backNo: number | null;
  pos1: string;
  pos2: string;
  phone: string | null;
}

// 새로 합류하는 팀이 양식(public/templates/member-roster-template.csv)에
// 채워온 멤버 명단을 한 번에 등록할 때 쓴다. 한 줄씩 검증해서, 잘못된
// 줄은 등록하지 않고 이유와 함께 돌려준다.
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  }

  const body = await request.json();
  const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return Response.json({ error: "등록할 멤버가 없어요." }, { status: 400 });
  }

  const created: string[] = [];
  const failed: { row: number; name: string; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r?.name ?? "").trim();
    if (!name) {
      failed.push({ row: i + 1, name: "", reason: "이름이 비어있어요." });
      continue;
    }
    const pos1 = POS_GROUPS.includes(r?.pos1 as PosGroup) ? (r.pos1 as PosGroup) : "CB";
    const pos2 = POS_GROUPS.includes(r?.pos2 as PosGroup) ? (r.pos2 as PosGroup) : "WB";
    const backNo =
      r?.backNo === null || r?.backNo === undefined || (r.backNo as unknown) === ""
        ? null
        : Number(r.backNo);
    const phone =
      typeof r?.phone === "string" && r.phone.trim() ? r.phone.trim() : null;

    try {
      await createMember(admin.teamId, {
        name,
        backNo: backNo != null && !Number.isNaN(backNo) ? backNo : null,
        pos1,
        pos2,
        isGuest: false,
        phone,
      });
      created.push(name);
    } catch (e) {
      failed.push({
        row: i + 1,
        name,
        reason: e instanceof Error ? e.message : "등록 실패",
      });
    }
  }

  return Response.json({ created, failed });
}
