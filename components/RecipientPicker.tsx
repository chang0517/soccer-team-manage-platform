"use client";

import { useMemo, useState } from "react";
import type { Member } from "@/lib/types";

/**
 * 알림 받을 사람 고르기 — 이름을 눌러 여러 명을 켜고 끈다. 알림을 켜두지 않은
 * 사람은 "알림 꺼짐"으로 표시해서, 골라도 실제로는 못 받는다는 걸 알 수 있게 한다.
 */
export default function RecipientPicker({
  members,
  pushOn,
  value,
  onChange,
}: {
  members: Member[];
  pushOn: Set<number>;
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const q = query.trim().toLowerCase();
  const shown = members
    .filter((m) => !q || m.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const off = value.filter((id) => !pushOn.has(id)).length;

  const toggle = (id: number) =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
          placeholder="이름으로 찾기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          onClick={() => onChange(value.length ? [] : members.map((m) => m.id))}
          className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-700"
        >
          {value.length ? "모두 해제" : "전체 선택"}
        </button>
      </div>
      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-white p-2 ring-1 ring-zinc-200">
        {shown.map((m) => {
          const on = selected.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              aria-pressed={on}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${
                on ? "bg-blue-700 text-white" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {m.name}
              {!pushOn.has(m.id) && (
                <span
                  className={`text-[10px] font-bold ${on ? "text-amber-200" : "text-amber-600"}`}
                  title="이 사람은 휴대폰 알림을 켜지 않았어요"
                >
                  🔕
                </span>
              )}
            </button>
          );
        })}
        {shown.length === 0 && <p className="p-2 text-xs text-zinc-400">찾는 이름이 없어요.</p>}
      </div>
      <p className="text-xs text-zinc-500">
        {value.length}명 선택
        {off > 0 && (
          <span className="text-amber-700">
            {" "}
            · 🔕 알림을 켜지 않은 {off}명은 받지 못해요
          </span>
        )}
      </p>
    </div>
  );
}
