import { listTeams } from "@/lib/db";
import { processMvpNotifications } from "@/lib/mvpNotify";
import { processReminders } from "@/lib/reminderNotify";

// Vercel 무료 플랜은 크론 하나가 하루 한 번만 돌 수 있어서, vercel.json에
// 매시 정각짜리 크론 24개를 등록해 사실상 한 시간마다 이 경로를 부른다.
// 한 번 돌 때 (1) 정기 알림(구장 예약 오픈 등)과 (2) 경기 끝난 뒤 MVP 투표
// 열림 / 마감 뒤 MVP 발표 알림을 모든 팀에 대해 확인한다 — 그래서 아무도 앱을
// 열지 않아도 경기가 끝나고 최대 1시간 안에 MVP 알림이 간다. 실행 시각이
// 최대 59분 늦을 수 있으니 각 알림은 "보낼 구간" 안이면 보내고, 보낸 알림은
// DB 기록으로 다시 보내지 않는다.
export async function GET() {
  const reminders = await processReminders();
  let teamsChecked = 0;
  for (const team of await listTeams()) {
    await processMvpNotifications(team.id).catch((e) =>
      console.error(`[cron] mvp notify failed for team ${team.id}:`, e)
    );
    teamsChecked++;
  }
  return Response.json({ sent: reminders, mvpTeamsChecked: teamsChecked });
}
