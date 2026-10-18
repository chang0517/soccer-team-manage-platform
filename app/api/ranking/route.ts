import { getSessionUser } from "@/lib/auth";
import {
  getAllHistoricalStats,
  getAllMvpVotes,
  getAllRecords,
  getTeamById,
  listEvents,
  listMembers,
} from "@/lib/db";
import { computeRanking } from "@/lib/points";
import { DEFAULT_SCORE_RULES } from "@/lib/types";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const seasonParam = new URL(request.url).searchParams.get("season");
  const season = seasonParam ? Number(seasonParam) : null;
  const [members, events, records, mvpVotes, historical, team] = await Promise.all([
    listMembers(session.teamId),
    listEvents(session.teamId),
    getAllRecords(session.teamId),
    getAllMvpVotes(session.teamId),
    getAllHistoricalStats(session.teamId),
    getTeamById(session.teamId),
  ]);
  return Response.json(
    computeRanking(
      members,
      events,
      records,
      mvpVotes,
      historical,
      season,
      team?.scoreRules ?? DEFAULT_SCORE_RULES
    )
  );
}
