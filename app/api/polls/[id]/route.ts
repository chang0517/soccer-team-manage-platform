import { getSessionUser } from "@/lib/auth";
import { deletePoll, getPoll, setPollClosed } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pollId = Number(id);
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const poll = await getPoll(session.teamId, pollId);
  if (!poll) return Response.json({ error: "not found" }, { status: 404 });

  const isOwner = session.memberId === poll.createdBy;
  if (!isOwner && session.role !== "admin") {
    return Response.json(
      { error: "투표를 만든 사람이나 운영진만 마감할 수 있어요." },
      { status: 403 }
    );
  }
  const body = await request.json();
  await setPollClosed(session.teamId, pollId, !!body.closed);
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pollId = Number(id);
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const poll = await getPoll(session.teamId, pollId);
  if (!poll) return Response.json({ error: "not found" }, { status: 404 });

  const isOwner = session.memberId === poll.createdBy;
  if (!isOwner && session.role !== "admin") {
    return Response.json(
      { error: "투표를 만든 사람이나 운영진만 삭제할 수 있어요." },
      { status: 403 }
    );
  }
  await deletePoll(session.teamId, pollId);
  return Response.json({ ok: true });
}
