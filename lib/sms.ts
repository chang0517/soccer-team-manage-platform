import { GatewayNotConfiguredError, getGateway } from "./gateway";
import { toE164 } from "./phone";

/**
 * 서버(Vercel)에서 팀 맥미니의 게이트웨이(ollama-gateway/gateway.mjs)를 거쳐
 * Messages.app으로 SMS를 보낸다. 게이트웨이는 원래 Ollama 호출용으로 만든
 * 것을 /sms/send 경로만 추가해서 재사용한다(같은 터널·시크릿).
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  const gateway = await getGateway();
  if (!gateway) {
    console.error("[sms] gateway not configured (OLLAMA_GATEWAY_SECRET / gateway url)");
    throw new GatewayNotConfiguredError();
  }
  const { url: gatewayUrl, secret } = gateway;

  let res: Response;
  try {
    res = await fetch(`${gatewayUrl}/sms/send`, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ phone: toE164(phone), message }),
    });
  } catch (e) {
    // 맥미니가 꺼져 있거나 ngrok 주소가 바뀐 직후면 여기서 실패한다.
    console.error("[sms] gateway unreachable:", e);
    throw new Error("문자 발송 서버(맥미니)에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[sms] send failed ${res.status}: ${text}`);
    throw new Error("문자를 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}
