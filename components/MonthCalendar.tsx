"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { EventItem } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 일정을 열었다가 돌아와도 보던 달이 그대로 남도록 이 브라우저 탭에 기억해 둔다(탭을
// 닫으면 사라져서 다음에 새로 열면 이번 달부터 보인다).
export const CALENDAR_MONTH_KEY = "schedule_calendar_month";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function MonthCalendar({
  events,
  todayStr,
  selectedDate,
  onSelectDate,
}: {
  events: EventItem[];
  todayStr: string;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const [year, todayMonth, todayDay] = todayStr.split("-").map(Number);
  const [cursor, setCursor] = useState({ year, month: todayMonth - 1 });
  const [direction, setDirection] = useState(0);

  // 돌아왔을 때 마지막에 보던 달로 복원한다. 서버에서 먼저 그려진 화면과 달라지면 안 되니
  // 처음 그린 뒤에 읽어서 바꾼다.
  useEffect(() => {
    try {
      const m = sessionStorage.getItem(CALENDAR_MONTH_KEY)?.match(/^(\d{4})-(\d{1,2})$/);
      if (m && Number(m[2]) >= 0 && Number(m[2]) <= 11) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장소(브라우저)는 첫 렌더 뒤에만 읽을 수 있다
        setCursor({ year: Number(m[1]), month: Number(m[2]) });
      }
    } catch {
      // 저장소를 못 쓰는 환경이면 이번 달부터
    }
  }, []);

  const eventsByDate = new Map<string, EventItem[]>();
  for (const e of events) {
    const list = eventsByDate.get(e.date) ?? [];
    list.push(e);
    eventsByDate.set(e.date, list);
  }

  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      `${cursor.year}-${pad(cursor.month + 1)}-${pad(i + 1)}`
    ),
  ];

  const changeMonth = (delta: number) => {
    setDirection(delta);
    const m = cursor.month + delta;
    const next =
      m < 0
        ? { year: cursor.year - 1, month: 11 }
        : m > 11
          ? { year: cursor.year + 1, month: 0 }
          : { year: cursor.year, month: m };
    setCursor(next);
    // 사용자가 직접 넘긴 달만 기억한다(처음 열 때의 이번 달로 덮어쓰지 않게).
    try {
      sessionStorage.setItem(CALENDAR_MONTH_KEY, `${next.year}-${next.month}`);
    } catch {
      // 저장소를 못 쓰면 기억만 못 할 뿐 달력은 그대로 동작한다
    }
  };

  const isToday = (d: string) =>
    d === `${year}-${pad(todayMonth)}-${pad(todayDay)}`;

  return (
    <div className="card overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => changeMonth(-1)}
          aria-label="이전 달"
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100"
        >
          ‹
        </button>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={`${cursor.year}-${cursor.month}`}
            initial={{ opacity: 0, y: direction >= 0 ? 8 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction >= 0 ? -8 : 8 }}
            className="text-[15px] font-extrabold tracking-tight"
          >
            {cursor.year}년 {cursor.month + 1}월
          </motion.p>
        </AnimatePresence>
        <button
          onClick={() => changeMonth(1)}
          aria-label="다음 달"
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100"
        >
          ›
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={`text-xs font-semibold ${
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-zinc-400"
            }`}
          >
            {w}
          </span>
        ))}
      </div>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={`${cursor.year}-${cursor.month}`}
          initial={{ opacity: 0, x: direction >= 0 ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction >= 0 ? -40 : 40 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60) changeMonth(1);
            else if (info.offset.x > 60) changeMonth(-1);
          }}
          className="grid touch-pan-y grid-cols-7 gap-y-1 text-center"
        >
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const dayEvents = eventsByDate.get(d) ?? [];
            const dayNum = Number(d.slice(-2));
            const selected = d === selectedDate;
            const today = isToday(d);
            return (
              <button
                key={d}
                onClick={() => onSelectDate(d)}
                className={`relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-sm ${
                  selected
                    ? "font-bold text-white"
                    : today
                      ? "font-extrabold text-blue-700"
                      : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId="calendar-selected"
                    transition={{ type: "spring", stiffness: 500, damping: 36 }}
                    className="absolute inset-0 rounded-full bg-blue-700 shadow-md shadow-blue-700/30"
                  />
                )}
                {!selected && today && (
                  <span className="absolute inset-0 rounded-full ring-2 ring-blue-500/60" />
                )}
                <span className="relative">{dayNum}</span>
                {dayEvents.length > 0 && (
                  <span
                    className={`relative -mt-0.5 h-1 w-1 rounded-full ${
                      selected ? "bg-white" : "bg-blue-600"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
