import { requireAdmin } from "@/lib/auth";
import { deleteTeam, getTeamBySlug, listTeams, renameTeamSlug } from "@/lib/db";

const SLUG_RE = /^[a-z0-9-]{3,30}$/;

// 이관 테스트 중 생긴 팀을 정리하거나 slug를 바로잡을 때 쓰는 운영 도구.
// 플랫폼 전체를 관리하는 소유자가 쓰는 거라, 현재 로그인한 팀이 아니라
// teamId로 임의의 팀을 다룬다 — requireAdmin()으로 "운영진으로 로그인은
// 했는지"만 확인한다.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  }
  return Response.json(await listTeams());
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  }
  const body = await request.json();
  const teamId = Number(body?.teamId);
  const newSlug = String(body?.newSlug ?? "").trim().toLowerCase();
  if (!teamId || !SLUG_RE.test(newSlug)) {
    return Response.json(
      { error: "teamId와 올바른 slug(영문 소문자·숫자·하이픈 3~30자)를 입력해 주세요." },
      { status: 400 }
    );
  }
  try {
    const existing = await getTeamBySlug(newSlug);
    if (existing && existing.id !== teamId) {
      return Response.json({ error: "이미 사용 중인 팀 코드예요." }, { status: 409 });
    }
    await renameTeamSlug(teamId, newSlug);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "변경에 실패했어요." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  }
  const body = await request.json();
  const teamId = Number(body?.teamId);
  if (!teamId) {
    return Response.json({ error: "teamId를 입력해 주세요." }, { status: 400 });
  }
  try {
    await deleteTeam(teamId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "삭제에 실패했어요." },
      { status: 500 }
    );
  }
}
