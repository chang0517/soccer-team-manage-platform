import { withTeamLogo } from "./teamLogos";
import * as sqlite from "./sqlite";
import * as pg from "./pg";
import type {
  AnnouncementRow,
  AppUser,
  CommentRow,
  EventItem,
  HallOfFameRow,
  HistoricalStats,
  Member,
  MvpVoteRow,
  OpponentKitRow,
  PhoneVerificationRow,
  Poll,
  PollOption,
  PollVoteRow,
  PosGroup,
  QuarterRecordEntry,
  RecordRow,
  ScoreRules,
  SquadData,
  TeamReminder,
  TeamRow,
  UserRole,
  UserStatus,
  VerificationPurpose,
  VoteRow,
  VoteStatus,
} from "./types";

// DATABASE_URL이 있으면 Postgres(Supabase), 없으면 로컬 SQLite를 쓴다.
const usePg = !!process.env.DATABASE_URL;

// ---------- teams ----------
export async function getTeamBySlug(slug: string): Promise<TeamRow | null> {
  return withTeamLogo(await (usePg ? pg.getTeamBySlug(slug) : sqlite.getTeamBySlug(slug)));
}
export async function getTeamById(id: number): Promise<TeamRow | null> {
  return withTeamLogo(await (usePg ? pg.getTeamById(id) : sqlite.getTeamById(id)));
}
export async function createTeam(t: { slug: string; name: string }): Promise<TeamRow> {
  return usePg ? pg.createTeam(t) : sqlite.createTeam(t);
}
export async function listTeams(): Promise<TeamRow[]> {
  return (await (usePg ? pg.listTeams() : sqlite.listTeams())).map((t) => withTeamLogo(t));
}
export async function updateTeamFineSettings(
  teamId: number,
  patch: { fineAccount?: string; fineAmount?: string }
) {
  return usePg
    ? pg.updateTeamFineSettings(teamId, patch)
    : sqlite.updateTeamFineSettings(teamId, patch);
}
export async function updateTeamScoreRules(teamId: number, patch: Partial<ScoreRules>) {
  return usePg
    ? pg.updateTeamScoreRules(teamId, patch)
    : sqlite.updateTeamScoreRules(teamId, patch);
}
export async function updateTeamLogo(teamId: number, logoUrl: string | null) {
  return usePg ? pg.updateTeamLogo(teamId, logoUrl) : sqlite.updateTeamLogo(teamId, logoUrl);
}

export async function updateTeamName(teamId: number, name: string) {
  return usePg ? pg.updateTeamName(teamId, name) : sqlite.updateTeamName(teamId, name);
}
export async function renameTeamSlug(teamId: number, newSlug: string) {
  return usePg ? pg.renameTeamSlug(teamId, newSlug) : sqlite.renameTeamSlug(teamId, newSlug);
}

export async function deleteTeam(teamId: number) {
  return usePg ? pg.deleteTeam(teamId) : sqlite.deleteTeam(teamId);
}

export async function listMembers(teamId: number): Promise<Member[]> {
  return usePg ? pg.listMembers(teamId) : sqlite.listMembers(teamId);
}
export async function getMember(teamId: number, id: number): Promise<Member | null> {
  return usePg ? pg.getMember(teamId, id) : sqlite.getMember(teamId, id);
}
export async function createMember(teamId: number, m: Omit<Member, "id">): Promise<Member> {
  return usePg ? pg.createMember(teamId, m) : sqlite.createMember(teamId, m);
}
export async function updateMember(teamId: number, id: number, m: Omit<Member, "id">) {
  return usePg ? pg.updateMember(teamId, id, m) : sqlite.updateMember(teamId, id, m);
}
export async function deleteMember(teamId: number, id: number) {
  return usePg ? pg.deleteMember(teamId, id) : sqlite.deleteMember(teamId, id);
}

