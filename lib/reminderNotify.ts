import { claimReminderSend, listReminders, listUsersByStatus } from "./db";
import { sendPushToAll, sendPushToMembers } from "./push";
import { dueReminder, leadLabel, openTimeLabel } from "./reminders";

/**
 * 보낼 때가 된 정기 알림(구장 예약 오픈 등)을 보낸다. teamId를 주면 그 팀만,
 * 없으면 모든 팀을 본다. 매시 도는 크론과 일정 목록 조회 때 함께 불린다.
 * 같은 달에는 한 번만 보낸다(reminder_sends로 원자적으로 확인).
 */
export async function processReminders(teamId?: number): Promise<number> {
  const reminders = await listReminders(teamId ?? null);
  let sent = 0;
  for (const r of reminders) {
    const due = dueReminder(r);
    if (!due) continue;
    if (!(await claimReminderSend(r.teamId, r.id, due.period))) continue;
    const payload = {
      title: `⏰ ${r.title} ${leadLabel(r.leadMinutes)} 전`,
      body: `오늘 ${openTimeLabel(r.openTime)}에 예약이 열려요. 미리 준비해 주세요!`,
      url: "/",
    };
    if (r.target === "admins") {
      const admins = (await listUsersByStatus(r.teamId, "approved"))
        .filter((u) => u.role === "admin" && u.memberId != null)
        .map((u) => u.memberId as number);
      await sendPushToMembers(r.teamId, admins, payload);
    } else {
      await sendPushToAll(r.teamId, payload);
    }
    sent++;
  }
  return sent;
}
