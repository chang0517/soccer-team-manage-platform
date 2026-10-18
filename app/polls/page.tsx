"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { confirmSheet } from "@/components/ui/ConfirmSheet";
import { haptic } from "@/components/ui/haptic";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/components/useSession";
import type { PollDetail } from "@/lib/types";

const emptyOptions = ["", ""];

export default function PollsPage() {
  const { user } = useSession();
  const myId = user?.memberId ?? null;
  const [polls, setPolls] = useState<PollDetail[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<string[]>(emptyOptions);
  const [multiSelect, setMultiSelect] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [picks, setPicks] = useState<Record<number, Set<number>>>({});
  const [votingId, setVotingId] = useState<number | null>(null);
  const [newOptionDrafts, setNewOptionDrafts] = useState<Record<number, string>>({});
  const [addingOptionId, setAddingOptionId] = useState<number | null>(null);
  const [expandedOptionId, setExpandedOptionId] = useState<number | null>(null);

  const load = () =>
    fetch(`/api/polls${myId ? `?memberId=${myId}` : ""}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PollDetail[]) => {
        setPolls(data);
        setLoaded(true);
        setPicks(
          Object.fromEntries(data.map((p) => [p.id, new Set(p.myOptionIds)]))
        );
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  const input = "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm";

  const updateOption = (i: number, value: string) =>
    setOptions((os) => os.map((o, idx) => (idx === i ? value : o)));

  const addOption = () => setOptions((os) => [...os, ""]);
  const removeOption = (i: number) =>
    setOptions((os) => os.filter((_, idx) => idx !== i));

  const submitPoll = async () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!title.trim() || cleanOptions.length < 2) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, options: cleanOptions, multiSelect }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "생성에 실패했어요.");
      return;
    }
    setTitle("");
    setOptions(emptyOptions);
    setMultiSelect(true);
    setShowForm(false);
    toast.success("투표를 만들었어요");
    load();
  };

  const togglePick = (poll: PollDetail, optionId: number) => {
    haptic(8);
    setPicks((prev) => {
      if (!poll.multiSelect) return { ...prev, [poll.id]: new Set([optionId]) };
      const next = new Set(prev[poll.id] ?? []);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return { ...prev, [poll.id]: next };
    });
  };

  const vote = async (pollId: number) => {
    if (!myId) return;
    const optionIds = [...(picks[pollId] ?? [])];
    if (optionIds.length === 0) return;
    setVotingId(pollId);
    const res = await fetch(`/api/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: myId, optionIds }),
    });
    setVotingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "투표에 실패했어요");
      return;
    }
    toast.success("투표했어요");
    load();
  };

  const toggleClosed = async (poll: PollDetail) => {
    await fetch(`/api/polls/${poll.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closed: !poll.closed }),
    });
    toast.success(poll.closed ? "투표를 다시 열었어요" : "투표를 마감했어요");
    load();
  };

  const removePoll = async (pollId: number) => {
    if (!(await confirmSheet({ title: "이 투표를 삭제할까요?", destructive: true, confirmText: "삭제" }))) return;
    await fetch(`/api/polls/${pollId}`, { method: "DELETE" });
    toast.success("투표를 삭제했어요");
    load();
  };

  const addPollOption = async (pollId: number) => {
    const label = (newOptionDrafts[pollId] ?? "").trim();
    if (!label) return;
    setAddingOptionId(pollId);
    await fetch(`/api/polls/${pollId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setAddingOptionId(null);
    setNewOptionDrafts((d) => ({ ...d, [pollId]: "" }));
    toast.success("보기를 추가했어요");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold tracking-tight">이벤트 투표</h1>
        {myId && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className={`rounded-full px-4 py-2 text-sm font-bold shadow-md ${
              showForm
                ? "bg-zinc-200 text-zinc-700 shadow-transparent"
                : "bg-blue-700 text-white shadow-blue-700/20"
            }`}
          >
            {showForm ? "닫기" : "+ 투표 만들기"}
          </button>
        )}
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
          <input
            className={input}
            placeholder="예: 이번 월드컵 우승은 어디?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={input}
                  placeholder={`보기 ${i + 1}`}
                  value={o}
                  onChange={(e) => updateOption(i, e.target.value)}
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    className="rounded-xl bg-zinc-100 px-3 text-sm text-zinc-500"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addOption}
              className="text-sm font-semibold text-blue-700"
            >
              + 보기 추가
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={multiSelect}
              onChange={(e) => setMultiSelect(e.target.checked)}
            />
            복수 선택 허용 (만든 후에는 바꿀 수 없어요)
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={submitPoll}
            disabled={
              saving ||
              !title.trim() ||
              options.map((o) => o.trim()).filter(Boolean).length < 2
            }
            className="w-full rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
          >
            {saving ? "만드는 중…" : "투표 만들기"}
          </button>
        </div>
        </motion.div>
      )}
      </AnimatePresence>

      {!loaded && <ListSkeleton rows={2} />}

      {loaded && polls.length === 0 && (
        <p className="card p-8 text-center text-sm text-zinc-400">
          아직 만들어진 투표가 없어요.
        </p>
      )}

      <div className="stagger space-y-3">
        {polls.map((poll) => {
          const total = Object.values(poll.voteCounts).reduce((a, b) => a + b, 0);
          const myPicks = picks[poll.id] ?? new Set<number>();
          const canManage = myId === poll.createdBy || user?.role === "admin";
          const alreadyVoted = poll.myOptionIds.length > 0;
          return (
            <div key={poll.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{poll.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {poll.creatorName} · 참여 {poll.voterCount}명
                    {!poll.multiSelect && " · 단일 선택"}
                    {poll.closed && " · 마감됨"}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => toggleClosed(poll)}
                      className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-200"
                    >
                      {poll.closed ? "재개" : "마감"}
                    </button>
                    <button
                      onClick={() => removePoll(poll.id)}
                      className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-500 hover:bg-red-100"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {poll.options.map((o) => {
                  const count = poll.voteCounts[o.id] ?? 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const picked = myPicks.has(o.id);
                  const voters = poll.optionVoters[o.id] ?? [];
                  const isExpanded = expandedOptionId === o.id;
                  return (
                    <div key={o.id}>
                      <div
                        className={`relative w-full overflow-hidden rounded-2xl border text-sm transition-colors ${
                          picked ? "border-blue-500 bg-blue-50/60" : "border-zinc-200"
                        }`}
                      >
                        <motion.div
                          className={`absolute inset-y-0 left-0 ${picked ? "bg-blue-200/70" : "bg-zinc-100"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ type: "spring", stiffness: 160, damping: 26 }}
                        />
                        <div className="relative flex items-center justify-between px-3.5 py-2.5">
                          <button
                            onClick={() => myId && !poll.closed && togglePick(poll, o.id)}
                            disabled={!myId || poll.closed}
                            className="min-w-0 flex-1 text-left disabled:opacity-70"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center ${
                                  poll.multiSelect ? "rounded-md" : "rounded-full"
                                } border-2 text-[11px] font-black transition-colors ${
                                  picked
                                    ? "border-blue-600 bg-blue-600 text-white"
                                    : "border-zinc-300 bg-white text-transparent"
                                }`}
                              >
                                ✓
                              </span>
                              <span className={picked ? "font-bold text-blue-800" : "font-medium"}>
                                {o.label}
                              </span>
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              setExpandedOptionId((cur) => (cur === o.id ? null : o.id))
                            }
                            className="shrink-0 pl-2 text-xs font-semibold tabular-nums text-zinc-500 hover:underline"
                          >
                            {count}표 · {pct}%
                          </button>
                        </div>
                      </div>
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden px-1 pt-1 text-xs text-zinc-500"
                          >
                            {voters.length > 0 ? voters.join(", ") : "아직 투표한 사람이 없어요."}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {canManage && !poll.closed && (
                <div className="mt-2 flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm"
                    placeholder="보기 추가"
                    value={newOptionDrafts[poll.id] ?? ""}
                    onChange={(e) =>
                      setNewOptionDrafts((d) => ({ ...d, [poll.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addPollOption(poll.id);
                    }}
                  />
                  <button
                    onClick={() => addPollOption(poll.id)}
                    disabled={
                      addingOptionId === poll.id || !(newOptionDrafts[poll.id] ?? "").trim()
                    }
                    className="shrink-0 rounded-xl bg-blue-50 px-3.5 py-1.5 text-sm font-bold text-blue-700 disabled:opacity-40"
                  >
                    추가
                  </button>
                </div>
              )}

              {myId && !poll.closed && (
                <button
                  onClick={() => vote(poll.id)}
                  disabled={votingId === poll.id || myPicks.size === 0}
                  className="mt-3 w-full rounded-2xl bg-blue-700 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
                >
                  {votingId === poll.id
                    ? "저장 중…"
                    : alreadyVoted
                      ? "투표 변경하기"
                      : "투표하기"}
                </button>
              )}
              {!myId && (
                <p className="mt-2 text-xs text-zinc-400">
                  로그인하면 투표할 수 있어요.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
