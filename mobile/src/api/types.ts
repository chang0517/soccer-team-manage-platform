// 백엔드(lib/types.ts)의 타입 중 앱 화면에서 실제로 쓰는 것만 옮겨왔다.
// monorepo 패키지 공유까지는 이번 단계 범위 밖이라 일단 손으로 맞춰둔다 —
// 백엔드 타입이 바뀌면 여기도 같이 손봐야 한다.

export type UserRole = "admin" | "player";
export type UserStatus = "pending" | "approved" | "rejected";

export interface SessionUser {
  id: number;
  teamId: number;
  teamName: string;
  teamLogoUrl: string | null;
  username: string;
  displayName: string;
  role: UserRole;
  memberId: number | null;
}

export type PosGroup = "GK" | "CB" | "WB" | "DM" | "AM" | "WG" | "ST";

export interface Member {
  id: number;
  name: string;
  backNo: number | null;
  pos1: PosGroup;
  pos2: PosGroup;
  isGuest: boolean;
  phone: string | null;
}

export type VoteStatus = "attend" | "maybe" | "absent";

export interface VoteRow {
  eventId: number;
  memberId: number;
  status: VoteStatus;
}

export interface SquadSlotAssign {
  slotId: string;
  memberId: number | null;
  memberId2?: number | null;
}

export interface QuarterSquad {
  starters: SquadSlotAssign[];
  bench: number[];
}

export interface SquadData {
  quarters: QuarterSquad[];
  generatedAt: string;
  confirmed?: boolean;
  approvedBy?: number[];
}

export interface EventItem {
  id: number;
  title: string;
  type: "match" | "social";
  date: string;
  time: string;
  location: string;
  opponent: string;
  scored: number | null;
  conceded: number | null;
  notes: string;
  squad: SquadData | null;
}

export interface CommentRow {
  id: number;
  eventId: number;
  memberId: number;
  body: string;
  createdAt: string;
}

export type AnnouncementCategory = "notice" | "coach_feedback";

export interface AnnouncementRow {
  id: number;
  title: string;
  body: string;
  authorName: string;
  category: AnnouncementCategory;
  feedbackDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Poll {
  id: number;
  title: string;
  createdBy: number;
  createdAt: string;
  closed: boolean;
  multiSelect: boolean;
}

export interface PollOption {
  id: number;
  pollId: number;
  label: string;
  order: number;
}

export interface PollDetail extends Poll {
  creatorName: string;
  options: PollOption[];
  voteCounts: Record<number, number>;
  optionVoters: Record<number, string[]>;
  voterCount: number;
  myOptionIds: number[];
}

export interface RankingRow {
  member: Member;
  played: number;
  goals: number;
  assists: number;
  cleanCount: number;
  cleanPts: number;
  mvpCount: number;
  total: number;
  streak: number;
  streakType: "goal" | "assist" | null;
}
