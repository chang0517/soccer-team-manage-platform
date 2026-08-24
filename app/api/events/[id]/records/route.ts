import { getSessionUser } from "@/lib/auth";
import { saveRecords, updateEvent } from "@/lib/db";
import type { RecordRow } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { id } = await params;
  const eventId = Number(id);
  const body = await request.json();
  if (
    body.scored !== undefined ||
    body.conceded !== undefined ||
    body.recordLog !== undefined
  ) {
    await updateEvent(session.teamId, eventId, {
      scored: body.scored === null || body.scored === "" ? null : Number(body.scored),
      conceded:
        body.conceded === null || body.conceded === "" ? null : Number(body.conceded),
      recordLog: body.recordLog ?? null,
    });
  }
  const records: RecordRow[] = (body.records ?? []).map(
    (r: Partial<RecordRow> & { memberId: number }) => ({
      eventId,
      memberId: r.memberId,
      played: r.played ? 1 : 0,
      goals: Number(r.goals) || 0,
      assists: Number(r.assists) || 0,
      position: r.position ?? "",
    })
  );
  await saveRecords(session.teamId, eventId, records);
  return Response.json({ ok: true });
}
