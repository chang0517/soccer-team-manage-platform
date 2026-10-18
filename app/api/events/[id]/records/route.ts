import { getSessionUser } from "@/lib/auth";
import { mutateEventRecordLog, saveRecords, updateEvent } from "@/lib/db";
import { rebuildEventRecords } from "@/lib/recordSync";
import { applyRecordOp, parseRecordOp, summarizeRecordLog } from "@/lib/records";
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

  // 기록 입력 화면은 동작 하나(골 추가·삭제, 실점 변경)씩 보낸다 — 서버가
  // 최신 기록에 적용하므로 여러 사람이 동시에 입력해도 서로 덮어쓰지 않는다.
  if (body.op !== undefined) {
    const op = parseRecordOp(body);
    if (!op) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    const recordLog = await mutateEventRecordLog(session.teamId, eventId, (cur) => {
      const next = applyRecordOp(cur, op);
      const { scored, conceded } = summarizeRecordLog(next);
      return { scored, conceded, recordLog: next };
    });
    if (!recordLog) return Response.json({ error: "일정을 찾을 수 없어요." }, { status: 404 });
    await rebuildEventRecords(session.teamId, eventId);
    return Response.json({ ok: true, recordLog });
  }

  // 예전 방식(화면 전체를 한 번에 저장) — 이미 열려 있던 옛 화면을 위해 남겨둔다.
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
