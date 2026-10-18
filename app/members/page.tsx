"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { confirmSheet } from "@/components/ui/ConfirmSheet";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/components/useSession";
import { POS_GROUPS, POS_LABELS } from "@/lib/types";
import type { Member, PosGroup } from "@/lib/types";

interface Draft {
  name: string;
  backNo: string;
  pos1: PosGroup;
  pos2: PosGroup;
  isGuest: boolean;
  phone: string;
}

const EMPTY: Draft = {
  name: "",
  backNo: "",
  pos1: "CB",
  pos2: "WB",
  isGuest: false,
  phone: "",
};

export default function MembersPage() {
  const { user } = useSession();
  const isAdmin = user?.role === "admin";
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);

  const load = () =>
    fetch("/api/members")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Member[]) => {
        setMembers(rows);
        setLoaded(true);
      });
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!draft.name.trim()) return;
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        backNo: draft.backNo === "" ? null : Number(draft.backNo),
        pos1: draft.pos1,
        pos2: draft.pos2,
        isGuest: draft.isGuest,
        phone: draft.phone,
      }),
    });
    if (!res.ok) {
      toast.error("멤버 추가에 실패했어요");
      return;
    }
    toast.success(`${draft.name} 님을 추가했어요`);
    setDraft(EMPTY);
    load();
  };

  const saveEdit = async (id: number) => {
    const res = await fetch(`/api/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editDraft.name,
        backNo: editDraft.backNo === "" ? null : Number(editDraft.backNo),
        pos1: editDraft.pos1,
        pos2: editDraft.pos2,
        isGuest: editDraft.isGuest,
        phone: editDraft.phone,
      }),
    });
    if (!res.ok) {
      toast.error("저장에 실패했어요");
      return;
    }
    setEditingId(null);
    toast.success("저장했어요");
    load();
  };

  const remove = async (m: Member) => {
    if (!(await confirmSheet({ title: `${m.name} 님을 삭제할까요? 투표·기록도 함께 삭제돼요.`, destructive: true, confirmText: "삭제" }))) return;
    const res = await fetch(`/api/members/${m.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("삭제에 실패했어요");
      return;
    }
    toast.success(`${m.name} 님을 삭제했어요`);
    load();
  };

  const input =
    "rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm";
  const q = query.trim();
  const shown = q ? members.filter((m) => m.name.includes(q) || String(m.backNo ?? "") === q) : members;
  const posSelect = (
    value: PosGroup,
    onChange: (v: PosGroup) => void
  ) => (
    <select
      className={input}
      value={value}
      onChange={(e) => onChange(e.target.value as PosGroup)}
    >
      {POS_GROUPS.map((g) => (
        <option key={g} value={g}>
          {g} · {POS_LABELS[g]}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[22px] font-extrabold tracking-tight">멤버</h1>
        <span className="rounded-full bg-zinc-200/70 px-2.5 py-0.5 text-xs font-bold text-zinc-600">총 {members.length}명</span>
      </div>

      {isAdmin && (
      <div className="space-y-3 rounded-3xl bg-blue-50/70 ring-1 ring-blue-100 p-4">
        <p className="text-sm font-bold">멤버 추가</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            className={input}
            placeholder="이름"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <input
            className={input}
            placeholder="등번호 (선택)"
            type="number"
            value={draft.backNo}
            onChange={(e) => setDraft({ ...draft, backNo: e.target.value })}
          />
          <input
            className={input}
            placeholder="전화번호 (선택)"
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
          <div>
            <label className="text-xs font-semibold text-zinc-500">
              1순위 포지션
            </label>
            {posSelect(draft.pos1, (v) => setDraft({ ...draft, pos1: v }))}
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500">
              2순위 포지션
            </label>
            {posSelect(draft.pos2, (v) => setDraft({ ...draft, pos2: v }))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-700"
            checked={draft.isGuest}
            onChange={(e) => setDraft({ ...draft, isGuest: e.target.checked })}
          />
          용병 (임시 참가자)
        </label>
        <button
          onClick={add}
          disabled={!draft.name.trim()}
          className="w-full rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
        >
          추가
        </button>
      </div>
      )}

      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">🔍</span>
        <input
          className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm"
          placeholder="이름 또는 등번호로 찾기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!loaded && <ListSkeleton rows={4} />}
      {loaded && shown.length === 0 && (
        <p className="card p-8 text-center text-sm text-zinc-400">
          {q ? `"${q}"에 해당하는 멤버가 없어요.` : "아직 등록된 멤버가 없어요."}
        </p>
      )}

      <div className="stagger card overflow-hidden">
        {shown.map((m) => (
          <div key={m.id} className="border-b border-zinc-100 last:border-0">
            {editingId === m.id ? (
              <div className="space-y-2 bg-zinc-50 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={input}
                    value={editDraft.name}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, name: e.target.value })
                    }
                  />
                  <input
                    className={input}
                    type="number"
                    placeholder="등번호"
                    value={editDraft.backNo}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, backNo: e.target.value })
                    }
                  />
                  <input
                    className={input}
                    type="tel"
                    placeholder="전화번호"
                    value={editDraft.phone}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, phone: e.target.value })
                    }
                  />
                  {posSelect(editDraft.pos1, (v) =>
                    setEditDraft({ ...editDraft, pos1: v })
                  )}
                  {posSelect(editDraft.pos2, (v) =>
                    setEditDraft({ ...editDraft, pos2: v })
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-700"
                    checked={editDraft.isGuest}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, isGuest: e.target.checked })
                    }
                  />
                  용병 (임시 참가자)
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(m.id)}
                    className="flex-1 rounded-2xl bg-blue-700 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-700/20"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 rounded-2xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-700"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-extrabold text-white shadow-sm">
                  {m.backNo ?? "–"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {m.name}
                    {m.isGuest && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        용병
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    1순위 {POS_LABELS[m.pos1]} · 2순위 {POS_LABELS[m.pos2]}
                  </p>
                  {(isAdmin || user?.memberId === m.id) && m.phone && (
                    <p className="text-xs text-zinc-400">{m.phone}</p>
                  )}
                </div>
                {(isAdmin || user?.memberId === m.id) && (
                  <button
                    onClick={() => {
                      setEditingId(m.id);
                      setEditDraft({
                        name: m.name,
                        backNo: m.backNo != null ? String(m.backNo) : "",
                        pos1: m.pos1,
                        pos2: m.pos2,
                        isGuest: m.isGuest,
                        phone: m.phone ?? "",
                      });
                    }}
                    className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                  >
                    수정
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => remove(m)}
                    className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-100"
                  >
                    삭제
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
