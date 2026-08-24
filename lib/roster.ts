import type { PosGroup } from "./types";

// 초기 명단과 포지션 선호(1순위/2순위). 각자 멤버 탭에서 수정 가능.
// TODO(멀티테넌트): 팀마다 명단이 다르므로 이 하드코딩된 배열은
// team_id 스코프의 members 테이블로 옮겨야 한다. 그 전까지는 빈 배열.
export const ROSTER: [string, PosGroup, PosGroup][] = [];
