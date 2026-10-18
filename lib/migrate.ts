import { Pool } from "pg";
import { createTeam, getTeamBySlug, updateTeamFineSettings } from "./db";
import { currentSeason } from "./season";

// 레이븐/블룸 같은 기존 단독(싱글테넌트) 배포의 운영 DB에서 데이터를 가져와
// 플랫폼(멀티테넌트)의 새 팀으로 복사하는 1회성 이관 도구. 두 코드베이스
// 모두 raven-fc에서 갈라져 나온 거라 테이블 구조는 거의 같지만, team_id가
// 없고(싱글테넌트) 일부 컬럼이 서로 다르다(예: historical_stats의 year,
// events의 scrimmage_squad는 한쪽에만 있을 수 있음) — 그래서 모든 컬럼을
// 선택적으로 다루고, SERIAL id는 전부 새로 발급받아 매핑 테이블로
// 외래키(event_id·member_id·user_id·poll_id·option_id)를 다시 연결한다.
//
// Vercel Hobby 플랜의 Serverless Function 실행 시간 상한(300초) 안에
// 끝내야 해서, 테이블 안에서는 행을 한 줄씩 순서대로 쓰지 않고 동시에
// 여러 개씩(concurrency) 묶어서 쓴다 — 테이블 사이에는 이전 테이블이
// 만든 id 매핑이 필요하니 순서를 지킨다.

function jsonb(v: unknown): string | null {
  return v == null ? null : JSON.stringify(v);
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1",
    [name]
  );
  return rows.length > 0;
}

async function runConcurrent<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 8
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function runner() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await worker(items[current]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runner)
  );
  return results;
}

export interface MigrationReport {
  teamId: number;
  counts: Record<string, number>;
}

