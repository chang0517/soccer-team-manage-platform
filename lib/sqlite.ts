import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type {
  AnnouncementCategory,
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
  SquadData,
  TacticsJobRow,
  TacticsJobStatus,
  TacticsScene,
  TeamRow,
  UserRole,
  UserStatus,
  VerificationPurpose,
  VoteRow,
  VoteStatus,
} from "./types";

const globalForDb = globalThis as unknown as { platformDb?: Database.Database };

function createDb(): Database.Database {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "platform.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      fine_account TEXT NOT NULL DEFAULT '',
      fine_amount TEXT NOT NULL DEFAULT '20,000원',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      back_no INTEGER,
      pos1 TEXT NOT NULL DEFAULT 'CB',
      pos2 TEXT NOT NULL DEFAULT 'WB',
      is_guest INTEGER NOT NULL DEFAULT 0,
      phone TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'match',
      date TEXT NOT NULL,
      time TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      opponent TEXT NOT NULL DEFAULT '',
      scored INTEGER,
      conceded INTEGER,
      squad TEXT,
      scrimmage_squad TEXT,
      notes TEXT NOT NULL DEFAULT '',
      duty_offense TEXT NOT NULL DEFAULT '',
      duty_defense TEXT NOT NULL DEFAULT '',
      water_duty TEXT NOT NULL DEFAULT '',
      icebox_duty TEXT NOT NULL DEFAULT '',
      record_log TEXT,
      equipment_reminder_sent INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS votes (
      team_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      PRIMARY KEY (event_id, member_id)
    );
    CREATE TABLE IF NOT EXISTS records (
      team_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      played INTEGER NOT NULL DEFAULT 0,
      goals INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      position TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (event_id, member_id)
    );
    CREATE TABLE IF NOT EXISTS mvp_votes (
      team_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      voter_id INTEGER NOT NULL,
      votee_id INTEGER NOT NULL,
      PRIMARY KEY (event_id, voter_id)
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      status TEXT NOT NULL DEFAULT 'pending',
      member_id INTEGER,
      created_at TEXT NOT NULL,
      draft_pos1 TEXT,
      draft_pos2 TEXT,
      draft_back_no INTEGER,
      draft_phone TEXT,
      UNIQUE (team_id, username)
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS historical_stats (
      team_id INTEGER NOT NULL,
      member_id INTEGER PRIMARY KEY,
      games INTEGER NOT NULL DEFAULT 0,
      goals INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      clean_pts REAL NOT NULL DEFAULT 0,
      bonus_pts REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'notice',
      feedback_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hall_of_fame (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      captain_id INTEGER,
      vice_captain_id INTEGER,
      manager_id INTEGER,
      top_scorer_id INTEGER,
      top_assist_id INTEGER,
      clean_sheet_first_id INTEGER,
      overall_first_id INTEGER,
      UNIQUE (team_id, year)
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      member_id INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      closed INTEGER NOT NULL DEFAULT 0,
      multi_select INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS poll_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      poll_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      order_idx INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS poll_votes (
      team_id INTEGER NOT NULL,
      poll_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      PRIMARY KEY (poll_id, member_id, option_id)
    );
    CREATE TABLE IF NOT EXISTS phone_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      phone TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tactics_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      error TEXT,
      raw_response TEXT,
      model TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.platformDb) globalForDb.platformDb = createDb();
  return globalForDb.platformDb;
}

// ---------- teams ----------
type TeamDbRow = {
  id: number;
  slug: string;
  name: string;
  fine_account: string;
  fine_amount: string;
  created_at: string;
};

function toTeam(r: TeamDbRow): TeamRow {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    fineAccount: r.fine_account,
    fineAmount: r.fine_amount,
    createdAt: r.created_at,
  };
}

export function getTeamBySlug(slug: string): TeamRow | null {
  const r = getDb().prepare("SELECT * FROM teams WHERE slug=?").get(slug) as
    | TeamDbRow
    | undefined;
  return r ? toTeam(r) : null;
}

export function getTeamById(id: number): TeamRow | null {
  const r = getDb().prepare("SELECT * FROM teams WHERE id=?").get(id) as
    | TeamDbRow
    | undefined;
  return r ? toTeam(r) : null;
}

export function createTeam(t: { slug: string; name: string }): TeamRow {
  const createdAt = new Date().toISOString();
  const r = getDb()
    .prepare("INSERT INTO teams (slug, name, created_at) VALUES (?, ?, ?)")
    .run(t.slug, t.name, createdAt);
  return getTeamById(Number(r.lastInsertRowid))!;
}

export function listTeams(): TeamRow[] {
  const rows = getDb().prepare("SELECT * FROM teams ORDER BY id").all() as TeamDbRow[];
  return rows.map(toTeam);
}

export function updateTeamFineSettings(
  teamId: number,
  patch: { fineAccount?: string; fineAmount?: string }
) {
  const cur = getTeamById(teamId);
  if (!cur) return;
  getDb()
    .prepare("UPDATE teams SET fine_account=?, fine_amount=? WHERE id=?")
    .run(patch.fineAccount ?? cur.fineAccount, patch.fineAmount ?? cur.fineAmount, teamId);
}

// ---------- members ----------
type MemberDbRow = {
  id: number;
  team_id: number;
  name: string;
  back_no: number | null;
  pos1: PosGroup;
  pos2: PosGroup;
  is_guest: number;
  phone: string | null;
};

function toMember(r: MemberDbRow): Member {
  return {
    id: r.id,
    name: r.name,
    backNo: r.back_no,
    pos1: r.pos1,
    pos2: r.pos2,
    isGuest: !!r.is_guest,
    phone: r.phone,
  };
}

export function listMembers(teamId: number): Member[] {
  const rows = getDb()
    .prepare("SELECT * FROM members WHERE team_id=? ORDER BY name")
    .all(teamId) as MemberDbRow[];
  return rows.map(toMember);
}

export function getMember(teamId: number, id: number): Member | null {
  const r = getDb()
    .prepare("SELECT * FROM members WHERE id=? AND team_id=?")
    .get(id, teamId) as MemberDbRow | undefined;
  return r ? toMember(r) : null;
}

export function createMember(teamId: number, m: Omit<Member, "id">): Member {
  const r = getDb()
    .prepare(
      "INSERT INTO members (team_id, name, back_no, pos1, pos2, is_guest, phone) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(teamId, m.name, m.backNo, m.pos1, m.pos2, m.isGuest ? 1 : 0, m.phone ?? null);
  return { id: Number(r.lastInsertRowid), ...m };
}

export function updateMember(teamId: number, id: number, m: Omit<Member, "id">) {
  getDb()
    .prepare(
      "UPDATE members SET name=?, back_no=?, pos1=?, pos2=?, is_guest=?, phone=? WHERE id=? AND team_id=?"
    )
    .run(m.name, m.backNo, m.pos1, m.pos2, m.isGuest ? 1 : 0, m.phone ?? null, id, teamId);
}

export function deleteMember(teamId: number, id: number) {
  const db = getDb();
  db.prepare("DELETE FROM members WHERE id=? AND team_id=?").run(id, teamId);
  db.prepare("DELETE FROM votes WHERE member_id=? AND team_id=?").run(id, teamId);
  db.prepare("DELETE FROM records WHERE member_id=? AND team_id=?").run(id, teamId);
  db.prepare(
    "DELETE FROM mvp_votes WHERE (voter_id=? OR votee_id=?) AND team_id=?"
  ).run(id, id, teamId);
}

// ---------- events ----------
type EventDbRow = {
  id: number;
  team_id: number;
  title: string;
  type: "match" | "social";
  date: string;
  time: string;
  location: string;
  opponent: string;
  scored: number | null;
  conceded: number | null;
  squad: string | null;
  scrimmage_squad: string | null;
  notes: string;
  duty_offense: string;
  duty_defense: string;
  water_duty: string;
  icebox_duty: string;
  record_log: string | null;
  equipment_reminder_sent: number;
};

function toEvent(r: EventDbRow): EventItem {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    date: r.date,
    time: r.time,
    location: r.location,
    opponent: r.opponent,
    scored: r.scored,
    conceded: r.conceded,
    squad: r.squad ? (JSON.parse(r.squad) as SquadData) : null,
    scrimmageSquad: r.scrimmage_squad ? (JSON.parse(r.scrimmage_squad) as SquadData) : null,
    notes: r.notes,
    dutyOffense: r.duty_offense,
    dutyDefense: r.duty_defense,
    waterDuty: r.water_duty,
    iceboxDuty: r.icebox_duty,
    recordLog: r.record_log ? (JSON.parse(r.record_log) as EventItem["recordLog"]) : null,
    equipmentReminderSent: !!r.equipment_reminder_sent,
  };
}

export function listEvents(teamId: number): EventItem[] {
  const rows = getDb()
    .prepare("SELECT * FROM events WHERE team_id=? ORDER BY date DESC, time DESC")
    .all(teamId) as EventDbRow[];
  return rows.map(toEvent);
}

export function getEvent(teamId: number, id: number): EventItem | null {
  const r = getDb()
    .prepare("SELECT * FROM events WHERE id=? AND team_id=?")
    .get(id, teamId) as EventDbRow | undefined;
  return r ? toEvent(r) : null;
}

export function createEvent(
  teamId: number,
  e: Omit<
    EventItem,
    "id" | "squad" | "scrimmageSquad" | "scored" | "conceded" | "equipmentReminderSent"
  >
): EventItem {
  const r = getDb()
    .prepare(
      "INSERT INTO events (team_id, title, type, date, time, location, opponent, notes, duty_offense, duty_defense, water_duty, icebox_duty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      teamId,
      e.title,
      e.type,
      e.date,
      e.time,
      e.location,
      e.opponent,
      e.notes,
      e.dutyOffense ?? "",
      e.dutyDefense ?? "",
      e.waterDuty ?? "",
      e.iceboxDuty ?? ""
    );
  return getEvent(teamId, Number(r.lastInsertRowid))!;
}

export function updateEvent(teamId: number, id: number, patch: Partial<EventItem>) {
  const cur = getEvent(teamId, id);
  if (!cur) return;
  const next = { ...cur, ...patch };
  getDb()
    .prepare(
      "UPDATE events SET title=?, type=?, date=?, time=?, location=?, opponent=?, scored=?, conceded=?, squad=?, scrimmage_squad=?, notes=?, duty_offense=?, duty_defense=?, water_duty=?, icebox_duty=?, record_log=?, equipment_reminder_sent=? WHERE id=? AND team_id=?"
    )
    .run(
      next.title,
      next.type,
      next.date,
      next.time,
      next.location,
      next.opponent,
      next.scored,
      next.conceded,
      next.squad ? JSON.stringify(next.squad) : null,
      next.scrimmageSquad ? JSON.stringify(next.scrimmageSquad) : null,
      next.notes,
      next.dutyOffense ?? "",
      next.dutyDefense ?? "",
      next.waterDuty ?? "",
      next.iceboxDuty ?? "",
      next.recordLog ? JSON.stringify(next.recordLog) : null,
      next.equipmentReminderSent ? 1 : 0,
      id,
      teamId
    );
}

export function deleteEvent(teamId: number, id: number) {
  const db = getDb();
  db.prepare("DELETE FROM events WHERE id=? AND team_id=?").run(id, teamId);
  db.prepare("DELETE FROM votes WHERE event_id=? AND team_id=?").run(id, teamId);
  db.prepare("DELETE FROM records WHERE event_id=? AND team_id=?").run(id, teamId);
  db.prepare("DELETE FROM mvp_votes WHERE event_id=? AND team_id=?").run(id, teamId);
}

// ---------- votes ----------
export function getVotes(teamId: number, eventId: number): VoteRow[] {
  const rows = getDb()
    .prepare("SELECT event_id, member_id, status FROM votes WHERE event_id=? AND team_id=?")
    .all(eventId, teamId) as { event_id: number; member_id: number; status: VoteStatus }[];
  return rows.map((r) => ({
    eventId: r.event_id,
    memberId: r.member_id,
    status: r.status,
  }));
}

export function getVotesForEvents(teamId: number, eventIds: number[]): VoteRow[] {
  if (eventIds.length === 0) return [];
  const placeholders = eventIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT event_id, member_id, status FROM votes WHERE team_id=? AND event_id IN (${placeholders})`
    )
    .all(teamId, ...eventIds) as { event_id: number; member_id: number; status: VoteStatus }[];
  return rows.map((r) => ({
    eventId: r.event_id,
    memberId: r.member_id,
    status: r.status,
  }));
}

export function setVote(teamId: number, eventId: number, memberId: number, status: VoteStatus) {
  getDb()
    .prepare(
      "INSERT INTO votes (team_id, event_id, member_id, status) VALUES (?, ?, ?, ?) ON CONFLICT(event_id, member_id) DO UPDATE SET status=excluded.status"
    )
    .run(teamId, eventId, memberId, status);
}

// ---------- records ----------
export function getRecords(teamId: number, eventId: number): RecordRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM records WHERE event_id=? AND team_id=?")
    .all(eventId, teamId) as {
    event_id: number;
    member_id: number;
    played: number;
    goals: number;
    assists: number;
    position: PosGroup | "";
  }[];
  return rows.map((r) => ({
    eventId: r.event_id,
    memberId: r.member_id,
    played: r.played,
    goals: r.goals,
    assists: r.assists,
    position: r.position,
  }));
}

export function saveRecords(teamId: number, eventId: number, records: RecordRow[]) {
  const db = getDb();
  const del = db.prepare("DELETE FROM records WHERE event_id=? AND team_id=?");
  const ins = db.prepare(
    "INSERT INTO records (team_id, event_id, member_id, played, goals, assists, position) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const tx = db.transaction(() => {
    del.run(eventId, teamId);
    for (const r of records) {
      if (!r.played && r.goals === 0 && r.assists === 0) continue;
      ins.run(teamId, eventId, r.memberId, r.played ? 1 : 0, r.goals, r.assists, r.position);
    }
  });
  tx();
}

export function getAllRecords(teamId: number): RecordRow[] {
  const rows = getDb().prepare("SELECT * FROM records WHERE team_id=?").all(teamId) as {
    event_id: number;
    member_id: number;
    played: number;
    goals: number;
    assists: number;
    position: PosGroup | "";
  }[];
  return rows.map((r) => ({
    eventId: r.event_id,
    memberId: r.member_id,
    played: r.played,
    goals: r.goals,
    assists: r.assists,
    position: r.position,
  }));
}

// ---------- mvp votes ----------
type MvpVoteDbRow = { event_id: number; voter_id: number; votee_id: number };

function toMvpVote(r: MvpVoteDbRow): MvpVoteRow {
  return { eventId: r.event_id, voterId: r.voter_id, voteeId: r.votee_id };
}

export function getMvpVotes(teamId: number, eventId: number): MvpVoteRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM mvp_votes WHERE event_id=? AND team_id=?")
    .all(eventId, teamId) as MvpVoteDbRow[];
  return rows.map(toMvpVote);
}

export function setMvpVote(teamId: number, eventId: number, voterId: number, voteeId: number) {
  getDb()
    .prepare(
      "INSERT INTO mvp_votes (team_id, event_id, voter_id, votee_id) VALUES (?, ?, ?, ?) ON CONFLICT(event_id, voter_id) DO UPDATE SET votee_id=excluded.votee_id"
    )
    .run(teamId, eventId, voterId, voteeId);
}

export function getAllMvpVotes(teamId: number): MvpVoteRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM mvp_votes WHERE team_id=?")
    .all(teamId) as MvpVoteDbRow[];
  return rows.map(toMvpVote);
}

// ---------- users ----------
type UserDbRow = {
  id: number;
  team_id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  status: UserStatus;
  member_id: number | null;
  created_at: string;
  draft_pos1: PosGroup | null;
  draft_pos2: PosGroup | null;
  draft_back_no: number | null;
  draft_phone: string | null;
};

function toUser(r: UserDbRow): AppUser {
  return {
    id: r.id,
    teamId: r.team_id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    status: r.status,
    memberId: r.member_id,
    createdAt: r.created_at,
    draftPos1: r.draft_pos1,
    draftPos2: r.draft_pos2,
    draftBackNo: r.draft_back_no,
    draftPhone: r.draft_phone,
  };
}

export function countUsers(teamId: number): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM users WHERE team_id=?")
    .get(teamId) as { c: number };
  return row.c;
}

export function getUserByUsername(
  teamId: number,
  username: string
): (AppUser & { passwordHash: string }) | null {
  const r = getDb()
    .prepare("SELECT * FROM users WHERE team_id=? AND username=?")
    .get(teamId, username) as UserDbRow | undefined;
  return r ? { ...toUser(r), passwordHash: r.password_hash } : null;
}

// id는 users.id(전역 유일 PK)라 teamId 없이도 행이 특정되지만, 세션 위조로
// 다른 팀 사용자 id를 들이미는 걸 막기 위해 teamId도 함께 검증한다.
export function getUserById(teamId: number, id: number): AppUser | null {
  const r = getDb()
    .prepare("SELECT * FROM users WHERE id=? AND team_id=?")
    .get(id, teamId) as UserDbRow | undefined;
  return r ? toUser(r) : null;
}

export function listUsersByStatus(teamId: number, status: UserStatus): AppUser[] {
  const rows = getDb()
    .prepare("SELECT * FROM users WHERE team_id=? AND status=? ORDER BY created_at")
    .all(teamId, status) as UserDbRow[];
  return rows.map(toUser);
}

export function getUsersByMemberId(teamId: number, memberId: number): AppUser[] {
  const rows = getDb()
    .prepare("SELECT * FROM users WHERE team_id=? AND member_id=? ORDER BY created_at")
    .all(teamId, memberId) as UserDbRow[];
  return rows.map(toUser);
}

export function createUser(
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
): AppUser {
  const createdAt = new Date().toISOString();
  const r = getDb()
    .prepare(
      "INSERT INTO users (team_id, username, password_hash, display_name, role, status, member_id, created_at, draft_pos1, draft_pos2, draft_back_no, draft_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      teamId,
      u.username,
      u.passwordHash,
      u.displayName,
      u.role,
      u.status,
      u.memberId,
      createdAt,
      u.draftPos1 ?? null,
      u.draftPos2 ?? null,
      u.draftBackNo ?? null,
      u.draftPhone ?? null
    );
  return getUserById(teamId, Number(r.lastInsertRowid))!;
}

export function updateUserStatus(
  teamId: number,
  id: number,
  status: UserStatus,
  memberId: number | null,
  role?: UserRole
) {
  if (role) {
    getDb()
      .prepare("UPDATE users SET status=?, member_id=?, role=? WHERE id=? AND team_id=?")
      .run(status, memberId, role, id, teamId);
  } else {
    getDb()
      .prepare("UPDATE users SET status=?, member_id=? WHERE id=? AND team_id=?")
      .run(status, memberId, id, teamId);
  }
}

export function updateUserPassword(teamId: number, id: number, passwordHash: string) {
  getDb()
    .prepare("UPDATE users SET password_hash=? WHERE id=? AND team_id=?")
    .run(passwordHash, id, teamId);
}

// ---------- phone verification (아이디/비밀번호 찾기 SMS 인증) ----------
type PhoneVerificationDbRow = {
  id: number;
  team_id: number;
  phone: string;
  purpose: VerificationPurpose;
  code: string;
  attempts: number;
  consumed: number;
  expires_at: string;
  created_at: string;
};

function toPhoneVerification(r: PhoneVerificationDbRow): PhoneVerificationRow {
  return {
    id: r.id,
    phone: r.phone,
    purpose: r.purpose,
    code: r.code,
    attempts: r.attempts,
    consumed: !!r.consumed,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}

export function createPhoneVerification(
  teamId: number,
  v: { phone: string; purpose: VerificationPurpose; code: string; expiresAt: string }
): PhoneVerificationRow {
  const createdAt = new Date().toISOString();
  const r = getDb()
    .prepare(
      "INSERT INTO phone_verifications (team_id, phone, purpose, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(teamId, v.phone, v.purpose, v.code, v.expiresAt, createdAt);
  const row = getDb()
    .prepare("SELECT * FROM phone_verifications WHERE id=?")
    .get(Number(r.lastInsertRowid)) as PhoneVerificationDbRow;
  return toPhoneVerification(row);
}

export function getLatestPhoneVerification(
  teamId: number,
  phone: string,
  purpose: VerificationPurpose
): PhoneVerificationRow | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM phone_verifications WHERE team_id=? AND phone=? AND purpose=? ORDER BY id DESC LIMIT 1"
    )
    .get(teamId, phone, purpose) as PhoneVerificationDbRow | undefined;
  return row ? toPhoneVerification(row) : null;
}

export function incrementPhoneVerificationAttempts(id: number) {
  getDb()
    .prepare("UPDATE phone_verifications SET attempts = attempts + 1 WHERE id=?")
    .run(id);
}

export function consumePhoneVerification(id: number) {
  getDb().prepare("UPDATE phone_verifications SET consumed=1 WHERE id=?").run(id);
}

// ---------- tactics jobs (전술 시뮬레이터 생성 작업) ----------
type TacticsJobDbRow = {
  id: number;
  team_id: number;
  user_id: number;
  description: string;
  status: TacticsJobStatus;
  result: string | null;
  error: string | null;
  raw_response: string | null;
  model: string;
  created_at: string;
};

function toTacticsJob(r: TacticsJobDbRow): TacticsJobRow {
  return {
    id: r.id,
    userId: r.user_id,
    description: r.description,
    status: r.status,
    result: r.result ? (JSON.parse(r.result) as TacticsScene) : null,
    error: r.error,
    rawResponse: r.raw_response,
    model: r.model,
    createdAt: r.created_at,
  };
}

export function listTacticsJobs(teamId: number): TacticsJobRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM tactics_jobs WHERE team_id=? ORDER BY created_at DESC")
    .all(teamId) as TacticsJobDbRow[];
  return rows.map(toTacticsJob);
}

export function createTacticsJob(
  teamId: number,
  userId: number,
  description: string,
  model: string
): TacticsJobRow {
  const db = getDb();
  // 오래된 작업이 계속 쌓이지 않게, 새 작업을 만들 때마다 하루 지난 것들을 지운다.
  db.prepare("DELETE FROM tactics_jobs WHERE created_at < ?").run(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  );
  const createdAt = new Date().toISOString();
  const r = db
    .prepare(
      "INSERT INTO tactics_jobs (team_id, user_id, description, status, model, created_at) VALUES (?, ?, ?, 'pending', ?, ?)"
    )
    .run(teamId, userId, description, model, createdAt);
  const row = db
    .prepare("SELECT * FROM tactics_jobs WHERE id=?")
    .get(Number(r.lastInsertRowid)) as TacticsJobDbRow;
  return toTacticsJob(row);
}

export function getTacticsJob(teamId: number, id: number): TacticsJobRow | null {
  const row = getDb()
    .prepare("SELECT * FROM tactics_jobs WHERE id=? AND team_id=?")
    .get(id, teamId) as TacticsJobDbRow | undefined;
  return row ? toTacticsJob(row) : null;
}

// pending 상태일 때만 갱신한다 — 사용자가 취소한 작업이 뒤늦게 끝나서
// 결과를 덮어써버리는 걸 막는다.
export function completeTacticsJob(
  id: number,
  result: TacticsScene,
  rawResponse: string | null
) {
  getDb()
    .prepare(
      "UPDATE tactics_jobs SET status='done', result=?, raw_response=? WHERE id=? AND status='pending'"
    )
    .run(JSON.stringify(result), rawResponse, id);
}

export function failTacticsJob(id: number, error: string, rawResponse: string | null) {
  getDb()
    .prepare(
      "UPDATE tactics_jobs SET status='error', error=?, raw_response=? WHERE id=? AND status='pending'"
    )
    .run(error, rawResponse, id);
}

export function cancelTacticsJob(id: number) {
  getDb()
    .prepare("UPDATE tactics_jobs SET status='cancelled' WHERE id=? AND status='pending'")
    .run(id);
}

export function deleteTacticsJob(teamId: number, id: number) {
  getDb().prepare("DELETE FROM tactics_jobs WHERE id=? AND team_id=?").run(id, teamId);
}

// ---------- comments ----------
type CommentDbRow = {
  id: number;
  team_id: number;
  event_id: number;
  member_id: number;
  body: string;
  created_at: string;
};

function toComment(r: CommentDbRow): CommentRow {
  return {
    id: r.id,
    eventId: r.event_id,
    memberId: r.member_id,
    body: r.body,
    createdAt: r.created_at,
  };
}

export function getComments(teamId: number, eventId: number): CommentRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM comments WHERE event_id=? AND team_id=? ORDER BY created_at")
    .all(eventId, teamId) as CommentDbRow[];
  return rows.map(toComment);
}

export function addComment(
  teamId: number,
  eventId: number,
  memberId: number,
  body: string
): CommentRow {
  const createdAt = new Date().toISOString();
  const r = getDb()
    .prepare(
      "INSERT INTO comments (team_id, event_id, member_id, body, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(teamId, eventId, memberId, body, createdAt);
  return {
    id: Number(r.lastInsertRowid),
    eventId,
    memberId,
    body,
    createdAt,
  };
}

export function getComment(teamId: number, id: number): CommentRow | null {
  const r = getDb()
    .prepare("SELECT * FROM comments WHERE id=? AND team_id=?")
    .get(id, teamId) as CommentDbRow | undefined;
  return r ? toComment(r) : null;
}

export function deleteComment(teamId: number, id: number) {
  getDb().prepare("DELETE FROM comments WHERE id=? AND team_id=?").run(id, teamId);
}

// ---------- historical stats (앱 도입 이전 누적 기록) ----------
type HistoricalDbRow = {
  team_id: number;
  member_id: number;
  games: number;
  goals: number;
  assists: number;
  clean_pts: number;
  bonus_pts: number;
};

function toHistorical(r: HistoricalDbRow): HistoricalStats {
  return {
    memberId: r.member_id,
    games: r.games,
    goals: r.goals,
    assists: r.assists,
    cleanPts: r.clean_pts,
    bonusPts: r.bonus_pts,
  };
}

export function getAllHistoricalStats(teamId: number): HistoricalStats[] {
  const rows = getDb()
    .prepare("SELECT * FROM historical_stats WHERE team_id=?")
    .all(teamId) as HistoricalDbRow[];
  return rows.map(toHistorical);
}

export function upsertHistoricalStats(teamId: number, stats: HistoricalStats) {
  getDb()
    .prepare(
      `INSERT INTO historical_stats (team_id, member_id, games, goals, assists, clean_pts, bonus_pts)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(member_id) DO UPDATE SET
         games=excluded.games, goals=excluded.goals,
         assists=excluded.assists, clean_pts=excluded.clean_pts,
         bonus_pts=excluded.bonus_pts`
    )
    .run(
      teamId,
      stats.memberId,
      stats.games,
      stats.goals,
      stats.assists,
      stats.cleanPts,
      stats.bonusPts
    );
}

export function deleteHistoricalStats(teamId: number, memberId: number) {
  getDb()
    .prepare("DELETE FROM historical_stats WHERE member_id=? AND team_id=?")
    .run(memberId, teamId);
}

// ---------- announcements ----------
type AnnouncementDbRow = {
  id: number;
  team_id: number;
  title: string;
  body: string;
  author_name: string;
  category: AnnouncementCategory;
  feedback_date: string | null;
  created_at: string;
  updated_at: string;
};

function toAnnouncement(r: AnnouncementDbRow): AnnouncementRow {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    authorName: r.author_name,
    category: r.category,
    feedbackDate: r.feedback_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listAnnouncements(teamId: number): AnnouncementRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM announcements WHERE team_id=? ORDER BY created_at DESC")
    .all(teamId) as AnnouncementDbRow[];
  return rows.map(toAnnouncement);
}

export function getAnnouncement(teamId: number, id: number): AnnouncementRow | null {
  const r = getDb()
    .prepare("SELECT * FROM announcements WHERE id=? AND team_id=?")
    .get(id, teamId) as AnnouncementDbRow | undefined;
  return r ? toAnnouncement(r) : null;
}

export function createAnnouncement(
  teamId: number,
  a: Omit<AnnouncementRow, "id" | "createdAt" | "updatedAt">
): AnnouncementRow {
  const now = new Date().toISOString();
  const r = getDb()
    .prepare(
      "INSERT INTO announcements (team_id, title, body, author_name, category, feedback_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(teamId, a.title, a.body, a.authorName, a.category, a.feedbackDate, now, now);
  return getAnnouncement(teamId, Number(r.lastInsertRowid))!;
}

export function updateAnnouncement(
  teamId: number,
  id: number,
  patch: { title: string; body: string; feedbackDate?: string | null }
) {
  if (patch.feedbackDate !== undefined) {
    getDb()
      .prepare(
        "UPDATE announcements SET title=?, body=?, feedback_date=?, updated_at=? WHERE id=? AND team_id=?"
      )
      .run(patch.title, patch.body, patch.feedbackDate, new Date().toISOString(), id, teamId);
    return;
  }
  getDb()
    .prepare("UPDATE announcements SET title=?, body=?, updated_at=? WHERE id=? AND team_id=?")
    .run(patch.title, patch.body, new Date().toISOString(), id, teamId);
}

export function deleteAnnouncement(teamId: number, id: number) {
  getDb().prepare("DELETE FROM announcements WHERE id=? AND team_id=?").run(id, teamId);
}

// ---------- 명예의 전당 ----------
type HallOfFameDbRow = {
  id: number;
  team_id: number;
  year: number;
  captain_id: number | null;
  vice_captain_id: number | null;
  manager_id: number | null;
  top_scorer_id: number | null;
  top_assist_id: number | null;
  clean_sheet_first_id: number | null;
  overall_first_id: number | null;
};

function toHallOfFame(r: HallOfFameDbRow): HallOfFameRow {
  return {
    id: r.id,
    year: r.year,
    captainId: r.captain_id,
    viceCaptainId: r.vice_captain_id,
    managerId: r.manager_id,
    topScorerId: r.top_scorer_id,
    topAssistId: r.top_assist_id,
    cleanSheetFirstId: r.clean_sheet_first_id,
    overallFirstId: r.overall_first_id,
  };
}

export function listHallOfFame(teamId: number): HallOfFameRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM hall_of_fame WHERE team_id=? ORDER BY year DESC")
    .all(teamId) as HallOfFameDbRow[];
  return rows.map(toHallOfFame);
}

export function upsertHallOfFame(
  teamId: number,
  entry: Omit<HallOfFameRow, "id">
): HallOfFameRow {
  getDb()
    .prepare(
      `INSERT INTO hall_of_fame (team_id, year, captain_id, vice_captain_id, manager_id, top_scorer_id, top_assist_id, clean_sheet_first_id, overall_first_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(team_id, year) DO UPDATE SET
         captain_id=excluded.captain_id, vice_captain_id=excluded.vice_captain_id,
         manager_id=excluded.manager_id, top_scorer_id=excluded.top_scorer_id,
         top_assist_id=excluded.top_assist_id, clean_sheet_first_id=excluded.clean_sheet_first_id,
         overall_first_id=excluded.overall_first_id`
    )
    .run(
      teamId,
      entry.year,
      entry.captainId,
      entry.viceCaptainId,
      entry.managerId,
      entry.topScorerId,
      entry.topAssistId,
      entry.cleanSheetFirstId,
      entry.overallFirstId
    );
  const r = getDb()
    .prepare("SELECT * FROM hall_of_fame WHERE team_id=? AND year=?")
    .get(teamId, entry.year) as HallOfFameDbRow;
  return toHallOfFame(r);
}

export function deleteHallOfFame(teamId: number, id: number) {
  getDb().prepare("DELETE FROM hall_of_fame WHERE id=? AND team_id=?").run(id, teamId);
}

// ---------- 웹 푸시 구독 ----------
export function savePushSubscription(
  teamId: number,
  sub: { endpoint: string; p256dh: string; auth: string; memberId: number | null }
) {
  getDb()
    .prepare(
      `INSERT INTO push_subscriptions (team_id, endpoint, p256dh, auth, member_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth, member_id=excluded.member_id`
    )
    .run(teamId, sub.endpoint, sub.p256dh, sub.auth, sub.memberId, new Date().toISOString());
}

export function getAllPushSubscriptions(teamId: number): {
  endpoint: string;
  p256dh: string;
  auth: string;
  memberId: number | null;
}[] {
  const rows = getDb()
    .prepare("SELECT endpoint, p256dh, auth, member_id FROM push_subscriptions WHERE team_id=?")
    .all(teamId) as { endpoint: string; p256dh: string; auth: string; member_id: number | null }[];
  return rows.map((r) => ({
    endpoint: r.endpoint,
    p256dh: r.p256dh,
    auth: r.auth,
    memberId: r.member_id,
  }));
}

export function deletePushSubscription(endpoint: string) {
  getDb().prepare("DELETE FROM push_subscriptions WHERE endpoint=?").run(endpoint);
}

// ---------- 이벤트 투표(폴) ----------
type PollDbRow = {
  id: number;
  team_id: number;
  title: string;
  created_by: number;
  created_at: string;
  closed: number;
  multi_select: number;
};

function toPoll(r: PollDbRow): Poll {
  return {
    id: r.id,
    title: r.title,
    createdBy: r.created_by,
    createdAt: r.created_at,
    closed: !!r.closed,
    multiSelect: !!r.multi_select,
  };
}

type PollOptionDbRow = {
  id: number;
  team_id: number;
  poll_id: number;
  label: string;
  order_idx: number;
};

function toPollOption(r: PollOptionDbRow): PollOption {
  return { id: r.id, pollId: r.poll_id, label: r.label, order: r.order_idx };
}

export function listPolls(teamId: number): Poll[] {
  const rows = getDb()
    .prepare("SELECT * FROM polls WHERE team_id=? ORDER BY created_at DESC")
    .all(teamId) as PollDbRow[];
  return rows.map(toPoll);
}

export function getPoll(teamId: number, id: number): Poll | null {
  const row = getDb()
    .prepare("SELECT * FROM polls WHERE id=? AND team_id=?")
    .get(id, teamId) as PollDbRow | undefined;
  return row ? toPoll(row) : null;
}

export function getAllPollOptions(teamId: number): PollOption[] {
  const rows = getDb()
    .prepare("SELECT * FROM poll_options WHERE team_id=? ORDER BY poll_id, order_idx")
    .all(teamId) as PollOptionDbRow[];
  return rows.map(toPollOption);
}

export function createPoll(
  teamId: number,
  title: string,
  options: string[],
  createdBy: number,
  multiSelect: boolean
): Poll {
  const createdAt = new Date().toISOString();
  const db = getDb();
  const insertPoll = db.prepare(
    "INSERT INTO polls (team_id, title, created_by, created_at, closed, multi_select) VALUES (?, ?, ?, ?, 0, ?)"
  );
  const insertOption = db.prepare(
    "INSERT INTO poll_options (team_id, poll_id, label, order_idx) VALUES (?, ?, ?, ?)"
  );
  const pollId = db.transaction(() => {
    const info = insertPoll.run(teamId, title, createdBy, createdAt, multiSelect ? 1 : 0);
    const id = Number(info.lastInsertRowid);
    options.forEach((label, i) => insertOption.run(teamId, id, label, i));
    return id;
  })();
  return { id: pollId, title, createdBy, createdAt, closed: false, multiSelect };
}

export function setPollClosed(teamId: number, id: number, closed: boolean) {
  getDb()
    .prepare("UPDATE polls SET closed=? WHERE id=? AND team_id=?")
    .run(closed ? 1 : 0, id, teamId);
}

export function addPollOption(teamId: number, pollId: number, label: string): PollOption {
  const db = getDb();
  const { m } = db
    .prepare(
      "SELECT COALESCE(MAX(order_idx), -1) AS m FROM poll_options WHERE poll_id=? AND team_id=?"
    )
    .get(pollId, teamId) as { m: number };
  const order = m + 1;
  const info = db
    .prepare("INSERT INTO poll_options (team_id, poll_id, label, order_idx) VALUES (?, ?, ?, ?)")
    .run(teamId, pollId, label, order);
  return { id: Number(info.lastInsertRowid), pollId, label, order };
}

export function deletePoll(teamId: number, id: number) {
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM poll_votes WHERE poll_id=? AND team_id=?").run(id, teamId);
    db.prepare("DELETE FROM poll_options WHERE poll_id=? AND team_id=?").run(id, teamId);
    db.prepare("DELETE FROM polls WHERE id=? AND team_id=?").run(id, teamId);
  })();
}

export function getAllPollVotes(teamId: number): PollVoteRow[] {
  const rows = getDb().prepare("SELECT * FROM poll_votes WHERE team_id=?").all(teamId) as {
    poll_id: number;
    member_id: number;
    option_id: number;
  }[];
  return rows.map((r) => ({
    pollId: r.poll_id,
    memberId: r.member_id,
    optionId: r.option_id,
  }));
}

export function setPollVote(
  teamId: number,
  pollId: number,
  memberId: number,
  optionIds: number[]
) {
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM poll_votes WHERE poll_id=? AND member_id=? AND team_id=?").run(
      pollId,
      memberId,
      teamId
    );
    const insert = db.prepare(
      "INSERT INTO poll_votes (team_id, poll_id, member_id, option_id) VALUES (?, ?, ?, ?)"
    );
    for (const optionId of optionIds) insert.run(teamId, pollId, memberId, optionId);
  })();
}
