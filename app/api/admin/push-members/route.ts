import { requireAdmin } from "@/lib/auth";
import { getAllPushSubscriptions } from "@/lib/db";

// 휴대폰 알림을 켜둔 선수 번호 목록 — 정기 알림 받을 사람을 고를 때, 알림이
// 꺼져 있어서 실제로는 못 받는 사람을 표시하는 데 쓴다.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  const subs = await getAllPushSubscriptions(admin.teamId);
  return Response.json([
    ...new Set(subs.map((s) => s.memberId).filter((m): m is number => m != null)),
  ]);
}
