import { requireMaster } from "@/lib/auth";
import { listTeams } from "@/lib/db";

// 마스터가 들어갈 수 있는 전체 팀 목록. 로고는 용량이 커서 이미지 주소로 내려준다.
export async function GET() {
  const master = await requireMaster();
  if (!master) return Response.json({ error: "마스터만 이용할 수 있어요." }, { status: 403 });
  const teams = await listTeams();
  return Response.json({
    currentTeamId: master.session.teamId,
    homeTeamId: master.origin.teamId,
    teams: teams.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      hasLogo: !!t.logoUrl,
      createdAt: t.createdAt,
    })),
  });
}
