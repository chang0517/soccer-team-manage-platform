"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/components/useSession";
import type { AnnouncementRow } from "@/lib/types";

export default function NoticeListPage() {
  const { user } = useSession();
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    fetch("/api/announcements")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: AnnouncementRow[]) => {
        setItems(rows);
        setLoaded(true);
      });

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "작성에 실패했어요.");
      return;
    }
    setTitle("");
    setBody("");
    setShowForm(false);
    toast.success("공지를 올렸어요");
    load();
  };

  const input = "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm";
  const notices = items.filter((a) => a.category === "notice");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold tracking-tight">게시판</h1>
        {user?.role === "admin" && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className={`rounded-full px-4 py-2 text-sm font-bold shadow-md ${
              showForm
                ? "bg-zinc-200 text-zinc-700 shadow-transparent"
                : "bg-blue-700 text-white shadow-blue-700/20"
            }`}
          >
            {showForm ? "닫기" : "+ 공지 작성"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Link
          href="/notice/coach"
          className="pressable card flex flex-col gap-1 p-4 hover:bg-zinc-50"
        >
          <span className="text-2xl">🗣️</span>
          <span className="text-sm font-extrabold">코치 피드백</span>
          <span className="text-xs text-zinc-400">날짜별 피드백 모아보기</span>
        </Link>
        <Link
          href="/notice/training"
          className="pressable card flex flex-col gap-1 p-4 hover:bg-zinc-50"
        >
          <span className="text-2xl">🏋️</span>
          <span className="text-sm font-extrabold">훈련 세션</span>
          <span className="text-xs text-zinc-400">훈련 내용 다시 보기</span>
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-3xl bg-blue-50/70 p-4 ring-1 ring-blue-100">
              <input
                className={input}
                placeholder="제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className={`${input} resize-none`}
                rows={5}
                placeholder="내용"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={submit}
                disabled={saving || !title.trim() || !body.trim()}
                className="w-full rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
              >
                {saving ? "저장 중…" : "게시하기"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <h2 className="px-1 pt-2 text-sm font-extrabold text-zinc-500">📢 공지사항</h2>

      {!loaded && <ListSkeleton rows={3} />}

      {loaded && notices.length === 0 && (
        <p className="card p-8 text-center text-sm text-zinc-400">아직 공지사항이 없어요.</p>
      )}

      <div className="stagger space-y-2.5">
        {notices.map((a) => (
          <Link
            key={a.id}
            href={`/notice/${a.id}`}
            className="card group flex items-center gap-3 p-4 transition-colors hover:bg-zinc-50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{a.title}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {a.authorName} · {new Date(a.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </div>
            <span className="text-lg text-zinc-300 transition-transform group-hover:translate-x-0.5">
              ›
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
