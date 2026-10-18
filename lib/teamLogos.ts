import type { TeamRow } from "./types";

// 플랫폼으로 옮겨온 팀들이 예전 개별 앱에서 쓰던 로고. 운영진이 계정
// 설정에서 로고를 따로 올리지 않았으면(logo_url 없음) 이걸 팀 로고로 쓴다 —
// 이관하면서 로고 파일은 DB로 따라오지 않았기 때문. 팀 코드나 팀 이름으로
// 알아본다.
const BUNDLED_LOGOS: { match: RegExp; src: string }[] = [
  { match: /raven|레이븐/i, src: "/team-logos/raven.png" },
  { match: /blum|블룸/i, src: "/team-logos/blum.png" },
];

export function withTeamLogo<T extends TeamRow | null>(team: T): T {
  if (!team || team.logoUrl) return team;
  const bundled = BUNDLED_LOGOS.find((b) => b.match.test(team.slug) || b.match.test(team.name));
  return bundled ? { ...team, logoUrl: bundled.src } : team;
}
