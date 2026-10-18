import { claimEventFlag, getMvpVotes, getVotes, listEvents, listMembers } from "./db";
import { matchLabel, mvpClosesAt, mvpDeadlineLabel, mvpLeaders, mvpOpensAt } from "./mvp";
import { sendPushToAll, sendPushToMembers } from "./push";
import type { EventItem } from "./types";

const DAY = 24 * 3600_000;

/**
 * 경기가 끝나면 참석자에게 "MVP 투표 열림" 푸시를, 투표가 마감되면 팀 전체에
 * "MVP 발표" 푸시를 한 번씩 보낸다. Vercel 무료 플랜 크론은 하루 한 번뿐이라,
 * 일정 목록을 불러올 때(홈·일정 화면)마다 응답 뒤에 이걸 돌려서 제때 보내고,
 * 하루 한 번 크론도 놓친 걸 마저 보낸다. 각 알림은 DB 플래그를 원자적으로
 * 켠 요청만 보내므로 여러 요청이 겹쳐도 한 번만 나간다. 도입 전 과거 경기가
 * 한꺼번에 알림을 쏟아내지 않도록, 열리거나 닫힌 지 하루가 안 된 경기만 본다.
 */
export async function processMvpNotifications(teamId: number, events?: EventItem[]) {
  const list = events ?? (await listEvents(teamId));
  const now = Date.now();
  for (const ev of list) {
    if (ev.type !== "match") continue;
    const opens = mvpOpensAt(ev);
    const closes = mvpClosesAt(ev);
    if (Number.isNaN(opens)) continue;

    if (!ev.mvpOpenNotified && now >= opens && now < closes && now - opens < DAY) {
      if (await claimEventFlag(teamId, ev.id, "mvp_open_notified")) {
        const votes = await getVotes(teamId, ev.id);
        const attendees = votes.filter((v) => v.status === "attend").map((v) => v.memberId);
        await sendPushToMembers(teamId, attendees, {
          title: "MVP 투표가 열렸어요 🏆",
          body: `${matchLabel(ev)} 경기 MVP를 뽑아주세요. ${mvpDeadlineLabel(ev)} 마감`,
          url: `/events/${ev.id}#mvp`,
        });
      }
    }

    if (!ev.mvpResultNotified && now >= closes && now - closes < DAY) {
      if (await claimEventFlag(teamId, ev.id, "mvp_result_notified")) {
        const [mvpVotes, members] = await Promise.all([
          getMvpVotes(teamId, ev.id),
          listMembers(teamId),
        ]);
        const leaders = mvpLeaders(mvpVotes);
        if (leaders.length === 0) continue;
        const names = leaders
          .map((l) => members.find((m) => m.id === l.memberId)?.name ?? "?")
          .join(", ");
        await sendPushToAll(teamId, {
          title: "이번 경기 MVP 발표 🏆",
          body: `${matchLabel(ev)} MVP는 ${names}! (${leaders[0].count}표)`,
          url: `/events/${ev.id}#mvp`,
        });
      }
    }
  }
}
