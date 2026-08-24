import { Pool } from "pg";
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

const globalForPg = globalThis as unknown as {
  platformPool?: Pool;
  platformPgReady?: Promise<void>;
};

function getPool(): Pool {
  if (!globalForPg.platformPool) {
    const connectionString = process.env.DATABASE_URL!;
    globalForPg.platformPool = new Pool({
      connectionString,
      // 서버리스는 함수 인스턴스마다 별도 풀을 만들기 때문에 인스턴스당
      // 커넥션 수를 작게 유지해야 Supabase 풀러의 동시 접속 한도를 넘지 않는다.
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: /supabase|sslmode=require/.test(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return globalForPg.platformPool;
}

async function init() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      logo_url TEXT,
      fine_account TEXT NOT NULL DEFAULT '',
      fine_amount TEXT NOT NULL DEFAULT '20,000원',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      back_no INTEGER,
      pos1 TEXT NOT NULL DEFAULT 'CB',
      pos2 TEXT NOT NULL DEFAULT 'WB',
      is_guest BOOLEAN NOT NULL DEFAULT false,
      phone TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'match',
      date TEXT NOT NULL,
      time TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      opponent TEXT NOT NULL DEFAULT '',
      scored INTEGER,
      conceded INTEGER,
      squad JSONB,
      scrimmage_squad JSONB,
      notes TEXT NOT NULL DEFAULT '',
      duty_offense TEXT NOT NULL DEFAULT '',
      duty_defense TEXT NOT NULL DEFAULT '',
      water_duty TEXT NOT NULL DEFAULT '',
      icebox_duty TEXT NOT NULL DEFAULT '',
      record_log JSONB,
      equipment_reminder_sent BOOLEAN NOT NULL DEFAULT false
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
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      status TEXT NOT NULL DEFAULT 'pending',
      member_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      draft_pos1 TEXT,
      draft_pos2 TEXT,
      draft_back_no INTEGER,
      draft_phone TEXT,
      UNIQUE (team_id, username)
    );
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS historical_stats (
      team_id INTEGER NOT NULL,
      member_id INTEGER PRIMARY KEY,
      games INTEGER NOT NULL DEFAULT 0,
      goals INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      clean_pts DOUBLE PRECISION NOT NULL DEFAULT 0,
      bonus_pts DOUBLE PRECISION NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'notice',
      feedback_date TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS hall_of_fame (
      id SERIAL PRIMARY KEY,
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
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      member_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS polls (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      closed BOOLEAN NOT NULL DEFAULT false,
      multi_select BOOLEAN NOT NULL DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS poll_options (
      id SERIAL PRIMARY KEY,
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
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL,
      phone TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed BOOLEAN NOT NULL DEFAULT false,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS tactics_jobs (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result JSONB,
      error TEXT,
      raw_response TEXT,
      model TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function ready(): Promise<Pool> {
  if (!globalForPg.platformPgReady) globalForPg.platformPgReady = init();
  await globalForPg.platformPgReady;
  return getPool();
}

// ---------- teams ----------
type TeamDbRow = {
  id: number;
  slug: string;
  name: string;
  logo_url: string | null;
  fine_account: string;
  fine_amount: string;
  created_at: string;
};

function toTeam(r: TeamDbRow): TeamRow {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    logoUrl: r.logo_url,
    fineAccount: r.fine_account,
    fineAmount: r.fine_amount,
    createdAt: r.created_at,
  };
}

export async function getTeamBySlug(slug: string): Promise<TeamRow | null> {
  const pool = await ready();
  const { rows } = await pool.query("SELECT * FROM teams WHERE slug=$1", [slug]);
  return rows[0] ? toTeam(rows[0]) : null;
}

export async function getTeamById(id: number): Promise<TeamRow | null> {
  const pool = await ready();
  const { rows } = await pool.query("SELECT * FROM teams WHERE id=$1", [id]);
  return rows[0] ? toTeam(rows[0]) : null;
}

export async function createTeam(t: { slug: string; name: string }): Promise<TeamRow> {
  const pool = await ready();
  const { rows } = await pool.query(
    "INSERT INTO teams (slug, name) VALUES ($1, $2) RETURNING id",
    [t.slug, t.name]
  );
  return (await getTeamById(rows[0].id))!;
}

export async function listTeams(): Promise<TeamRow[]> {
  const pool = await ready();
  const { rows } = await pool.query("SELECT * FROM teams ORDER BY id");
  return rows.map(toTeam);
}

export async function updateTeamFineSettings(
  teamId: number,
  patch: { fineAccount?: string; fineAmount?: string }
) {
  const pool = await ready();
  const cur = await getTeamById(teamId);
  if (!cur) return;
  await pool.query("UPDATE teams SET fine_account=$1, fine_amount=$2 WHERE id=$3", [
    patch.fineAccount ?? cur.fineAccount,
    patch.fineAmount ?? cur.fineAmount,
    teamId,
  ]);
}

export async function updateTeamLogo(teamId: number, logoUrl: string | null) {
  const pool = await ready();
  await pool.query("UPDATE teams SET logo_url=$1 WHERE id=$2", [logoUrl, teamId]);
}

// ---------- members ----------
type MemberDbRow = {
  id: number;
  name: string;
  back_no: number | null;
  pos1: PosGroup;
  pos2: PosGroup;
  is_guest: boolean;
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

export async function listMembers(teamId: number): Promise<Member[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM members WHERE team_id=$1 ORDER BY name",
    [teamId]
  );
  return (rows as MemberDbRow[]).map(toMember);
}

export async function getMember(teamId: number, id: number): Promise<Member | null> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM members WHERE id=$1 AND team_id=$2",
    [id, teamId]
  );
  return rows[0] ? toMember(rows[0] as MemberDbRow) : null;
}

export async function createMember(teamId: number, m: Omit<Member, "id">): Promise<Member> {
  const pool = await ready();
  const { rows } = await pool.query(
    "INSERT INTO members (team_id, name, back_no, pos1, pos2, is_guest, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    [teamId, m.name, m.backNo, m.pos1, m.pos2, !!m.isGuest, m.phone ?? null]
  );
  return { id: rows[0].id, ...m };
}

export async function updateMember(teamId: number, id: number, m: Omit<Member, "id">) {
  const pool = await ready();
  await pool.query(
    "UPDATE members SET name=$1, back_no=$2, pos1=$3, pos2=$4, is_guest=$5, phone=$6 WHERE id=$7 AND team_id=$8",
    [m.name, m.backNo, m.pos1, m.pos2, !!m.isGuest, m.phone ?? null, id, teamId]
  );
}

export async function deleteMember(teamId: number, id: number) {
  const pool = await ready();
  await pool.query("DELETE FROM members WHERE id=$1 AND team_id=$2", [id, teamId]);
  await pool.query("DELETE FROM votes WHERE member_id=$1 AND team_id=$2", [id, teamId]);
  await pool.query("DELETE FROM records WHERE member_id=$1 AND team_id=$2", [id, teamId]);
  await pool.query(
    "DELETE FROM mvp_votes WHERE (voter_id=$1 OR votee_id=$1) AND team_id=$2",
    [id, teamId]
  );
}

type EventDbRow = {
  id: number;
  title: string;
  type: "match" | "social";
  date: string;
  time: string;
  location: string;
  opponent: string;
  scored: number | null;
  conceded: number | null;
  squad: SquadData | null;
  scrimmage_squad: SquadData | null;
  notes: string;
  duty_offense: string;
  duty_defense: string;
  water_duty: string;
  icebox_duty: string;
  record_log: EventItem["recordLog"];
  equipment_reminder_sent: boolean;
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
    squad: r.squad,
    scrimmageSquad: r.scrimmage_squad,
    notes: r.notes,
    dutyOffense: r.duty_offense,
    dutyDefense: r.duty_defense,
    waterDuty: r.water_duty,
    iceboxDuty: r.icebox_duty,
    recordLog: r.record_log ?? null,
    equipmentReminderSent: r.equipment_reminder_sent,
  };
}

export async function listEvents(teamId: number): Promise<EventItem[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM events WHERE team_id=$1 ORDER BY date DESC, time DESC",
    [teamId]
  );
  return (rows as EventDbRow[]).map(toEvent);
}

export async function getEvent(teamId: number, id: number): Promise<EventItem | null> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM events WHERE id=$1 AND team_id=$2",
    [id, teamId]
  );
  return rows[0] ? toEvent(rows[0] as EventDbRow) : null;
}

export async function createEvent(
  teamId: number,
  e: Omit<
    EventItem,
    "id" | "squad" | "scrimmageSquad" | "scored" | "conceded" | "equipmentReminderSent"
  >
): Promise<EventItem> {
  const pool = await ready();
  const { rows } = await pool.query(
    "INSERT INTO events (team_id, title, type, date, time, location, opponent, notes, duty_offense, duty_defense, water_duty, icebox_duty) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
    [
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
      e.iceboxDuty ?? "",
    ]
  );
  return (await getEvent(teamId, rows[0].id))!;
}

export async function updateEvent(teamId: number, id: number, patch: Partial<EventItem>) {
  const cur = await getEvent(teamId, id);
  if (!cur) return;
  const next = { ...cur, ...patch };
  const pool = await ready();
  await pool.query(
    "UPDATE events SET title=$1, type=$2, date=$3, time=$4, location=$5, opponent=$6, scored=$7, conceded=$8, squad=$9, scrimmage_squad=$10, notes=$11, duty_offense=$12, duty_defense=$13, water_duty=$14, icebox_duty=$15, record_log=$16, equipment_reminder_sent=$17 WHERE id=$18 AND team_id=$19",
    [
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
      next.equipmentReminderSent ?? false,
      id,
      teamId,
    ]
  );
}

export async function deleteEvent(teamId: number, id: number) {
  const pool = await ready();
  await pool.query("DELETE FROM events WHERE id=$1 AND team_id=$2", [id, teamId]);
  await pool.query("DELETE FROM votes WHERE event_id=$1 AND team_id=$2", [id, teamId]);
  await pool.query("DELETE FROM records WHERE event_id=$1 AND team_id=$2", [id, teamId]);
  await pool.query("DELETE FROM mvp_votes WHERE event_id=$1 AND team_id=$2", [id, teamId]);
}

export async function getVotes(teamId: number, eventId: number): Promise<VoteRow[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM votes WHERE event_id=$1 AND team_id=$2",
    [eventId, teamId]
  );
  return rows.map((r) => ({
    eventId: r.event_id,
    memberId: r.member_id,
    status: r.status as VoteStatus,
  }));
}