export async function listEvents(teamId: number): Promise<EventItem[]> {
  return usePg ? pg.listEvents(teamId) : sqlite.listEvents(teamId);
}
export async function getEvent(teamId: number, id: number): Promise<EventItem | null> {
  return usePg ? pg.getEvent(teamId, id) : sqlite.getEvent(teamId, id);
}
export async function createEvent(
  teamId: number,
  e: Omit<
    EventItem,
    | "id"
    | "squad"
    | "scrimmageSquad"
    | "scored"
    | "conceded"
    | "equipmentReminderSent"
    | "mvpOpenNotified"
    | "mvpResultNotified"
  >
): Promise<EventItem> {
  return usePg ? pg.createEvent(teamId, e) : sqlite.createEvent(teamId, e);
}
export async function updateEvent(teamId: number, id: number, patch: Partial<EventItem>) {
  return usePg ? pg.updateEvent(teamId, id, patch) : sqlite.updateEvent(teamId, id, patch);
}
export async function mutateEventRecordLog(
  teamId: number,
  id: number,
  fn: (log: EventItem["recordLog"]) => {
    scored: number | null;
    conceded: number | null;
    recordLog: QuarterRecordEntry[];
  }
): Promise<QuarterRecordEntry[] | null> {
  return usePg
    ? pg.mutateEventRecordLog(teamId, id, fn)
    : sqlite.mutateEventRecordLog(teamId, id, fn);
}
export async function mutateEventSquad(
  teamId: number,
  id: number,
  field: "squad" | "scrimmageSquad",
  fn: (cur: SquadData | null) => SquadData | null
): Promise<{ before: SquadData | null; after: SquadData | null } | null> {
  return usePg
    ? pg.mutateEventSquad(teamId, id, field, fn)
    : sqlite.mutateEventSquad(teamId, id, field, fn);
}
export async function getAppSetting(key: string): Promise<string | null> {
  return usePg ? pg.getAppSetting(key) : sqlite.getAppSetting(key);
}
export async function setAppSetting(key: string, value: string) {
  return usePg ? pg.setAppSetting(key, value) : sqlite.setAppSetting(key, value);
}
export async function listReminders(teamId: number | null) {
  return usePg ? pg.listReminders(teamId) : sqlite.listReminders(teamId);
}
export async function createReminder(teamId: number, r: Omit<TeamReminder, "id">) {
  return usePg ? pg.createReminder(teamId, r) : sqlite.createReminder(teamId, r);
}
export async function deleteReminder(teamId: number, id: number) {
  return usePg ? pg.deleteReminder(teamId, id) : sqlite.deleteReminder(teamId, id);
}
export async function claimReminderSend(teamId: number, reminderId: number, period: string) {
  return usePg
    ? pg.claimReminderSend(teamId, reminderId, period)
    : sqlite.claimReminderSend(teamId, reminderId, period);
}
export async function claimEventFlag(
  teamId: number,
  id: number,
  flag: "mvp_open_notified" | "mvp_result_notified"
): Promise<boolean> {
  return usePg ? pg.claimEventFlag(teamId, id, flag) : sqlite.claimEventFlag(teamId, id, flag);
}
export async function deleteEvent(teamId: number, id: number) {
  return usePg ? pg.deleteEvent(teamId, id) : sqlite.deleteEvent(teamId, id);
}

export async function getVotes(teamId: number, eventId: number): Promise<VoteRow[]> {
  return usePg ? pg.getVotes(teamId, eventId) : sqlite.getVotes(teamId, eventId);
}
export async function getVotesForEvents(teamId: number, eventIds: number[]): Promise<VoteRow[]> {
  return usePg
    ? pg.getVotesForEvents(teamId, eventIds)
    : sqlite.getVotesForEvents(teamId, eventIds);
}
export async function setVote(
  teamId: number,
  eventId: number,
  memberId: number,
  status: VoteStatus
) {
  return usePg
    ? pg.setVote(teamId, eventId, memberId, status)
    : sqlite.setVote(teamId, eventId, memberId, status);
}

export async function deleteVote(teamId: number, eventId: number, memberId: number) {
  return usePg
    ? pg.deleteVote(teamId, eventId, memberId)
    : sqlite.deleteVote(teamId, eventId, memberId);
}

