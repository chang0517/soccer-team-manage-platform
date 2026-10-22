// 웹 푸시 켜기/상태 확인 — 알림 안내 배너와 계정 설정 화면이 같이 쓴다.

export type PushState =
  | "needs-install" // 아이폰 사파리 탭: 홈 화면에 추가한 앱에서만 알림을 켤 수 있음
  | "unsupported"
  | "no-key"
  | "denied"
  | "off"
  | "on";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

async function fetchPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/key", { cache: "no-store" });
    if (res.ok) return ((await res.json()).publicKey as string | null) ?? null;
  } catch {
    // 아래에서 빌드에 박힌 값으로 대신한다
  }
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

export async function getPushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return ios && !isStandalone() ? "needs-install" : "unsupported";
  }
  if (!(await fetchPublicKey())) return "no-key";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.register("/sw.js");
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** 권한을 요청하고 구독을 서버에 등록한다. 버튼을 직접 누른 순간에 불러야 한다(아이폰 규칙). */
export async function enablePush(): Promise<"ok" | "denied" | "no-key" | "failed"> {
  const publicKey = await fetchPublicKey();
  if (!publicKey) return "no-key";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
    return res.ok ? "ok" : "failed";
  } catch (e) {
    console.error("[push] enable failed:", e);
    return "failed";
  }
}

/**
 * 이 기기의 알림을 끈다 — 브라우저 구독을 해지하고 서버 목록에서도 지운다.
 * 브라우저의 알림 허용 자체는 그대로라서, 나중에 "알림 켜기"로 바로 다시 켤 수 있다.
 */
export async function disablePush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
    return true;
  } catch (e) {
    console.error("[push] disable failed:", e);
    return false;
  }
}