export async function getVotesForEvents(teamId: number, eventIds: number[]): Promise<VoteRow[]> {
  if (eventIds.length === 0) return [];
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM votes WHERE team_id=$1 AND event_id = ANY($2::int[])",
    [teamId, eventIds]
  );
  return rows.map((r) => ({
    eventId: r.event_id,
    memberId: r.member_id,
    status: r.status as VoteStatus,
  }));
}

export async function setVote(
  teamId: number,
  eventId: number,
  memberId: number,
  status: VoteStatus
) {
  const pool = await ready();
  await pool.query(
    "INSERT INTO votes (team_id, event_id, member_id, status) VALUES ($1, $2, $3, $4) ON CONFLICT (event_id, member_id) DO UPDATE SET status=EXCLUDED.status",
    [teamId, eventId, memberId, status]
  );
}

function toRecord(r: {
  event_id: number;
  member_id: number;
  played: number;
  goals: number;
  assists: number;
  position: PosGroup | "";
}): RecordRow {
  return {
    eventId: r.event_id,
    memberId: r.member_id,
    played: r.played,
    goals: r.goals,
    assists: r.assists,
    position: r.position,
  };
}

export async function getRecords(teamId: number, eventId: number): Promise<RecordRow[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM records WHERE event_id=$1 AND team_id=$2",
    [eventId, teamId]
  );
  return rows.map(toRecord);
}

