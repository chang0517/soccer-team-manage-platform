import { requireAdmin } from "@/lib/auth";
import { getTeamById, updateTeamFineSettings, updateTeamScoreRules } from "@/lib/db";
import { getSmsDay, setSmsDay } from "@/lib/smsSchedule";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  }
  const team = await getTeamById(admin.teamId);
  if (!team) return Response.json({ error: "팀을 찾을 수 없어요." }, { status: 404 });
  return Response.json({ ...team, smsDay: await getSmsDay(admin.teamId) });
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
    if (body?.smsDay !== undefined) {
      const day = Math.floor(Number(body.smsDay));
      if (!Number.isFinite(day) || day < 1 || day > 28) {
        return Response.json({ error: "문자 발송일은 1~28일 중에서 골라 주세요." }, { status: 400 });
      }
      await setSmsDay(admin.teamId, day);
    }
    const team = await getTeamById(admin.teamId);
    return Response.json(team ? { ...team, smsDay: await getSmsDay(admin.teamId) } : team);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "저장에 실패했어요." },
      { status: 500 }
    );
  }
}
