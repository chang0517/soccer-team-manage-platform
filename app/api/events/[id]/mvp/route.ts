import { getSessionUser } from "@/lib/auth";
import { getMvpVotes, getVotes, setMvpVote } from "@/lib/db";

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
  const body = await request.json();
  if (!body.voterId || !body.voteeId) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (Number(body.voterId) === Number(body.voteeId)) {
    return Response.json(
      { error: "본인에게는 투표할 수 없어요." },
      { status: 400 }
    );
  }
  const votes = await getVotes(session.teamId, Number(id));
  const attendIds = new Set(
    votes.filter((v) => v.status === "attend").map((v) => v.memberId)
  );
  if (!attendIds.has(Number(body.voterId)) || !attendIds.has(Number(body.voteeId))) {
    return Response.json(
      { error: "경기 참여자만 MVP 투표를 할 수 있어요." },
      { status: 403 }
    );
  }
  await setMvpVote(session.teamId, Number(id), Number(body.voterId), Number(body.voteeId));
  return Response.json({ ok: true });
}
