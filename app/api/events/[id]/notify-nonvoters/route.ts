import { requireAdmin } from "@/lib/auth";
import { getEvent, getTeamById, getVotes, listMembers } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { sendSms } from "@/lib/sms";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 보낼 수 있어요." }, { status: 403 });
  }

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

  return Response.json({ sent, failed, skippedNoPhone });
}
