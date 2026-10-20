import { getTeamById, getUserById } from "./db";

// 플랫폼 마스터 = 모든 팀에 승인 없이 운영진으로 들어갈 수 있는 소유자 계정.
// Vercel 환경변수 MASTER_ACCOUNTS에 "팀코드:아이디"를 쉼표로 적어 지정한다
// (예: raven-fc:chang0517). 아이디만으로 정하면 누구나 다른 팀에 같은 아이디로
// 가입해 마스터가 될 수 있어서, 반드시 팀코드까지 함께 맞아야 한다.
function masterIdentities(): Set<string> {
  return new Set(
    (process.env.MASTER_ACCOUNTS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isMasterIdentity(teamSlug: string, username: string): boolean {
  return masterIdentities().has(`${teamSlug}:${username}`.toLowerCase());
}

/** 그 계정이 지금도 승인된 운영진이고 마스터 목록에 있는지 DB에서 다시 확인한다. */
export async function isMasterAccount(teamId: number, userId: number): Promise<boolean> {
  if (masterIdentities().size === 0) return false;
  const [user, team] = await Promise.all([getUserById(teamId, userId), getTeamById(teamId)]);
  if (!user || !team) return false;
  if (user.status !== "approved" || user.role !== "admin") return false;
  return isMasterIdentity(team.slug, user.username);
}
