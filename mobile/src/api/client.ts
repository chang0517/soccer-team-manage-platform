import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./config";

const TOKEN_KEY = "session_token";
const TEAM_SLUG_KEY = "team_slug";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getSavedTeamSlug(): Promise<string | null> {
  return SecureStore.getItemAsync(TEAM_SLUG_KEY);
}

export async function setSavedTeamSlug(slug: string): Promise<void> {
  await SecureStore.setItemAsync(TEAM_SLUG_KEY, slug);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// 웹은 httpOnly 쿠키로 세션을 들고 다니지만, 이 앱은 브라우저 쿠키 저장소가
// 없어서 로그인/팀 만들기 응답에 같이 내려오는 token을 SecureStore에 저장해뒀다가
// 매 요청마다 Authorization: Bearer로 실어 보낸다(백엔드 lib/auth.ts가 둘 다 받음).
async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; skipAuth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!options.skipAuth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `요청이 실패했어요 (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body }),
};
