import { timingSafeEqual } from "node:crypto";
import { setAppSetting } from "@/lib/db";
import { GATEWAY_URL_SETTING } from "@/lib/gateway";

// 맥미니의 ngrok-sync가 ngrok 공개 주소가 바뀔 때마다 부른다. 게이트웨이와
// 같은 시크릿(OLLAMA_GATEWAY_SECRET)을 Bearer로 보내야만 저장된다.
export async function POST(request: Request) {
  const secret = (process.env.OLLAMA_GATEWAY_SECRET ?? "").trim();
  // 설정 문제를 맥미니 로그에서 바로 구분할 수 있게 "플랫폼에 시크릿이 없음"과
  // "값이 다름"을 나눠 알려준다(시크릿 값 자체는 어디에도 드러내지 않는다).
  if (!secret) {
    return Response.json(
      { error: "platform has no OLLAMA_GATEWAY_SECRET (add it in Vercel and redeploy)" },
      { status: 503 }
    );
  }
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const ok =
    given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) {
    return Response.json(
      { error: `secret mismatch (platform value has ${secret.length} chars)` },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!/^https:\/\/[^\s/]+(\/.*)?$/.test(url) || url.length > 300) {
    return Response.json({ error: "https 주소가 필요해요." }, { status: 400 });
  }
  await setAppSetting(GATEWAY_URL_SETTING, url);
  return Response.json({ ok: true });
}
