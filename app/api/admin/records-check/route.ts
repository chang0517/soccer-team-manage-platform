import { requireAdmin } from "@/lib/auth";
import { listEvents, listMembers } from "@/lib/db";
import { computeQuarterCleanUnits } from "@/lib/points";
import { normalizeRecordLog } from "@/lib/records";

// 클린시트가 왜 적게 잡히는지 경기별로 따져 보는 진단. 운영 DB를 직접 열어보지
// 않아도 화면에서 원인(선수 번호 불일치, 쿼터 실점 미입력, 기록 없음)을 볼 수 있게 한다.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  const [events, members] = await Promise.all([listEvents(admin.teamId), listMembers(admin.teamId)]);
  const known = new Set(members.map((m) => m.id));

  const rows = events
    .filter((e) => e.type === "match" && (e.squad || e.recordLog || e.conceded != null))
    .map((e) => {
      const squadIds = new Set<number>();
      for (const q of e.squad?.quarters ?? []) {
        for (const s of q.starters) {
          if (s.memberId != null) squadIds.add(s.memberId);
          if (s.memberId2 != null) squadIds.add(s.memberId2);
        }
        q.bench.forEach((m) => squadIds.add(m));
      }
      const log = e.recordLog ? normalizeRecordLog(e.recordLog) : null;
      const quarterConceded = log ? log.map((q) => q.conceded) : null;
      const units = [...computeQuarterCleanUnits([e], members).values()].reduce((a, b) => a + b, 0);
      const missing = [...squadIds].filter((id) => !known.has(id)).length;
      const reasons: string[] = [];
      if (e.squad && e.recordLog) {
        if (missing > 0) reasons.push(`스쿼드 선수 ${missing}명이 명단에 없음(선수 번호 복구 필요)`);
        const empty = quarterConceded!.filter((c) => c == null).length;
        if (empty > 0) reasons.push(`실점 미입력 쿼터 ${empty}개`);
        if (units === 0 && missing === 0 && empty === 0) reasons.push("모든 쿼터에 실점이 있어 클린시트 없음");
      } else if (e.recordLog && !e.squad) {
        reasons.push("스쿼드 없음 → 경기 단위로만 계산");
      } else if (e.squad && !e.recordLog) {
        reasons.push("쿼터 기록 없음 → 경기 단위로만 계산");
      } else {
        reasons.push("스쿼드·쿼터 기록 없음 → 경기 단위로만 계산");
      }
      if (reasons.length === 0) reasons.push("정상 — 무실점 쿼터에 뛴 수비수가 클린시트로 잡혔어요");
      return {
        id: e.id,
        date: e.date,
        title: e.title,
        opponent: e.opponent,
        conceded: e.conceded,
        hasSquad: !!e.squad,
        hasLog: !!e.recordLog,
        quarterConceded,
        missing,
        units,
        reasons,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return Response.json({
    memberCount: members.length,
    totalUnits: rows.reduce((a, r) => a + r.units, 0),
    rows,
  });
}
