// 이 이름으로 가입하면 자동으로 운영진(admin) 권한이 배정된다.
// 승인은 여전히 필요하고, 승인 화면에서 운영진이 역할을 바꿀 수도 있다.
// TODO(멀티테넌트): 팀마다 다른 화이트리스트가 필요하므로 이 하드코딩된
// 배열은 team_id 스코프의 DB 테이블로 옮겨야 한다. 그 전까지는 빈 배열
// (없어도 첫 가입자는 자동 운영진이 되는 기존 정책이 그대로 적용됨).
export const ADMIN_NAMES: string[] = [];

export function isWhitelistedAdminName(displayName: string): boolean {
  return ADMIN_NAMES.includes(displayName.trim());
}
