import { requireAdmin } from "@/lib/auth";
import { getAllRecords, listEvents, listMembers } from "@/lib/db";
import { computeQuarterCleanUnits } from "@/lib/points";
import { normalizeRecordLog } from "@/lib/records";
import { memberQuarterRoles } from "@/lib/squad";

// 선수 한 명의 클린시트가 왜 그 값인지 경기별로 보여준다. "기록상 뛴 경기"
// (records)와 "스쿼드에 들어 있는 경기"를 나란히 놓으면, 뛰었는데 스쿼드에는
// 없는 경기(스쿼드의 선수 번호가 어긋난 경기)가 바로 드러난다.
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  const memberId = Number(new URL(request.url).searchParams.get("member"));
  if (!Number.isInteger(memberId)) {
    return Response.json({ error: "선수를 골라 주세요." }, { status: 400 });
  }
  const [events, members, records] = await Promise.all([
    listEvents(admin.teamId),
    listMembers(admin.teamId),
    getAllRecords(admin.teamId),
  ]);
  const member = members.find((m) => m.id === memberId);
  if (!member) return Response.json({ error: "선수를 찾을 수 없어요." }, { status: 404 });
  const played = new Set(records.filter((r) => r.memberId === memberId && r.played).map((r) => r.eventId));

  const rows = events
    .filter((e) => e.type === "match" && (played.has(e.id) || e.squad))
    .map((e) => {
      const roles = e.squad ? memberQuarterRoles(e.squad, memberId) : null;
      const inSquad = !!roles && roles.some((r) => r !== "휴식" && r !== "-");
      const log = e.recordLog ? normalizeRecordLog(e.recordLog) : null;
      const units = e.squad && e.recordLog ? (computeQuarterCleanUnits([e], members).get(memberId) ?? 0) : 0;
      return {
        id: e.id,
        date: e.date,
        title: e.title,
        opponent: e.opponent,
        played: played.has(e.id),
        hasSquad: !!e.squad,
        roles,
        inSquad,
        quarterConceded: log ? log.map((q) => q.conceded) : null,
        hasLog: !!log,
        units,
      };
    })
    .filter((r) => r.played || r.inSquad)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return Response.json({
    member: { id: member.id, name: member.name, backNo: member.backNo, pos1: member.pos1, pos2: member.pos2 },
    totalUnits: rows.reduce((a, r) => a + r.units, 0),
    playedNotInSquad: rows.filter((r) => r.played && r.hasSquad && !r.inSquad).length,
    // 아직 기록이 없는 경기(예정 경기)는 "안 뛴" 경기로 세지 않는다.
    inSquadNotPlayed: rows.filter((r) => !r.played && r.inSquad && r.hasLog).length,
    rows,
  });
}