export async function getRecords(teamId: number, eventId: number): Promise<RecordRow[]> {
  return usePg ? pg.getRecords(teamId, eventId) : sqlite.getRecords(teamId, eventId);
}
export async function saveRecords(teamId: number, eventId: number, records: RecordRow[]) {
  return usePg
    ? pg.saveRecords(teamId, eventId, records)
    : sqlite.saveRecords(teamId, eventId, records);
}
export async function getAllRecords(teamId: number): Promise<RecordRow[]> {
  return usePg ? pg.getAllRecords(teamId) : sqlite.getAllRecords(teamId);
}

export async function getMvpVotes(teamId: number, eventId: number): Promise<MvpVoteRow[]> {
  return usePg ? pg.getMvpVotes(teamId, eventId) : sqlite.getMvpVotes(teamId, eventId);
}
export async function setMvpVote(
  teamId: number,
  eventId: number,
  voterId: number,
  voteeId: number
) {
  return usePg
    ? pg.setMvpVote(teamId, eventId, voterId, voteeId)
    : sqlite.setMvpVote(teamId, eventId, voterId, voteeId);
}
export async function getAllMvpVotes(teamId: number): Promise<MvpVoteRow[]> {
  return usePg ? pg.getAllMvpVotes(teamId) : sqlite.getAllMvpVotes(teamId);
}

export async function countUsers(teamId: number): Promise<number> {
  return usePg ? pg.countUsers(teamId) : sqlite.countUsers(teamId);
}
export async function getUserByUsername(
  teamId: number,
  username: string
): Promise<(AppUser & { passwordHash: string }) | null> {
  return usePg
    ? pg.getUserByUsername(teamId, username)
    : sqlite.getUserByUsername(teamId, username);
}
/**
 * 계정을 지운다. withMember면 연결된 선수 프로필과 그 선수의 모든 흔적(투표·
 * 기록·MVP·댓글·역대 기록·만든 투표·알림 구독, 명예의 전당 지정, 일정 안의
 * 스쿼드 자리와 쿼터별 득점·어시)까지 함께 지운다. 스쿼드 자리는 빈칸,
 * 득점은 "득점자 미기록"으로 남겨 스코어는 그대로 유지한다.
 */
export async function deleteAccount(teamId: number, userId: number, withMember: boolean) {
  const user = await getUserById(teamId, userId);
  if (!user) return null;
  const memberId = withMember ? user.memberId : null;
  if (memberId != null) {
    const { withoutMember } = await import("./squad");
    const { recordLogWithoutMember } = await import("./records");
    for (const ev of await listEvents(teamId)) {
      for (const field of ["squad", "scrimmageSquad"] as const) {
        if (ev[field] && JSON.stringify(ev[field]).includes(String(memberId))) {
          await mutateEventSquad(teamId, ev.id, field, (cur) => (cur ? withoutMember(cur, memberId) : cur));
        }
      }
      if (ev.recordLog && JSON.stringify(ev.recordLog).includes(String(memberId))) {
        await mutateEventRecordLog(teamId, ev.id, (cur) => {
          const recordLog = recordLogWithoutMember(cur ?? [], memberId);
          return { scored: ev.scored, conceded: ev.conceded, recordLog };
        });
      }
    }
    await (usePg ? pg.purgeMemberRows(teamId, memberId) : sqlite.purgeMemberRows(teamId, memberId));
  }
  await (usePg ? pg.deleteUserRow(teamId, userId) : sqlite.deleteUserRow(teamId, userId));
  return { user, memberDeleted: memberId != null };
}

export async function getUserById(teamId: number, id: number): Promise<AppUser | null> {
  return usePg ? pg.getUserById(teamId, id) : sqlite.getUserById(teamId, id);
}
export async function listUsersByStatus(
  teamId: number,
  status: UserStatus
): Promise<AppUser[]> {
  return usePg
    ? pg.listUsersByStatus(teamId, status)
    : sqlite.listUsersByStatus(teamId, status);
}
export async function getUsersByMemberId(teamId: number, memberId: number): Promise<AppUser[]> {
  return usePg
    ? pg.getUsersByMemberId(teamId, memberId)
    : sqlite.getUsersByMemberId(teamId, memberId);
}
export async function createUser(
  teamId: number,
  u: {
    username: string;
    passwordHash: string;
    displayName: string;
    role: UserRole;
    status: UserStatus;
    memberId: number | null;
    draftPos1?: PosGroup | null;
    draftPos2?: PosGroup | null;
    draftBackNo?: number | null;
    draftPhone?: string | null;
  }
): Promise<AppUser> {
  return usePg ? pg.createUser(teamId, u) : sqlite.createUser(teamId, u);
}
export async function updateUserStatus(
  teamId: number,
  id: number,
  status: UserStatus,
  memberId: number | null,
  role?: UserRole
) {
  return usePg
    ? pg.updateUserStatus(teamId, id, status, memberId, role)
    : sqlite.updateUserStatus(teamId, id, status, memberId, role);
}
export async function updateUserPassword(teamId: number, id: number, passwordHash: string) {
  return usePg
    ? pg.updateUserPassword(teamId, id, passwordHash)
    : sqlite.updateUserPassword(teamId, id, passwordHash);
}

