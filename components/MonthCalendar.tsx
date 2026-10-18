"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { EventItem } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 0) return { year: c.year - 1, month: 11 };
      if (m > 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month: m };
    });
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
