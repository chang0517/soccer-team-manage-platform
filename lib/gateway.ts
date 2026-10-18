import { getAppSetting } from "./db";

export const GATEWAY_URL_SETTING = "gateway_url";

/**
 * 맥미니 게이트웨이(문자 발송·로컬 AI) 접속 정보. 주소는 ngrok 무료 플랜이라
 * 맥미니가 재시작될 때마다 바뀌는데, 맥미니의 ngrok-sync가 바뀐 주소를
 * /api/gateway/register로 알려주면 DB에 저장해 두고 그걸 먼저 쓴다(재배포
 * 없이 바로 반영). 아직 등록된 적 없으면 예전처럼 환경변수 값을 쓴다.
 * 시크릿은 맥미니와 똑같은 값을 Vercel 환경변수에 한 번만 넣어두면 된다.
 */
export async function getGateway(): Promise<{ url: string; secret: string } | null> {
  const secret = process.env.OLLAMA_GATEWAY_SECRET;
  const url =
    (await getAppSetting(GATEWAY_URL_SETTING).catch(() => null)) ??
    process.env.OLLAMA_GATEWAY_URL ??
    null;
  if (!url || !secret) return null;
  return { url: url.replace(/\/$/, ""), secret };
}

export class GatewayNotConfiguredError extends Error {
  constructor() {
    super("문자·AI 발송용 맥미니 연결이 아직 설정되지 않았어요. 운영진에게 문의해 주세요.");
  }
}
