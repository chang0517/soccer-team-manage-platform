import { getVotes, listEvents, listMembers, listTeams, updateEvent } from "@/lib/db";
import { daysUntil } from "@/lib/format";
import { FORMATION_SLOTS, generateSquad } from "@/lib/squad";

const CURRENT_SLOT_IDS = new Set(FORMATION_SLOTS.map((s) => s.id));

// Vercel cron이 매일 호출: 모든 팀에 대해, 3일 안에 열리는 경기 중 스쿼드가
// 없거나 예전 포메이션으로 만들어진 경기를 새로 생성
export async function GET() {
  const teams = await listTeams();
  let generated = 0;
  for (const team of teams) {
    const [events, members] = await Promise.all([
      listEvents(team.id),
      listMembers(team.id),
    ]);
    for (const e of events) {
      const d = daysUntil(e.date);
      const hasValidSquad =
        !!e.squad &&
        Array.isArray(e.squad.quarters) &&
        e.squad.quarters.every((q) =>
          q.starters.every((s) => CURRENT_SLOT_IDS.has(s.slotId))
        );
      if (e.type !== "match" || hasValidSquad || d < 0 || d > 3) continue;
      const attendIds = new Set(
        (await getVotes(team.id, e.id))
          .filter((v) => v.status === "attend")
          .map((v) => v.memberId)
      );
      const attendees = members.filter((m) => attendIds.has(m.id));
      if (attendees.length === 0) continue;
      await updateEvent(team.id, e.id, { squad: generateSquad(attendees) });
      generated++;
    }
  }
  return Response.json({ generated });
}
