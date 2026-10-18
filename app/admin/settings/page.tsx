"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReminderSettings from "@/components/ReminderSettings";
import { useSession } from "@/components/useSession";
import { computeRanking } from "@/lib/points";
import type {
  EventItem,
  HistoricalStats,
  Member,
  MvpVoteRow,
  RecordRow,
  ScoreRules,
  TeamRow,
} from "@/lib/types";

const SCORE_FIELDS: { key: keyof TeamRow["scoreRules"]; label: string; hint: string }[] = [
  { key: "participation", label: "출전", hint: "경기에 출전만 해도 받는 점수" },
  { key: "goal", label: "골", hint: "골 1개당 점수" },
  { key: "assist", label: "어시스트", hint: "어시스트 1개당 점수" },
  { key: "cleanSheetDefence", label: "클린시트 (GK·CB·WB)", hint: "무실점 경기 1회당 점수" },
  { key: "cleanSheetDm", label: "클린시트 (DM·수미)", hint: "무실점 경기 1회당 점수(보통 수비진의 절반)" },
];

interface RankingRawData {
  members: Member[];
  events: EventItem[];
  records: RecordRow[];
  mvpVotes: MvpVoteRow[];
  historical: HistoricalStats[];
}

export default function TeamSettingsPage() {
  const { user, loading } = useSession();
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [fineAccount, setFineAccount] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [rawData, setRawData] = useState<RankingRawData | null>(null);

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
    if (user?.role === "admin") {
      load();
      fetch("/api/admin/ranking-raw")
        .then((r) => (r.ok ? r.json() : null))
        .then(setRawData);
    }
  }, [user]);

  // 입력칸에 타이핑하는 즉시(서버 왕복 없이) 미리보기 랭킹을 다시 계산한다.
  const draftRules: ScoreRules | null = useMemo(() => {
    if (Object.keys(scoreDrafts).length === 0) return null;
    const vals = Object.fromEntries(
      SCORE_FIELDS.map((f) => [f.key, Number(scoreDrafts[f.key])])
    ) as unknown as ScoreRules;
    if (Object.values(vals).some((v) => typeof v !== "number" || Number.isNaN(v))) return null;
    return vals;
  }, [scoreDrafts]);

  const previewRanking = useMemo(() => {
    if (!rawData || !draftRules) return [];
    return computeRanking(
      rawData.members,
      rawData.events,
      rawData.records,
      rawData.mvpVotes,
      rawData.historical,
      null,
      draftRules
    ).slice(0, 10);
  }, [rawData, draftRules]);

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

  const input = "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm";

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
      <h1 className="text-[22px] font-extrabold tracking-tight">팀 설정</h1>

      <ReminderSettings />

      <div className="space-y-3 card p-4">
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

      <div className="space-y-3 card p-4">
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

      <div className="rounded-3xl bg-blue-50/70 ring-1 ring-blue-100 p-4">
        <h2 className="text-sm font-bold">실시간 미리보기 — 역대 랭킹 TOP 10</h2>
        <p className="mb-2 text-xs text-zinc-500">
          위 배율을 바꾸면 저장하지 않아도 여기 숫자가 바로 바뀌어요.
        </p>
        {!rawData && <p className="text-xs text-zinc-400">불러오는 중…</p>}
        {rawData && !draftRules && (
          <p className="text-xs text-red-500">숫자를 전부 올바르게 입력해 주세요.</p>
        )}
        {rawData && draftRules && (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-100">
            {previewRanking.map((r, i) => (
              <div
                key={r.member.id}
                className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm last:border-0"
              >
                <span className="w-5 text-center text-xs font-bold text-zinc-400">
                  {["🥇", "🥈", "🥉"][i] ?? i + 1}
                </span>
                <span className="flex-1 font-semibold">{r.member.name}</span>
                <span className="text-xs text-zinc-500">
                  출전{r.played} ⚽{r.goals} 🎯{r.assists} 🧤{r.cleanCount}
                </span>
                <span className="w-14 text-right font-bold text-blue-700">
                  {r.total}점
                </span>
              </div>
            ))}
            {previewRanking.length === 0 && (
              <p className="p-4 text-center text-xs text-zinc-400">
                아직 계산할 기록이 없어요.
              </p>
            )}
          </div>
        )}
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
        className="w-full rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
      >
        {saving ? "저장 중…" : "저장"}
      </button>
    </main>
  );
}