export async function saveRecords(teamId: number, eventId: number, records: RecordRow[]) {
  const pool = await ready();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM records WHERE event_id=$1 AND team_id=$2", [
      eventId,
      teamId,
    ]);
    for (const r of records) {
      if (!r.played && r.goals === 0 && r.assists === 0) continue;
      await client.query(
        "INSERT INTO records (team_id, event_id, member_id, played, goals, assists, position) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [teamId, eventId, r.memberId, r.played ? 1 : 0, r.goals, r.assists, r.position]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getAllRecords(teamId: number): Promise<RecordRow[]> {
  const pool = await ready();
  const { rows } = await pool.query("SELECT * FROM records WHERE team_id=$1", [teamId]);
  return rows.map(toRecord);
}

function toMvpVote(r: {
  event_id: number;
  voter_id: number;
  votee_id: number;
}): MvpVoteRow {
  return { eventId: r.event_id, voterId: r.voter_id, voteeId: r.votee_id };
}

export async function getMvpVotes(teamId: number, eventId: number): Promise<MvpVoteRow[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM mvp_votes WHERE event_id=$1 AND team_id=$2",
    [eventId, teamId]
  );
  return rows.map(toMvpVote);
}

export async function setMvpVote(
  teamId: number,
  eventId: number,
  voterId: number,
  voteeId: number
) {
  const pool = await ready();
  await pool.query(
    "INSERT INTO mvp_votes (team_id, event_id, voter_id, votee_id) VALUES ($1, $2, $3, $4) ON CONFLICT (event_id, voter_id) DO UPDATE SET votee_id=EXCLUDED.votee_id",
    [teamId, eventId, voterId, voteeId]
  );
}

