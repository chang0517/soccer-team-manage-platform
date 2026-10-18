import { getEvent, getVotes, listMembers, saveRecords } from "./db";
import { normalizeRecordLog, summarizeRecordLog } from "./records";
import { slotFinalPosition } from "./squad";
import type { RecordRow } from "./types";

/**
 * 쿼터별 기록 로그 + 현재 참석 명단으로 records 테이블(선수별 출전·골·어시)을
 * 다시 만든다. 기록 입력이 자동 저장되면서 "저장" 시점이 따로 없으니, 기록이
 * 바뀔 때와 참석 명단이 바뀔 때마다 이걸 불러서 랭킹이 항상 최신이 되게 한다.
 * 기록 입력 화면을 거치지 않은 경기(recordLog 없음 — 과거 일괄 입력 등)는
 * 건드리지 않는다.
 */
export async function rebuildEventRecords(teamId: number, eventId: number) {
  const event = await getEvent(teamId, eventId);
  if (!event || event.type !== "match" || !event.recordLog) return;
  const [votes, members] = await Promise.all([
    getVotes(teamId, eventId),
    listMembers(teamId),
  ]);

  const { goals, assists } = summarizeRecordLog(normalizeRecordLog(event.recordLog));
  const memberById = new Map(members.map((m) => [m.id, m]));
  // 쿼터 기록에 이 팀 명단에 없는 선수 번호가 있으면(예전 이관 데이터가 아직
  // 복구되지 않은 경우) 다시 계산하면 골·어시가 사라지니 기존 기록을 그대로 둔다.
  if ([...goals.keys(), ...assists.keys()].some((id) => !memberById.has(id))) return;

  // 클린시트 계산용 포지션: 스쿼드에 처음 배정된 자리의 수비 포지션, 없으면 1순위 포지션.
  const squadPos = new Map<number, RecordRow["position"]>();
  for (const squad of [event.squad, event.scrimmageSquad]) {
    for (const q of squad?.quarters ?? []) {
      for (const s of q.starters) {
        for (const mid of [s.memberId, s.memberId2]) {
          if (mid != null && !squadPos.has(mid)) squadPos.set(mid, slotFinalPosition(s.slotId));
        }
      }
    }
  }

  const ids = new Set<number>([
    ...votes.filter((v) => v.status === "attend").map((v) => v.memberId),
    ...goals.keys(),
    ...assists.keys(),
  ]);
  const records: RecordRow[] = [...ids]
    .filter((mid) => memberById.has(mid))
    .map((mid) => ({
      eventId,
      memberId: mid,
      played: 1,
      goals: goals.get(mid) ?? 0,
      assists: assists.get(mid) ?? 0,
      position: squadPos.get(mid) || memberById.get(mid)!.pos1 || "",
    }));
  await saveRecords(teamId, eventId, records);
}
