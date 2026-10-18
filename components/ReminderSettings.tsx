"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { confirmSheet } from "@/components/ui/ConfirmSheet";
import { leadLabel, openTimeLabel } from "@/lib/reminders";
import type { TeamReminder } from "@/lib/types";

const LEAD_OPTIONS = [30, 60, 120, 180, 1440];

/**
 * 팀 설정의 "정기 알림" — 매월 같은 날·시각에 열리는 구장 예약 같은 일을
 * 미리 알려준다. 각 항목은 그 자리에서 바로 저장되고(아래 팀 설정 "저장"
 * 버튼과 별개), 오픈 시각 N분 전에 팀원(또는 운영진) 휴대폰으로 알림이 간다.
 */
export default function ReminderSettings() {
  const [list, setList] = useState<TeamReminder[]>([]);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("16");
  const [time, setTime] = useState("09:00");
  const [lead, setLead] = useState(60);
  const [target, setTarget] = useState<"all" | "admins">("all");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/admin/reminders")
      .then((r) => (r.ok ? r.json() : []))
      .then(setList)
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          dayOfMonth: Number(day),
          openTime: time,
          leadMinutes: lead,
          target,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "추가하지 못했어요.");
      toast.success(`"${title.trim()}" 알림을 추가했어요`);
      setTitle("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "추가하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: TeamReminder) => {
    if (!(await confirmSheet({ title: `"${r.title}" 알림을 지울까요?`, destructive: true, confirmText: "삭제" })))
      return;
    await fetch(`/api/admin/reminders?id=${r.id}`, { method: "DELETE" });
    load();
  };

  const input = "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-3 card p-4">
      <div>
        <h2 className="text-sm font-bold">정기 알림 (구장 예약 오픈 등)</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          매월 같은 날·시각에 열리는 예약을 미리 알려줘요. 휴대폰 알림을 켠 팀원에게
          가고, 추가·삭제는 바로 저장돼요. 서버 사정상 알림은 정한 시각부터 최대
          1시간 안에 도착하지만, 오픈 시각을 넘겨서 가지는 않아요.
        </p>
      </div>

      {list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5">
              <span className="text-lg" aria-hidden="true">
                ⏰
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{r.title}</p>
                <p className="text-xs text-zinc-500">
                  매월 {r.dayOfMonth}일 {openTimeLabel(r.openTime)} 오픈 · {leadLabel(r.leadMinutes)} 전 알림 ·{" "}
                  {r.target === "admins" ? "운영진만" : "팀원 전체"}
                </p>
              </div>
              <button
                onClick={() => remove(r)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-500"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-xl bg-blue-50/60 p-3 ring-1 ring-blue-100">
        <input
          className={`${input} w-full`}
          placeholder="이름 (예: 기흥 레스피아 예약)"
          value={title}
          maxLength={40}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-zinc-600">매월</span>
          <select className={input} value={day} onChange={(e) => setDay(e.target.value)} aria-label="날짜">
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}일
              </option>
            ))}
          </select>
          <input
            type="time"
            className={input}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="오픈 시각"
          />
          <span className="text-zinc-600">오픈</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <select className={input} value={lead} onChange={(e) => setLead(Number(e.target.value))} aria-label="미리 알림">
            {LEAD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {leadLabel(m)} 전
              </option>
            ))}
          </select>
          <span className="text-zinc-600">알림 ·</span>
          <select
            className={input}
            value={target}
            onChange={(e) => setTarget(e.target.value as "all" | "admins")}
            aria-label="받는 사람"
          >
            <option value="all">팀원 전체</option>
            <option value="admins">운영진만</option>
          </select>
        </div>
        <button
          onClick={add}
          disabled={busy || !title.trim()}
          className="w-full rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "추가 중…" : "정기 알림 추가"}
        </button>
      </div>
    </div>
  );
}
