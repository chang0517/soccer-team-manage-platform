import { listTeams } from "@/lib/db";

// 로그인·가입 화면의 팀 선택 목록(로그인 전에도 볼 수 있다). 로고는 용량이 큰
// data URI라 목록에 싣지 않고, 별도 이미지 주소(/api/teams/<slug>/logo)로
// 내려준다. v는 로고가 바뀌면 브라우저 캐시가 새로 받도록 붙이는 값.
export async function GET() {
  const teams = await listTeams();
  return Response.json(
    teams
      .map((t) => ({
        slug: t.slug,
        name: t.name,
        logo: t.logoUrl
          ? `/api/teams/${encodeURIComponent(t.slug)}/logo?v=${t.logoUrl.length}-${t.logoUrl.slice(-24).replace(/[^A-Za-z0-9]/g, "")}`
          : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    { headers: { "Cache-Control": "no-store" } }
  );
}