export async function migrateTeamData(opts: {
  sourceUrl: string;
  teamSlug: string;
  teamName: string;
  fineAccount?: string;
}): Promise<MigrationReport> {
  const existing = await getTeamBySlug(opts.teamSlug);
  if (existing) {
    throw new Error(
      `slug "${opts.teamSlug}"은 이미 존재하는 팀이에요. 다시 실행하면 데이터가 중복돼요 — 다른 slug를 쓰거나, 먼저 그 팀을 정리해 주세요.`
    );
  }

  const srcPool = new Pool({
    connectionString: opts.sourceUrl,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: /supabase|sslmode=require/.test(opts.sourceUrl)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  // createTeam이 내부적으로 플랫폼 DB의 스키마 초기화(ready())를 거치므로,
  // 이후 raw SQL로 같은 DB에 써도 테이블이 보장된다.
  const team = await createTeam({ slug: opts.teamSlug, name: opts.teamName });
  if (opts.fineAccount) {
    await updateTeamFineSettings(team.id, { fineAccount: opts.fineAccount });
  }
  const teamId = team.id;

  const destPool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: /supabase|sslmode=require/.test(process.env.DATABASE_URL ?? "")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const counts: Record<string, number> = {};

  try {
    const memberIdMap = new Map<number, number>();
    const eventIdMap = new Map<number, number>();
    const userIdMap = new Map<number, number>();
    const pollIdMap = new Map<number, number>();
    const pollOptionIdMap = new Map<number, number>();

    // ---------- members ----------
    const { rows: members } = await srcPool.query("SELECT * FROM members ORDER BY id");
    await runConcurrent(members, async (m) => {
      const { rows } = await destPool.query(
        `INSERT INTO members (team_id, name, back_no, pos1, pos2, is_guest, phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [teamId, m.name, m.back_no, m.pos1, m.pos2, m.is_guest ?? false, m.phone ?? null]
      );
      memberIdMap.set(m.id, rows[0].id);
    });
    counts.members = members.length;

    // ---------- events ----------
    const { rows: events } = await srcPool.query("SELECT * FROM events ORDER BY id");
    await runConcurrent(events, async (e) => {
      const { rows } = await destPool.query(
        `INSERT INTO events (
           team_id, title, type, date, time, location, opponent, scored, conceded,
           squad, scrimmage_squad, notes, duty_offense, duty_defense, water_duty,
           icebox_duty, record_log, equipment_reminder_sent
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17::jsonb,$18)
         RETURNING id`,
        [
          teamId,
          e.title,
          e.type,
          e.date,
          e.time ?? "",
          e.location ?? "",
          e.opponent ?? "",
          e.scored,
          e.conceded,
          jsonb(e.squad),
          jsonb(e.scrimmage_squad),
          e.notes ?? "",
          e.duty_offense ?? "",
          e.duty_defense ?? "",
          e.water_duty ?? "",
          e.icebox_duty ?? "",
          jsonb(e.record_log),
          e.equipment_reminder_sent ?? false,
        ]
      );
      eventIdMap.set(e.id, rows[0].id);
    });
    counts.events = events.length;

    // ---------- votes ----------
    const { rows: votes } = await srcPool.query("SELECT * FROM votes");
    const votesToInsert = votes.filter(
      (v) => eventIdMap.has(v.event_id) && memberIdMap.has(v.member_id)
    );
    await runConcurrent(votesToInsert, (v) =>
      destPool.query(
        `INSERT INTO votes (team_id, event_id, member_id, status) VALUES ($1,$2,$3,$4)
         ON CONFLICT (event_id, member_id) DO NOTHING`,
        [teamId, eventIdMap.get(v.event_id), memberIdMap.get(v.member_id), v.status]
      )
    );
    counts.votes = votesToInsert.length;

    // ---------- records ----------
    const { rows: records } = await srcPool.query("SELECT * FROM records");
    const recordsToInsert = records.filter(
      (r) => eventIdMap.has(r.event_id) && memberIdMap.has(r.member_id)
    );
    await runConcurrent(recordsToInsert, (r) =>
      destPool.query(
        `INSERT INTO records (team_id, event_id, member_id, played, goals, assists, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (event_id, member_id) DO NOTHING`,
        [
          teamId,
          eventIdMap.get(r.event_id),
          memberIdMap.get(r.member_id),
          r.played ?? 0,
          r.goals ?? 0,
          r.assists ?? 0,
          r.position ?? "",
        ]
      )
    );
    counts.records = recordsToInsert.length;

    // ---------- mvp_votes ----------
    const { rows: mvpVotes } = await srcPool.query("SELECT * FROM mvp_votes");
    const mvpToInsert = mvpVotes.filter(
      (v) =>
        eventIdMap.has(v.event_id) &&
        memberIdMap.has(v.voter_id) &&
        memberIdMap.has(v.votee_id)
    );
    await runConcurrent(mvpToInsert, (v) =>
      destPool.query(
        `INSERT INTO mvp_votes (team_id, event_id, voter_id, votee_id) VALUES ($1,$2,$3,$4)
         ON CONFLICT (event_id, voter_id) DO NOTHING`,
        [
          teamId,
          eventIdMap.get(v.event_id),
          memberIdMap.get(v.voter_id),
          memberIdMap.get(v.votee_id),
        ]
      )
    );
    counts.mvpVotes = mvpToInsert.length;

    // ---------- users (비밀번호 해시는 그대로 복사 — 동일한 bcrypt 방식) ----------
    const { rows: users } = await srcPool.query("SELECT * FROM users ORDER BY id");
    await runConcurrent(users, async (u) => {
      const newMemberId = u.member_id != null ? memberIdMap.get(u.member_id) ?? null : null;
      const { rows } = await destPool.query(
        `INSERT INTO users (
           team_id, username, password_hash, display_name, role, status, member_id,
           created_at, draft_pos1, draft_pos2, draft_back_no, draft_phone
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [
          teamId,
          u.username,
          u.password_hash,
          u.display_name,
          u.role,
          u.status,
          newMemberId,
          u.created_at,
          u.draft_pos1 ?? null,
          u.draft_pos2 ?? null,
          u.draft_back_no ?? null,
          u.draft_phone ?? null,
        ]
      );
      userIdMap.set(u.id, rows[0].id);
    });
    counts.users = users.length;

    // ---------- comments ----------
    const { rows: comments } = await srcPool.query("SELECT * FROM comments ORDER BY id");
    const commentsToInsert = comments.filter(
      (c) => eventIdMap.has(c.event_id) && memberIdMap.has(c.member_id)
    );
    await runConcurrent(commentsToInsert, (c) =>
      destPool.query(
        `INSERT INTO comments (team_id, event_id, member_id, body, created_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [teamId, eventIdMap.get(c.event_id), memberIdMap.get(c.member_id), c.body, c.created_at]
      )
    );
    counts.comments = commentsToInsert.length;

    // ---------- historical_stats (레이븐은 year 컬럼이 없어 기본 시즌값을 쓴다) ----------
    const { rows: historical } = await srcPool.query("SELECT * FROM historical_stats");
    const fallbackYear = currentSeason();
    const historicalToInsert = historical.filter((h) => memberIdMap.has(h.member_id));
    await runConcurrent(historicalToInsert, (h) =>
      destPool.query(
        `INSERT INTO historical_stats (team_id, member_id, year, games, goals, assists, clean_pts, bonus_pts)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (team_id, member_id, year) DO NOTHING`,
        [
          teamId,
          memberIdMap.get(h.member_id),
          h.year ?? fallbackYear,
          h.games ?? 0,
          h.goals ?? 0,
          h.assists ?? 0,
          h.clean_pts ?? 0,
          h.bonus_pts ?? 0,
        ]
      )
    );
    counts.historicalStats = historicalToInsert.length;

    // ---------- announcements ----------
    const { rows: announcements } = await srcPool.query(
      "SELECT * FROM announcements ORDER BY id"
    );
    await runConcurrent(announcements, (a) =>
      destPool.query(
        `INSERT INTO announcements (team_id, title, body, author_name, category, feedback_date, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          teamId,
          a.title,
          a.body,
          a.author_name,
          a.category ?? "notice",
          a.feedback_date ?? null,
          a.created_at,
          a.updated_at,
        ]
      )
    );
    counts.announcements = announcements.length;

    // ---------- hall_of_fame ----------
    const { rows: hof } = await srcPool.query("SELECT * FROM hall_of_fame ORDER BY id");
    const remapMember = (id: number | null) => (id == null ? null : memberIdMap.get(id) ?? null);
    await runConcurrent(hof, (h) =>
      destPool.query(
        `INSERT INTO hall_of_fame (
           team_id, year, captain_id, vice_captain_id, manager_id, top_scorer_id,
           top_assist_id, clean_sheet_first_id, overall_first_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (team_id, year) DO NOTHING`,
        [
          teamId,
          h.year,
          remapMember(h.captain_id),
          remapMember(h.vice_captain_id),
          remapMember(h.manager_id),
          remapMember(h.top_scorer_id),
          remapMember(h.top_assist_id),
          remapMember(h.clean_sheet_first_id),
          remapMember(h.overall_first_id),
        ]
      )
    );
    counts.hallOfFame = hof.length;

    // ---------- opponent_kits (레이븐에만 있음) ----------
    if (await tableExists(srcPool, "opponent_kits")) {
      const { rows: kits } = await srcPool.query("SELECT * FROM opponent_kits");
      await runConcurrent(kits, (k) =>
        destPool.query(
          `INSERT INTO opponent_kits (team_id, team_name, color, updated_at)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (team_id, team_name) DO NOTHING`,
          [teamId, k.team_name, k.color, k.updated_at]
        )
      );
      counts.opponentKits = kits.length;
    } else {
      counts.opponentKits = 0;
    }

    // ---------- polls / poll_options / poll_votes ----------
    const { rows: polls } = await srcPool.query("SELECT * FROM polls ORDER BY id");
    const pollsToInsert = polls.filter((p) => userIdMap.has(p.created_by));
    await runConcurrent(pollsToInsert, async (p) => {
      const { rows } = await destPool.query(
        `INSERT INTO polls (team_id, title, created_by, created_at, closed, multi_select)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          teamId,
          p.title,
          userIdMap.get(p.created_by),
          p.created_at,
          p.closed ?? false,
          p.multi_select ?? true,
        ]
      );
      pollIdMap.set(p.id, rows[0].id);
    });
    counts.polls = pollsToInsert.length;

    const { rows: pollOptions } = await srcPool.query(
      "SELECT * FROM poll_options ORDER BY id"
    );
    const pollOptionsToInsert = pollOptions.filter((o) => pollIdMap.has(o.poll_id));
    await runConcurrent(pollOptionsToInsert, async (o) => {
      const { rows } = await destPool.query(
        `INSERT INTO poll_options (team_id, poll_id, label, order_idx) VALUES ($1,$2,$3,$4) RETURNING id`,
        [teamId, pollIdMap.get(o.poll_id), o.label, o.order_idx ?? 0]
      );
      pollOptionIdMap.set(o.id, rows[0].id);
    });
    counts.pollOptions = pollOptionsToInsert.length;

    const { rows: pollVotes } = await srcPool.query("SELECT * FROM poll_votes");
    const pollVotesToInsert = pollVotes.filter(
      (v) =>
        pollIdMap.has(v.poll_id) &&
        memberIdMap.has(v.member_id) &&
        pollOptionIdMap.has(v.option_id)
    );
    await runConcurrent(pollVotesToInsert, (v) =>
      destPool.query(
        `INSERT INTO poll_votes (team_id, poll_id, member_id, option_id) VALUES ($1,$2,$3,$4)
         ON CONFLICT (poll_id, member_id, option_id) DO NOTHING`,
        [
          teamId,
          pollIdMap.get(v.poll_id),
          memberIdMap.get(v.member_id),
          pollOptionIdMap.get(v.option_id),
        ]
      )
    );
    counts.pollVotes = pollVotesToInsert.length;

    // push_subscriptions, phone_verifications는 기기/세션에 종속된 일시 데이터라
    // 일부러 옮기지 않는다 — 새 팀에서는 다시 구독·인증하면 된다.

    return { teamId, counts };
  } finally {
    await srcPool.end().catch(() => {});
    await destPool.end().catch(() => {});
  }
}
