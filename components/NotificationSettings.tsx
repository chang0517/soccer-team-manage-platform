"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { disablePush, enablePush, getPushState } from "./pushClient";
import type { PushState } from "./pushClient";

const MESSAGE: Record<PushState, string> = {
  "needs-install":
    "아이폰은 사파리에서 ‘홈 화면에 추가’한 앱으로 열었을 때만 알림을 켤 수 있어요. 홈 화면의 앱 아이콘으로 접속해서 이 화면을 다시 열어 주세요.",
  unsupported: "이 브라우저는 알림을 지원하지 않아요.",
  "no-key": "서버에 알림 키가 아직 설정되지 않았어요. 운영진에게 알려주세요.",
  denied:
    "알림이 꺼져 있어요. 아이폰은 설정 → 알림 → 이 앱, 안드로이드는 앱 정보 → 알림에서 켜 주세요.",
  off: "새 경기·투표·스쿼드 확정 소식을 알림으로 받아보세요.",
  on: "이 기기에서 알림을 받고 있어요. 끄면 새 경기·스쿼드 확정 같은 알림이 오지 않아요.",
};

export default function NotificationSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    if (result === "ok") {
      toast.success("알림을 켰어요");
      localStorage.removeItem("pushDismissed");
    } else if (result === "failed") {
      toast.error("알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
    setState(await getPushState().catch(() => "unsupported" as PushState));
  };

  const disable = async () => {
    setBusy(true);
    const ok = await disablePush();
    setBusy(false);
    if (ok) {
      // 끈 기기에서 "알림 켜세요" 안내 배너가 다시 뜨지 않게 한다.
      try {
        localStorage.setItem("pushDismissed", "1");
      } catch {}
      toast.success("이 기기의 알림을 껐어요");
    } else {
      toast.error("알림을 끄지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
    setState(await getPushState().catch(() => "unsupported" as PushState));
  };

  if (!state) return null;
  return (
    <div className="space-y-2 card p-4">
      <p className="text-sm font-bold">🔔 알림 설정</p>
      <p className="text-xs leading-relaxed text-zinc-500">{MESSAGE[state]}</p>
      {state === "off" && (
        <button
          onClick={enable}
          disabled={busy}
          className="w-full rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
        >
          {busy ? "설정 중…" : "알림 켜기"}
        </button>
      )}
      {state === "on" && (
        <div className="space-y-1.5">
          <button
            onClick={disable}
            disabled={busy}
            className="w-full rounded-2xl bg-zinc-100 py-3 text-sm font-bold text-zinc-800 disabled:opacity-40"
          >
            {busy ? "설정 중…" : "알림 끄기"}
          </button>
          <button
            onClick={enable}
            disabled={busy}
            className="w-full py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-40"
          >
            알림이 안 올 때: 이 기기 다시 등록
          </button>
        </div>
      )}
    </div>
  );
}
