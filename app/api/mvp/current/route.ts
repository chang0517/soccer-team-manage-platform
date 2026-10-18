import { getSessionUser } from "@/lib/auth";
import { getMvpVotes, getVotes, listEvents, listMembers } from "@/lib/db";
import {
  matchLabel,
  mvpClosesAt,
  mvpDeadlineLabel,
  mvpLeaders,
  mvpOpensAt,
  mvpPhase,
} from "@/lib/mvp";

const SHOW_RESULT_DAYS = 3;

// 홈 화면 MVP 카드용: 지금 투표 중인 경기(없으면 마감된 지 며칠 안 된 경기)
// 하나와 내 투표 상태, 마감됐으면 결과를 돌려준다. 해당 경기가 없으면 null.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const now = Date.now();
  const events = (await listEvents(session.teamId))
    .filter((e) => e.type === "match" && !Number.isNaN(mvpOpensAt(e)))
    .sort((a, b) => mvpOpensAt(b) - mvpOpensAt(a));
  const ev =
    events.find((e) => mvpPhase(e, now) === "open") ??
    events.find(
      (e) =>
        mvpPhase(e, now) === "closed" && now - mvpClosesAt(e) < SHOW_RESULT_DAYS * 86400_000
    );
  if (!ev) return Response.json(null);

  const [votes, mvpVotes, members] = await Promise.all([
    getVotes(session.teamId, ev.id),
    getMvpVotes(session.teamId, ev.id),
    listMembers(session.teamId),
  ]);
  const nameOf = (id: number) => members.find((m) => m.id === id)?.name ?? "?";
  const phase = mvpPhase(ev, now);
  const attendees = votes.filter((v) => v.status === "attend").map((v) => v.memberId);
  const myVote = mvpVotes.find((v) => v.voterId === session.memberId);

  return Response.json({
    eventId: ev.id,
    label: matchLabel(ev),
    phase,
    deadlineLabel: mvpDeadlineLabel(ev),
    amAttendee: session.memberId != null && attendees.includes(session.memberId),
    myVoteName: myVote ? nameOf(myVote.voteeId) : null,
    voterCount: mvpVotes.length,
    attendCount: attendees.length,
    // 투표 중에는 결과를 미리 보여주지 않는다(분위기에 휩쓸리지 않게).
    leaders:
      phase === "closed"
        ? mvpLeaders(mvpVotes).map((l) => ({ name: nameOf(l.memberId), count: l.count }))
        : [],
  });
}
