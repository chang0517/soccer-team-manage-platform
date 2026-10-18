"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/useSession";
import type { TeamRow } from "@/lib/types";

const SCORE_FIELDS: { key: keyof TeamRow["scoreRules"]; label: string; hint: string }[] = [
  { key: "participation", label: "출전", hint: "경기에 출전만 해도 받는 점수" },
  { key: "goal", label: "골", hint: "골 1개당 점수" },
  { key: "assist", label: "어시스트", hint: "어시스트 1개당 점수" },
  { key: "cleanSheetDefence", label: "클린시트 (GK·CB·WB)", hint: "무실점 경기 1회당 점수" },
  { key: "cleanSheetDm", label: "클린시트 (DM·수미)", hint: "무실점 경기 1회당 점수(보통 수비진의 절반)" },
];

export default function TeamSettingsPage() {
  const { user, loading } = useSession();
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [fineAccount, setFineAccount] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = () =>
    fetch("/api/admin/team-settings")
      .then((r) => r.json())
      .then((t: TeamRow) => {
        setTeam(t);
        setFineAccount(t.fineAccount ?? "");
        setFineAmount(t.fineAmount ?? "");
        setScoreDrafts(
          Object.fromEntries(
            SCORE_FIELDS.map((f) => [f.key, String(t.scoreRules[f.key])])
          )
        );
      });

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user]);

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

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    const scoreRules = Object.fromEntries(
      SCORE_FIELDS.map((f) => [f.key, Number(scoreDrafts[f.key])])
    );
    try {
      const res = await fetch("/api/admin/team-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fineAccount, fineAmount, scoreRules }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했어요.");
      } else {
        setTeam(data);
        setSaved(true);
      }
    } catch {
      setError("요청에 실패했어요. 네트워크를 확인해 주세요.");
    }
    setSaving(false);
  };

  if (!team) return null;

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 pb-24 pt-6">
      <Link href="/admin" className="text-sm font-semibold text-blue-700">
        ← 운영진 메뉴
      </Link>
      <h1 className="text-lg font-bold">팀 설정</h1>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-bold">벌금 안내</h2>
        <label className="block text-xs font-semibold text-zinc-500">
          입금 계좌
          <input
            className={`${input} mt-1`}
            placeholder="예: 000-0000-0000 ○○은행 (홍길동)"
            value={fineAccount}
            onChange={(e) => setFineAccount(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-zinc-500">
          벌금 금액
          <input
            className={`${input} mt-1`}
            placeholder="예: 20,000원"
            value={fineAmount}
            onChange={(e) => setFineAmount(e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-bold">랭킹 점수 배율</h2>
        <p className="text-xs text-zinc-500">
          랭킹 계산에 쓰이는 배율이에요. 바꾸면 그 순간부터의 새 기록에 적용돼요
          (과거 누적 기록은 저장될 때 단가 그대로 유지돼요).
        </p>
        {SCORE_FIELDS.map((f) => (
          <label key={f.key} className="block text-xs font-semibold text-zinc-500">
            {f.label}
            <input
              className={`${input} mt-1`}
              type="number"
              step="0.01"
              value={scoreDrafts[f.key] ?? ""}
              onChange={(e) =>
                setScoreDrafts((d) => ({ ...d, [f.key]: e.target.value }))
              }
            />
            <span className="mt-0.5 block text-[11px] font-normal text-zinc-400">
              {f.hint}
            </span>
          </label>
        ))}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}
      {saved && (
        <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">저장했어요.</p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white disabled:opacity-40"
      >
        {saving ? "저장 중…" : "저장"}
      </button>
    </main>
  );
}
