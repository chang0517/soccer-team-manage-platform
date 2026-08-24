import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  api,
  clearToken,
  getSavedTeamSlug,
  getToken,
  setSavedTeamSlug,
  setToken,
} from "../api/client";
import type { PosGroup, SessionUser } from "../api/types";

interface LoginResult {
  token: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  teamSlug: string;
  setTeamSlug: (slug: string) => void;
  login: (teamSlug: string, username: string, password: string) => Promise<void>;
  createTeam: (input: {
    teamName: string;
    teamSlug: string;
    displayName: string;
    username: string;
    password: string;
  }) => Promise<void>;
  signup: (input: {
    teamSlug: string;
    username: string;
    password: string;
    displayName: string;
    pos1: PosGroup;
    pos2: PosGroup;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamSlug, setTeamSlug] = useState("");

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ user: SessionUser | null }>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const savedSlug = await getSavedTeamSlug();
      if (savedSlug) setTeamSlug(savedSlug);
      await refresh();
    })();
  }, [refresh]);

  const login = useCallback(
    async (slug: string, username: string, password: string) => {
      const data = await api.post<LoginResult>("/api/auth/login", {
        teamSlug: slug,
        username,
        password,
      });
      await setToken(data.token);
      await setSavedTeamSlug(slug);
      setTeamSlug(slug);
      await refresh();
    },
    [refresh]
  );

  const createTeam = useCallback(
    async (input: {
      teamName: string;
      teamSlug: string;
      displayName: string;
      username: string;
      password: string;
    }) => {
      const data = await api.post<{ token: string; teamSlug: string }>("/api/teams", input);
      await setToken(data.token);
      await setSavedTeamSlug(data.teamSlug);
      setTeamSlug(data.teamSlug);
      await refresh();
    },
    [refresh]
  );

  const signup = useCallback(
    async (input: {
      teamSlug: string;
      username: string;
      password: string;
      displayName: string;
      pos1: PosGroup;
      pos2: PosGroup;
    }) => {
      await api.post("/api/auth/signup", input);
      await setSavedTeamSlug(input.teamSlug);
      setTeamSlug(input.teamSlug);
      // 가입은 항상 운영진 승인 대기 상태로 시작하므로 여기서 로그인 처리는 하지 않는다.
    },
    []
  );

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, teamSlug, setTeamSlug, login, createTeam, signup, logout }),
    [user, loading, teamSlug, login, createTeam, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
