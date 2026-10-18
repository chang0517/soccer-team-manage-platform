"use client";

import { confirmSheet } from "@/components/ui/ConfirmSheet";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/useSession";
import { currentSeason } from "@/lib/season";
import type { HistoricalStats, Member } from "@/lib/types";

interface Draft {
  games: string;
  goals: string;
  assists: string;
  cleanPts: string;
  bonusPts: string;
}

const toDraft = (s?: HistoricalStats): Draft => ({
  games: s ? String(s.games) : "0",
  goals: s ? String(s.goals) : "0",
  assists: s ? String(s.assists) : "0",
  cleanPts: s ? String(s.cleanPts) : "0",
  bonusPts: s ? String(s.bonusPts) : "0",
});

export default function HistoricalStatsAdminPage() {
  const { user, loading } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<HistoricalStats[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [newMemberId, setNewMemberId] = useState("");
  const [newYear, setNewYear] = useState(String(currentSeason()));

  const key = (memberId: number, year: number) => `${memberId}:${year}`;

  const load = async () => {
    const [membersRes, statsRes] = await Promise.all([
      fetch("/api/members").then((r) => r.json()),
      fetch("/api/admin/historical-stats"),
    ]);
    if (statsRes.status === 403) {
      setForbidden(true);
      return;
    }
    const statsData: HistoricalStats[] = await statsRes.json();
    setMembers(membersRes);
    setStats(statsData);
    setDrafts(
      Object.fromEntries(statsData.map((s) => [key(s.memberId, s.year), toDraft(s)]))
    );
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) return null;
  if (!user || user.role !== "admin" || forbidden) {
    return (
      <div className="space-y-3 pt-10 text-center">
        <p className="text-sm text-zinc-500">운영진만 볼 수 있는 페이지예요.</p>
        <Link href="/" className="font-semibold text-blue-700">
          홈으로
        </Link>
      </div>
    );
  }

  const input = "w-16 rounded-xl border border-zinc-200 bg-white px-1.5 py-1 text-sm text-right";
  const memberById = new Map(members.map((m) => [m.id, m]));

  const setDraft = (k: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [k]: { ...(d[k] ?? toDraft()), ...patch } }));

  const save = async (memberId: number, year: number) => {
    const k = key(memberId, year);
    const d = drafts[k] ?? toDraft();
    setSavingKey(k);
    await fetch("/api/admin/historical-stats", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, year, ...d }),
    });
    setSavingKey(null);
    load();
  };

  const remove = async (memberId: number, year: number, name: string) => {
    if (!(await confirmSheet({ title: `${name}의 ${year} 시즌 기록을 삭제할까요?`, destructive: true, confirmText: "삭제" }))) return;
    const k = key(memberId, year);
    setSavingKey(k);
    await fetch("/api/admin/historical-stats", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, year }),
    });
    setSavingKey(null);
    load();
  };

  const addNew = async () => {
    const memberId = Number(newMemberId);
    const year = Number(newYear);
    if (!memberId || !year) return;
    if (stats.some((s) => s.memberId === memberId && s.year === year)) {
      toast.error("이미 해당 멤버·시즌 항목이 있어요. 아래 목록에서 수정해 주세요.");
      return;
    }
    await save(memberId, year);
    setNewMemberId("");
  };

  const sorted = [...stats].sort(
    (a, b) =>
      b.year - a.year ||
      (memberById.get(a.memberId)?.name ?? "").localeCompare(
        memberById.get(b.memberId)?.name ?? "",
        "ko"
      )
  );

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-extrabold tracking-tight">역대 누적 기록(랭킹) 관리</h1>
      <p className="text-sm text-zinc-500">
        앱 도입 이전 시즌별 누적 기록을 멤버·시즌 단위로 추가·수정할 수 있어요.
        여기서 입력한 값은 해당 시즌과 &quot;전체&quot; 랭킹에 기준치로 더해져요.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-blue-50/70 ring-1 ring-blue-100 p-3">
        <select
          className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm"
          value={newMemberId}
          onChange={(e) => setNewMemberId(e.target.value)}
        >
          <option value="">멤버 선택</option>
          {[...members]
            .sort((a, b) => a.name.localeCompare(b.name, "ko"))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
        <input
          className="w-20 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm"
          value={newYear}
          onChange={(e) => setNewYear(e.target.value)}
          placeholder="시즌(연도)"
        />
        <button
          onClick={addNew}
          disabled={!newMemberId || !newYear}
          className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          + 새 항목 추가
        </button>
      </div>

      <div className="overflow-x-auto card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <th className="px-3 py-2.5">이름</th>
              <th className="px-2 py-2.5 text-center">시즌</th>
              <th className="px-2 py-2.5 text-center">출전</th>
              <th className="px-2 py-2.5 text-center">골</th>
              <th className="px-2 py-2.5 text-center">어시</th>
              <th className="px-2 py-2.5 text-center">CS점수</th>
              <th className="px-2 py-2.5 text-center">보너스</th>
              <th className="px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const k = key(s.memberId, s.year);
              const d = drafts[k] ?? toDraft(s);
              const member = memberById.get(s.memberId);
              const name = member?.name ?? `#${s.memberId}`;
              return (
                <tr key={k} className="border-b border-zinc-100 last:border-0">
                  <td className="px-3 py-2 font-semibold">
                    {name}
                    {member?.backNo != null && (
                      <span className="ml-1 text-xs text-zinc-400">#{member.backNo}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center text-zinc-500">{s.year}</td>
                  <td className="px-2 py-2 text-center">
                    <input
                      className={input}
                      value={d.games}
                      onChange={(e) => setDraft(k, { games: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      className={input}
                      value={d.goals}
                      onChange={(e) => setDraft(k, { goals: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      className={input}
                      value={d.assists}
                      onChange={(e) => setDraft(k, { assists: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      className={input}
                      value={d.cleanPts}
                      onChange={(e) => setDraft(k, { cleanPts: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      className={input}
                      value={d.bonusPts}
                      onChange={(e) => setDraft(k, { bonusPts: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => save(s.memberId, s.year)}
                        disabled={savingKey === k}
                        className="rounded-lg bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => remove(s.memberId, s.year, name)}
                        disabled={savingKey === k}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-500 disabled:opacity-40"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-400">
            아직 등록된 역대 기록이 없어요.
          </p>
        )}
      </div>
    </div>
  );
}
