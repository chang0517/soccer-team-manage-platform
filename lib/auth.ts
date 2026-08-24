import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { getUserById } from "./db";
import type { SessionUser } from "./types";

const SESSION_COOKIE = "raven_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180일

function getSecret(): string {
  return process.env.SESSION_SECRET || "raven-fc-dev-secret-change-me";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSessionToken(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({ ...user, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return {
      id: data.id,
      teamId: data.teamId,
      username: data.username,
      displayName: data.displayName,
      role: data.role,
      memberId: data.memberId ?? null,
    };
  } catch {
    return null;
  }
}

// 웹은 httpOnly 쿠키로 세션을 들고 다니지만, 네이티브 앱은 브라우저 쿠키
// 저장소가 없어서 로그인 응답에 같이 내려준 토큰을 자체 보관했다가
// Authorization: Bearer 헤더로 보낸다. 서명·만료 검증 로직은 완전히
// 동일하므로(parseSessionToken 재사용) 같은 토큰이 양쪽에서 다 통한다.
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookieUser = parseSessionToken(store.get(SESSION_COOKIE)?.value);
  if (cookieUser) return cookieUser;

  const hdrs = await headers();
  const auth = hdrs.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  return parseSessionToken(bearer);
}

export async function setSessionCookie(user: SessionUser) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * 관리자 전용 API에서 쓰는 가드. 쿠키뿐 아니라 DB의 최신 role/status까지
 * 확인해서, 승인 취소나 강등이 즉시 반영되게 한다.
 */
export async function requireAdmin(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  if (!session) return null;
  const user = await getUserById(session.teamId, session.id);
  if (!user || user.status !== "approved" || user.role !== "admin") return null;
  return session;
}
