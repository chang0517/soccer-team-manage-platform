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
  PhoneVerificationRow,
  Poll,
  PollOption,
  PollVoteRow,
  PosGroup,
  RecordRow,
  TacticsJobRow,
  TacticsScene,
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
  return usePg ? pg.getTeamBySlug(slug) : sqlite.getTeamBySlug(slug);
}
export async function getTeamById(id: number): Promise<TeamRow | null> {
  return usePg ? pg.getTeamById(id) : sqlite.getTeamById(id);
}
export async function createTeam(t: { slug: string; name: string }): Promise<TeamRow> {
  return usePg ? pg.createTeam(t) : sqlite.createTeam(t);
}
export async function listTeams(): Promise<TeamRow[]> {
  return usePg ? pg.listTeams() : sqlite.listTeams();
}
export async function updateTeamFineSettings(
  teamId: number,
  patch: { fineAccount?: string; fineAmount?: string }
) {
  return usePg
    ? pg.updateTeamFineSettings(teamId, patch)
    : sqlite.updateTeamFineSettings(teamId, patch);
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
    "id" | "squad" | "scrimmageSquad" | "scored" | "conceded" | "equipmentReminderSent"
  >
): Promise<EventItem> {
  return usePg ? pg.createEvent(teamId, e) : sqlite.createEvent(teamId, e);
}
export async function updateEvent(teamId: number, id: number, patch: Partial<EventItem>) {
  return usePg ? pg.updateEvent(teamId, id, patch) : sqlite.updateEvent(teamId, id, patch);
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

export async function listTacticsJobs(teamId: number): Promise<TacticsJobRow[]> {
  return usePg ? pg.listTacticsJobs(teamId) : sqlite.listTacticsJobs(teamId);
}
export async function createTacticsJob(
  teamId: number,
  userId: number,
  description: string,
  model: string
): Promise<TacticsJobRow> {
  return usePg
    ? pg.createTacticsJob(teamId, userId, description, model)
    : sqlite.createTacticsJob(teamId, userId, description, model);
}
export async function getTacticsJob(teamId: number, id: number): Promise<TacticsJobRow | null> {
  return usePg ? pg.getTacticsJob(teamId, id) : sqlite.getTacticsJob(teamId, id);
}
export async function completeTacticsJob(
  id: number,
  result: TacticsScene,
  rawResponse: string | null
) {
  return usePg
    ? pg.completeTacticsJob(id, result, rawResponse)
    : sqlite.completeTacticsJob(id, result, rawResponse);
}
export async function failTacticsJob(id: number, error: string, rawResponse: string | null) {
  return usePg
    ? pg.failTacticsJob(id, error, rawResponse)
    : sqlite.failTacticsJob(id, error, rawResponse);
}
export async function cancelTacticsJob(id: number) {
  return usePg ? pg.cancelTacticsJob(id) : sqlite.cancelTacticsJob(id);
}
export async function deleteTacticsJob(teamId: number, id: number) {
  return usePg ? pg.deleteTacticsJob(teamId, id) : sqlite.deleteTacticsJob(teamId, id);
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
export async function deleteHistoricalStats(teamId: number, memberId: number) {
  return usePg
    ? pg.deleteHistoricalStats(teamId, memberId)
    : sqlite.deleteHistoricalStats(teamId, memberId);
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
