import { requireAdmin } from "@/lib/auth";
import { getAllPushSubscriptions, listMembers } from "@/lib/db";
import { pushKind, sendPushDiagnostic } from "@/lib/push";

// 팀원별로 알림을 켠 기기가 있는지, 어느 종류 기기인지 보여준다(알림이 안 간다는
// 사람이 아예 구독이 없는지, 구독은 있는데 전달이 안 되는지 가리려고).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  const [members, subs] = await Promise.all([
    listMembers(admin.teamId),
    getAllPushSubscriptions(admin.teamId),
  ]);
  return Response.json({
    unlinked: subs.filter((s) => s.memberId == null).length,
    members: members.map((m) => {
      const mine = subs.filter((s) => s.memberId === m.id);
      return {
        id: m.id,
        name: m.name,
        backNo: m.backNo,
        devices: mine.map((s) => pushKind(s.endpoint)),
      };
    }),
  });
}

// 한 팀원에게 테스트 알림을 보내고 기기별 전송 결과를 돌려준다.
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const memberId = Number(body?.memberId);
  if (!Number.isInteger(memberId)) {
    return Response.json({ error: "팀원을 골라 주세요." }, { status: 400 });
  }
  const members = await listMembers(admin.teamId);
  if (!members.some((m) => m.id === memberId)) {
    return Response.json({ error: "팀원을 찾을 수 없어요." }, { status: 404 });
  }
  return Response.json(await sendPushDiagnostic(admin.teamId, memberId));
}
