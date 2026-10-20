import { requireAdmin } from "@/lib/auth";
import { mutateEventSquad } from "@/lib/db";
import { applySquadAction, SquadActionError, squadStatus } from "@/lib/squad";
import type { SquadAction } from "@/lib/squad";
import { notifySquadConfirmed, notifySquadSubmitted } from "@/lib/squadNotify";

const ACTIONS: SquadAction[] = ["submit", "withdraw", "approve", "unapprove", "unlock"];

// 스쿼드 제출·승인·확정 해제. 운영진 SQUAD_APPROVAL_THRESHOLD명이 승인하는
// 순간 확정되고, 그 요청에서만 참석자에게 확정 알림을 보낸다(행 잠금으로
// 확정 전환을 본 요청이 정확히 하나). ?team=B는 내전 모드 B팀 스쿼드.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 할 수 있어요." }, { status: 403 });
  }
  if (admin.memberId == null) {
    return Response.json(
      { error: "멤버 프로필과 연결된 운영진 계정만 제출·승인할 수 있어요." },
      { status: 400 }
    );
  }
  const memberId = admin.memberId;
  const team = new URL(request.url).searchParams.get("team") === "B" ? "B" : "A";
  const { id } = await params;
  const eventId = Number(id);
  const { action } = await request.json();
  if (!ACTIONS.includes(action)) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  let result;
  try {
    result = await mutateEventSquad(
      admin.teamId,
      eventId,
      team === "B" ? "scrimmageSquad" : "squad",
      (cur) => {
        if (!cur) throw new SquadActionError("스쿼드가 없어요.");
        return applySquadAction(cur, action, memberId);
      }
    );
  } catch (e) {
    if (e instanceof SquadActionError) {
      return Response.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
  if (!result?.after) return Response.json({ error: "일정을 찾을 수 없어요." }, { status: 404 });

  const justConfirmed =
    squadStatus(result.before) !== "confirmed" && squadStatus(result.after) === "confirmed";
  let notified = 0;
  if (justConfirmed) {
    notified = await notifySquadConfirmed(admin.teamId, eventId, result.after, team).catch((e) => {
      console.error("[squad] confirm notify failed:", e);
      return 0;
    });
  }
  // 제출된 순간(작성 중 → 승인 대기)에만 다른 운영진에게 승인 요청을 보낸다.
  const justSubmitted =
    squadStatus(result.before) !== "submitted" && squadStatus(result.after) === "submitted";
  if (justSubmitted) {
    await notifySquadSubmitted(admin.teamId, eventId, result.after, team).catch((e) =>
      console.error("[squad] submit notify failed:", e)
    );
  }
  return Response.json({ squad: result.after, justConfirmed, notified });
}
