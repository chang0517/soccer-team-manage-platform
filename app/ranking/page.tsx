"use client";

import { useEffect, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import HallOfFameSection from "@/components/HallOfFameSection";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { useSession } from "@/components/useSession";
import type { PosCategory, RankingRow } from "@/lib/types";
import { DEFAULT_SCORE_RULES, POS_CATEGORY, POS_CATEGORY_LABELS } from "@/lib/types";
import { seasonLabel } from "@/lib/season";

const VIEW_TABS = [
  { key: "ranking" as const, label: "시즌 랭킹" },
  { key: "hof" as const, label: "명예의 전당" },
];

const TABS: { key: PosCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "ATT", label: "공격" },
  { key: "MID", label: "미드필더" },
  { key: "DEF", label: "수비" },
];

type SortKey = "played" | "goals" | "assists" | "cleanCount" | "mvpCount" | "total";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "played", label: "출전" },
  { key: "goals", label: "골" },
  { key: "assists", label: "어시" },
  { key: "cleanCount", label: "CS" },
  { key: "mvpCount", label: "MVP" },
  { key: "total", label: "총점" },
];

const ALL_TIME = "ALL_TIME";
const SPRING = { type: "spring", stiffness: 500, damping: 38 } as const;
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

// 선택된 칸 뒤로 색 배경이 미끄러져 가는 세그먼트 컨트롤
function Segmented<T extends string | number>({
  id,
  items,
  value,
  onChange,
  className = "",
  activeClass = "bg-blue-900",
}: {
  id: string;
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  activeClass?: string;
}) {
  return (
    <div className={`flex gap-1 rounded-2xl bg-zinc-200/60 p-1 ${className}`}>
      {items.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={String(t.key)}
            onClick={() => onChange(t.key)}
            className={`relative flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold ${
              active ? "text-white" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={SPRING}
                className={`absolute inset-0 rounded-xl shadow-md ${activeClass}`}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function RankingPage() {
  const { user } = useSession();
  const myId = user?.memberId ?? null;
  const rules = user?.teamScoreRules ?? DEFAULT_SCORE_RULES;
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState<number | typeof ALL_TIME>(ALL_TIME);
  const [tab, setTab] = useState<PosCategory | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [view, setView] = useState<"ranking" | "hof">("ranking");

  useEffect(() => {
    fetch("/api/ranking/seasons")
      .then((r) => (r.ok ? r.json() : []))
      .then(setSeasons);
  }, []);

  useEffect(() => {
    const qs = season === ALL_TIME ? "" : `?season=${season}`;
    fetch(`/api/ranking${qs}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RankingRow[]) => {
        setRows(data);
        setLoaded(true);
      });
  }, [season]);

  const mvpRanking = rows
    .filter((r) => r.mvpCount > 0)
    .sort((a, b) => b.mvpCount - a.mvpCount);

  const filtered = tab === "ALL" ? rows : rows.filter((r) => POS_CATEGORY[r.member.pos1] === tab);
  const visibleRows = filtered.slice().sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDir === "asc" ? diff : -diff;
  });

  const podium = filtered
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const clickSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const seasonItems: { key: number | typeof ALL_TIME; label: string }[] = [
    { key: ALL_TIME, label: "전체" },
    ...seasons.map((s) => ({ key: s, label: seasonLabel(s) })),
  ];

  // 2위 · 1위 · 3위 순서로 놓아서 가운데가 가장 높은 시상대 모양을 만든다
  const podiumOrder = [
    { row: podium[1], rank: 2, h: "h-16", medal: "🥈", tint: "from-zinc-100 to-zinc-200" },
    { row: podium[0], rank: 1, h: "h-24", medal: "🥇", tint: "from-amber-100 to-amber-200" },
    { row: podium[2], rank: 3, h: "h-12", medal: "🥉", tint: "from-orange-100 to-orange-200" },
  ];

  return (
    <div className="space-y-4">
      <Segmented id="view" items={VIEW_TABS} value={view} onChange={setView} />

      {view === "hof" && <HallOfFameSection />}

      {view === "ranking" && (
        <>
          <h1 className="px-1 text-[22px] font-extrabold tracking-tight">시즌 랭킹</h1>

          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
            <Segmented
              id="season"
              items={seasonItems}
              value={season}
              onChange={setSeason}
              className="w-max min-w-full"
              activeClass="bg-blue-700"
            />
          </div>

          <Segmented id="pos" items={TABS} value={tab} onChange={setTab} activeClass="bg-zinc-800" />
          {tab !== "ALL" && (
            <p className="-mt-2 px-1 text-xs text-zinc-400">
              1순위 포지션이 {POS_CATEGORY_LABELS[tab]}인 선수만 표시돼요.
            </p>
          )}

          {podium.length >= 3 && (
            <motion.div
              key={`${season}-${tab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card grid grid-cols-3 items-end gap-2 overflow-hidden px-4 pt-5"
            >
              {podiumOrder.map(({ row, rank, h, medal, tint }, i) =>
                row ? (
                  <div key={row.member.id} className="flex min-w-0 flex-col items-center">
                    <span className="text-2xl">{medal}</span>
                    <span
                      className={`mt-1 max-w-full truncate text-sm font-extrabold ${
                        row.member.id === myId ? "text-blue-700" : ""
                      }`}
                    >
                      {row.member.name}
                    </span>
                    <span className="text-xs font-bold text-blue-700">
                      <AnimatedNumber value={row.total} format={fmt} />점
                    </span>
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ type: "spring", stiffness: 160, damping: 20, delay: 0.08 * i }}
                      style={{ originY: 1 }}
                      className={`mt-2 flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 text-lg font-black text-zinc-500/60 ${h} ${tint}`}
                    >
                      {rank}
                    </motion.div>
                  </div>
                ) : (
                  <div key={i} />
                )
              )}
            </motion.div>
          )}

          {mvpRanking.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-extrabold text-zinc-500">⭐ MVP 최다 선정</h2>
              <div className="stagger space-y-1.5">
                {mvpRanking.map((r, i) => (
                  <div key={r.member.id} className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-center">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                    <span className="flex-1 font-bold">{r.member.name}</span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-extrabold text-amber-600">
                      {r.mvpCount}회
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                  <th className="px-3 py-3">순위</th>
                  <th className="px-2 py-3">이름</th>
                  {SORT_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={`px-2 py-3 ${c.key === "total" ? "text-right" : "text-center"}`}
                    >
                      <button
                        onClick={() => clickSort(c.key)}
                        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold ${
                          sortKey === c.key ? "bg-blue-50 text-blue-700" : "text-zinc-500"
                        }`}
                      >
                        {c.label}
                        <span className="text-[10px]">
                          {sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loaded &&
                  [0, 1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-3 py-2.5">
                        <div className="skeleton h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                <LayoutGroup>
                  {visibleRows.map((r, i) => {
                    const isMe = r.member.id === myId;
                    return (
                      <motion.tr
                        layout="position"
                        key={r.member.id}
                        transition={{ type: "spring", stiffness: 400, damping: 40 }}
                        className={`border-b border-zinc-100 last:border-0 ${isMe ? "bg-blue-50/70" : ""}`}
                      >
                        <td className="px-3 py-2.5 font-bold text-zinc-400">
                          {["🥇", "🥈", "🥉"][i] ?? i + 1}
                        </td>
                        <td className="px-2 py-2.5 font-bold">
                          {r.member.name}
                          {r.member.backNo != null && (
                            <span className="ml-1 text-xs font-medium text-zinc-400">#{r.member.backNo}</span>
                          )}
                          {isMe && (
                            <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              나
                            </span>
                          )}
                          {r.streak >= 3 && (
                            <span
                              className="ml-1 text-xs font-bold text-orange-500"
                              title={`최근 ${r.streak}경기 연속 ${r.streakType === "goal" ? "골" : "어시스트"}`}
                            >
                              🔥{r.streak}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{r.played}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{r.goals}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{r.assists}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{r.cleanCount}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{r.mvpCount}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold text-blue-700">
                          <AnimatedNumber value={r.total} format={(v) => v.toFixed(1)} />
                        </td>
                      </motion.tr>
                    );
                  })}
                </LayoutGroup>
              </tbody>
            </table>
            {loaded && visibleRows.length === 0 && (
              <p className="p-6 text-center text-sm text-zinc-400">아직 기록이 없어요.</p>
            )}
          </div>

          <p className="rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-500">
            점수 기준: 출전 {fmt(rules.participation)}점 · 골 {fmt(rules.goal)}점 · 어시스트{" "}
            {fmt(rules.assist)}점 · 클린시트 시 GK·센터백·윙백 {fmt(rules.cleanSheetDefence)}점, 수비형
            미드필더 {fmt(rules.cleanSheetDm)}점. CS 열은 점수가 아니라 클린시트 기여 횟수예요(수비형
            미드필더는 0.5회).
          </p>
        </>
      )}
    </div>
  );
}
