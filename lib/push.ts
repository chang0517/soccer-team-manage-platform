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
          json
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await deletePushSubscription(sub.endpoint);
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
