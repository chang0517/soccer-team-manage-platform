"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { haptic } from "@/components/ui/haptic";
import { TEAM_SLUG_KEY } from "@/lib/teamSlug";

interface PublicTeam {
  slug: string;
  name: string;
  logo: string | null;
}

/**
 * 로그인·가입 같은 화면의 "팀 선택" — 팀 코드를 외워서 입력하는 대신 엠블럼과
 * 팀 이름이 있는 카드에서 고른다. 마지막으로 쓴 팀은 기억해 두었다가 미리
 * 선택해 주고, 팀이 하나뿐이면 그 팀을 바로 선택한다.
 */
export default function TeamPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
}) {
  const [teams, setTeams] = useState<PublicTeam[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  const load = () => {
    fetch("/api/teams/public")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: PublicTeam[]) => {
        setTeams(list);
        // 저장된 팀이 아직 있으면 그대로, 없어졌거나 처음이면 하나뿐일 때만 자동 선택
        const saved = localStorage.getItem(TEAM_SLUG_KEY) ?? "";
        if (list.some((t) => t.slug === saved)) onChange(saved);
        else if (list.length === 1) onChange(list[0].slug);
        else onChange("");
      })
      .catch(() => setFailed(true));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-600">
        팀 목록을 불러오지 못했어요.{" "}
        <button
          onClick={() => {
            setFailed(false);
            load();
          }}
          className="font-bold underline"
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (!teams) {
    return (
      <div className="grid grid-cols-2 gap-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="skeleton h-[104px] rounded-2xl" />
        ))}
      </div>
    );
  }
  if (teams.length === 0) {
    return <p className="rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-500">아직 등록된 팀이 없어요.</p>;
  }

  const q = query.trim().toLowerCase();
  const shown = q ? teams.filter((t) => t.name.toLowerCase().includes(q)) : teams;

  return (
    <div className="space-y-2">
      {teams.length > 6 && (
        <input
          className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm"
          placeholder="팀 이름으로 찾기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="팀 선택">
        {shown.map((t) => {
          const selected = t.slug === value;
          return (
            <button
              key={t.slug}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                haptic(8);
                onChange(t.slug);
              }}
              className={`relative flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors ${
                selected ? "bg-blue-50 ring-2 ring-blue-600" : "bg-white ring-1 ring-zinc-200"
              }`}
            >
              {t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- 팀이 올린 로고라 크기가 제각각
                <img
                  src={t.logo}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover ring-1 ring-zinc-200"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-900 text-xl font-extrabold text-white">
                  {t.name.trim().charAt(0) || "T"}
                </span>
              )}
              <span className="line-clamp-2 text-sm font-bold leading-tight">{t.name}</span>
              {selected && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white"
                  aria-hidden="true"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </motion.span>
              )}
            </button>
          );
        })}
      </div>
      {shown.length === 0 && (
        <p className="py-2 text-center text-sm text-zinc-400">찾는 팀이 없어요.</p>
      )}
    </div>
  );
}
