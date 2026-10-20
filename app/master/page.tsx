"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { notifySessionChanged, useSession } from "@/components/useSession";

interface MasterTeam {
  id: number;
  slug: string;
  name: string;
  hasLogo: boolean;
  createdAt: string;
}

export default function MasterPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [data, setData] = useState<{
    currentTeamId: number;
    homeTeamId: number;
    teams: MasterTeam[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.isMaster) return;
    fetch("/api/master/teams")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));
  }, [user?.isMaster, user?.teamId]);

  const [setup, setSetup] = useState<{
    identity: string;
    configured: boolean;
    isAdmin: boolean;
  } | null>(null);
  useEffect(() => {
    if (loading || !user || user.isMaster) return;
    fetch("/api/master/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSetup)
      .catch(() => {});
  }, [loading, user]);

  const enter = async (team: MasterTeam) => {
    setBusyId(team.id);
    try {
      const res = await fetch("/api/master/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await notifySessionChanged();
      toast.success(`${team.name}에 들어왔어요`);
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "들어가지 못했어요.");
    }
    setBusyId(null);
  };

  if (loading) return null;
  if (!user?.isMaster) {
    return (
      <div className="space-y-3 pt-10 text-center">
        <p className="text-sm text-zinc-500">마스터만 볼 수 있는 페이지예요.</p>
        {setup?.isAdmin && (
          <div className="mx-auto max-w-sm space-y-1.5 rounded-2xl bg-amber-50 p-4 text-left text-xs text-amber-900 ring-1 ring-amber-200">
            <p className="font-bold">이 계정을 마스터로 쓰려면</p>
            <p>
              Vercel 환경변수 <b>MASTER_ACCOUNTS</b>에 아래 값을 넣고 다시 배포한 뒤, 로그아웃했다가 다시 로그인하세요.
            </p>
            <p className="select-all break-all rounded-lg bg-white px-2.5 py-2 font-mono text-sm font-bold">
              {setup.identity}
            </p>
            <p className="text-amber-700">
              {setup.configured
                ? "지금 설정된 값에 이 계정이 없어요(다른 팀코드나 철자가 다를 수 있어요)."
                : "지금은 설정된 값이 없어요(환경변수가 비었거나 배포가 아직 안 됐어요)."}
            </p>
          </div>
        )}
        <Link href="/" className="font-semibold text-blue-700">
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pt-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">🛠 마스터</h1>
        <p className="mt-1 text-sm text-zinc-500">
          팀을 고르면 승인 없이 운영진으로 들어가요. 다른 팀에서 이 화면으로 돌아와 내 팀을 고르면 평소 모습으로 돌아와요.
        </p>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ul className="space-y-2">
        {data?.teams.map((t) => {
          const current = t.id === data.currentTeamId;
          return (
            <li key={t.id} className="card flex items-center gap-3 p-3">
              {t.hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- 팀이 올린 로고라 크기가 제각각
                <img
                  src={`/api/teams/${t.slug}/logo`}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
                />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-base font-extrabold text-zinc-500">
                  {t.name.trim().charAt(0) || "T"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {t.name}
                  {t.id === data.homeTeamId && (
                    <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                      내 팀
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-zinc-400">{t.slug}</p>
              </div>
              {current ? (
                <span className="shrink-0 text-xs font-bold text-emerald-600">현재 화면</span>
              ) : (
                <button
                  onClick={() => enter(t)}
                  disabled={busyId === t.id}
                  className="pressable shrink-0 rounded-full bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  {busyId === t.id ? "이동 중…" : "들어가기"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
