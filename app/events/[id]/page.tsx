"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { confirmSheet } from "@/components/ui/ConfirmSheet";
import { PageSkeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TimePicker from "@/components/TimePicker";
import MatchRecorder from "@/components/MatchRecorder";
import MvpVoteSection from "@/components/MvpVoteSection";
import SquadEditor from "@/components/SquadEditor";
import VoteButtons from "@/components/VoteButtons";
import { useSession } from "@/components/useSession";
import { formatDate, dDayLabel } from "@/lib/format";
import { WEATHER_EMOJI } from "@/lib/weather";
import type { MatchWeather } from "@/lib/weather";
import { normalizeRecordLog, summarizeRecordLog } from "@/lib/records";
import { ATTEND_CAP, isVotingClosed } from "@/lib/rules";
import {
  generateSquad,
  squadStatus,
  splitScrimmageTeams,
} from "@/lib/squad";
import { POS_CATEGORY, POS_CATEGORY_LABELS, POS_GROUPS } from "@/lib/types";
import type {
  CommentRow,
  EventItem,
  Member,
  MvpVoteRow,
  PosCategory,
  PosGroup,
  QuarterRecordEntry,
  SquadData,
  VoteRow,
  VoteStatus,
} from "@/lib/types";

const CATEGORY_ORDER: PosCategory[] = ["ATT", "MID", "DEF"];

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [recordLog, setRecordLog] = useState<QuarterRecordEntry[]>(() =>
    normalizeRecordLog(null)
  );
  const { user } = useSession();
  const myId = user?.memberId ?? null;
  const [activeTeam, setActiveTeam] = useState<"A" | "B">("A");
  const [weather, setWeather] = useState<MatchWeather | null>(null);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestForm, setGuestForm] = useState<{
    name: string;
    pos1: PosGroup;
    pos2: PosGroup;
  }>({ name: "", pos1: "CB", pos2: "WB" });
  const [addingGuest, setAddingGuest] = useState(false);
  const [mvpVotes, setMvpVotes] = useState<MvpVoteRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [adminAddPick, setAdminAddPick] = useState("");
  const [voteError, setVoteError] = useState("");
  const isAdmin = user?.role === "admin";
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoForm, setInfoForm] = useState({
    title: "",
    type: "match" as "match" | "social",
    opponent: "",
    date: "",
    time: "08:00",
    location: "",
  });
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState("");

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  const load = useCallback(async () => {
    const [detail, mems, comms] = await Promise.all([
      fetch(`/api/events/${id}`).then((r) => r.json()),
      fetch("/api/members").then((r) => r.json()),
      fetch(`/api/events/${id}/comments`).then((r) => r.json()),
    ]);
    if (detail.error) return;
    const ev: EventItem = detail.event;
    setEvent(ev);
    setVotes(detail.votes);
    setMvpVotes(detail.mvpVotes ?? []);
    setComments(Array.isArray(comms) ? comms : []);
    setMembers(mems);

    setRecordLog(normalizeRecordLog(ev.recordLog));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // load()가 이벤트를 다 받아온 다음에야 날씨를 요청하면 그만큼 늦게
  // 뜬다 — id는 라우트 파라미터로 이미 알고 있으니 load()와 동시에 바로
  // 요청한다(서버가 event.type을 판단해 매치가 아니면 null을 준다).
  // event.date/time/location을 의존성에 넣으면 load()가 끝나 그 값들이
  // 채워질 때 이펙트가 다시 돌면서 이 병렬 요청 자체가 무의미해지므로,
  // id에만 반응하고 정보 수정 후에는 saveInfo에서 직접 다시 부른다.
  const loadWeather = useCallback(() => {
    fetch(`/api/events/${id}/weather`)
      .then((r) => r.json())
      .then((d) => setWeather(d.weather ?? null))
      .catch(() => setWeather(null));
  }, [id]);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  // 푸시·홈 카드에서 /events/:id#mvp(MVP 투표)나 #squad(스쿼드 확정 알림)로
  // 들어오면, 화면이 다 그려진 뒤 그 섹션으로 스크롤한다(처음 로드 시점엔
  // 섹션이 아직 없어서 브라우저가 못 찾음).
  const eventLoaded = event != null;
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (!eventLoaded || (target !== "mvp" && target !== "squad")) return;
    const t = setTimeout(
      () => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      350
    );
    return () => clearTimeout(t);
  }, [eventLoaded]);

  if (!event) return <PageSkeleton />;

  const attendIds = votes.filter((v) => v.status === "attend").map((v) => v.memberId);
  const counts: Record<VoteStatus, number> = {
    attend: attendIds.length,
    maybe: votes.filter((v) => v.status === "maybe").length,
    absent: votes.filter((v) => v.status === "absent").length,
  };
  const myStatus =
    votes.find((v) => v.memberId === myId)?.status ?? null;
  const nonVoters = members.filter(
    (m) => !m.isGuest && !votes.some((v) => v.memberId === m.id)
  );
  const statusOf = (memberId: number): VoteStatus | null =>
    votes.find((v) => v.memberId === memberId)?.status ?? null;
  const voteClosed = isVotingClosed(counts.attend);
  // 내전(자체 2팀 스크리미지) 모드: scrimmageSquad가 있으면 squad=A팀,
  // scrimmageSquad=B팀으로 취급하고, 탭으로 어느 팀을 보고/편집 중인지 고른다.
  const isScrimmage = !!event.scrimmageSquad;
  const currentSquad = activeTeam === "B" ? event.scrimmageSquad : event.squad;
  const squadField = activeTeam === "B" ? "scrimmageSquad" : "squad";
  // 팀 로스터(그 팀 소속 memberId 전체) — 매뉴얼 조정 드롭다운과 벤치 계산에
  // 쓴다. 슬롯 이동만으로는 팀 소속이 바뀌지 않으므로, 4쿼터 전체의
  // starters+bench 합집합으로 안정적으로 복원한다.
  const teamRosterIds = (squad: SquadData | null): number[] => {
    const ids = new Set<number>();
    if (!squad) return [];
    for (const q of squad.quarters) {
      for (const s of q.starters) {
        if (s.memberId != null) ids.add(s.memberId);
        if (s.memberId2 != null) ids.add(s.memberId2);
      }
      for (const mid of q.bench) ids.add(mid);
    }
    return [...ids];
  };
  const rosterIds = isScrimmage ? teamRosterIds(currentSquad) : attendIds;
  const currentStatus = squadStatus(currentSquad);
  const isSquadLocked = currentStatus === "confirmed";
  // 스쿼드 자동생성·편집은 운영진만 가능(서버도 동일하게 검사한다).
  const canEditSquad = isAdmin;
  // 반대 팀으로 옮기는 건 두 팀 스쿼드를 동시에 다시 만드는 조작이라, 두
  // 팀 다 확정되지 않았을 때만 허용한다(서버도 확정된 스쿼드는 거절한다).
  const otherTeamSquad = activeTeam === "B" ? event.squad : event.scrimmageSquad;
  const canMoveTeam =
    isScrimmage && canEditSquad && !isSquadLocked && squadStatus(otherTeamSquad) !== "confirmed";
  const hasAbsenteeInSquad =
    currentSquad?.quarters.some(
      (q) =>
        q.starters.some(
          (s) =>
            (s.memberId != null && statusOf(s.memberId) === "absent") ||
            (s.memberId2 != null && statusOf(s.memberId2) === "absent")
        ) || q.bench.some((mid) => statusOf(mid) === "absent")
    ) ?? false;


  // 오늘 경기 개인 기록(골·어시) — MVP 후보 카드에 같이 보여준다.
  const recordSummary = summarizeRecordLog(recordLog);

  // 낙관적 업데이트: 누르는 즉시 반영하고, 서버가 거절하면 되돌린다.
  const vote = async (status: VoteStatus) => {
    if (!myId) return;
    const prev = votes;
    setVotes([
      ...prev.filter((v) => v.memberId !== myId),
      { eventId: Number(id), memberId: myId, status },
    ]);
    const res = await fetch(`/api/events/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: myId, status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setVotes(prev);
      setVoteError(data?.error || "투표에 실패했어요.");
      toast.error(data?.error || "투표에 실패했어요.");
      return;
    }
    setVoteError("");
    toast.success(`${{ attend: "참석", maybe: "미정", absent: "불참" }[status]}으로 투표했어요`);
    load();
  };

  const postComment = async () => {
    if (!newComment.trim()) return;
    setCommentSaving(true);
    const res = await fetch(`/api/events/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment.trim() }),
    });
    setCommentSaving(false);
    if (res.ok) {
      setNewComment("");
      load();
    }
  };

  const removeComment = async (commentId: number) => {
    await fetch(`/api/events/${id}/comments/${commentId}`, { method: "DELETE" });
    load();
  };

  const adminAddAttend = async () => {
    if (!adminAddPick) return;
    await fetch(`/api/events/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: Number(adminAddPick), status: "attend" }),
    });
    setAdminAddPick("");
    load();
  };

  const adminSetVote = async (memberId: number, status: VoteStatus | "none") => {
    await fetch(`/api/events/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, status }),
    });
    load();
  };

  const addGuest = async () => {
    if (!guestForm.name.trim()) return;
    setAddingGuest(true);
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: guestForm.name.trim(),
        backNo: null,
        pos1: guestForm.pos1,
        pos2: guestForm.pos2,
        isGuest: true,
      }),
    });
    const guest = await res.json();
    await fetch(`/api/events/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: guest.id, status: "attend" }),
    });
    setAddingGuest(false);
    setGuestForm({ name: "", pos1: "CB", pos2: "WB" });
    setShowGuestForm(false);
    load();
  };

  // 내전 모드가 아니면(=평소 단일 팀) 서버가 참석 투표를 다시 읽어 A팀
  // 스쿼드를 새로 만든다. 내전 모드면 지금 보고 있는 팀의 기존 로스터
  // (팀을 새로 나누지 않고) 그대로 포메이션·쿼터만 다시 섞는다.
  const confirmSquadReset = async () =>
    currentStatus !== "submitted" ||
    (await confirmSheet({
      title: "제출된 스쿼드를 바꿀까요?",
      description: "받은 승인이 초기화되고, 다시 제출해야 해요.",
      confirmText: "바꾸기",
    }));

  const regenerate = async () => {
    if (currentSquad && !(await confirmSheet({ title: "스쿼드를 새로 만들까요?", description: "직접 고친 내용이 모두 사라지고 자동으로 다시 짜요." + (currentStatus === "submitted" ? " 받은 승인도 초기화돼요." : ""), confirmText: "다시 만들기" })))
      return;
    if (!isScrimmage) {
      const res = await fetch(`/api/events/${id}/squad`, { method: "POST" });
      if (!res.ok) toast.error((await res.json().catch(() => null))?.error || "스쿼드를 만들지 못했어요.");
      load();
      return;
    }
    const rosterMembers = members.filter((m) => rosterIds.includes(m.id));
    const squad = generateSquad(rosterMembers);
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [squadField]: squad }),
    });
    load();
  };

  // 참석자를 포지션 균형 맞춰 두 팀으로 나누고, 각 팀 포메이션도 함께
  // 새로 만든다. 이미 내전 모드였다면 두 팀 다 다시 나뉜다(재승인 필요).
  const splitScrimmage = async () => {
    if (isScrimmage && !(await confirmSheet("두 팀을 다시 나눌까요? 기존 두 팀 스쿼드가 대체돼요.")))
      return;
    const attendees = members.filter((m) => attendIds.includes(m.id));
    const { teamA, teamB } = splitScrimmageTeams(attendees);
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        squad: generateSquad(teamA),
        scrimmageSquad: generateSquad(teamB),
      }),
    });
    setActiveTeam("A");
    load();
  };

  // 내전 모드 종료 — B팀 스쿼드를 지우고 평소처럼 A팀(squad) 하나만 쓰는
  // 상태로 되돌린다. A팀 스쿼드 자체는 그대로 둔다.
  const endScrimmage = async () => {
    if (!(await confirmSheet({ title: "내전 모드를 끝낼까요? B팀 스쿼드는 사라져요.", destructive: true, confirmText: "끝내기" }))) return;
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scrimmageSquad: null }),
    });
    setActiveTeam("A");
    load();
  };

  // 내전 모드에서 특정 멤버를 반대 팀 로스터로 옮긴다. 두 팀 다 그 새
  // 로스터로 포메이션을 다시 만든다(어느 슬롯에 배정될지는 다시 계산됨).
  const moveToOtherTeam = async (memberId: number) => {
    if (!event.squad || !event.scrimmageSquad) return;
    if (!(await confirmSquadReset())) return;
    const aIds = teamRosterIds(event.squad);
    const bIds = teamRosterIds(event.scrimmageSquad);
    const movingFromA = aIds.includes(memberId);
    const newAIds = movingFromA
      ? aIds.filter((mid) => mid !== memberId)
      : [...aIds, memberId];
    const newBIds = movingFromA
      ? [...bIds, memberId]
      : bIds.filter((mid) => mid !== memberId);
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        squad: generateSquad(members.filter((m) => newAIds.includes(m.id))),
        scrimmageSquad: generateSquad(members.filter((m) => newBIds.includes(m.id))),
      }),
    });
    load();
  };

  // 불참으로 바뀐 멤버를 스쿼드(선발+벤치)에서 완전히 빼낸다. 내전 모드의
  // rosterIds는 참석 투표가 아니라 팀 배정 기준이라, 불참 처리해도 그냥 두면
  // 벤치로 다시 채워져버리므로 여기서 명시적으로 걸러낸다. 승인은 스쿼드
  // 구성이 바뀌는 것이므로 재승인이 필요하도록 비운다.
  const removeAbsenteesFromSquad = async () => {
    if (!currentSquad) return;
    if (!(await confirmSquadReset())) return;
    const isAbsent = (mid: number | null | undefined) =>
      mid != null && statusOf(mid) === "absent";
    const quarters = currentSquad.quarters.map((q) => {
      const starters = q.starters.map((s) => {
        const patch: Partial<{ memberId: number | null; memberId2: number | null }> = {};
        if (isAbsent(s.memberId)) patch.memberId = null;
        if (isAbsent(s.memberId2)) patch.memberId2 = null;
        return Object.keys(patch).length ? { ...s, ...patch } : s;
      });
      const starterIds = new Set(
        starters.flatMap((s) => [s.memberId, s.memberId2 ?? null]).filter((v): v is number => v != null)
      );
      return {
        starters,
        bench: rosterIds.filter((mid) => !starterIds.has(mid) && !isAbsent(mid)),
      };
    });
    const squad: SquadData = { ...currentSquad, quarters, confirmed: false, approvedBy: [] };
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [squadField]: squad }),
    });
    load();
  };

  const removeEvent = async () => {
    if (!(await confirmSheet({ title: "이 일정을 삭제할까요? 투표와 기록도 함께 삭제돼요.", destructive: true, confirmText: "삭제" }))) return;
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    router.push("/schedule");
  };

  const startEditInfo = () => {
    setInfoForm({
      title: event.title,
      type: event.type,
      opponent: event.opponent,
      date: event.date,
      time: event.time,
      location: event.location,
    });
    setEditingInfo(true);
  };

  const saveInfo = async () => {
    if (!infoForm.title.trim() || !infoForm.date) return;
    setInfoSaving(true);
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(infoForm),
    });
    setInfoSaving(false);
    setEditingInfo(false);
    load();
    loadWeather();
  };

  const notifyNonVoters = async () => {
    if (!(await confirmSheet(`미투표자 ${nonVoters.length}명에게 투표 독려 문자를 보낼까요?`))) return;
    setNotifying(true);
    setNotifyResult("");
    const res = await fetch(`/api/events/${id}/notify-nonvoters`, { method: "POST" });
    const data = await res.json();
    setNotifying(false);
    if (!res.ok) {
      setNotifyResult(data.error || "문자 발송에 실패했어요.");
      return;
    }
    const parts: string[] = [];
    if (data.sent.length > 0) parts.push(`${data.sent.length}명 발송 완료`);
    if (data.skippedNoPhone.length > 0)
      parts.push(`전화번호 없음 ${data.skippedNoPhone.length}명 제외`);
    if (data.failed.length > 0) parts.push(`발송 실패 ${data.failed.length}명`);
    setNotifyResult(parts.join(" · ") || "보낼 대상이 없어요.");
  };

  // 스쿼드를 짤 때 공격/미드필더/수비 인원을 한눈에 보려고 포지션(1순위)
  // 카테고리별로 묶어서 보여준다.
  const groupedByCategory = (memberIds: number[]) => {
    const byCat = new Map<PosCategory, string[]>();
    for (const mid of memberIds) {
      const m = memberById.get(mid);
      if (!m) continue;
      const cat = POS_CATEGORY[m.pos1];
      const list = byCat.get(cat) ?? [];
      list.push(`${m.name}${m.isGuest ? "(용병)" : ""}`);
      byCat.set(cat, list);
    }
    return CATEGORY_ORDER.filter((c) => (byCat.get(c)?.length ?? 0) > 0).map((c) => ({
      cat: c,
      label: POS_CATEGORY_LABELS[c],
      names: byCat.get(c)!,
    }));
  };

  const groupedVoters = (status: VoteStatus) =>
    groupedByCategory(votes.filter((v) => v.status === status).map((v) => v.memberId));

  // 팀 로스터를 포지션별로 묶되, 각 인원의 memberId도 같이 준다 — 내전
  // 모드에서 이름을 눌러 반대 팀으로 옮기는 조작에 필요하다.
  const groupedByCategoryIds = (memberIds: number[]) => {
    const byCat = new Map<PosCategory, number[]>();
    for (const mid of memberIds) {
      const m = memberById.get(mid);
      if (!m) continue;
      const cat = POS_CATEGORY[m.pos1];
      const list = byCat.get(cat) ?? [];
      list.push(mid);
      byCat.set(cat, list);
    }
    return CATEGORY_ORDER.filter((c) => (byCat.get(c)?.length ?? 0) > 0).map((c) => ({
      cat: c,
      label: POS_CATEGORY_LABELS[c],
      ids: byCat.get(c)!,
    }));
  };

  return (
    <div className="space-y-6">
      <section
        className={
          editingInfo
            ? "card p-4"
            : "overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-5 text-white shadow-lg shadow-blue-900/20"
        }
      >
        <div className="flex items-center justify-between">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
              editingInfo ? "bg-blue-50 text-blue-700" : "bg-white/15 text-white"
            }`}
          >
            {dDayLabel(event.date)}
          </span>
          {isAdmin && !editingInfo && (
            <div className="flex gap-3">
              <button
                onClick={startEditInfo}
                className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white hover:bg-white/25"
              >
                정보 수정
              </button>
              <button
                onClick={removeEvent}
                className="rounded-full bg-red-500/80 px-3 py-1 text-xs font-bold text-white hover:bg-red-500"
              >
                삭제
              </button>
            </div>
          )}
        </div>
        {editingInfo ? (
          <div className="mt-3 space-y-3 rounded-2xl bg-blue-50/70 p-3 ring-1 ring-blue-100">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-zinc-500">제목</label>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm"
                  value={infoForm.title}
                  onChange={(e) => setInfoForm({ ...infoForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500">유형</label>
                <select
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm"
                  value={infoForm.type}
                  onChange={(e) =>
                    setInfoForm({ ...infoForm, type: e.target.value as "match" | "social" })
                  }
                >
                  <option value="match">경기</option>
                  <option value="social">모임/행사</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500">상대팀</label>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm"
                  placeholder="경기일 때만"
                  value={infoForm.opponent}
                  onChange={(e) => setInfoForm({ ...infoForm, opponent: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-500">날짜</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm"
                  value={infoForm.date}
                  onChange={(e) => setInfoForm({ ...infoForm, date: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-zinc-500">시간</label>
                <TimePicker
                  value={infoForm.time}
                  onChange={(time) => setInfoForm({ ...infoForm, time })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-zinc-500">장소</label>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm"
                  value={infoForm.location}
                  onChange={(e) => setInfoForm({ ...infoForm, location: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveInfo}
                disabled={infoSaving || !infoForm.title.trim() || !infoForm.date}
                className="flex-1 rounded-2xl bg-blue-700 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-700/20 disabled:opacity-40"
              >
                {infoSaving ? "저장 중…" : "저장"}
              </button>
              <button
                onClick={() => setEditingInfo(false)}
                className="rounded-2xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
              {event.title}
              {event.opponent && (
                <span className="font-semibold text-blue-100"> vs {event.opponent}</span>
              )}
            </h1>
            <p className="mt-1.5 text-sm text-blue-100">
              {formatDate(event.date, event.time)}
              {event.location && ` · ${event.location}`}
            </p>
            {weather && (
              <p className="mt-1 text-sm font-semibold text-blue-50">
                {weather.pty ? WEATHER_EMOJI[weather.pty] : weather.sky ? WEATHER_EMOJI[weather.sky] : ""}{" "}
                {weather.pty ?? weather.sky ?? ""}
                {weather.tmp != null && ` · ${weather.tmp}°C`}
                {weather.pop != null && ` · 강수 ${weather.pop}%`}
              </p>
            )}
          </>
        )}
        {event.scored != null && event.conceded != null && (
          <p
            className={`mt-3 text-4xl font-black tabular-nums tracking-tight ${
              editingInfo ? "text-blue-700" : "text-white"
            }`}
          >
            {event.scored} : {event.conceded}
            {event.conceded === 0 && (
              <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
                클린시트
              </span>
            )}
          </p>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-lg font-extrabold tracking-tight">참석 투표</h2>
        {voteClosed && (
          <p className="mb-3 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600">
            투표가 마감됐어요 (참석 {ATTEND_CAP}명 도달). 참석하고 싶으면 아래 댓글로 남겨 주세요.
          </p>
        )}
        <VoteButtons
          myStatus={myStatus}
          counts={counts}
          disabled={!myId || (voteClosed && !isAdmin)}
          onVote={vote}
        />
        {voteError && <p className="mt-2 text-xs text-red-500">{voteError}</p>}
        {!myId && (
          <p className="mt-2 text-xs text-zinc-400">
            {user
              ? "아직 멤버 프로필과 연결되지 않았어요. 운영진에게 요청해 주세요."
              : "투표하려면 먼저 로그인해 주세요."}{" "}
            {!user && (
              <Link className="text-blue-700 underline" href="/login">
                로그인
              </Link>
            )}
          </p>
        )}
        <div className="mt-4 space-y-3 text-sm">
          {(
            [
              ["attend", "참석", "text-blue-700"],
              ["maybe", "미정", "text-amber-600"],
              ["absent", "불참", "text-zinc-500"],
            ] as [VoteStatus, string, string][]
          ).map(([status, label, colorClass]) => (
            <div key={status}>
              <span className={`font-semibold ${colorClass}`}>
                {label} {counts[status]}
              </span>
              <div className="mt-1 space-y-0.5">
                {groupedVoters(status).map((g) => (
                  <p key={g.cat} className="text-zinc-600">
                    <span className="font-semibold text-zinc-500">
                      {g.label} {g.names.length}
                    </span>{" "}
                    {g.names.join(", ")}
                  </p>
                ))}
              </div>
            </div>
          ))}
          {nonVoters.length > 0 && (
            <p className="text-xs text-zinc-400">
              미투표 {nonVoters.length}명: {nonVoters.map((m) => m.name).join(", ")}
            </p>
          )}
          {isAdmin && nonVoters.length > 0 && (
            <div className="mt-1.5">
              <button
                onClick={notifyNonVoters}
                disabled={notifying}
                className="rounded-lg bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {notifying ? "발송 중…" : "미투표자에게 문자 보내기"}
              </button>
              {notifyResult && (
                <p className="mt-1 text-xs text-zinc-500">{notifyResult}</p>
              )}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <div className="flex items-center gap-2">
              <select
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm"
                value={adminAddPick}
                onChange={(e) => setAdminAddPick(e.target.value)}
              >
                <option value="">참석으로 직접 추가할 멤버 선택</option>
                {members
                  .filter((m) => !attendIds.includes(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.isGuest ? " · 용병" : ""}
                    </option>
                  ))}
              </select>
              <button
                onClick={adminAddAttend}
                disabled={!adminAddPick}
                className="shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                참석 추가
              </button>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-blue-700">
                운영진: 전체 인원 참석 관리 (투표 마감 후에도 변경 가능)
              </summary>
              <div className="mt-2 max-h-96 space-y-1 overflow-y-auto rounded-lg border border-zinc-100 p-2">
                {members
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, "ko"))
                  .map((m) => {
                    const st = statusOf(m.id);
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 py-1"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {m.name}
                          {m.isGuest ? " · 용병" : ""}
                        </span>
                        <div className="flex shrink-0 gap-1">
                          {(
                            [
                              ["attend", "참석"],
                              ["maybe", "미정"],
                              ["absent", "불참"],
                              ["none", "미투표"],
                            ] as [VoteStatus | "none", string][]
                          ).map(([status, label]) => (
                            <button
                              key={status}
                              onClick={() => adminSetVote(m.id, status)}
                              className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                                (st ?? "none") === status
                                  ? status === "attend"
                                    ? "bg-blue-700 text-white"
                                    : status === "maybe"
                                      ? "bg-amber-500 text-white"
                                      : "bg-zinc-500 text-white"
                                  : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </details>
          </div>
        )}

        <div className="mt-4 border-t border-zinc-100 pt-3">
          <p className="mb-2 text-sm font-semibold text-zinc-500">댓글</p>
          {comments.length === 0 ? (
            <p className="mb-2 text-xs text-zinc-400">아직 댓글이 없어요.</p>
          ) : (
            <div className="mb-2 space-y-1.5">
              {comments.map((c) => (
                <p key={c.id} className="flex items-start justify-between gap-2 text-sm">
                  <span>
                    <span className="font-semibold">
                      {memberById.get(c.memberId)?.name ?? "?"}
                    </span>
                    <span className="ml-1.5 text-zinc-600">{c.body}</span>
                  </span>
                  {(myId === c.memberId || isAdmin) && (
                    <button
                      onClick={() => removeComment(c.id)}
                      className="shrink-0 text-xs text-zinc-400 hover:text-red-500"
                    >
                      삭제
                    </button>
                  )}
                </p>
              ))}
            </div>
          )}
          {myId ? (
            <div className="flex items-center gap-2">
              <input
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm"
                placeholder="참석 의사나 하고 싶은 말을 남겨보세요"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && postComment()}
              />
              <button
                onClick={postComment}
                disabled={commentSaving || !newComment.trim()}
                className="shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                등록
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">댓글을 남기려면 로그인해 주세요.</p>
          )}
        </div>

        <div className="mt-4 border-t border-zinc-100 pt-3">
          <button
            onClick={() => setShowGuestForm((v) => !v)}
            className="text-sm font-semibold text-blue-700"
          >
            {showGuestForm ? "용병 추가 닫기" : "+ 용병 추가"}
          </button>
          {showGuestForm && (
            <div className="mt-3 space-y-2 rounded-xl bg-zinc-50 p-3">
              <input
                className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm"
                placeholder="용병 이름"
                value={guestForm.name}
                onChange={(e) =>
                  setGuestForm({ ...guestForm, name: e.target.value })
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-2 py-2 text-sm"
                  value={guestForm.pos1}
                  onChange={(e) =>
                    setGuestForm({
                      ...guestForm,
                      pos1: e.target.value as PosGroup,
                    })
                  }
                >
                  {POS_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      1순위 {g}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-2 py-2 text-sm"
                  value={guestForm.pos2}
                  onChange={(e) =>
                    setGuestForm({
                      ...guestForm,
                      pos2: e.target.value as PosGroup,
                    })
                  }
                >
                  {POS_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      2순위 {g}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={addGuest}
                disabled={addingGuest || !guestForm.name.trim()}
                className="w-full rounded-2xl bg-blue-700 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
              >
                {addingGuest ? "추가 중…" : "용병 추가 + 이 경기 참석 등록"}
              </button>
              <p className="text-xs text-zinc-400">
                이 경기에만 쓰는 임시 참가자예요. 멤버 명단에도 &ldquo;용병&rdquo;
                표시로 남아요.
              </p>
            </div>
          )}
        </div>
      </section>

      {event.type === "match" && (
        <section id="squad" className="card scroll-mt-20 p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold tracking-tight">스쿼드 (4-1-2-2-1)</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {isAdmin && !isSquadLocked && (
                <button
                  onClick={splitScrimmage}
                  className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {isScrimmage ? "내전 2팀 다시 나누기" : "내전 2팀 나누기"}
                </button>
              )}
              {isAdmin && isScrimmage && (
                <button
                  onClick={endScrimmage}
                  className="rounded-xl bg-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600"
                >
                  내전 모드 종료
                </button>
              )}
              {isAdmin && currentSquad && hasAbsenteeInSquad && !isSquadLocked && (
                <button
                  onClick={removeAbsenteesFromSquad}
                  className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  불참자 정리
                </button>
              )}
              {canEditSquad && !isSquadLocked && (
                <button
                  onClick={regenerate}
                  className="rounded-xl bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {currentSquad ? (isScrimmage ? "이 팀 다시 생성" : "다시 생성") : "스쿼드 만들기 시작"}
                </button>
              )}
            </div>
          </div>
          {isScrimmage && (
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setActiveTeam("A")}
                className={`rounded-xl py-2 text-sm font-bold ${
                  activeTeam === "A" ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700"
                }`}
              >
                A팀
              </button>
              <button
                onClick={() => setActiveTeam("B")}
                className={`rounded-xl py-2 text-sm font-bold ${
                  activeTeam === "B" ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700"
                }`}
              >
                B팀
              </button>
            </div>
          )}
          {currentSquad ? (
            <>
              {/* 전체 명단은 내전에서 선수를 다른 팀으로 옮길 때만 필요해서 그때만 보여준다. */}
              {canMoveTeam && (
              <div className="mb-3 rounded-xl bg-zinc-50 p-3 text-sm">
                <p className="mb-1.5 text-xs font-bold text-zinc-500">
                  {isScrimmage ? `${activeTeam}팀 전체 명단` : "전체 명단"} · {rosterIds.length}명
                  {canMoveTeam && ` · 이름을 누르면 ${activeTeam === "A" ? "B" : "A"}팀으로 이동`}
                </p>
                <div className="space-y-1.5">
                  {groupedByCategoryIds(rosterIds).map(({ cat, label, ids }) => (
                    <p key={cat} className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 shrink-0 font-semibold text-zinc-500">
                        {label} {ids.length}
                      </span>
                      {ids.map((mid) => {
                        const m = memberById.get(mid);
                        const nameLabel = `${m?.name ?? "?"}${m?.isGuest ? "(용병)" : ""}`;
                        return canMoveTeam ? (
                          <button
                            key={mid}
                            onClick={() => moveToOtherTeam(mid)}
                            className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200"
                          >
                            {nameLabel}
                          </button>
                        ) : (
                          <span
                            key={mid}
                            className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-100"
                          >
                            {nameLabel}
                          </span>
                        );
                      })}
                    </p>
                  ))}
                </div>
              </div>
              )}

              <SquadEditor
                key={activeTeam}
                eventId={Number(id)}
                team={activeTeam}
                squad={currentSquad}
                members={members}
                rosterIds={rosterIds}
                isAdmin={isAdmin}
                myId={myId}
                onSquadChange={(sq) => {
                  const field = squadField;
                  setEvent((ev) => (ev ? { ...ev, [field]: sq } : ev));
                }}
              />
            </>
          ) : (
            <p className="rounded-2xl bg-zinc-50 p-5 text-center text-sm text-zinc-400">
              아직 스쿼드가 없어요. 경기 3일 전에 자동으로 만들어지고, 위
              &lsquo;스쿼드 만들기 시작&rsquo;을 누르면 참석자로 바로 배치돼요.
            </p>
          )}
        </section>
      )}

      {event.type === "match" && (
        <section className="card p-4">
          <MatchRecorder
            eventId={Number(id)}
            event={event}
            members={members}
            attendIds={attendIds}
            recordLog={recordLog}
            onRecordLogChange={setRecordLog}
          />
          {isAdmin && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-zinc-50 p-2">
              <select
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm"
                value={adminAddPick}
                onChange={(e) => setAdminAddPick(e.target.value)}
              >
                <option value="">
                  투표 없이 뛴 선수를 참석으로 추가
                </option>
                {members
                  .filter((m) => !attendIds.includes(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.isGuest ? " · 용병" : ""}
                    </option>
                  ))}
              </select>
              <button
                onClick={adminAddAttend}
                disabled={!adminAddPick}
                className="shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                참석 추가
              </button>
            </div>
          )}
        </section>
      )}

      {event.type === "match" && (
        <MvpVoteSection
          eventId={Number(id)}
          event={event}
          members={members}
          attendIds={attendIds}
          myId={myId}
          loggedIn={!!user}
          mvpVotes={mvpVotes}
          onMvpVotesChange={setMvpVotes}
          goals={recordSummary.goals}
          assists={recordSummary.assists}
        />
      )}
    </div>
  );
}
