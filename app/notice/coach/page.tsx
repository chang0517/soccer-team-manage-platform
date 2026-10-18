"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/components/useSession";
import type { AnnouncementRow } from "@/lib/types";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export default function CoachFeedbackPage() {
  const { user } = useSession();
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [feedbackDate, setFeedbackDate] = useState(todayStr());
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
    if (!title.trim() || !body.trim() || !feedbackDate) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, category: "coach_feedback", feedbackDate }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "작성에 실패했어요.");
      return;
    }
    setTitle("");
    setBody("");
    setFeedbackDate(todayStr());
    setShowForm(false);
    toast.success("코치 피드백을 올렸어요");
    load();
  };

  const input = "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm";

  const feedback = items.filter((a) => a.category === "coach_feedback");
  const groups = new Map<string, AnnouncementRow[]>();
  for (const a of feedback) {
    const key = a.feedbackDate ?? a.createdAt.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  const sortedDates = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="space-y-4">
      <Link href="/notice" className="text-sm font-semibold text-blue-700">
        ← 게시판
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold tracking-tight">🗣️ 코치 피드백</h1>
        {user?.role === "admin" && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-700/20"
          >
            {showForm ? "닫기" : "+ 피드백 기록"}
          </button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 rounded-3xl bg-blue-50/70 ring-1 ring-blue-100 p-4">
          <label className="block text-xs font-semibold text-zinc-500">
            날짜
            <input
              className={`${input} mt-1`}
              type="date"
              value={feedbackDate}
              onChange={(e) => setFeedbackDate(e.target.value)}
            />
          </label>
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
            disabled={saving || !title.trim() || !body.trim() || !feedbackDate}
            className="w-full rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
          >
            {saving ? "저장 중…" : "기록하기"}
          </button>
        </div>
      )}

      {!loaded && <ListSkeleton rows={3} />}

      {loaded && feedback.length === 0 && (
        <p className="card p-8 text-center text-sm text-zinc-400">
          아직 기록된 코치 피드백이 없어요.
        </p>
      )}

      <div className="stagger space-y-5">
        {sortedDates.map((date) => (
          <div key={date}>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400">
              {formatDateHeader(date)}
            </p>
            <div className="space-y-2">
              {groups.get(date)!.map((a) => (
                <Link
                  key={a.id}
                  href={`/notice/${a.id}`}
                  className="block card p-4 transition-colors hover:bg-zinc-50"
                >
                  <p className="font-semibold">{a.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{a.authorName}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
