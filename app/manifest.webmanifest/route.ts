import { getSessionUser } from "@/lib/auth";
import { getTeamById } from "@/lib/db";

// 홈 화면에 앱을 설치할 때(안드로이드 크롬 등) 읽는 앱 정보. 로그인한 팀이
// 있으면 그 팀 이름과 로고로 내려주고, 로그인 전이거나 로고가 없으면 기본
// "Team Manager" 정보를 준다. 팀마다 id가 달라서 한 기기에 여러 팀 앱을 따로
// 설치할 수 있다.
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

export async function GET() {
  let manifest: Record<string, unknown> = {
    ...BASE,
    id: "/",
    name: "Team Manager",
    short_name: "Team Manager",
    description: "팀 일정·스쿼드·기록 관리",
    icons: DEFAULT_ICONS,
  };

  try {
    const session = await getSessionUser();
    const team = session ? await getTeamById(session.teamId) : null;
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