export async function getAllMvpVotes(teamId: number): Promise<MvpVoteRow[]> {
  const pool = await ready();
  const { rows } = await pool.query("SELECT * FROM mvp_votes WHERE team_id=$1", [teamId]);
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

export async function countUsers(teamId: number): Promise<number> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS c FROM users WHERE team_id=$1",
    [teamId]
  );
  return rows[0].c;
}

export async function getUserByUsername(
  teamId: number,
  username: string
): Promise<(AppUser & { passwordHash: string }) | null> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE team_id=$1 AND username=$2",
    [teamId, username]
  );
  const r = rows[0] as UserDbRow | undefined;
  return r ? { ...toUser(r), passwordHash: r.password_hash } : null;
}

// id는 users.id(전역 유일 PK)라 teamId 없이도 행이 특정되지만, 세션 위조로
// 다른 팀 사용자 id를 들이미는 걸 막기 위해 teamId도 함께 검증한다.
export async function getUserById(teamId: number, id: number): Promise<AppUser | null> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE id=$1 AND team_id=$2",
    [id, teamId]
  );
  return rows[0] ? toUser(rows[0] as UserDbRow) : null;
}

export async function listUsersByStatus(
  teamId: number,
  status: UserStatus
): Promise<AppUser[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE team_id=$1 AND status=$2 ORDER BY created_at",
    [teamId, status]
  );
  return (rows as UserDbRow[]).map(toUser);
}

export async function getUsersByMemberId(teamId: number, memberId: number): Promise<AppUser[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE team_id=$1 AND member_id=$2 ORDER BY created_at",
    [teamId, memberId]
  );
  return (rows as UserDbRow[]).map(toUser);
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
  const pool = await ready();
  const { rows } = await pool.query(
    "INSERT INTO users (team_id, username, password_hash, display_name, role, status, member_id, draft_pos1, draft_pos2, draft_back_no, draft_phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id",
    [
      teamId,
      u.username,
      u.passwordHash,
      u.displayName,
      u.role,
      u.status,
      u.memberId,
      u.draftPos1 ?? null,
      u.draftPos2 ?? null,
      u.draftBackNo ?? null,
      u.draftPhone ?? null,
    ]
  );
  return (await getUserById(teamId, rows[0].id))!;
}

export async function updateUserStatus(
  teamId: number,
  id: number,
  status: UserStatus,
  memberId: number | null,
  role?: UserRole
) {
  const pool = await ready();
  if (role) {
    await pool.query(
      "UPDATE users SET status=$1, member_id=$2, role=$3 WHERE id=$4 AND team_id=$5",
      [status, memberId, role, id, teamId]
    );
  } else {
    await pool.query(
      "UPDATE users SET status=$1, member_id=$2 WHERE id=$3 AND team_id=$4",
      [status, memberId, id, teamId]
    );
  }
}

export async function updateUserPassword(teamId: number, id: number, passwordHash: string) {
  const pool = await ready();
  await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2 AND team_id=$3", [
    passwordHash,
    id,
    teamId,
  ]);
}

