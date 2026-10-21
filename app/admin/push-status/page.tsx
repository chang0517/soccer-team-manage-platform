"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useSession } from "@/components/useSession";

interface MemberStatus {
  id: number;
  name: string;
  backNo: number | null;
  devices: string[];
}

interface TestResult {
  configured: boolean;
  results: { kind: string; ok: boolean; status: number; message: string }[];
}

export default function PushStatusPage() {
  const { user, loading } = useSession();
  const [data, setData] = useState<{ unlinked: number; members: MemberStatus[] } | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [tests, setTests] = useState<Record<number, TestResult>>({});

  const load = () =>
    fetch("/api/admin/push-status")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user]);

  const test = async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/push-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setTests((t) => ({ ...t, [id]: j }));
      if (!j.configured) toast.error("서버에 알림 키가 없어요.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "보내지 못했어요.");
    }
    setBusyId(null);
  };

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

  const withDevice = data?.members.filter((m) => m.devices.length > 0).length ?? 0;

  return (
    <div className="mx-auto max-w-lg space-y-4 pt-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">알림 점검</h1>
        <p className="mt-1 text-sm text-zinc-500">
          팀원별로 알림을 켠 기기가 있는지 보고, 테스트 알림을 보내서 전달이 되는지 확인해요.
        </p>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {data && (
        <>
          <p className="rounded-2xl bg-zinc-50 p-3 text-sm">
            알림을 켠 팀원 <b>{withDevice}</b>명 / 전체 {data.members.length}명
            {data.unlinked > 0 && (
              <span className="mt-1 block text-xs text-amber-700">
                선수와 연결되지 않은 기기 {data.unlinked}개가 있어요(이 기기들은 선수별 알림을 못 받아요).
              </span>
            )}
          </p>
          <ul className="space-y-2">
            {data.members.map((m) => {
              const t = tests[m.id];
              return (
                <li key={m.id} className="card space-y-1.5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {m.name}
                        {m.backNo != null && <span className="ml-1 text-xs font-normal text-zinc-400">#{m.backNo}</span>}
                      </p>
                      <p className={`text-xs ${m.devices.length ? "text-zinc-500" : "text-red-500"}`}>
                        {m.devices.length ? m.devices.join(" · ") : "알림을 켠 기기가 없어요"}
                      </p>
                    </div>
                    {m.devices.length > 0 && (
                      <button
                        onClick={() => test(m.id)}
                        disabled={busyId === m.id}
                        className="pressable shrink-0 rounded-full bg-blue-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                      >
                        {busyId === m.id ? "보내는 중…" : "테스트 보내기"}
                      </button>
                    )}
                  </div>
                  {t?.results.map((r, i) => (
                    <p
                      key={i}
                      className={`rounded-lg px-2 py-1 text-xs ${r.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                    >
                      {r.kind}: {r.ok ? `전송됨(${r.status}) — 기기에 알림이 오는지 확인하세요` : `실패(${r.status || "연결 오류"}) ${r.message}`}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
