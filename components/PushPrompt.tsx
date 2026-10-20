"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { enablePush, getPushState } from "./pushClient";

export default function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("pushDismissed") === "1") return;
    // 앱(홈 화면)으로 연 화면에서만 배너를 띄운다. 알림을 켜는 다른 길은 계정 설정에 있다.
    if (!window.matchMedia("(display-mode: standalone)").matches &&
        (navigator as unknown as { standalone?: boolean }).standalone !== true) return;
    getPushState()
      .then((state) => setVisible(state === "off"))
      .catch(() => {});
  }, []);

  const enable = async () => {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    setVisible(false);
    if (result === "ok") toast.success("알림을 켰어요");
    else if (result === "failed") toast.error("알림을 켜지 못했어요. 계정 설정에서 다시 시도해 주세요.");
  };

  const dismiss = () => {
    localStorage.setItem("pushDismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="no-print fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-sm items-center gap-3 rounded-3xl bg-white/95 p-3.5 shadow-2xl shadow-blue-900/15 ring-1 ring-blue-100 backdrop-blur-xl md:bottom-6">
      <span className="text-2xl">🔔</span>
      <p className="flex-1 text-xs text-zinc-600">
        새 경기 일정이 올라오면 바로 알림을 받아보세요.
      </p>
      <button
        onClick={enable}
        disabled={busy}
        className="shrink-0 rounded-full bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-700/20 disabled:opacity-40"
      >
        {busy ? "설정 중…" : "알림 켜기"}
      </button>
      <button onClick={dismiss} className="shrink-0 text-xs text-zinc-400">
        닫기
      </button>
    </div>
  );
}
