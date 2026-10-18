import { requireAdmin } from "@/lib/auth";
import {
  getAllHistoricalStats,
  getAllMvpVotes,
  getAllRecords,
  listEvents,
  listMembers,
} from "@/lib/db";

// 팀 설정 화면에서 점수 배율을 바꿀 때마다 서버를 다시 부르지 않고
// 클라이언트에서 즉시 재계산(computeRanking)할 수 있도록, 랭킹 계산에
// 필요한 원본 데이터를 한 번에 내려준다.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  }
  const [members, events, records, mvpVotes, historical] = await Promise.all([
    listMembers(admin.teamId),
    listEvents(admin.teamId),
    getAllRecords(admin.teamId),
    getAllMvpVotes(admin.teamId),
    getAllHistoricalStats(admin.teamId),
  ]);
  return Response.json({ members, events, records, mvpVotes, historical });
}
