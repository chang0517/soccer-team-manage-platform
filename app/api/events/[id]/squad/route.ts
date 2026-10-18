import { requireAdmin } from "@/lib/auth";
import { getEvent, getVotes, listMembers, mutateEventSquad } from "@/lib/db";
import {
  asDraft,
  FORMATION_SLOTS,
  generateSquad,
  QUARTER_COUNT,
  SquadActionError,
  squadStatus,
} from "@/lib/squad";
import type { QuarterSquad } from "@/lib/types";

const LOCKED = "확정된 스쿼드예요. 고치려면 먼저 확정을 해제해 주세요.";

// 참석 투표 기준으로 A팀 스쿼드를 새로 만든다(작성 중 상태).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json(
      { error: "운영진만 스쿼드를 만들 수 있어요." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const eventId = Number(id);
  const event = await getEvent(admin.teamId, eventId);
  if (!event) return Response.json({ error: "not found" }, { status: 404 });

  const attendIds = new Set(
    (await getVotes(admin.teamId, eventId))
      .filter((v) => v.status === "attend")
      .map((v) => v.memberId)
  );
  const attendees = (await listMembers(admin.teamId)).filter((m) => attendIds.has(m.id));
  try {
    const result = await mutateEventSquad(admin.teamId, eventId, "squad", (cur) => {
      if (squadStatus(cur) === "confirmed") throw new SquadActionError(LOCKED);
      return generateSquad(attendees);
    });
    return Response.json(result?.after ?? null);
  } catch (e) {
    if (e instanceof SquadActionError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}

const SLOT_IDS = new Set(FORMATION_SLOTS.map((s) => s.id));
const isId = (v: unknown) => v === null || (typeof v === "number" && Number.isInteger(v));

function parseQuarters(raw: unknown): QuarterSquad[] | null {
  if (!Array.isArray(raw) || raw.length !== QUARTER_COUNT) return null;
  const out: QuarterSquad[] = [];
  for (const q of raw) {
    if (!q || !Array.isArray(q.starters) || !Array.isArray(q.bench)) return null;
    const starters = [];
    for (const s of q.starters) {
      if (!s || !SLOT_IDS.has(s.slotId) || !isId(s.memberId)) return null;
      if (s.memberId2 !== undefined && !isId(s.memberId2)) return null;
      starters.push(
        s.memberId2 !== undefined
          ? { slotId: s.slotId, memberId: s.memberId, memberId2: s.memberId2 }
          : { slotId: s.slotId, memberId: s.memberId }
      );
    }
    if (!q.bench.every((m: unknown) => typeof m === "number")) return null;
    out.push({ starters, bench: q.bench });
  }
  return out;
}

// 편집 화면의 라인업 저장(자동 저장). 확정된 스쿼드는 거절하고, 제출된
// 스쿼드는 라인업이 바뀌었으니 작성 중으로 되돌려 승인을 다시 받게 한다.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "스쿼드는 운영진만 수정할 수 있어요." }, { status: 403 });
  }
  const team = new URL(request.url).searchParams.get("team") === "B" ? "B" : "A";
  const { id } = await params;
  const quarters = parseQuarters((await request.json()).quarters);
  if (!quarters) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  try {
    const result = await mutateEventSquad(
      admin.teamId,
      Number(id),
      team === "B" ? "scrimmageSquad" : "squad",
      (cur) => {
        if (!cur) throw new SquadActionError("스쿼드가 없어요.");
        if (squadStatus(cur) === "confirmed") throw new SquadActionError(LOCKED);
        return { ...asDraft(cur), quarters };
      }
    );
    if (!result) return Response.json({ error: "일정을 찾을 수 없어요." }, { status: 404 });
    return Response.json({ squad: result.after });
  } catch (e) {
    if (e instanceof SquadActionError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
