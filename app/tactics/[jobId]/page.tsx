"use client";

import { confirmSheet } from "@/components/ui/ConfirmSheet";
import { toast } from "sonner";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TacticsBoard from "@/components/TacticsBoard";
import { useSession } from "@/components/useSession";
import type { TacticsScene } from "@/lib/types";

export default function TacticsViewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const { user, loading } = useSession();
  const [scene, setScene] = useState<TacticsScene | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetch(`/api/tactics/${jobId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.result) {
          setScene(data.result);
          setCreatedAt(data.createdAt ?? null);
        } else {
          setError(data.error ?? "찾을 수 없어요.");
        }
      });
  }, [jobId, user]);

  const remove = async () => {
    if (!(await confirmSheet({ title: "이 전술을 삭제할까요?", destructive: true, confirmText: "삭제" }))) return;
    setDeleting(true);
    const res = await fetch(`/api/tactics/${jobId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setDeleting(false);
      toast.error(data.error ?? "삭제에 실패했어요.");
      return;
    }
    router.push("/tactics");
  };

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

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pb-10">
      <Link href="/tactics" className="text-sm font-semibold text-blue-700">
        ← 전술 목록
      </Link>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      {scene && (
        <div className="mt-4 card p-4">
          <TacticsBoard scene={scene} />
          {createdAt && (
            <p className="mt-3 text-center text-xs text-zinc-400">
              {new Date(createdAt).toLocaleString("ko-KR")}에 저장됨
            </p>
          )}
        </div>
      )}

      {scene && (
        <button
          onClick={remove}
          disabled={deleting}
          className="mt-4 w-full rounded-xl border border-red-300 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-40"
        >
          {deleting ? "삭제 중…" : "이 전술 삭제"}
        </button>
      )}
    </main>
  );
}
