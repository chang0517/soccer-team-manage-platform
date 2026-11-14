import { requireAdmin } from "@/lib/auth";
import {
  getAppSetting,
  getEvent,
  getTeamById,
  getVotes,
  listMembers,
  setAppSetting,
} from "@/lib/db";
import { formatDate, todayStr } from "@/lib/format";
import { getSmsDay } from "@/lib/smsSchedule";
import { sendSms } from "@/lib/sms";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 보낼 수 있어요." }, { status: 403 });
  }

  // 문자는 비용·피로 때문에 운영진이 정한 날(팀 설정의 문자 발송일, 기본 매월 1일,
  // 한국 시간)에 팀당 달마다 한 번만 보낸다. 한 번 보낸 달에는 다른 일정에서 눌러도
  // 다시 나가지 않는다.
  const today = todayStr();
  const smsDay = await getSmsDay(admin.teamId);
  if (Number(today.slice(8, 10)) !== smsDay) {
    return Response.json(
      { error: `미투표자 문자는 매월 ${smsDay}일에만 보낼 수 있어요.` },
      { status: 403 }
    );
  }
  const month = today.slice(0, 7);
  const settingKey = `nonvoter_sms_month_${admin.teamId}`;
  const previous = await getAppSetting(settingKey).catch(() => null);
  if (previous === month) {
    return Response.json(
      { error: `이번 달에는 이미 문자를 보냈어요. 다음 달 ${smsDay}일에 다시 보낼 수 있어요.` },
      { status: 409 }
    );
  }
  // 두 번 눌러도 한 번만 나가도록 보내기 전에 먼저 이번 달로 표시해 둔다.
  await setAppSetting(settingKey, month);

  const { id } = await params;
  const event = await getEvent(admin.teamId, Number(id));
  if (!event) {
    return Response.json({ error: "일정을 찾을 수 없어요." }, { status: 404 });
  }
  const team = await getTeamById(admin.teamId);

  const [votes, members] = await Promise.all([
    getVotes(admin.teamId, event.id),
    listMembers(admin.teamId),
  ]);
  const votedIds = new Set(votes.map((v) => v.memberId));
  const nonVoters = members.filter((m) => !m.isGuest && !votedIds.has(m.id));

  const message = `[${team?.name ?? "팀"}] "${event.title}"(${formatDate(event.date, event.time)}) 일정에 아직 투표하지 않으셨어요. 투표 부탁드립니다!!`;

  const sent: string[] = [];
  const failed: string[] = [];
  const skippedNoPhone: string[] = [];

  for (const m of nonVoters) {
    if (!m.phone) {
      skippedNoPhone.push(m.name);
      continue;
    }
    try {
      await sendSms(m.phone, message);
      sent.push(m.name);
    } catch {
      failed.push(m.name);
    }
  }

  // 한 명도 못 보냈으면(연결 문제 등) 이번 달 발송으로 치지 않고 다시 시도할 수 있게 되돌린다.
  if (sent.length === 0) await setAppSetting(settingKey, previous ?? "");

  return Response.json({ sent, failed, skippedNoPhone });
}
