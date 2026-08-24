import { hashPassword, setSessionCookie } from "@/lib/auth";
import { createTeam, createUser, getTeamBySlug } from "@/lib/db";

const SLUG_RE = /^[a-z0-9-]{3,30}$/;

// 새 팀을 만든다. 이 요청을 보낸 사람이 그 팀의 첫 운영진(admin, 승인 완료
// 상태)이 된다 — 화이트리스트나 "첫 가입자 자동 승인" 같은 걸 따로 둘 필요
// 없이, 팀을 만든 사람 = 그 팀의 첫 운영진이라는 규칙 하나로 단순화했다.
// 그 뒤 팀원들은 이 팀의 teamSlug로 일반 가입(/api/auth/signup)해서
// 운영진 승인을 거친다.
export async function POST(request: Request) {
  const body = await request.json();
  const teamName = String(body?.teamName ?? "").trim();
  const teamSlug = String(body?.teamSlug ?? "")
    .trim()
    .toLowerCase();
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim();

  if (!teamName) {
    return Response.json({ error: "팀 이름을 입력해 주세요." }, { status: 400 });
  }
  if (!SLUG_RE.test(teamSlug)) {
    return Response.json(
      { error: "팀 코드는 영문 소문자·숫자·하이픈(-)만 사용해 3~30자로 입력해 주세요." },
      { status: 400 }
    );
  }
  if (username.length < 3 || password.length < 4 || !displayName) {
    return Response.json(
      { error: "아이디는 3자 이상, 비밀번호는 4자 이상, 이름을 입력해 주세요." },
      { status: 400 }
    );
  }
  if (await getTeamBySlug(teamSlug)) {
    return Response.json({ error: "이미 사용 중인 팀 코드예요." }, { status: 409 });
  }

  const team = await createTeam({ slug: teamSlug, name: teamName });
  const passwordHash = await hashPassword(password);
  const user = await createUser(team.id, {
    username,
    passwordHash,
    displayName,
    role: "admin",
    status: "approved",
    memberId: null,
  });

  await setSessionCookie({
    id: user.id,
    teamId: user.teamId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    memberId: user.memberId,
  });

  return Response.json({ ok: true, teamSlug: team.slug }, { status: 201 });
}
