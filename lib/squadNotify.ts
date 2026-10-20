import { getEvent, getVotes, listMembers, listUsersByStatus } from "./db";
import { formatDate } from "./format";
import { sendPushToEach, sendPushToMembers } from "./push";
import { memberQuarterRoles, SQUAD_APPROVAL_THRESHOLD } from "./squad";
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

/**
 * 스쿼드가 제출되면 제출한 사람을 뺀 다른 운영진에게 "승인해 주세요" 푸시를
 * 보낸다. 승인을 모으려면 다른 운영진이 제출 사실을 알아야 해서다. 휴대폰
 * 알림을 켜둔 운영진에게만 가고, 보낸 대상 수를 돌려준다.
 */
export async function notifySquadSubmitted(
  teamId: number,
  eventId: number,
  squad: SquadData,
  team: "A" | "B"
): Promise<number> {
  const [event, users, members] = await Promise.all([
    getEvent(teamId, eventId),
    listUsersByStatus(teamId, "approved"),
    listMembers(teamId),
  ]);
  if (!event) return 0;
  const adminIds = [
    ...new Set(
      users.filter((u) => u.role === "admin" && u.memberId != null).map((u) => u.memberId as number)
    ),
  ].filter((id) => id !== squad.submittedBy);
  if (adminIds.length === 0) return 0;
  const submitter = members.find((m) => m.id === squad.submittedBy)?.name ?? "운영진";
  const label = event.opponent ? `vs ${event.opponent}` : event.title;
  const teamPart = event.scrimmageSquad ? ` ${team}팀` : "";
  await sendPushToMembers(teamId, adminIds, {
    title: "스쿼드 승인 요청 📋",
    body: `${submitter}님이 ${formatDate(event.date, event.time)} ${label}${teamPart} 스쿼드를 제출했어요 · 운영진 ${SQUAD_APPROVAL_THRESHOLD}명이 승인하면 확정돼요`,
    url: `/events/${eventId}#squad`,
  });
  return adminIds.length;
}
