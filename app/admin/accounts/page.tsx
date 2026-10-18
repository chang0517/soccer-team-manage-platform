"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { confirmSheet } from "@/components/ui/ConfirmSheet";
import { useSession } from "@/components/useSession";

interface Account {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "player";
  status: "approved" | "pending" | "rejected";
  memberId: number | null;
  memberName: string | null;
}

const STATUS_LABEL = { approved: "승인", pending: "대기", rejected: "거절" } as const;

// 운영진 "계정 관리" — 장난·중복 가입 같은 계정을 찾아 완전히 지운다.
export default function AccountsPage() {
  const { user, loading } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(
    () =>
      fetch("/api/admin/accounts")
        .then((r) => (r.ok ? r.json() : []))
        .then(setAccounts),
    []
  );
  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user, load]);

  if (loading) return null;
  if (!user || user.role !== "admin") {
    return (
      <p className="pt-10 text-center text-sm text-zinc-500">운영진만 볼 수 있는 페이지예요.</p>
    );
  }

  const remove = async (a: Account) => {
    if (
      !(await confirmSheet({
        title: `${a.displayName}(${a.username}) 계정을 지울까요?`,
        description: "다시 로그인할 수 없고, 되돌릴 수 없어요.",
        destructive: true,
        confirmText: "계정 삭제",
      }))
    )
      return;
    let withMember = false;
    if (a.memberId != null) {
      withMember = await confirmSheet({
        title: `연결된 선수 "${a.memberName ?? "?"}"도 지울까요?`,
        description:
          "선수 명단에서 빠지고, 이 선수의 참석 투표·경기 기록·MVP·댓글·만든 투표·역대 기록, 일정 속 스쿼드 자리까지 모두 지워져요. 실제 팀원의 프로필이면 '계정만 삭제'를 고르세요.",
        destructive: true,
        confirmText: "선수와 기록까지 모두 삭제",
        cancelText: "계정만 삭제",
      });
    }
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/admin/accounts?id=${a.id}${withMember ? "&withMember=1" : ""}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "삭제에 실패했어요.");
      toast.success(
        data.memberDeleted
          ? `${a.displayName} 계정과 선수 기록을 모두 지웠어요`
          : `${a.displayName} 계정을 지웠어요`
      );
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했어요.");
    } finally {
      setBusyId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = accounts.filter(
    (a) =>
      !q ||
      a.displayName.toLowerCase().includes(q) ||
      a.username.toLowerCase().includes(q) ||
      (a.memberName ?? "").toLowerCase().includes(q)
  );

  return (
    <main className="mx-auto max-w-xl space-y-4 px-1 pb-24 pt-2">
      <Link href="/admin" className="text-sm font-semibold text-blue-700">
        ← 운영진 메뉴
      </Link>
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight">계정 관리</h1>
        <p className="mt-1 text-sm text-zinc-500">
          가입된 계정 {accounts.length}개 · 장난이나 중복으로 만든 계정을 지울 수 있어요.
        </p>
      </div>
      <input
        className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm"
        placeholder="이름·아이디로 찾기"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="space-y-1.5">
        {shown.map((a) => (
          <li key={a.id} className="flex items-center gap-3 card px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {a.displayName}{" "}
                <span className="font-medium text-zinc-400">@{a.username}</span>
              </p>
              <p className="text-xs text-zinc-500">
                {a.role === "admin" ? "운영진" : "일반"} · {STATUS_LABEL[a.status]} ·{" "}
                {a.memberName ? `선수: ${a.memberName}` : "선수 연결 없음"}
              </p>
            </div>
            {a.id === user.id ? (
              <span className="shrink-0 text-xs text-zinc-400">나</span>
            ) : (
              <button
                onClick={() => remove(a)}
                disabled={busyId === a.id}
                className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-500 disabled:opacity-40"
              >
                {busyId === a.id ? "삭제 중…" : "삭제"}
              </button>
            )}
          </li>
        ))}
        {shown.length === 0 && (
          <li className="card p-6 text-center text-sm text-zinc-400">찾는 계정이 없어요.</li>
        )}
      </ul>
    </main>
  );
}