export async function createPhoneVerification(
  teamId: number,
  v: { phone: string; purpose: VerificationPurpose; code: string; expiresAt: string }
): Promise<PhoneVerificationRow> {
  return usePg
    ? pg.createPhoneVerification(teamId, v)
    : sqlite.createPhoneVerification(teamId, v);
}
export async function getLatestPhoneVerification(
  teamId: number,
  phone: string,
  purpose: VerificationPurpose
): Promise<PhoneVerificationRow | null> {
  return usePg
    ? pg.getLatestPhoneVerification(teamId, phone, purpose)
    : sqlite.getLatestPhoneVerification(teamId, phone, purpose);
}
export async function incrementPhoneVerificationAttempts(id: number) {
  return usePg
    ? pg.incrementPhoneVerificationAttempts(id)
    : sqlite.incrementPhoneVerificationAttempts(id);
}
export async function consumePhoneVerification(id: number) {
  return usePg
    ? pg.consumePhoneVerification(id)
    : sqlite.consumePhoneVerification(id);
}

export async function getComments(teamId: number, eventId: number): Promise<CommentRow[]> {
  return usePg ? pg.getComments(teamId, eventId) : sqlite.getComments(teamId, eventId);
}
export async function addComment(
  teamId: number,
  eventId: number,
  memberId: number,
  body: string
): Promise<CommentRow> {
  return usePg
    ? pg.addComment(teamId, eventId, memberId, body)
    : sqlite.addComment(teamId, eventId, memberId, body);
}
export async function getComment(teamId: number, id: number): Promise<CommentRow | null> {
  return usePg ? pg.getComment(teamId, id) : sqlite.getComment(teamId, id);
}
export async function deleteComment(teamId: number, id: number) {
  return usePg ? pg.deleteComment(teamId, id) : sqlite.deleteComment(teamId, id);
}

export async function getAllHistoricalStats(teamId: number): Promise<HistoricalStats[]> {
  return usePg ? pg.getAllHistoricalStats(teamId) : sqlite.getAllHistoricalStats(teamId);
}
export async function upsertHistoricalStats(teamId: number, stats: HistoricalStats) {
  return usePg
    ? pg.upsertHistoricalStats(teamId, stats)
    : sqlite.upsertHistoricalStats(teamId, stats);
}
export async function deleteHistoricalStats(teamId: number, memberId: number, year: number) {
  return usePg
    ? pg.deleteHistoricalStats(teamId, memberId, year)
    : sqlite.deleteHistoricalStats(teamId, memberId, year);
}

export async function listAnnouncements(teamId: number): Promise<AnnouncementRow[]> {
  return usePg ? pg.listAnnouncements(teamId) : sqlite.listAnnouncements(teamId);
}
export async function getAnnouncement(
  teamId: number,
  id: number
): Promise<AnnouncementRow | null> {
  return usePg ? pg.getAnnouncement(teamId, id) : sqlite.getAnnouncement(teamId, id);
}
export async function createAnnouncement(
  teamId: number,
  a: Omit<AnnouncementRow, "id" | "createdAt" | "updatedAt">
): Promise<AnnouncementRow> {
  return usePg ? pg.createAnnouncement(teamId, a) : sqlite.createAnnouncement(teamId, a);
}
export async function updateAnnouncement(
  teamId: number,
  id: number,
  patch: { title: string; body: string; feedbackDate?: string | null }
) {
  return usePg
    ? pg.updateAnnouncement(teamId, id, patch)
    : sqlite.updateAnnouncement(teamId, id, patch);
}
export async function deleteAnnouncement(teamId: number, id: number) {
  return usePg ? pg.deleteAnnouncement(teamId, id) : sqlite.deleteAnnouncement(teamId, id);
}

