import { QUARTER_COUNT } from "./squad";
import type { QuarterRecordEntry } from "./types";

// 경기 기록 입력은 "골 하나 추가", "실점 +1" 같은 동작 단위로 서버에 보낸다.
// 화면 전체 상태를 통째로 저장하면 두 사람이 동시에 입력할 때 한쪽 입력이
// 덮어써지기 때문에, 서버가 최신 기록에 이 동작을 하나씩 적용한다.
export type RecordOp =
  | { op: "addGoal"; quarter: number; scorerId: number | null; assistId: number | null }
  | { op: "removeGoal"; quarter: number; index: number; scorerId: number | null; assistId: number | null }
  | { op: "setConceded"; quarter: number; conceded: number | null };

/**
 * 쿼터 기록을 항상 QUARTER_COUNT칸으로 맞추고, 쿼터 득점을 골 기록 수로
 * 통일한다. 예전 화면은 득점 수를 따로 입력해서 득점자 없이 숫자만 적힌
 * 쿼터가 있을 수 있는데, 그 차이만큼 "득점자 미기록" 골로 채워서 스코어가
 * 줄어들지 않게 한다. 득점도 실점도 입력 전인 쿼터는 scored/conceded가
 * null로 남는다(무실점 0과 구분해야 클린시트가 잘못 붙지 않는다).
 */
export function normalizeRecordLog(
  log: QuarterRecordEntry[] | null | undefined
): QuarterRecordEntry[] {
  return Array.from({ length: QUARTER_COUNT }, (_, i) => {
    const q = log?.[i];
    const goals = (q?.goals ?? []).map((g) => ({
      scorerId: g.scorerId ?? null,
      assistId: g.assistId ?? null,
    }));
    if (q?.scored != null) {
      for (let n = goals.length; n < q.scored; n++) {
        goals.push({ scorerId: null, assistId: null });
      }
    }
    const touched = q?.scored != null || goals.length > 0;
    return {
      scored: touched ? goals.length : null,
      conceded: q?.conceded ?? null,
      goals,
    };
  });
}

export function applyRecordOp(
  log: QuarterRecordEntry[] | null | undefined,
  op: RecordOp
): QuarterRecordEntry[] {
  const next = normalizeRecordLog(log);
  const q = next[op.quarter];
  if (!q) return next;
  if (op.op === "addGoal") {
    q.goals.push({ scorerId: op.scorerId, assistId: op.assistId });
  } else if (op.op === "removeGoal") {
    // 다른 사람이 그사이 골을 추가·삭제해서 순서가 밀렸을 수 있으니, 그
    // 자리의 골이 화면에서 본 골과 같을 때만 그 자리를 지우고, 아니면 같은
    // 득점자·어시 조합의 골을 찾아서 지운다.
    const same = (i: number) =>
      q.goals[i]?.scorerId === op.scorerId && q.goals[i]?.assistId === op.assistId;
    const idx = same(op.index) ? op.index : q.goals.findIndex((_, i) => same(i));
    if (idx >= 0) q.goals.splice(idx, 1);
  } else {
    q.conceded = op.conceded == null ? null : Math.max(0, Math.floor(op.conceded));
  }
  q.scored = q.goals.length > 0 || q.conceded != null ? q.goals.length : null;
  return next;
}

export function summarizeRecordLog(log: QuarterRecordEntry[]) {
  let scored: number | null = null;
  let conceded: number | null = null;
  const goals = new Map<number, number>();
  const assists = new Map<number, number>();
  for (const q of log) {
    if (q.scored != null) scored = (scored ?? 0) + q.scored;
    if (q.conceded != null) conceded = (conceded ?? 0) + q.conceded;
    for (const g of q.goals) {
      if (g.scorerId != null) goals.set(g.scorerId, (goals.get(g.scorerId) ?? 0) + 1);
      if (g.assistId != null) assists.set(g.assistId, (assists.get(g.assistId) ?? 0) + 1);
    }
  }
  return { scored, conceded, goals, assists };
}

export function parseRecordOp(body: unknown): RecordOp | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const quarter = Number(b.quarter);
  if (!Number.isInteger(quarter) || quarter < 0 || quarter >= QUARTER_COUNT) return null;
  const idOrNull = (v: unknown) => (v == null || v === "" ? null : Number(v));
  if (b.op === "addGoal" || b.op === "removeGoal") {
    const scorerId = idOrNull(b.scorerId);
    const assistId = idOrNull(b.assistId);
    if (Number.isNaN(scorerId) || Number.isNaN(assistId)) return null;
    if (b.op === "addGoal") return { op: "addGoal", quarter, scorerId, assistId };
    const index = Number(b.index);
    if (!Number.isInteger(index)) return null;
    return { op: "removeGoal", quarter, index, scorerId, assistId };
  }
  if (b.op === "setConceded") {
    const conceded = idOrNull(b.conceded);
    if (conceded != null && (Number.isNaN(conceded) || conceded < 0)) return null;
    return { op: "setConceded", quarter, conceded };
  }
  return null;
}

/** 쿼터 기록에서 한 선수를 지운다 — 골은 "득점자 미기록"으로 남겨 스코어 유지. */
export function recordLogWithoutMember(
  log: QuarterRecordEntry[],
  memberId: number
): QuarterRecordEntry[] {
  return log.map((q) => ({
    ...q,
    goals: q.goals.map((g) => ({
      scorerId: g.scorerId === memberId ? null : g.scorerId,
      assistId: g.assistId === memberId ? null : g.assistId,
    })),
  }));
}
