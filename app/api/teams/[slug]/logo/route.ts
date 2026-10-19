import { getTeamBySlug } from "@/lib/db";

// 팀 로고 이미지. DB에는 data URI로 저장돼 있어서 여기서 이미지 바이트로
// 풀어 내려주고, 앱에 같이 넣어둔 로고(/team-logos/…)는 그쪽으로 보낸다.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  const logo = team?.logoUrl;
  if (!logo) return new Response("not found", { status: 404 });

  if (logo.startsWith("/")) {
    return Response.redirect(new URL(logo, request.url), 302);
  }
  const m = logo.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return new Response("not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: {
      "Content-Type": m[1],
      // 주소에 ?v=가 붙어 있어 로고가 바뀌면 새 주소가 되므로 오래 캐시해도 된다.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