// ---------- phone verification (아이디/비밀번호 찾기 SMS 인증) ----------
function toPhoneVerification(r: {
  id: number;
  phone: string;
  purpose: VerificationPurpose;
  code: string;
  attempts: number;
  consumed: boolean;
  expires_at: string;
  created_at: string;
}): PhoneVerificationRow {
  return {
    id: r.id,
    phone: r.phone,
    purpose: r.purpose,
    code: r.code,
    attempts: r.attempts,
    consumed: r.consumed,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}

export async function createPhoneVerification(
  teamId: number,
  v: { phone: string; purpose: VerificationPurpose; code: string; expiresAt: string }
): Promise<PhoneVerificationRow> {
  const pool = await ready();
  const { rows } = await pool.query(
    "INSERT INTO phone_verifications (team_id, phone, purpose, code, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [teamId, v.phone, v.purpose, v.code, v.expiresAt]
  );
  return toPhoneVerification(rows[0]);
}

export async function getLatestPhoneVerification(
  teamId: number,
  phone: string,
  purpose: VerificationPurpose
): Promise<PhoneVerificationRow | null> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM phone_verifications WHERE team_id=$1 AND phone=$2 AND purpose=$3 ORDER BY id DESC LIMIT 1",
    [teamId, phone, purpose]
  );
  return rows[0] ? toPhoneVerification(rows[0]) : null;
}

export async function incrementPhoneVerificationAttempts(id: number) {
  const pool = await ready();
  await pool.query(
    "UPDATE phone_verifications SET attempts = attempts + 1 WHERE id=$1",
    [id]
  );
}

export async function consumePhoneVerification(id: number) {
  const pool = await ready();
  await pool.query("UPDATE phone_verifications SET consumed=true WHERE id=$1", [id]);
}

// ---------- tactics jobs (전술 시뮬레이터 생성 작업) ----------
function toTacticsJob(r: {
  id: number;
  user_id: number;
  description: string;
  status: TacticsJobStatus;
  result: TacticsScene | null;
  error: string | null;
  raw_response: string | null;
  model: string;
  created_at: string;
}): TacticsJobRow {
  return {
    id: r.id,
    userId: r.user_id,
    description: r.description,
    status: r.status,
    result: r.result,
    error: r.error,
    rawResponse: r.raw_response,
    model: r.model,
    createdAt: r.created_at,
  };
}

export async function listTacticsJobs(teamId: number): Promise<TacticsJobRow[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM tactics_jobs WHERE team_id=$1 ORDER BY created_at DESC",
    [teamId]
  );
  return rows.map(toTacticsJob);
}

export async function createTacticsJob(
  teamId: number,
  userId: number,
  description: string,
  model: string
): Promise<TacticsJobRow> {
  const pool = await ready();
  // 오래된 작업이 계속 쌓이지 않게, 새 작업을 만들 때마다 하루 지난 것들을 지운다.
  await pool.query("DELETE FROM tactics_jobs WHERE created_at < now() - interval '1 day'");
  const { rows } = await pool.query(
    "INSERT INTO tactics_jobs (team_id, user_id, description, status, model) VALUES ($1, $2, $3, 'pending', $4) RETURNING *",
    [teamId, userId, description, model]
  );
  return toTacticsJob(rows[0]);
}

export async function getTacticsJob(teamId: number, id: number): Promise<TacticsJobRow | null> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM tactics_jobs WHERE id=$1 AND team_id=$2",
    [id, teamId]
  );
  return rows[0] ? toTacticsJob(rows[0]) : null;
}

// pending 상태일 때만 갱신한다 — 사용자가 취소한 작업이 뒤늦게 끝나서
// 결과를 덮어써버리는 걸 막는다.
export async function completeTacticsJob(
  id: number,
  result: TacticsScene,
  rawResponse: string | null
) {
  const pool = await ready();
  await pool.query(
    "UPDATE tactics_jobs SET status='done', result=$1, raw_response=$2 WHERE id=$3 AND status='pending'",
    [JSON.stringify(result), rawResponse, id]
  );
}

export async function failTacticsJob(id: number, error: string, rawResponse: string | null) {
  const pool = await ready();
  await pool.query(
    "UPDATE tactics_jobs SET status='error', error=$1, raw_response=$2 WHERE id=$3 AND status='pending'",
    [error, rawResponse, id]
  );
}

