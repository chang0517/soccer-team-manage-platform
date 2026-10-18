"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScoreRules, SessionUser } from "@/lib/types";

type MeUser = SessionUser & {
  teamName: string;
  teamLogoUrl: string | null;
  teamScoreRules?: ScoreRules;
};

// 한 화면에서 세션 정보를 다시 불러오면(예: 팀 로고 변경) 상단 헤더처럼
// 같은 훅을 쓰는 다른 컴포넌트도 새로고침 없이 바로 바뀌도록 알린다.
const SESSION_EVENT = "session-updated";

export function useSession() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    setUser(data.user);
    setLoading(false);
    return data.user as MeUser | null;
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = (e: Event) => {
      setUser((e as CustomEvent<MeUser | null>).detail);
      setLoading(false);
    };
    window.addEventListener(SESSION_EVENT, onUpdate);
    return () => window.removeEventListener(SESSION_EVENT, onUpdate);
  }, [refresh]);

  // 직접 부른 refresh만 다른 컴포넌트에 알린다(첫 로드 때마다 알리면 서로 계속 갱신).
  const refreshAll = useCallback(async () => {
    const next = await refresh();
    window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: next }));
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: null }));
  }, []);

  return { user, loading, refresh: refreshAll, logout };
}
