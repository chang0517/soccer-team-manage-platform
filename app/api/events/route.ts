import { getSessionUser, requireAdmin } from "@/lib/auth";
import { createEvent, listEvents } from "@/lib/db";
import { after } from "next/server";
import { formatDate } from "@/lib/format";
import { processMvpNotifications } from "@/lib/mvpNotify";
import { processReminders } from "@/lib/reminderNotify";
import { sendPushToAll } from "@/lib/push";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const events = await listEvents(session.teamId);
  // 홈·일정 화면이 열릴 때마다 응답을 보낸 뒤 MVP 투표 시작/발표 알림을
  // 보낼 때가 된 경기가 있는지 확인한다(하루 한 번 크론만으로는 늦어서).
  after(async () => {
    await processMvpNotifications(session.teamId, events).catch((e) =>
      console.error("[mvp] notify failed:", e)
    );
    // 정기 알림(구장 예약 오픈 등)도 크론이 늦을 때를 대비해 같이 확인한다.
    await processReminders(session.teamId).catch((e) =>
      console.error("[reminders] notify failed:", e)
    );
  });
  return Response.json(events);
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 일정을 추가할 수 있어요." }, { status: 403 });
  }
  const body = await request.json();
  if (!body.title?.trim() || !body.date) {
    return Response.json(
      { error: "제목과 날짜는 필수입니다." },
      { status: 400 }
    );
  }
  const event = await createEvent(admin.teamId, {
    title: body.title.trim(),
    type: body.type === "social" ? "social" : "match",
    date: body.date,
    time: body.time ?? "",
    location: body.location ?? "",
    opponent: body.opponent ?? "",
    notes: body.notes ?? "",
    dutyOffense: body.dutyOffense ?? "",
    dutyDefense: body.dutyDefense ?? "",
    dutyBag3: body.dutyBag3 ?? "",
    supplyBag: body.supplyBag ?? "",
    vestBag: body.vestBag ?? "",
    waterDuty: body.waterDuty ?? "",
    iceboxDuty: body.iceboxDuty ?? "",
    recordLog: null,
  });

  if (event.type === "match") {
    const opponentPart = event.opponent ? ` vs ${event.opponent}` : "";
    await sendPushToAll(admin.teamId, {
      title: "⚽ 새 경기 일정이 등록됐어요",
      body: `${event.title}${opponentPart} · ${formatDate(event.date, event.time)} — 참석 투표를 해주세요!`,
      url: `/events/${event.id}`,
    });
  }

  return Response.json(event, { status: 201 });
}
