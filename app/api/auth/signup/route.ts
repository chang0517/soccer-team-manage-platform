import { hashPassword } from "@/lib/auth";
import { createUser, getTeamBySlug, getUserByUsername } from "@/lib/db";
import { POS_GROUPS } from "@/lib/types";
import type { PosGroup } from "@/lib/types";

// 팀의 첫 운영진은 "/api/teams"(새 팀 만들기)로 만들어진다 — 여기(일반
// 가입)는 항상 pending 상태로 만들어서 그 팀 운영진의 승인을 거치게 한다.
export async function POST(request: Request) {
  const body = await request.json();
  const teamSlug = String(body?.teamSlug ?? "").trim();
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim();
  const pos1 = POS_GROUPS.includes(body?.pos1) ? (body.pos1 as PosGroup) : "CB";
  const pos2 = POS_GROUPS.includes(body?.pos2) ? (body.pos2 as PosGroup) : "WB";
  const backNo =
    body?.backNo === null || body?.backNo === undefined || body?.backNo === ""
      ? null
      : Number(body.backNo);
  const phone = typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null;

  if (username.length < 3 || password.length < 4 || !displayName) {
    return Response.json(
      { error: "아이디는 3자 이상, 비밀번호는 4자 이상, 이름을 입력해 주세요." },
      { status: 400 }
    );
  }

  const team = await getTeamBySlug(teamSlug);
  if (!team) {
    return Response.json({ error: "팀 코드를 확인해 주세요." }, { status: 404 });
  }
  if (await getUserByUsername(team.id, username)) {
    return Response.json({ error: "이미 사용 중인 아이디예요." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  await createUser(team.id, {
    username,
    passwordHash,
    displayName,
    role: "player",
    status: "pending",
    memberId: null,
    draftPos1: pos1,
    draftPos2: pos2,
    draftBackNo: backNo,
    draftPhone: phone,
  });

  return Response.json({ autoApproved: false });
}
