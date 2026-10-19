import { requireAdmin } from "@/lib/auth";
import {
  createReminder,
  deleteReminder,
  listMembers,
  listReminders,
  updateReminderRecipients,
} from "@/lib/db";
import type { TeamReminder } from "@/lib/types";

// 팀 설정의 "정기 알림" — 매월 정해진 날·시각(예: 구장 예약 오픈) 전에 알림.
async function parseRecipients(
  teamId: number,
  b: { target?: unknown; memberIds?: unknown } | null
): Promise<{ target: TeamReminder["target"]; memberIds: number[] } | { error: string }> {
  const target = b?.target === "admins" || b?.target === "members" ? b.target : "all";
  if (target !== "members") return { target, memberIds: [] };
  // 이 팀 선수만 받을 수 있다 — 다른 팀 번호가 섞여 들어와도 걸러낸다.
  const valid = new Set((await listMembers(teamId)).map((m) => m.id));
  const memberIds = [
    ...new Set(
      (Array.isArray(b?.memberIds) ? b.memberIds : [])
        .map(Number)
        .filter((n) => Number.isInteger(n) && valid.has(n))
    ),
  ];
  if (memberIds.length === 0) return { error: "알림 받을 사람을 한 명 이상 골라주세요." };
  return { target, memberIds };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  return Response.json(await listReminders(admin.teamId));
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  const b = await request.json().catch(() => null);
  const title = typeof b?.title === "string" ? b.title.trim() : "";
  const dayOfMonth = Number(b?.dayOfMonth);
  const openTime = typeof b?.openTime === "string" ? b.openTime : "";
  const leadMinutes = Number(b?.leadMinutes ?? 60);
  if (
    !title ||
    title.length > 40 ||
    !Number.isInteger(dayOfMonth) ||
    dayOfMonth < 1 ||
    dayOfMonth > 31 ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(openTime) ||
    !Number.isInteger(leadMinutes) ||
    leadMinutes < 10 ||
    leadMinutes > 24 * 60
  ) {
    return Response.json({ error: "입력값을 확인해 주세요." }, { status: 400 });
  }
  const to = await parseRecipients(admin.teamId, b);
  if ("error" in to) return Response.json({ error: to.error }, { status: 400 });
  return Response.json(
    await createReminder(admin.teamId, { title, dayOfMonth, openTime, leadMinutes, ...to }),
    { status: 201 }
  );
}

// 받는 사람만 바꾼다(예약 담당자가 바뀌었을 때 지우고 새로 만들 필요 없게).
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  const b = await request.json().catch(() => null);
  const id = Number(b?.id);
  if (!Number.isInteger(id)) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const to = await parseRecipients(admin.teamId, b);
  if ("error" in to) return Response.json({ error: to.error }, { status: 400 });
  const updated = await updateReminderRecipients(admin.teamId, id, to.target, to.memberIds);
  if (!updated) return Response.json({ error: "알림을 찾을 수 없어요." }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  await deleteReminder(admin.teamId, id);
  return Response.json({ ok: true });
}
