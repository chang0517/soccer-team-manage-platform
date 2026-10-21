import { getSessionUser } from "@/lib/auth";
import { getTeamById, getTeamBySlug } from "@/lib/db";

// 홈 화면에 앱을 설치할 때(안드로이드 크롬 등) 읽는 앱 정보. 로그인한 팀이
// 있으면 그 팀 이름과 로고로 내려주고, 로그인 전이거나 로고가 없으면 기본
// "Team Manager" 정보를 준다. 팀마다 id가 달라서 한 기기에 여러 팀 앱을 따로
// 설치할 수 있다.
// 로그인한 팀마다 내용이 달라서 빌드 때 한 번 만들어 두지 않고 요청마다 만든다.
export const dynamic = "force-dynamic";

const DEFAULT_ICONS = [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

const BASE = {
  lang: "ko",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#10151f",
  theme_color: "#1e3a8a",
};

export async function GET(request: Request) {
  let manifest: Record<string, unknown> = {
    ...BASE,
    id: "/",
    name: "Team Manager",
    short_name: "Team Manager",
    description: "팀 일정·스쿼드·기록 관리",
    icons: DEFAULT_ICONS,
  };

  try {
    // 브라우저는 앱 정보 파일을 로그인 쿠키 없이 가져오는 경우가 많아서(웹앱
    // 표준상 기본값), 화면이 주소에 팀 코드(?team=)를 실어 보낸다. 팀 이름·로고는
    // 로그인 전 팀 선택 화면에도 공개돼 있어 주소로 받아도 안전하다. 코드가 없으면
    // 쿠키의 로그인 팀으로 대신한다.
    const slug = new URL(request.url).searchParams.get("team");
    let team = slug ? await getTeamBySlug(slug) : null;
    if (!team) {
      const session = await getSessionUser();
      team = session ? await getTeamById(session.teamId) : null;
    }
    if (team?.logoUrl) {
      // 로고가 바뀌면 v가 달라져서 휴대폰이 새 아이콘을 받아간다.
      const v = `${team.logoUrl.length}-${team.logoUrl.slice(-24).replace(/[^A-Za-z0-9]/g, "")}`;
      const icon = (size: number, maskable = false) =>
        `/api/teams/${encodeURIComponent(team.slug)}/icon?size=${size}${maskable ? "&maskable=1" : ""}&v=${v}`;
      manifest = {
        ...BASE,
        id: `/?team=${encodeURIComponent(team.slug)}`,
        name: team.name,
        short_name: team.name.length > 12 ? team.name.slice(0, 12) : team.name,
        description: `${team.name} 일정·스쿼드·기록 관리`,
        icons: [
          { src: icon(192), sizes: "192x192", type: "image/png", purpose: "any" },
          { src: icon(512), sizes: "512x512", type: "image/png", purpose: "any" },
          { src: icon(512, true), sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      };
    }
  } catch (e) {
    // 팀 정보를 못 읽어도 설치 정보는 기본값으로 계속 내려준다.
    console.error("[manifest] team lookup failed:", e);
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "private, no-cache",
    },
  });
}
