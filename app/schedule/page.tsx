"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CalendarSubscribe from "@/components/CalendarSubscribe";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import MonthCalendar from "@/components/MonthCalendar";
import { ListSkeleton } from "@/components/ui/Skeleton";
import TimePicker from "@/components/TimePicker";
import { useSession } from "@/components/useSession";
import { dDayLabel, formatDate, todayStr } from "@/lib/format";
import type { EventItem } from "@/lib/types";

const EMPTY_FORM = {
  title: "정기 경기",
  type: "match",
  date: "",
  time: "08:00",
  location: "",
  opponent: "",
};

export default function SchedulePage() {
  const { user } = useSession();
  const isAdmin = user?.role === "admin";
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = () =>
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : []))
      .then((evs: EventItem[]) => {
        setEvents(evs);
        setLoaded(true);
      });
  useEffect(() => {
    load();
  }, []);

  const upcoming = events
    .filter((e) => e.date >= todayStr())
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => e.date < todayStr());

  const submit = async () => {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "일정 저장에 실패했어요.");
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast.success("일정을 추가했어요");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "일정 저장에 실패했어요.");
    }
    setSaving(false);
  };

  const input =
    "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm";

  // 컴포넌트가 아니라 렌더 함수로 둔다 — 렌더마다 새 컴포넌트 타입이 생기면
  // 폼에 타이핑할 때마다 행이 다시 마운트돼서 등장 애니메이션이 반복된다.
  const eventRow = (e: EventItem) => {
    const upcomingRow = e.date >= todayStr();
    return (
      <Link
        key={e.id}
        href={`/events/${e.id}`}
        className="card group flex items-center gap-3 p-4 transition-colors hover:bg-zinc-50"
      >
        <div className="w-14 shrink-0 text-center">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
              upcomingRow ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {dDayLabel(e.date)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">
            {e.type === "social" ? "🎉 " : ""}
            {e.title}
            {e.opponent && (
              <span className="font-medium text-zinc-500"> vs {e.opponent}</span>
            )}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {formatDate(e.date, e.time)}
            {e.location && ` · ${e.location}`}
          </p>
        </div>
        {e.scored != null && e.conceded != null ? (
          <span
            className={`rounded-full px-2.5 py-1 text-sm font-extrabold tabular-nums ${
              e.scored > e.conceded
                ? "bg-blue-50 text-blue-700"
                : e.scored < e.conceded
                  ? "bg-red-50 text-red-600"
                  : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {e.scored}:{e.conceded}
          </span>
        ) : (
          <span className="text-lg text-zinc-300 transition-transform group-hover:translate-x-0.5">
            ›
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold tracking-tight">일정</h1>
        <div className="flex items-center gap-2">
          {user && <CalendarSubscribe />}
          {isAdmin && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className={`rounded-full px-4 py-2 text-sm font-bold shadow-md ${
                showForm
                  ? "bg-zinc-200 text-zinc-700 shadow-transparent"
                  : "bg-blue-700 text-white shadow-blue-700/20"
              }`}
            >
              {showForm ? "닫기" : "+ 일정 추가"}
            </button>
          )}
        </div>
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
        <div className="space-y-3 rounded-3xl bg-blue-50/70 ring-1 ring-blue-100 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-zinc-500">제목</label>
              <input
                className={input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500">유형</label>
              <select
                className={input}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="match">경기</option>
                <option value="social">모임/행사</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500">상대팀</label>
              <input
                className={input}
                placeholder="경기일 때만"
                value={form.opponent}
                onChange={(e) => setForm({ ...form, opponent: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500">날짜</label>
              <input
                type="date"
                className={input}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-zinc-500">시간</label>
              <TimePicker
                value={form.time}
                onChange={(time) => setForm({ ...form, time })}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-zinc-500">장소</label>
              <input
                className={input}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>
          <button
            onClick={submit}
            disabled={saving || !form.title.trim() || !form.date}
            className="w-full rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
          >
            {saving ? "저장 중…" : "일정 저장"}
          </button>
        </div>
        </motion.div>
      )}
      </AnimatePresence>

      <MonthCalendar
        events={events}
        todayStr={todayStr()}
        selectedDate={selectedDate}
        onSelectDate={(d) => setSelectedDate(d === selectedDate ? null : d)}
      />

      <AnimatePresence initial={false}>
        {selectedDate && (
          <motion.section
            key={selectedDate}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2.5"
          >
            <h2 className="px-1 text-sm font-extrabold text-zinc-500">
              {formatDate(selectedDate)} 일정
            </h2>
            {events.filter((e) => e.date === selectedDate).length === 0 && (
              <p className="card p-5 text-center text-sm text-zinc-400">이 날짜에는 일정이 없어요.</p>
            )}
            <div className="stagger space-y-2.5">
              {events.filter((e) => e.date === selectedDate).map(eventRow)}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="space-y-2.5">
        <h2 className="px-1 text-sm font-extrabold text-zinc-500">다가오는 일정</h2>
        {!loaded && <ListSkeleton rows={2} />}
        {loaded && upcoming.length === 0 && (
          <p className="card p-5 text-center text-sm text-zinc-400">예정된 일정이 없어요.</p>
        )}
        <div className="stagger space-y-2.5">{upcoming.map(eventRow)}</div>
      </section>

      <section className="space-y-2.5">
        <h2 className="px-1 text-sm font-extrabold text-zinc-500">지난 일정</h2>
        {!loaded && <ListSkeleton rows={2} />}
        {loaded && past.length === 0 && (
          <p className="card p-5 text-center text-sm text-zinc-400">지난 일정이 없어요.</p>
        )}
        <div className="stagger space-y-2.5">{past.map(eventRow)}</div>
      </section>
    </div>
  );
}
