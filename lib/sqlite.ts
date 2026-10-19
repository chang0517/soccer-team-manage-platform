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
      logo_url TEXT,
      fine_account TEXT NOT NULL DEFAULT '',
      fine_amount TEXT NOT NULL DEFAULT '20,000원',
      score_participation REAL NOT NULL DEFAULT 1.5,
      score_goal REAL NOT NULL DEFAULT 1.4,
      score_assist REAL NOT NULL DEFAULT 1.25,
      score_clean_defence REAL NOT NULL DEFAULT 1.25,
      score_clean_dm REAL NOT NULL DEFAULT 0.625,
      calendar_token TEXT,
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
      equipment_reminder_sent INTEGER NOT NULL DEFAULT 0,
      mvp_open_notified INTEGER NOT NULL DEFAULT 0,
      mvp_result_notified INTEGER NOT NULL DEFAULT 0
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
      member_id INTEGER NOT NULL,
      year INTEGER NOT NULL DEFAULT 0,
      games INTEGER NOT NULL DEFAULT 0,
      goals INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      clean_pts REAL NOT NULL DEFAULT 0,
      bonus_pts REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (team_id, member_id, year)
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
    CREATE TABLE IF NOT EXISTS opponent_kits (
      team_id INTEGER NOT NULL,
      team_name TEXT NOT NULL,
      color TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (team_id, team_name)
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
    CREATE TABLE IF NOT EXISTS team_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      day_of_month INTEGER NOT NULL,
      open_time TEXT NOT NULL,
      lead_minutes INTEGER NOT NULL DEFAULT 60,
      target TEXT NOT NULL DEFAULT 'all',
      member_ids TEXT
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reminder_sends (
      team_id INTEGER NOT NULL,
      reminder_id INTEGER NOT NULL,
      period TEXT NOT NULL,
      PRIMARY KEY (reminder_id, period)
    );
  `);
  // 예전에 만들어진 로컬 DB에는 나중에 추가한 컬럼을 붙여준다.
  const reminderCols = db.prepare("PRAGMA table_info(team_reminders)").all() as { name: string }[];
  if (!reminderCols.some((c) => c.name === "member_ids")) {
    db.exec("ALTER TABLE team_reminders ADD COLUMN member_ids TEXT");
  }
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
  logo_url: string | null;
  fine_account: string;
  fine_amount: string;
  score_participation: number;
  score_goal: number;
  score_assist: number;
  score_clean_defence: number;
  score_clean_dm: number;
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
    scoreRules: {
      participation: r.score_participation,
      goal: r.score_goal,
      assist: r.score_assist,
      cleanSheetDefence: r.score_clean_defence,
      cleanSheetDm: r.score_clean_dm,
    },
    createdAt: r.created_at,
  };
}

export function ensureCalendarToken(teamId: number, fresh: string): string {
  const db = getDb();
  db.prepare("UPDATE teams SET calendar_token=? WHERE id=? AND calendar_token IS NULL").run(fresh, teamId);
  return (db.prepare("SELECT calendar_token FROM teams WHERE id=?").get(teamId) as { calendar_token: string }).calendar_token;
}

export function getTeamIdByCalendarToken(token: string): number | null {
  const row = getDb().prepare("SELECT id FROM teams WHERE calendar_token=?").get(token) as
    | { id: number }
    | undefined;
  return row?.id ?? null;
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

export function updateTeamScoreRules(teamId: number, patch: Partial<ScoreRules>) {
  const cur = getTeamById(teamId);
  if (!cur) return;
  const rules = { ...cur.scoreRules, ...patch };
  getDb()
    .prepare(
      `UPDATE teams SET score_participation=?, score_goal=?, score_assist=?,
         score_clean_defence=?, score_clean_dm=? WHERE id=?`
    )
    .run(
      rules.participation,
      rules.goal,
      rules.assist,
      rules.cleanSheetDefence,
      rules.cleanSheetDm,
      teamId
    );
}

export function updateTeamLogo(teamId: number, logoUrl: string | null) {
  getDb().prepare("UPDATE teams SET logo_url=? WHERE id=?").run(logoUrl, teamId);
}

export function updateTeamName(teamId: number, name: string) {
  getDb().prepare("UPDATE teams SET name=? WHERE id=?").run(name, teamId);
}

export function renameTeamSlug(teamId: number, newSlug: string) {
  getDb().prepare("UPDATE teams SET slug=? WHERE id=?").run(newSlug, teamId);
}

export function deleteTeam(teamId: number) {
  const tables = [
    "votes",
    "records",
    "mvp_votes",
    "comments",
    "historical_stats",
    "announcements",
    "hall_of_fame",
    "opponent_kits",
    "push_subscriptions",
    "poll_votes",
    "poll_options",
    "polls",
    "phone_verifications",
    "reminder_sends",
    "team_reminders",
    "users",
    "events",
    "members",
  ];
  const db = getDb();
  for (const t of tables) {
    db.prepare(`DELETE FROM ${t} WHERE team_id=?`).run(teamId);
  }
  db.prepare("DELETE FROM teams WHERE id=?").run(teamId);
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

export function deleteUserRow(teamId: number, id: number) {
  getDb().prepare("DELETE FROM users WHERE id=? AND team_id=?").run(id, teamId);
}

export function purgeMemberRows(teamId: number, memberId: number) {
  const db = getDb();
  db.transaction(() => {
    for (const t of ["votes", "records", "comments", "historical_stats", "poll_votes", "push_subscriptions"]) {
      db.prepare(`DELETE FROM ${t} WHERE member_id=? AND team_id=?`).run(memberId, teamId);
    }
    db.prepare("DELETE FROM mvp_votes WHERE (voter_id=? OR votee_id=?) AND team_id=?").run(memberId, memberId, teamId);
    const polls = db.prepare("SELECT id FROM polls WHERE created_by=? AND team_id=?").all(memberId, teamId) as { id: number }[];
    for (const p of polls) {
      db.prepare("DELETE FROM poll_votes WHERE poll_id=? AND team_id=?").run(p.id, teamId);
      db.prepare("DELETE FROM poll_options WHERE poll_id=? AND team_id=?").run(p.id, teamId);
      db.prepare("DELETE FROM polls WHERE id=? AND team_id=?").run(p.id, teamId);
    }
    db.prepare("UPDATE hall_of_fame SET captain_id=NULL WHERE captain_id=? AND team_id=?").run(memberId, teamId);
    db.prepare("UPDATE hall_of_fame SET vice_captain_id=NULL WHERE vice_captain_id=? AND team_id=?").run(memberId, teamId);
    db.prepare("UPDATE hall_of_fame SET manager_id=NULL WHERE manager_id=? AND team_id=?").run(memberId, teamId);
    db.prepare("UPDATE hall_of_fame SET top_scorer_id=NULL WHERE top_scorer_id=? AND team_id=?").run(memberId, teamId);
    db.prepare("UPDATE hall_of_fame SET top_assist_id=NULL WHERE top_assist_id=? AND team_id=?").run(memberId, teamId);
    db.prepare("UPDATE hall_of_fame SET clean_sheet_first_id=NULL WHERE clean_sheet_first_id=? AND team_id=?").run(memberId, teamId);
    db.prepare("UPDATE hall_of_fame SET overall_first_id=NULL WHERE overall_first_id=? AND team_id=?").run(memberId, teamId);
    db.prepare("UPDATE users SET member_id=NULL WHERE member_id=? AND team_id=?").run(memberId, teamId);
    db.prepare("DELETE FROM members WHERE id=? AND team_id=?").run(memberId, teamId);
  })();
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
  mvp_open_notified: number;
  mvp_result_notified: number;
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
    mvpOpenNotified: !!r.mvp_open_notified,
    mvpResultNotified: !!r.mvp_result_notified,
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
    | "id"
    | "squad"
    | "scrimmageSquad"
    | "scored"
    | "conceded"
    | "equipmentReminderSent"
    | "mvpOpenNotified"
    | "mvpResultNotified"
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

// pg.ts의 같은 함수 설명 참고 — better-sqlite3는 동기라 트랜잭션 하나로 충분하다.
export function mutateEventRecordLog(
  teamId: number,
  id: number,
  fn: (log: EventItem["recordLog"]) => {
    scored: number | null;
    conceded: number | null;
    recordLog: QuarterRecordEntry[];
  }
): QuarterRecordEntry[] | null {
  const db = getDb();
  return db.transaction(() => {
    const row = db
      .prepare("SELECT record_log FROM events WHERE id=? AND team_id=?")
      .get(id, teamId) as { record_log: string | null } | undefined;
    if (!row) return null;
    const next = fn(row.record_log ? JSON.parse(row.record_log) : null);
    db.prepare(
      "UPDATE events SET scored=?, conceded=?, record_log=? WHERE id=? AND team_id=?"
    ).run(next.scored, next.conceded, JSON.stringify(next.recordLog), id, teamId);
    return next.recordLog;
  })();
}

export function mutateEventSquad(
  teamId: number,
  id: number,
  field: "squad" | "scrimmageSquad",
  fn: (cur: SquadData | null) => SquadData | null
): { before: SquadData | null; after: SquadData | null } | null {
  const col = field === "squad" ? "squad" : "scrimmage_squad";
  const db = getDb();
  return db.transaction(() => {
    const row = db
      .prepare(`SELECT ${col} AS v FROM events WHERE id=? AND team_id=?`)
      .get(id, teamId) as { v: string | null } | undefined;
    if (!row) return null;
    const before = row.v ? (JSON.parse(row.v) as SquadData) : null;
    const after = fn(before);
    db.prepare(`UPDATE events SET ${col}=? WHERE id=? AND team_id=?`).run(
      after ? JSON.stringify(after) : null,
      id,
      teamId
    );
    return { before, after };
  })();
}

export function getAppSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM app_settings WHERE key=?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setAppSetting(key: string, value: string) {
  getDb()
    .prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(key, value);
}

type ReminderDbRow = {
  id: number;
  team_id: number;
  title: string;
  day_of_month: number;
  open_time: string;
  lead_minutes: number;
  target: string;
  member_ids: string | null;
};
const parseIds = (v: string | null): number[] => {
  try {
    const a = JSON.parse(v ?? "[]");
    return Array.isArray(a) ? a.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
};
const toReminder = (r: ReminderDbRow): TeamReminder & { teamId: number } => ({
  id: r.id,
  teamId: r.team_id,
  title: r.title,
  dayOfMonth: r.day_of_month,
  openTime: r.open_time,
  leadMinutes: r.lead_minutes,
  target: r.target === "admins" || r.target === "members" ? r.target : "all",
  memberIds: parseIds(r.member_ids),
});

export function listReminders(teamId: number | null) {
  const db = getDb();
  const rows = (teamId == null
    ? db.prepare("SELECT * FROM team_reminders ORDER BY id").all()
    : db.prepare("SELECT * FROM team_reminders WHERE team_id=? ORDER BY day_of_month, open_time").all(teamId)) as ReminderDbRow[];
  return rows.map(toReminder);
}

export function createReminder(teamId: number, r: Omit<TeamReminder, "id">) {
  const db = getDb();
  const info = db
    .prepare("INSERT INTO team_reminders (team_id, title, day_of_month, open_time, lead_minutes, target, member_ids) VALUES (?,?,?,?,?,?,?)")
    .run(teamId, r.title, r.dayOfMonth, r.openTime, r.leadMinutes, r.target, JSON.stringify(r.memberIds));
  return toReminder(db.prepare("SELECT * FROM team_reminders WHERE id=?").get(Number(info.lastInsertRowid)) as ReminderDbRow);
}

export function updateReminderRecipients(
  teamId: number,
  id: number,
  target: TeamReminder["target"],
  memberIds: number[]
) {
  const db = getDb();
  db.prepare("UPDATE team_reminders SET target=?, member_ids=? WHERE id=? AND team_id=?").run(
    target,
    JSON.stringify(memberIds),
    id,
    teamId
  );
  const row = db.prepare("SELECT * FROM team_reminders WHERE id=? AND team_id=?").get(id, teamId) as
    | ReminderDbRow
    | undefined;
  return row ? toReminder(row) : null;
}

export function deleteReminder(teamId: number, id: number) {
  getDb().prepare("DELETE FROM team_reminders WHERE id=? AND team_id=?").run(id, teamId);
}

export function claimReminderSend(teamId: number, reminderId: number, period: string) {
  const r = getDb()
    .prepare("INSERT OR IGNORE INTO reminder_sends (team_id, reminder_id, period) VALUES (?,?,?)")
    .run(teamId, reminderId, period);
  return r.changes > 0;
}

export function claimEventFlag(
  teamId: number,
  id: number,
  flag: "mvp_open_notified" | "mvp_result_notified"
): boolean {
  const r = getDb()
    .prepare(`UPDATE events SET ${flag}=1 WHERE id=? AND team_id=? AND ${flag}=0`)
    .run(id, teamId);
  return r.changes > 0;
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

export function deleteVote(teamId: number, eventId: number, memberId: number) {
  getDb()
    .prepare("DELETE FROM votes WHERE team_id=? AND event_id=? AND member_id=?")
    .run(teamId, eventId, memberId);
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
  year: number;
  games: number;
  goals: number;
  assists: number;
  clean_pts: number;
  bonus_pts: number;
};

function toHistorical(r: HistoricalDbRow): HistoricalStats {
  return {
    memberId: r.member_id,
    year: r.year,
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
      `INSERT INTO historical_stats (team_id, member_id, year, games, goals, assists, clean_pts, bonus_pts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(team_id, member_id, year) DO UPDATE SET
         games=excluded.games, goals=excluded.goals,
         assists=excluded.assists, clean_pts=excluded.clean_pts,
         bonus_pts=excluded.bonus_pts`
    )
    .run(
      teamId,
      stats.memberId,
      stats.year,
      stats.games,
      stats.goals,
      stats.assists,
      stats.cleanPts,
      stats.bonusPts
    );
}

export function deleteHistoricalStats(teamId: number, memberId: number, year: number) {
  getDb()
    .prepare("DELETE FROM historical_stats WHERE member_id=? AND team_id=? AND year=?")
    .run(memberId, teamId, year);
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

// ---------- 상대팀 유니폼 색 ----------
type OpponentKitDbRow = {
  team_name: string;
  color: string;
  updated_at: string;
};

function toOpponentKit(r: OpponentKitDbRow): OpponentKitRow {
  return { teamName: r.team_name, color: r.color, updatedAt: r.updated_at };
}

export function listOpponentKits(teamId: number): OpponentKitRow[] {
  const rows = getDb()
    .prepare("SELECT team_name, color, updated_at FROM opponent_kits WHERE team_id=?")
    .all(teamId) as OpponentKitDbRow[];
  return rows.map(toOpponentKit);
}

export function upsertOpponentKit(
  teamId: number,
  teamName: string,
  color: string
): OpponentKitRow {
  const updatedAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO opponent_kits (team_id, team_name, color, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(team_id, team_name) DO UPDATE SET color=excluded.color, updated_at=excluded.updated_at`
    )
    .run(teamId, teamName, color, updatedAt);
  return { teamName, color, updatedAt };
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
