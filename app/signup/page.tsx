"use client";

import AuthHeader from "@/components/ui/AuthHeader";
import { useState } from "react";
import Link from "next/link";
import TeamPicker from "@/components/TeamPicker";
import { TEAM_SLUG_KEY } from "@/lib/teamSlug";
import { POS_GROUPS, POS_LABELS } from "@/lib/types";
import type { PosGroup } from "@/lib/types";

export default function SignupPage() {
  const [teamSlug, setTeamSlug] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pos1, setPos1] = useState<PosGroup>("CB");
  const [pos2, setPos2] = useState<PosGroup>("WB");
  const [backNo, setBackNo] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingMsg, setPendingMsg] = useState("");

  const submit = async () => {
    if (
      !teamSlug.trim() ||
      username.trim().length < 3 ||
      password.length < 4 ||
      !displayName.trim()
    )
      return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamSlug: teamSlug.trim(),
          username: username.trim(),
          password,
          displayName: displayName.trim(),
          pos1,
          pos2,
          backNo: backNo === "" ? null : Number(backNo),
          phone: phone.trim() || null,
        }),
      });
      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // 서버가 JSON이 아닌 응답(500 HTML 에러 페이지 등)을 준 경우
      }
      if (!res.ok) {
        setError(data.error || `가입에 실패했어요. (status ${res.status})`);
        return;
      }
      localStorage.setItem(TEAM_SLUG_KEY, teamSlug.trim());
      setPendingMsg(
        "가입 요청이 접수됐어요. 운영진이 이름을 확인하고 승인하면 로그인할 수 있어요."
      );
    } catch {
      setError("요청에 실패했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const input =
    "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm";

  if (pendingMsg) {
    return (
      <div className="mx-auto max-w-sm space-y-5 pt-6 text-center">
        <AuthHeader icon="🎉" title="가입 신청 완료" />
        <p className="card p-4 text-sm text-zinc-600">
          {pendingMsg}
        </p>
        <Link href="/login" className="font-semibold text-blue-700">
          로그인 화면으로
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-5 pt-6">
      <AuthHeader title="가입하기" />
      <div className="space-y-3 card p-4">
        <div>
          <label className="text-xs font-semibold text-zinc-500">팀 선택</label>
          <div className="mt-1.5">
            <TeamPicker value={teamSlug} onChange={setTeamSlug} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-500">이름</label>
          <input
            className={input}
            placeholder="실명 (운영진이 이걸 보고 승인해요)"
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
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-zinc-500">1순위 포지션</label>
            <select
              className={input}
              value={pos1}
              onChange={(e) => setPos1(e.target.value as PosGroup)}
            >
              {POS_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g} · {POS_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500">2순위 포지션</label>
            <select
              className={input}
              value={pos2}
              onChange={(e) => setPos2(e.target.value as PosGroup)}
            >
              {POS_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g} · {POS_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-zinc-500">등번호 (선택)</label>
            <input
              className={input}
              type="number"
              value={backNo}
              onChange={(e) => setBackNo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500">전화번호 (선택)</label>
            <input
              className={input}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={submit}
          disabled={
            loading ||
            !teamSlug.trim() ||
            username.trim().length < 3 ||
            password.length < 4 ||
            !displayName.trim()
          }
          className="w-full rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
        >
          {loading ? "가입 중…" : "가입 신청"}
        </button>
      </div>
      <p className="text-center text-sm text-zinc-500">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-semibold text-blue-700">
          로그인
        </Link>
      </p>
    </div>
  );
}
