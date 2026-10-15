import { requireAdmin } from "@/lib/auth";
import { migrateTeamData } from "@/lib/migrate";

// 레이븐/블룸 같은 기존 단독 배포의 운영 DB를 플랫폼의 새 팀으로 통째로
// 복사해오는 1회성 관리자 도구. 큰 작업일 수 있어 Vercel Hobby 플랜의
// Serverless Function 실행 시간 상한(300초) 안에서 처리한다.
export const maxDuration = 300;

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "운영진만 이용할 수 있어요." }, { status: 403 });
  }

  const body = await request.json();
  const sourceUrl = String(body?.sourceUrl ?? "").trim();
  const teamSlug = String(body?.teamSlug ?? "").trim();
  const teamName = String(body?.teamName ?? "").trim();
  const fineAccount = body?.fineAccount ? String(body.fineAccount) : undefined;

  if (!sourceUrl || !teamSlug || !teamName) {
    return Response.json(
      { error: "sourceUrl, teamSlug, teamName을 모두 입력해 주세요." },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9-]+$/.test(teamSlug)) {
    return Response.json(
      { error: "slug는 영문 소문자·숫자·하이픈만 가능해요." },
      { status: 400 }
    );
  }

  try {
    const report = await migrateTeamData({ sourceUrl, teamSlug, teamName, fineAccount });
    return Response.json(report);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "이관에 실패했어요." },
      { status: 500 }
    );
  }
}
