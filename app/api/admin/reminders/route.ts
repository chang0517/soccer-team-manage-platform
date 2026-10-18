import { requireAdmin } from "@/lib/auth";
import { createReminder, deleteReminder, listReminders } from "@/lib/db";

// 팀 설정의 "정기 알림" — 매월 정해진 날·시각(예: 구장 예약 오픈) 전에 알림.
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
  const target = b?.target === "admins" ? "admins" : "all";
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
  return Response.json(
    await createReminder(admin.teamId, { title, dayOfMonth, openTime, leadMinutes, target }),
    { status: 201 }
  );
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  await deleteReminder(admin.teamId, id);
  return Response.json({ ok: true });
}
