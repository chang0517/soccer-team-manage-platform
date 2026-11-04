import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { getTeamBySlug, getUserByUsername } from "@/lib/db";
import { isMasterIdentity, masterTeamSlugsFor } from "@/lib/master";
import type { SessionUser } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const teamSlug = String(body?.teamSlug ?? "").trim();
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  try {
    const team = await getTeamBySlug(teamSlug);
    if (!team) {
      return Response.json({ error: "팀 코드를 확인해 주세요." }, { status: 404 });
    }

    // 마스터 계정의 아이디·비밀번호면 어느 팀 로그인 화면에서든 그 팀에 마스터로 바로
    // 들어간다. 비밀번호까지 마스터 계정 것과 같아야 하므로, 같은 아이디로 다른 팀에
    // 가입해 둔 사칭 계정은 해당하지 않는다(그 계정은 평소대로 자기 팀에만 로그인).
    for (const homeSlug of masterTeamSlugsFor(username)) {
      const homeTeam = await getTeamBySlug(homeSlug);
      const home = homeTeam ? await getUserByUsername(homeTeam.id, username) : null;
      if (
        !homeTeam ||
        !home ||
        home.status !== "approved" ||
        home.role !== "admin" ||
        !isMasterIdentity(homeTeam.slug, home.username) ||
        !(await verifyPassword(password, home.passwordHash))
      ) {
        continue;
      }
      const sessionUser: SessionUser =
        homeTeam.id === team.id
          ? {
              id: home.id,
              teamId: home.teamId,
              username: home.username,
              displayName: home.displayName,
              role: home.role,
              memberId: home.memberId,
            }
          : {
              id: -1,
              teamId: team.id,
              username: home.username,
              displayName: home.displayName,
              role: "admin",
              memberId: null,
              masterOf: { teamId: home.teamId, id: home.id },
            };
      await setSessionCookie(sessionUser);
      return Response.json({ ...sessionUser, token: createSessionToken(sessionUser) });
    }

    const user = await getUserByUsername(team.id, username);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return Response.json(
        { error: "아이디 또는 비밀번호가 올바르지 않아요." },
        { status: 401 }
      );
    }
    if (user.status === "pending") {
      return Response.json(
        { error: "아직 운영진 승인 대기 중이에요." },
        { status: 403 }
      );
    }
    if (user.status === "rejected") {
      return Response.json({ error: "가입이 거절됐어요." }, { status: 403 });
    }

    const sessionUser = {
      id: user.id,
      teamId: user.teamId,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      memberId: user.memberId,
    };
    await setSessionCookie(sessionUser);
    // 웹은 위 httpOnly 쿠키를 쓰고, 네이티브 앱은 쿠키 저장소가 없어서
    // 이 token을 직접 저장했다가 Authorization: Bearer로 보낸다.
    return Response.json({ ...sessionUser, token: createSessionToken(sessionUser) });
  } catch (e) {
    console.error("POST /api/auth/login failed", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "로그인에 실패했어요." },
      { status: 500 }
    );
  }
}
