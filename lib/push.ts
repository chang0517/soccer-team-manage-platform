import webpush from "web-push";
import { deletePushSubscription, getAllPushSubscriptions } from "./db";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

type PushSub = { endpoint: string; p256dh: string; auth: string };

async function sendTo(subs: PushSub[], payload: { title: string; body: string; url: string }) {
  if (!ensureConfigured()) return;
  const json = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          json,
          // 안드로이드는 절전 상태에서 보통 우선순위 알림을 한참 뒤에 전달해서, 스쿼드
          // 확정 같은 소식은 높은 우선순위로 보낸다(하루 안에 못 전하면 버린다).
          { TTL: 24 * 3600, urgency: "high" }
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await deletePushSubscription(sub.endpoint);
        } else {
          // 그 밖의 실패(키 불일치·네트워크 등)는 삼키되 로그는 남겨 원인을 찾을 수 있게 한다.
          console.error("[push] send failed:", statusCode ?? "", (err as Error).message);
        }
      }
    })
  );
}

/**
 * 등록된 모든 PWA 구독자에게 푸시 알림을 보낸다. 실패해도 호출자(예: 일정
 * 생성 API)를 막지 않도록 에러는 여기서 삼킨다. 구독이 만료됐으면(410/404)
 * DB에서 정리한다.
 */
export async function sendPushToAll(
  teamId: number,
  payload: { title: string; body: string; url: string }
) {
  const subs = await getAllPushSubscriptions(teamId);
  await sendTo(subs, payload);
}

/**
 * 특정 멤버(예: 비품 담당자)의 구독 기기에만 푸시 알림을 보낸다. 그 멤버가
 * 여러 기기로 구독해뒀으면 전부에게 간다.
 */
export async function sendPushToMember(
  teamId: number,
  memberId: number,
  payload: { title: string; body: string; url: string }
) {
  const subs = (await getAllPushSubscriptions(teamId)).filter((s) => s.memberId === memberId);
  await sendTo(subs, payload);
}

// 여러 멤버(예: 그 경기 참석자 전원)의 구독 기기에 한 번에 보낸다.
export async function sendPushToMembers(
  teamId: number,
  memberIds: number[],
  payload: { title: string; body: string; url: string }
) {
  if (memberIds.length === 0) return;
  const ids = new Set(memberIds);
  const subs = (await getAllPushSubscriptions(teamId)).filter(
    (s) => s.memberId != null && ids.has(s.memberId)
  );
  await sendTo(subs, payload);
}

// 멤버마다 내용이 다른 알림(예: 각자의 출전 쿼터)을 보낸다. 구독 목록은 한
// 번만 읽는다. 알림을 켠 기기가 있어 실제로 보낸 멤버 수를 돌려준다.
export async function sendPushToEach(
  teamId: number,
  items: { memberId: number; payload: { title: string; body: string; url: string } }[]
): Promise<number> {
  if (items.length === 0) return 0;
  const subs = await getAllPushSubscriptions(teamId);
  let reached = 0;
  await Promise.all(
    items.map(async ({ memberId, payload }) => {
      const mine = subs.filter((s) => s.memberId === memberId);
      if (mine.length === 0) return;
      reached++;
      await sendTo(mine, payload);
    })
  );
  return reached;
}

export type PushKind = "아이폰·맥(애플)" | "안드로이드·크롬(구글)" | "파이어폭스" | "윈도우" | "기타";

/** 구독 주소로 어느 푸시 서비스를 쓰는 기기인지 알아본다. */
export function pushKind(endpoint: string): PushKind {
  let host = "";
  try {
    host = new URL(endpoint).hostname;
  } catch {
    return "기타";
  }
  if (host.endsWith("push.apple.com")) return "아이폰·맥(애플)";
  if (host.endsWith("googleapis.com") || host.endsWith("google.com")) return "안드로이드·크롬(구글)";
  if (host.endsWith("mozilla.com")) return "파이어폭스";
  if (host.endsWith("notify.windows.com")) return "윈도우";
  return "기타";
}

/**
 * 한 멤버의 구독 기기마다 테스트 알림을 보내고 푸시 서비스의 응답을 그대로
 * 돌려준다(운영진이 "왜 안 가는지" 볼 수 있게). 만료된 구독(404/410)은 지운다.
 */
export async function sendPushDiagnostic(teamId: number, memberId: number) {
  if (!ensureConfigured()) return { configured: false, results: [] as PushResult[] };
  const subs = (await getAllPushSubscriptions(teamId)).filter((s) => s.memberId === memberId);
  const json = JSON.stringify({
    title: "테스트 알림 🔔",
    body: "이 알림이 보이면 정상이에요.",
    url: "/",
  });
  const results: PushResult[] = await Promise.all(
    subs.map(async (sub) => {
      const kind = pushKind(sub.endpoint);
      try {
        const res = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json,
          { TTL: 600, urgency: "high" }
        );
        return { kind, ok: true, status: res.statusCode, message: "" };
      } catch (err) {
        const e = err as { statusCode?: number; body?: string; message?: string };
        if (e.statusCode === 404 || e.statusCode === 410) await deletePushSubscription(sub.endpoint);
        return {
          kind,
          ok: false,
          status: e.statusCode ?? 0,
          message: (e.body || e.message || "").slice(0, 200),
        };
      }
    })
  );
  return { configured: true, results };
}

export type PushResult = { kind: PushKind; ok: boolean; status: number; message: string };
