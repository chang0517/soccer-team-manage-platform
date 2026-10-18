import { requireAdmin } from "@/lib/auth";
import { getTeamById, updateTeamFineSettings, updateTeamScoreRules } from "@/lib/db";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  }
  const team = await getTeamById(admin.teamId);
  if (!team) return Response.json({ error: "팀을 찾을 수 없어요." }, { status: 404 });
  return Response.json(team);
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  }
  const body = await request.json();

  try {
    if (body?.fineAccount !== undefined || body?.fineAmount !== undefined) {
      await updateTeamFineSettings(admin.teamId, {
        fineAccount: body.fineAccount,
        fineAmount: body.fineAmount,
      });
    }
    if (body?.scoreRules && typeof body.scoreRules === "object") {
      const r = body.scoreRules;
      const toNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
      const patch: Record<string, number> = {};
      const fields = [
        "participation",
        "goal",
        "assist",
        "cleanSheetDefence",
        "cleanSheetDm",
      ] as const;
      for (const f of fields) {
        const v = toNum(r[f]);
        if (v !== undefined) patch[f] = v;
      }
      await updateTeamScoreRules(admin.teamId, patch);
    }
    const team = await getTeamById(admin.teamId);
    return Response.json(team);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "저장에 실패했어요." },
      { status: 500 }
    );
  }
}
