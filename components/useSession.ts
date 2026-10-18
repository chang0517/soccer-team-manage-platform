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

/**
 * 로그인·팀 만들기처럼 이 훅 밖에서 세션이 바뀌었을 때 부른다. 상단 헤더는
 * 레이아웃에 한 번만 마운트돼서 페이지를 옮겨도 다시 불러오지 않으므로,
 * 직접 알려주지 않으면 로그인 직후에도 "로그인 전" 헤더가 남는다.
 */
export async function notifySessionChanged() {
  try {
    const data = await fetch("/api/auth/me").then((r) => r.json());
    window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: data.user ?? null }));
  } catch {
    // 알림 실패는 다음 새로고침 때 바로잡힌다
  }
}

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
