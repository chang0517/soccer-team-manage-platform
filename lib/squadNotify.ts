import { getEvent, getVotes } from "./db";
import { formatDate } from "./format";
import { sendPushToEach } from "./push";
import { memberQuarterRoles } from "./squad";
import type { SquadData } from "./types";

/**
 * 스쿼드가 확정되면 그 스쿼드에 든 참석자 각자에게 "내 출전" 요약을 담아
 * 푸시를 보낸다(예: "1Q CB · 2Q 휴식 · 3Q CB · 4Q LB"). 휴대폰 알림을
 * 켜둔 사람에게만 간다. 보낸 인원 수를 돌려준다.
 */
export async function notifySquadConfirmed(
  teamId: number,
  eventId: number,
  squad: SquadData,
  team: "A" | "B"
): Promise<number> {
  const [event, votes] = await Promise.all([getEvent(teamId, eventId), getVotes(teamId, eventId)]);
  if (!event) return 0;
  const attending = new Set(votes.filter((v) => v.status === "attend").map((v) => v.memberId));
  const roster = new Set<number>();
  for (const q of squad.quarters) {
    for (const s of q.starters) {
      if (s.memberId != null) roster.add(s.memberId);
      if (s.memberId2 != null) roster.add(s.memberId2);
    }
    q.bench.forEach((m) => roster.add(m));
  }
  const label = event.opponent ? `vs ${event.opponent}` : event.title;
  // 내전 모드일 때만 몇 팀 스쿼드인지 밝힌다.
  const teamPart = event.scrimmageSquad ? ` ${team}팀` : "";
  const targets = [...roster].filter((m) => attending.has(m));
  return sendPushToEach(
    teamId,
    targets.map((memberId) => ({
      memberId,
      payload: {
        title: `스쿼드가 확정됐어요${teamPart ? ` (${team}팀)` : ""} 📋`,
        body: `${formatDate(event.date, event.time)} ${label}${teamPart} · 내 출전: ${memberQuarterRoles(squad, memberId)
          .map((r, i) => `${i + 1}Q ${r}`)
          .join(" · ")}`,
        url: `/events/${eventId}#squad`,
      },
    }))
  );
}
