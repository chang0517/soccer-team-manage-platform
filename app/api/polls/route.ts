import { getSessionUser } from "@/lib/auth";
import {
  createPoll,
  getAllPollOptions,
  getAllPollVotes,
  listMembers,
  listPolls,
} from "@/lib/db";
import { buildPollDetails } from "@/lib/polls";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const viewerMemberId = Number(
    new URL(request.url).searchParams.get("memberId")
  );
  const [polls, options, votes, members] = await Promise.all([
    listPolls(session.teamId),
    getAllPollOptions(session.teamId),
    getAllPollVotes(session.teamId),
    listMembers(session.teamId),
  ]);
  return Response.json(
    buildPollDetails(
      polls,
      options,
      votes,
      members,
      Number.isFinite(viewerMemberId) && viewerMemberId > 0 ? viewerMemberId : null
    )
  );
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !session.memberId) {
    return Response.json(
      { error: "멤버 프로필과 연결된 계정만 투표를 만들 수 있어요." },
      { status: 403 }
    );
  }
  const body = await request.json();
  const title = String(body?.title ?? "").trim();
  const options: string[] = Array.isArray(body?.options)
    ? body.options.map((o: unknown) => String(o).trim()).filter(Boolean)
    : [];
  if (!title || options.length < 2) {
    return Response.json(
      { error: "제목과 보기 2개 이상을 입력해 주세요." },
      { status: 400 }
    );
  }
  const multiSelect = body?.multiSelect !== false;
  const poll = await createPoll(session.teamId, title, options, session.memberId, multiSelect);
  return Response.json(poll, { status: 201 });
}