export async function cancelTacticsJob(id: number) {
  const pool = await ready();
  await pool.query(
    "UPDATE tactics_jobs SET status='cancelled' WHERE id=$1 AND status='pending'",
    [id]
  );
}

export async function deleteTacticsJob(teamId: number, id: number) {
  const pool = await ready();
  await pool.query("DELETE FROM tactics_jobs WHERE id=$1 AND team_id=$2", [id, teamId]);
}

// ---------- comments ----------
function toComment(r: {
  id: number;
  event_id: number;
  member_id: number;
  body: string;
  created_at: string;
}): CommentRow {
  return {
    id: r.id,
    eventId: r.event_id,
    memberId: r.member_id,
    body: r.body,
    createdAt: r.created_at,
  };
}

export async function getComments(teamId: number, eventId: number): Promise<CommentRow[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM comments WHERE event_id=$1 AND team_id=$2 ORDER BY created_at",
    [eventId, teamId]
  );
  return rows.map(toComment);
}

export async function addComment(
  teamId: number,
  eventId: number,
  memberId: number,
  body: string
): Promise<CommentRow> {
  const pool = await ready();
  const { rows } = await pool.query(
    "INSERT INTO comments (team_id, event_id, member_id, body) VALUES ($1, $2, $3, $4) RETURNING *",
    [teamId, eventId, memberId, body]
  );
  return toComment(rows[0]);
}

export async function getComment(teamId: number, id: number): Promise<CommentRow | null> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM comments WHERE id=$1 AND team_id=$2",
    [id, teamId]
  );
  return rows[0] ? toComment(rows[0]) : null;
}

export async function deleteComment(teamId: number, id: number) {
  const pool = await ready();
  await pool.query("DELETE FROM comments WHERE id=$1 AND team_id=$2", [id, teamId]);
}

function toHistorical(r: {
  member_id: number;
  games: number;
  goals: number;
  assists: number;
  clean_pts: number;
  bonus_pts: number;
}): HistoricalStats {
  return {
    memberId: r.member_id,
    games: r.games,
    goals: r.goals,
    assists: r.assists,
    cleanPts: r.clean_pts,
    bonusPts: r.bonus_pts,
  };
}

export async function getAllHistoricalStats(teamId: number): Promise<HistoricalStats[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM historical_stats WHERE team_id=$1",
    [teamId]
  );
  return rows.map(toHistorical);
}

export async function upsertHistoricalStats(teamId: number, stats: HistoricalStats) {
  const pool = await ready();
  await pool.query(
    `INSERT INTO historical_stats (team_id, member_id, games, goals, assists, clean_pts, bonus_pts)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (member_id) DO UPDATE SET
       games=EXCLUDED.games, goals=EXCLUDED.goals,
       assists=EXCLUDED.assists, clean_pts=EXCLUDED.clean_pts,
       bonus_pts=EXCLUDED.bonus_pts`,
    [
      teamId,
      stats.memberId,
      stats.games,
      stats.goals,
      stats.assists,
      stats.cleanPts,
      stats.bonusPts,
    ]
  );
}

export async function deleteHistoricalStats(teamId: number, memberId: number) {
  const pool = await ready();
  await pool.query("DELETE FROM historical_stats WHERE member_id=$1 AND team_id=$2", [
    memberId,
    teamId,
  ]);
}

function toAnnouncement(r: {
  id: number;
  title: string;
  body: string;
  author_name: string;
  category: AnnouncementCategory;
  feedback_date: string | null;
  created_at: string;
  updated_at: string;
}): AnnouncementRow {
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

export async function listAnnouncements(teamId: number): Promise<AnnouncementRow[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM announcements WHERE team_id=$1 ORDER BY created_at DESC",
    [teamId]
  );
  return rows.map(toAnnouncement);
}

export async function getAnnouncement(
  teamId: number,
  id: number
): Promise<AnnouncementRow | null> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM announcements WHERE id=$1 AND team_id=$2",
    [id, teamId]
  );
  return rows[0] ? toAnnouncement(rows[0]) : null;
}

