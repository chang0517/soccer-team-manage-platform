"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/useSession";

export default function MigrateTeamPage() {
  const { user, loading } = useSession();
  const [sourceUrl, setSourceUrl] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [teamName, setTeamName] = useState("");
  const [fineAccount, setFineAccount] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    teamId: number;
    counts: Record<string, number>;
  } | null>(null);

  if (loading) return null;
  if (!user || user.role !== "admin") {
    return (
      <div className="space-y-3 pt-10 text-center">
        <p className="text-sm text-zinc-500">운영진만 볼 수 있는 페이지예요.</p>
        <Link href="/" className="font-semibold text-blue-700">
          홈으로
        </Link>
      </div>
    );
  }

  const input = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm";

  const run = async () => {
    if (!sourceUrl.trim() || !teamSlug.trim() || !teamName.trim()) return;
    if (!confirm(`"${teamName}" 팀으로 데이터를 복사할까요? (slug: ${teamSlug})`)) return;
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/migrate-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: sourceUrl.trim(),
          teamSlug: teamSlug.trim(),
          teamName: teamName.trim(),
          fineAccount: fineAccount.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "이관에 실패했어요.");
      } else {
        setResult(data);
        setSourceUrl("");
      }
    } catch {
      setError("요청에 실패했어요. 네트워크를 확인해 주세요.");
    }
    setRunning(false);
  };

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 pb-24 pt-6">
      <Link href="/admin" className="text-sm font-semibold text-blue-700">
        ← 운영진 메뉴
      </Link>
      <h1 className="text-lg font-bold">기존 팀 데이터 이관</h1>
      <p className="text-sm text-zinc-500">
        레이븐·블룸처럼 단독으로 운영 중인 팀의 운영 DB에서 회원·일정·투표·기록
        등을 통째로 가져와 플랫폼의 새 팀으로 만들어요. 기존 DB는 건드리지
        않고 읽기만 해요. <b>같은 slug로 두 번 실행하면 안 돼요</b>(중복
        생성).
      </p>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <label className="block text-xs font-semibold text-zinc-500">
          원본 DATABASE_URL (레이븐/블룸의 Supabase 연결 문자열)
          <input
            type="password"
            className={`${input} mt-1`}
            placeholder="postgresql://postgres:...@...supabase.com:5432/postgres"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="block text-xs font-semibold text-zinc-500">
          새 팀 slug (영문 소문자·숫자·하이픈)
          <input
            className={`${input} mt-1`}
            placeholder="raven"
            value={teamSlug}
            onChange={(e) => setTeamSlug(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-zinc-500">
          새 팀 표시 이름
          <input
            className={`${input} mt-1`}
            placeholder="레이븐 FC"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-zinc-500">
          벌금 계좌 (선택, 나중에 설정에서도 바꿀 수 있어요)
          <input
            className={`${input} mt-1`}
            placeholder="예: 000-0000-0000 ○○은행 (홍길동)"
            value={fineAccount}
            onChange={(e) => setFineAccount(e.target.value)}
          />
        </label>

        <button
          onClick={run}
          disabled={
            running || !sourceUrl.trim() || !teamSlug.trim() || !teamName.trim()
          }
          className="w-full rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {running ? "이관 중… (몇 분 걸릴 수 있어요)" : "이관 시작"}
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      {result && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-bold text-green-800">
            완료! 새 팀(team id: {result.teamId})으로 복사됐어요.
          </p>
          <ul className="mt-2 space-y-0.5 text-green-700">
            {Object.entries(result.counts).map(([k, v]) => (
              <li key={k}>
                {k}: {v}건
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
