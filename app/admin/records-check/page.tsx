"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/useSession";

interface Row {
  id: number;
  date: string;
  title: string;
  opponent: string;
  conceded: number | null;
  hasSquad: boolean;
  hasLog: boolean;
  quarterConceded: (number | null)[] | null;
  missing: number;
  missingIds: number[];
  squadPlayers: { id: number; name: string | null; backNo: number | null }[];
  units: number;
  reasons: string[];
}

export default function RecordsCheckPage() {
  const { user, loading } = useSession();
  const [data, setData] = useState<{
    memberCount: number;
    totalUnits: number;
    roster: { id: number; name: string; backNo: number | null }[];
    rows: Row[];
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetch("/api/admin/records-check")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));
  }, [user]);

  if (loading) return null;
  if (user?.role !== "admin") {
    return (
      <div className="space-y-3 pt-10 text-center">
        <p className="text-sm text-zinc-500">운영진만 볼 수 있는 페이지예요.</p>
        <Link href="/" className="font-semibold text-blue-700">
          홈으로
        </Link>
      </div>
    );
  }

  const q = (c: number | null) => (c == null ? "·" : String(c));

  return (
    <div className="mx-auto max-w-lg space-y-4 pt-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">클린시트 점검</h1>
        <p className="mt-1 text-sm text-zinc-500">
          경기마다 클린시트가 왜 그렇게 잡혔는지 보여줘요. 쿼터 실점은 1Q~4Q 순서이고 ·는 입력 전이에요. 선수는 #선수id 이름 (등번호)로 보여요.
        </p>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {data && (
        <>
          <p className="rounded-2xl bg-zinc-50 p-3 text-sm">
            쿼터 단위로 계산된 클린시트 합계 <b>{data.totalUnits}</b>유닛 · 등록된 선수 {data.memberCount}명
          </p>
          <details className="rounded-2xl bg-zinc-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold">현재 선수 명단 (번호 = 선수 id)</summary>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              {data.roster.map((m) => `#${m.id} ${m.name}${m.backNo != null ? `(${m.backNo})` : ""}`).join(" · ")}
            </p>
          </details>
          <ul className="space-y-2">
            {data.rows.map((r) => (
              <li key={r.id} className="card space-y-1.5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/events/${r.id}`} className="min-w-0 truncate text-sm font-bold text-blue-700">
                    {r.date} {r.title}
                    {r.opponent ? ` vs ${r.opponent}` : ""}
                  </Link>
                  <span className="shrink-0 text-xs font-bold text-zinc-500">{r.units}유닛</span>
                </div>
                <p className="text-xs text-zinc-500">
                  쿼터 실점 {r.quarterConceded ? r.quarterConceded.map(q).join(" ") : "기록 없음"} · 경기 실점{" "}
                  {r.conceded ?? "·"}
                </p>
                {r.squadPlayers.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {r.squadPlayers.map((p) => (
                      <span
                        key={p.id}
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          p.name ? "bg-zinc-100 text-zinc-700" : "bg-red-50 font-bold text-red-600"
                        }`}
                      >
                        #{p.id} {p.name ?? "명단에 없음"}
                        {p.name && p.backNo != null ? ` (${p.backNo})` : ""}
                      </span>
                    ))}
                  </div>
                )}
                {r.reasons.map((x) => (
                  <p key={x} className={`text-xs ${r.missing > 0 ? "font-semibold text-red-600" : "text-zinc-600"}`}>
                    {x}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