export async function listHallOfFame(teamId: number): Promise<HallOfFameRow[]> {
  return usePg ? pg.listHallOfFame(teamId) : sqlite.listHallOfFame(teamId);
}
export async function upsertHallOfFame(
  teamId: number,
  entry: Omit<HallOfFameRow, "id">
): Promise<HallOfFameRow> {
  return usePg ? pg.upsertHallOfFame(teamId, entry) : sqlite.upsertHallOfFame(teamId, entry);
}
export async function deleteHallOfFame(teamId: number, id: number) {
  return usePg ? pg.deleteHallOfFame(teamId, id) : sqlite.deleteHallOfFame(teamId, id);
}

export async function listOpponentKits(teamId: number): Promise<OpponentKitRow[]> {
  return usePg ? pg.listOpponentKits(teamId) : sqlite.listOpponentKits(teamId);
}
export async function upsertOpponentKit(
  teamId: number,
  teamName: string,
  color: string
): Promise<OpponentKitRow> {
  return usePg
    ? pg.upsertOpponentKit(teamId, teamName, color)
    : sqlite.upsertOpponentKit(teamId, teamName, color);
}

export async function savePushSubscription(
  teamId: number,
  sub: { endpoint: string; p256dh: string; auth: string; memberId: number | null }
) {
  return usePg
    ? pg.savePushSubscription(teamId, sub)
    : sqlite.savePushSubscription(teamId, sub);
}
export async function getAllPushSubscriptions(teamId: number) {
  return usePg ? pg.getAllPushSubscriptions(teamId) : sqlite.getAllPushSubscriptions(teamId);
}
export async function deletePushSubscription(endpoint: string) {
  return usePg ? pg.deletePushSubscription(endpoint) : sqlite.deletePushSubscription(endpoint);
}

export async function listPolls(teamId: number): Promise<Poll[]> {
  return usePg ? pg.listPolls(teamId) : sqlite.listPolls(teamId);
}
export async function getPoll(teamId: number, id: number): Promise<Poll | null> {
  return usePg ? pg.getPoll(teamId, id) : sqlite.getPoll(teamId, id);
}
export async function getAllPollOptions(teamId: number): Promise<PollOption[]> {
  return usePg ? pg.getAllPollOptions(teamId) : sqlite.getAllPollOptions(teamId);
}
export async function createPoll(
  teamId: number,
  title: string,
  options: string[],
  createdBy: number,
  multiSelect: boolean
): Promise<Poll> {
  return usePg
    ? pg.createPoll(teamId, title, options, createdBy, multiSelect)
    : sqlite.createPoll(teamId, title, options, createdBy, multiSelect);
}
export async function setPollClosed(teamId: number, id: number, closed: boolean) {
  return usePg
    ? pg.setPollClosed(teamId, id, closed)
    : sqlite.setPollClosed(teamId, id, closed);
}
export async function addPollOption(
  teamId: number,
  pollId: number,
  label: string
): Promise<PollOption> {
  return usePg
    ? pg.addPollOption(teamId, pollId, label)
    : sqlite.addPollOption(teamId, pollId, label);
}
export async function deletePoll(teamId: number, id: number) {
  return usePg ? pg.deletePoll(teamId, id) : sqlite.deletePoll(teamId, id);
}
export async function getAllPollVotes(teamId: number): Promise<PollVoteRow[]> {
  return usePg ? pg.getAllPollVotes(teamId) : sqlite.getAllPollVotes(teamId);
}
export async function setPollVote(
  teamId: number,
  pollId: number,
  memberId: number,
  optionIds: number[]
) {
  return usePg
    ? pg.setPollVote(teamId, pollId, memberId, optionIds)
    : sqlite.setPollVote(teamId, pollId, memberId, optionIds);
}