export async function createAnnouncement(
  teamId: number,
  a: Omit<AnnouncementRow, "id" | "createdAt" | "updatedAt">
): Promise<AnnouncementRow> {
  const pool = await ready();
  const { rows } = await pool.query(
    "INSERT INTO announcements (team_id, title, body, author_name, category, feedback_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [teamId, a.title, a.body, a.authorName, a.category, a.feedbackDate]
  );
  return (await getAnnouncement(teamId, rows[0].id))!;
}

export async function updateAnnouncement(
  teamId: number,
  id: number,
  patch: { title: string; body: string; feedbackDate?: string | null }
) {
  const pool = await ready();
  if (patch.feedbackDate !== undefined) {
    await pool.query(
      "UPDATE announcements SET title=$1, body=$2, feedback_date=$3, updated_at=now() WHERE id=$4 AND team_id=$5",
      [patch.title, patch.body, patch.feedbackDate, id, teamId]
    );
    return;
  }
  await pool.query(
    "UPDATE announcements SET title=$1, body=$2, updated_at=now() WHERE id=$3 AND team_id=$4",
    [patch.title, patch.body, id, teamId]
  );
}

export async function deleteAnnouncement(teamId: number, id: number) {
  const pool = await ready();
  await pool.query("DELETE FROM announcements WHERE id=$1 AND team_id=$2", [id, teamId]);
}

// ---------- 명예의 전당 ----------
function toHallOfFame(r: {
  id: number;
  year: number;
  captain_id: number | null;
  vice_captain_id: number | null;
  manager_id: number | null;
  top_scorer_id: number | null;
  top_assist_id: number | null;
  clean_sheet_first_id: number | null;
  overall_first_id: number | null;
}): HallOfFameRow {
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

export async function listHallOfFame(teamId: number): Promise<HallOfFameRow[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM hall_of_fame WHERE team_id=$1 ORDER BY year DESC",
    [teamId]
  );
  return rows.map(toHallOfFame);
}

export async function upsertHallOfFame(
  teamId: number,
  entry: Omit<HallOfFameRow, "id">
): Promise<HallOfFameRow> {
  const pool = await ready();
  const { rows } = await pool.query(
    `INSERT INTO hall_of_fame (team_id, year, captain_id, vice_captain_id, manager_id, top_scorer_id, top_assist_id, clean_sheet_first_id, overall_first_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (team_id, year) DO UPDATE SET
       captain_id=EXCLUDED.captain_id, vice_captain_id=EXCLUDED.vice_captain_id,
       manager_id=EXCLUDED.manager_id, top_scorer_id=EXCLUDED.top_scorer_id,
       top_assist_id=EXCLUDED.top_assist_id, clean_sheet_first_id=EXCLUDED.clean_sheet_first_id,
       overall_first_id=EXCLUDED.overall_first_id
     RETURNING *`,
    [
      teamId,
      entry.year,
      entry.captainId,
      entry.viceCaptainId,
      entry.managerId,
      entry.topScorerId,
      entry.topAssistId,
      entry.cleanSheetFirstId,
      entry.overallFirstId,
    ]
  );
  return toHallOfFame(rows[0]);
}

export async function deleteHallOfFame(teamId: number, id: number) {
  const pool = await ready();
  await pool.query("DELETE FROM hall_of_fame WHERE id=$1 AND team_id=$2", [id, teamId]);
}

// ---------- 웹 푸시 구독 ----------
export async function savePushSubscription(
  teamId: number,
  sub: { endpoint: string; p256dh: string; auth: string; memberId: number | null }
) {
  const pool = await ready();
  await pool.query(
    `INSERT INTO push_subscriptions (team_id, endpoint, p256dh, auth, member_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, member_id=EXCLUDED.member_id`,
    [teamId, sub.endpoint, sub.p256dh, sub.auth, sub.memberId]
  );
}

export async function getAllPushSubscriptions(
  teamId: number
): Promise<{ endpoint: string; p256dh: string; auth: string; memberId: number | null }[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    'SELECT endpoint, p256dh, auth, member_id AS "memberId" FROM push_subscriptions WHERE team_id=$1',
    [teamId]
  );
  return rows;
}

export async function deletePushSubscription(endpoint: string) {
  const pool = await ready();
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [endpoint]);
}

