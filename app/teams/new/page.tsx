"use client";

import AuthHeader from "@/components/ui/AuthHeader";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TEAM_SLUG_KEY } from "@/lib/teamSlug";

// 팀 코드는 로그인/가입 화면에서 팀을 구분하는 값이라 영문 소문자·숫자·
// 하이픈만 허용한다(URL·토큰에도 쓰이므로).
const SLUG_RE = /^[a-z0-9-]{3,30}$/;

export default function NewTeamPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const valid =
    teamName.trim() &&
    SLUG_RE.test(teamSlug.trim()) &&
    displayName.trim() &&
    username.trim().length >= 3 &&
    password.length >= 4;

  const submit = async () => {
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: teamName.trim(),
          teamSlug: teamSlug.trim(),
          displayName: displayName.trim(),
          username: username.trim(),
          password,
        }),
      });
      let data: { error?: string; teamSlug?: string } = {};
      try {
        data = await res.json();
      } catch {
        // 서버가 JSON이 아닌 응답(500 HTML 에러 페이지 등)을 준 경우
      }
      if (!res.ok) {
        setError(data.error || `팀 생성에 실패했어요. (status ${res.status})`);
        return;
      }
      if (data.teamSlug) localStorage.setItem(TEAM_SLUG_KEY, data.teamSlug);
      router.push("/");
      router.refresh();
    } catch {
      setError("요청에 실패했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const input = "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm";

  return (
    <div className="mx-auto max-w-sm space-y-5 pt-6">
      <AuthHeader title="새 팀 만들기" />
      <p className="text-center text-xs text-zinc-500">
        여기서 만든 계정이 이 팀의 첫 운영진이 돼요. 이후 팀원들은 아래 팀
        코드로 가입 신청을 하고, 운영진이 승인하면 합류합니다.
      </p>
      <div className="space-y-3 card p-4">
        <div>
          <label className="text-xs font-semibold text-zinc-500">팀 이름</label>
          <input
            className={input}
            placeholder="예: Raven FC"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-500">팀 코드</label>
          <input
            className={input}
            placeholder="예: raven-fc (영문 소문자·숫자·하이픈)"
            value={teamSlug}
            onChange={(e) => setTeamSlug(e.target.value.toLowerCase())}
          />
          <p className="mt-1 text-[11px] text-zinc-400">
            팀원들이 로그인·가입할 때 입력하는 코드예요. 나중에 바꿀 수 없어요.
          </p>
        </div>
        <hr className="border-zinc-100" />
        <div>
          <label className="text-xs font-semibold text-zinc-500">내 이름</label>
          <input
            className={input}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-500">아이디</label>
          <input
            className={input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-500">비밀번호</label>
          <input
            type="password"
            className={input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={submit}
          disabled={loading || !valid}
          className="w-full rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
        >
          {loading ? "만드는 중…" : "팀 만들기"}
        </button>
      </div>
      <p className="text-center text-sm text-zinc-500">
        이미 팀이 있나요?{" "}
        <Link href="/login" className="font-semibold text-blue-700">
          로그인
        </Link>
      </p>
    </div>
  );
}
