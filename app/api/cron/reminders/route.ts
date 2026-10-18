import { processReminders } from "@/lib/reminderNotify";

// Vercel 무료 플랜은 크론 하나가 하루 한 번만 돌 수 있어서, vercel.json에
// 매시 정각짜리 크론 24개를 등록해 사실상 한 시간마다 이 경로를 부른다.
// 실행 시각이 최대 59분 늦을 수 있으니 dueReminder가 "오픈 전 lead분 구간"
// 안이면 보내도록 처리한다.
export async function GET() {
  const sent = await processReminders();
  return Response.json({ sent });
}