// ---------- 이벤트 투표(폴) ----------
function toPoll(r: {
  id: number;
  title: string;
  created_by: number;
  created_at: string;
  closed: boolean;
  multi_select: boolean;
}): Poll {
  return {
    id: r.id,
    title: r.title,
    createdBy: r.created_by,
    createdAt: r.created_at,
    closed: !!r.closed,
    multiSelect: !!r.multi_select,
  };
}

function toPollOption(r: {
  id: number;
  poll_id: number;
  label: string;
  order_idx: number;
}): PollOption {
  return { id: r.id, pollId: r.poll_id, label: r.label, order: r.order_idx };
}

export async function listPolls(teamId: number): Promise<Poll[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM polls WHERE team_id=$1 ORDER BY created_at DESC",
    [teamId]
  );
  return rows.map(toPoll);
}

export async function getPoll(teamId: number, id: number): Promise<Poll | null> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM polls WHERE id=$1 AND team_id=$2",
    [id, teamId]
  );
  return rows[0] ? toPoll(rows[0]) : null;
}

export async function getAllPollOptions(teamId: number): Promise<PollOption[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT * FROM poll_options WHERE team_id=$1 ORDER BY poll_id, order_idx",
    [teamId]
  );
  return rows.map(toPollOption);
}

export async function createPoll(
  teamId: number,
  title: string,
  options: string[],
  createdBy: number,
  multiSelect: boolean
): Promise<Poll> {
  const pool = await ready();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "INSERT INTO polls (team_id, title, created_by, multi_select) VALUES ($1, $2, $3, $4) RETURNING *",
      [teamId, title, createdBy, multiSelect]
    );
    const poll = toPoll(rows[0]);
    let order = 0;
    for (const label of options) {
      await client.query(
        "INSERT INTO poll_options (team_id, poll_id, label, order_idx) VALUES ($1, $2, $3, $4)",
        [teamId, poll.id, label, order++]
      );
    }
    await client.query("COMMIT");
    return poll;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function setPollClosed(teamId: number, id: number, closed: boolean) {
  const pool = await ready();
  await pool.query("UPDATE polls SET closed=$1 WHERE id=$2 AND team_id=$3", [
    closed,
    id,
    teamId,
  ]);
}

export async function addPollOption(
  teamId: number,
  pollId: number,
  label: string
): Promise<PollOption> {
  const pool = await ready();
  const { rows: maxRows } = await pool.query(
    "SELECT COALESCE(MAX(order_idx), -1) AS m FROM poll_options WHERE poll_id=$1 AND team_id=$2",
    [pollId, teamId]
  );
  const order = Number(maxRows[0].m) + 1;
  const { rows } = await pool.query(
    "INSERT INTO poll_options (team_id, poll_id, label, order_idx) VALUES ($1, $2, $3, $4) RETURNING *",
    [teamId, pollId, label, order]
  );
  return toPollOption(rows[0]);
}

export async function deletePoll(teamId: number, id: number) {
  const pool = await ready();
  await pool.query("DELETE FROM poll_votes WHERE poll_id=$1 AND team_id=$2", [id, teamId]);
  await pool.query("DELETE FROM poll_options WHERE poll_id=$1 AND team_id=$2", [id, teamId]);
  await pool.query("DELETE FROM polls WHERE id=$1 AND team_id=$2", [id, teamId]);
}

export async function getAllPollVotes(teamId: number): Promise<PollVoteRow[]> {
  const pool = await ready();
  const { rows } = await pool.query("SELECT * FROM poll_votes WHERE team_id=$1", [teamId]);
  return rows.map((r) => ({
    pollId: r.poll_id,
    memberId: r.member_id,
    optionId: r.option_id,
  }));
}

export async function setPollVote(
  teamId: number,
  pollId: number,
  memberId: number,
  optionIds: number[]
) {
  const pool = await ready();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM poll_votes WHERE poll_id=$1 AND member_id=$2 AND team_id=$3",
      [pollId, memberId, teamId]
    );
    for (const optionId of optionIds) {
      await client.query(
        "INSERT INTO poll_votes (team_id, poll_id, member_id, option_id) VALUES ($1, $2, $3, $4)",
        [teamId, pollId, memberId, optionId]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
