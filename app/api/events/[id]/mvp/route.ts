import { getSessionUser } from "@/lib/auth";
import { getEvent, getMvpVotes, getVotes, setMvpVote } from "@/lib/db";
import { mvpPhase } from "@/lib/mvp";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { id } = await params;
  return Response.json(await getMvpVotes(session.teamId, Number(id)));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { id } = await params;
  const eventId = Number(id);
  const body = await request.json();
  // 투표자는 항상 로그인한 본인 — 요청에 담긴 voterId를 믿으면 다른 사람
  // 이름으로 투표할 수 있다.
  const voterId = session.memberId;
  const voteeId = Number(body.voteeId);
  if (voterId == null) {
    return Response.json(
      { error: "멤버 프로필과 연결된 계정만 투표할 수 있어요." },
      { status: 403 }
    );
  }
  if (!voteeId) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (voterId === voteeId) {
    return Response.json(
      { error: "본인에게는 투표할 수 없어요." },
      { status: 400 }
    );
  }
  const event = await getEvent(session.teamId, eventId);
  if (!event || event.type !== "match") {
    return Response.json({ error: "경기를 찾을 수 없어요." }, { status: 404 });
  }
  const phase = mvpPhase(event);
  if (phase !== "open") {
    return Response.json(
      {
        error:
          phase === "before"
            ? "MVP 투표는 경기가 끝나면 열려요."
            : "MVP 투표가 마감됐어요.",
      },
      { status: 403 }
    );
  }
  const votes = await getVotes(session.teamId, eventId);
  const attendIds = new Set(
    votes.filter((v) => v.status === "attend").map((v) => v.memberId)
  );
  if (!attendIds.has(voterId) || !attendIds.has(voteeId)) {
    return Response.json(
      { error: "경기 참여자만 MVP 투표를 할 수 있어요." },
      { status: 403 }
    );
  }
  await setMvpVote(session.teamId, eventId, voterId, voteeId);
  return Response.json({ ok: true });
}
