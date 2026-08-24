import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";
import type {
  CommentRow,
  EventItem,
  Member,
  MvpVoteRow,
  PosGroup,
  QuarterRecordEntry,
  RecordRow,
  SquadData,
  VoteRow,
  VoteStatus,
} from "../api/types";
import { POS_GROUPS } from "../constants";
import PosPicker from "../components/PosPicker";
import { colors } from "../theme";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "EventDetail">;

const VOTE_OPTIONS: { status: VoteStatus; label: string; color: string }[] = [
  { status: "attend", label: "참석", color: colors.primaryLight },
  { status: "maybe", label: "미정", color: "#d97706" },
  { status: "absent", label: "불참", color: "#71717a" },
];

const SQUAD_APPROVAL_THRESHOLD = 3;
const QUARTER_COUNT = 4;

interface GoalEntryDraft {
  key: string;
  scorerId: string;
  assistId: string;
}

interface QuarterRecordDraft {
  scored: string;
  conceded: string;
  goals: GoalEntryDraft[];
}

let goalKeySeq = 0;
const makeGoalKey = () => `g${++goalKeySeq}`;

const emptyRecordQuarters = (): QuarterRecordDraft[] =>
  Array.from({ length: QUARTER_COUNT }, () => ({ scored: "", conceded: "", goals: [] }));

function isSquadConfirmed(squad: SquadData | null | undefined): boolean {
  if (!squad) return false;
  if (squad.confirmed) return true;
  return (squad.approvedBy?.length ?? 0) >= SQUAD_APPROVAL_THRESHOLD;
}

export default function EventDetailScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const myId = user?.memberId ?? null;

  const [event, setEvent] = useState<EventItem | null>(null);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [mvpVotes, setMvpVotes] = useState<MvpVoteRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

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

  const [showAdminVotes, setShowAdminVotes] = useState(false);
  const [adminAddPick, setAdminAddPick] = useState<number | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState("");

  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestForm, setGuestForm] = useState<{ name: string; pos1: PosGroup; pos2: PosGroup }>({
    name: "",
    pos1: "CB",
    pos2: "WB",
  });
  const [addingGuest, setAddingGuest] = useState(false);

  const [squadBusy, setSquadBusy] = useState(false);
  const [squadQuarterIdx, setSquadQuarterIdx] = useState(0);

  const [recordQuarters, setRecordQuarters] = useState<QuarterRecordDraft[]>(emptyRecordQuarters());
  const [recordQuarterIdx, setRecordQuarterIdx] = useState(0);
  const [savingRecords, setSavingRecords] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [recordAddPick, setRecordAddPick] = useState<number | null>(null);

  const [mvpPick, setMvpPick] = useState<number | null>(null);
  const [votingMvp, setVotingMvp] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [detail, memberList, commentList] = await Promise.all([
        api.get<{ event: EventItem; votes: VoteRow[]; mvpVotes: MvpVoteRow[] }>(
          `/api/events/${eventId}`
        ),
        api.get<Member[]>("/api/members"),
        api.get<CommentRow[]>(`/api/events/${eventId}/comments`),
      ]);
      setEvent(detail.event);
      setVotes(detail.votes);
      setMvpVotes(detail.mvpVotes ?? []);
      setMembers(memberList);
      setComments(commentList);
      navigation.setOptions({ title: detail.event.title });

      if (Array.isArray(detail.event.recordLog) && detail.event.recordLog.length > 0) {
        setRecordQuarters(
          detail.event.recordLog.map((q) => ({
            scored: q.scored != null ? String(q.scored) : "",
            conceded: q.conceded != null ? String(q.conceded) : "",
            goals: q.goals.map((g) => ({
              key: makeGoalKey(),
              scorerId: g.scorerId != null ? String(g.scorerId) : "",
              assistId: g.assistId != null ? String(g.assistId) : "",
            })),
          }))
        );
      } else {
        setRecordQuarters(emptyRecordQuarters());
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [eventId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const memberName = (id: number | null) =>
    id == null ? "-" : (members.find((m) => m.id === id)?.name ?? `#${id}`);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "일정을 찾을 수 없어요."}</Text>
      </View>
    );
  }

  const attendIds = votes.filter((v) => v.status === "attend").map((v) => v.memberId);
  const amAttendee = myId != null && attendIds.includes(myId);
  const counts: Record<VoteStatus, number> = { attend: 0, maybe: 0, absent: 0 };
  for (const v of votes) counts[v.status]++;
  const myStatus = votes.find((v) => v.memberId === myId)?.status ?? null;
  const attendNames = attendIds.map((id) => memberName(id));
  const nonVoters = members.filter((m) => !m.isGuest && !votes.some((v) => v.memberId === m.id));
  const statusOf = (memberId: number): VoteStatus | null =>
    votes.find((v) => v.memberId === memberId)?.status ?? null;

  const currentSquad = event.squad;
  const isSquadLocked = isSquadConfirmed(currentSquad);
  const squadApprovedBy = currentSquad?.approvedBy ?? [];
  const iApprovedSquad = myId != null && squadApprovedBy.includes(myId);
  const rosterIds = attendIds;

  const mvpTally = (() => {
    const tally = new Map<number, number>();
    for (const v of mvpVotes) tally.set(v.voteeId, (tally.get(v.voteeId) ?? 0) + 1);
    const max = Math.max(0, ...tally.values());
    return [...tally.entries()]
      .map(([memberId, count]) => ({ memberId, count, isLeader: count === max && max > 0 }))
      .sort((a, b) => b.count - a.count);
  })();
  const myMvpVote = mvpVotes.find((v) => v.voterId === myId)?.voteeId ?? null;

  const recordSummary = (() => {
    let scoredSum = 0;
    let concededSum = 0;
    let anyScored = false;
    let anyConceded = false;
    const goals = new Map<number, number>();
    const assists = new Map<number, number>();
    for (const q of recordQuarters) {
      if (q.scored !== "") {
        scoredSum += Number(q.scored) || 0;
        anyScored = true;
      }
      if (q.conceded !== "") {
        concededSum += Number(q.conceded) || 0;
        anyConceded = true;
      }
      for (const g of q.goals) {
        if (g.scorerId) goals.set(Number(g.scorerId), (goals.get(Number(g.scorerId)) ?? 0) + 1);
        if (g.assistId) assists.set(Number(g.assistId), (assists.get(Number(g.assistId)) ?? 0) + 1);
      }
    }
    const attendedIds = new Set([...attendIds, ...goals.keys(), ...assists.keys()]);
    return {
      scored: anyScored ? scoredSum : null,
      conceded: anyConceded ? concededSum : null,
      goals,
      assists,
      attendedIds,
    };
  })();

  const squadPositionByMember = new Map<number, string>();

  const castVote = async (status: VoteStatus) => {
    if (!myId) return;
    setVoting(true);
    setVoteError("");
    try {
      await api.post(`/api/events/${eventId}/vote`, { memberId: myId, status });
      await load();
    } catch (e) {
      setVoteError(e instanceof ApiError ? e.message : "투표에 실패했어요.");
    } finally {
      setVoting(false);
    }
  };

  const adminSetVote = async (memberId: number, status: VoteStatus) => {
    await api.post(`/api/events/${eventId}/vote`, { memberId, status });
    await load();
  };

  const adminAddAttend = async () => {
    if (!adminAddPick) return;
    await api.post(`/api/events/${eventId}/vote`, { memberId: adminAddPick, status: "attend" });
    setAdminAddPick(null);
    await load();
  };

  const notifyNonVoters = () => {
    Alert.alert("문자 발송", `미투표자 ${nonVoters.length}명에게 투표 독려 문자를 보낼까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "발송",
        onPress: async () => {
          setNotifying(true);
          setNotifyResult("");
          try {
            const data = await api.post<{ sent: unknown[]; skippedNoPhone: unknown[] }>(
              `/api/events/${eventId}/notify-nonvoters`
            );
            const parts: string[] = [];
            if (data.sent.length > 0) parts.push(`${data.sent.length}명 발송 완료`);
            if (data.skippedNoPhone.length > 0)
              parts.push(`전화번호 없음 ${data.skippedNoPhone.length}명 제외`);
            setNotifyResult(parts.join(" · ") || "발송할 대상이 없어요.");
          } catch (e) {
            setNotifyResult(e instanceof ApiError ? e.message : "문자 발송에 실패했어요.");
          } finally {
            setNotifying(false);
          }
        },
      },
    ]);
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      await api.post(`/api/events/${eventId}/comments`, { body: commentText.trim() });
      setCommentText("");
      await load();
    } catch {
      // 실패해도 목록은 그대로 두고 조용히 무시 — 별도 상태 없이 재시도만 유도
    } finally {
      setPostingComment(false);
    }
  };

  const deleteComment = async (commentId: number) => {
    await api.del(`/api/events/${eventId}/comments/${commentId}`);
    await load();
  };

  const addGuest = async () => {
    if (!guestForm.name.trim()) return;
    setAddingGuest(true);
    try {
      const guest = await api.post<Member>("/api/members", {
        name: guestForm.name.trim(),
        backNo: null,
        pos1: guestForm.pos1,
        pos2: guestForm.pos2,
        isGuest: true,
      });
      await api.post(`/api/events/${eventId}/vote`, { memberId: guest.id, status: "attend" });
      setGuestForm({ name: "", pos1: "CB", pos2: "WB" });
      setShowGuestForm(false);
      await load();
    } catch {
      Alert.alert("추가 실패", "잠시 후 다시 시도해 주세요.");
    } finally {
      setAddingGuest(false);
    }
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
    try {
      await api.patch(`/api/events/${eventId}`, infoForm);
      setEditingInfo(false);
      await load();
    } catch {
      Alert.alert("저장 실패", "잠시 후 다시 시도해 주세요.");
    } finally {
      setInfoSaving(false);
    }
  };

  const removeEvent = () => {
    Alert.alert("일정 삭제", "이 일정을 삭제할까요? 투표와 기록도 함께 삭제돼요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await api.del(`/api/events/${eventId}`);
          navigation.goBack();
        },
      },
    ]);
  };

  const regenerate = async () => {
    setSquadBusy(true);
    try {
      await api.post(`/api/events/${eventId}/squad`);
      await load();
    } finally {
      setSquadBusy(false);
    }
  };

  const unlockSquad = async () => {
    if (!currentSquad) return;
    setSquadBusy(true);
    try {
      await api.patch(`/api/events/${eventId}`, {
        squad: { ...currentSquad, confirmed: false, approvedBy: [] },
      });
      await load();
    } finally {
      setSquadBusy(false);
    }
  };

  const toggleSquadApproval = async () => {
    setSquadBusy(true);
    try {
      await api.post(`/api/events/${eventId}/squad/approve?team=A`);
      await load();
    } finally {
      setSquadBusy(false);
    }
  };

  const updateQuarterScore = (qi: number, patch: Partial<{ scored: string; conceded: string }>) =>
    setRecordQuarters((qs) => qs.map((q, i) => (i === qi ? { ...q, ...patch } : q)));

  const addGoal = (qi: number) =>
    setRecordQuarters((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, goals: [...q.goals, { key: makeGoalKey(), scorerId: "", assistId: "" }] } : q
      )
    );

  const removeGoal = (qi: number, key: string) =>
    setRecordQuarters((qs) =>
      qs.map((q, i) => (i === qi ? { ...q, goals: q.goals.filter((g) => g.key !== key) } : q))
    );

  const updateGoal = (qi: number, key: string, patch: Partial<{ scorerId: string; assistId: string }>) =>
    setRecordQuarters((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, goals: q.goals.map((g) => (g.key === key ? { ...g, ...patch } : g)) } : q
      )
    );

  const recordAddAttend = async () => {
    if (!recordAddPick) return;
    await api.post(`/api/events/${eventId}/vote`, { memberId: recordAddPick, status: "attend" });
    setRecordAddPick(null);
    await load();
  };

  const saveRecords = async () => {
    const records: Omit<RecordRow, "eventId">[] = [...recordSummary.attendedIds].map((mid) => ({
      memberId: mid,
      played: 1,
      goals: recordSummary.goals.get(mid) ?? 0,
      assists: recordSummary.assists.get(mid) ?? 0,
      position: (squadPositionByMember.get(mid) as PosGroup | undefined) || members.find((m) => m.id === mid)?.pos1 || "",
    }));
    const recordLog: QuarterRecordEntry[] = recordQuarters.map((q) => ({
      scored: q.scored === "" ? null : Number(q.scored),
      conceded: q.conceded === "" ? null : Number(q.conceded),
      goals: q.goals
        .filter((g) => g.scorerId || g.assistId)
        .map((g) => ({
          scorerId: g.scorerId ? Number(g.scorerId) : null,
          assistId: g.assistId ? Number(g.assistId) : null,
        })),
    }));
    setSavingRecords(true);
    try {
      await api.post(`/api/events/${eventId}/records`, {
        scored: recordSummary.scored,
        conceded: recordSummary.conceded,
        records,
        recordLog,
      });
      setSavedMsg(
        recordSummary.scored != null && recordSummary.conceded != null
          ? `기록이 저장되고 최종 스코어 ${recordSummary.scored} : ${recordSummary.conceded}로 게시됐어요.`
          : "기록이 저장됐어요."
      );
      setTimeout(() => setSavedMsg(""), 3000);
      await load();
    } finally {
      setSavingRecords(false);
    }
  };

  const voteMvp = async () => {
    if (!myId || !amAttendee || !mvpPick) return;
    setVotingMvp(true);
    try {
      await api.post(`/api/events/${eventId}/mvp`, { voterId: myId, voteeId: mvpPick });
      setMvpPick(null);
      await load();
    } finally {
      setVotingMvp(false);
    }
  };

  const currentGoalQuarter = recordQuarters[recordQuarterIdx];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={styles.card}>
        {editingInfo ? (
          <View style={{ gap: 8 }}>
            <View style={styles.chipRow}>
              {(["match", "social"] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setInfoForm((f) => ({ ...f, type: t }))}
                  style={[styles.chip, infoForm.type === t && styles.chipActive]}
                >
                  <Text style={[styles.chipText, infoForm.type === t && styles.chipTextActive]}>
                    {t === "match" ? "⚽ 경기" : "🤝 모임"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="제목"
              value={infoForm.title}
              onChangeText={(v) => setInfoForm((f) => ({ ...f, title: v }))}
            />
            {infoForm.type === "match" && (
              <TextInput
                style={styles.input}
                placeholder="상대팀"
                value={infoForm.opponent}
                onChangeText={(v) => setInfoForm((f) => ({ ...f, opponent: v }))}
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={infoForm.date}
              onChangeText={(v) => setInfoForm((f) => ({ ...f, date: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder="HH:MM"
              value={infoForm.time}
              onChangeText={(v) => setInfoForm((f) => ({ ...f, time: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder="장소"
              value={infoForm.location}
              onChangeText={(v) => setInfoForm((f) => ({ ...f, location: v }))}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={saveInfo}
                disabled={infoSaving || !infoForm.title.trim() || !infoForm.date}
                style={[
                  styles.button,
                  { flex: 1 },
                  (infoSaving || !infoForm.title.trim() || !infoForm.date) && { opacity: 0.4 },
                ]}
              >
                <Text style={styles.buttonText}>{infoSaving ? "저장 중…" : "저장"}</Text>
              </Pressable>
              <Pressable
                onPress={() => setEditingInfo(false)}
                style={[styles.button, styles.buttonSecondary, { flex: 1 }]}
              >
                <Text style={styles.buttonSecondaryText}>취소</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.rowBetween}>
              <Text style={styles.title}>
                {event.type === "match" ? "⚽" : "🤝"} {event.title}
              </Text>
              {isAdmin && (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable onPress={startEditInfo}>
                    <Text style={styles.editLink}>정보 수정</Text>
                  </Pressable>
                  <Pressable onPress={removeEvent}>
                    <Text style={styles.deleteLink}>삭제</Text>
                  </Pressable>
                </View>
              )}
            </View>
            <Text style={styles.sub}>
              {event.date} {event.time} {event.opponent ? `· vs ${event.opponent}` : ""}
            </Text>
            {event.location ? <Text style={styles.sub}>@ {event.location}</Text> : null}
            {event.scored != null && event.conceded != null && (
              <Text style={styles.score}>
                {event.scored} : {event.conceded}
              </Text>
            )}
            {event.notes ? <Text style={styles.notes}>{event.notes}</Text> : null}
          </>
        )}
      </View>

      {event.type === "match" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>참석 투표</Text>
          {myId ? (
            <>
              <View style={styles.voteRow}>
                {VOTE_OPTIONS.map((o) => (
                  <Pressable
                    key={o.status}
                    onPress={() => castVote(o.status)}
                    disabled={voting}
                    style={[
                      styles.voteBtn,
                      myStatus === o.status && { backgroundColor: o.color, borderColor: o.color },
                    ]}
                  >
                    <Text style={[styles.voteBtnText, myStatus === o.status && { color: "#fff" }]}>
                      {o.label} {counts[o.status]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {voteError ? <Text style={styles.error}>{voteError}</Text> : null}
            </>
          ) : (
            <Text style={styles.mutedText}>멤버 프로필과 연결된 계정만 투표할 수 있어요.</Text>
          )}
          {attendNames.length > 0 && (
            <Text style={styles.mutedText}>참석: {attendNames.join(", ")}</Text>
          )}
          {nonVoters.length > 0 && (
            <Text style={styles.mutedText}>
              미투표 {nonVoters.length}명: {nonVoters.map((m) => m.name).join(", ")}
            </Text>
          )}

          {isAdmin && (
            <View style={styles.adminBlock}>
              {nonVoters.length > 0 && (
                <Pressable onPress={notifyNonVoters} disabled={notifying} style={styles.smallButton}>
                  <Text style={styles.smallButtonText}>
                    {notifying ? "발송 중…" : "미투표자에게 문자 보내기"}
                  </Text>
                </Pressable>
              )}
              {notifyResult ? <Text style={styles.mutedText}>{notifyResult}</Text> : null}

              <Text style={styles.smallLabel}>참석으로 직접 추가</Text>
              <View style={styles.chipRow}>
                {members
                  .filter((m) => !attendIds.includes(m.id))
                  .map((m) => (
                    <Pressable
                      key={m.id}
                      onPress={() => setAdminAddPick(m.id)}
                      style={[styles.chip, adminAddPick === m.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, adminAddPick === m.id && styles.chipTextActive]}>
                        {m.name}
                        {m.isGuest ? " · 용병" : ""}
                      </Text>
                    </Pressable>
                  ))}
              </View>
              <Pressable
                onPress={adminAddAttend}
                disabled={!adminAddPick}
                style={[styles.smallButton, !adminAddPick && { opacity: 0.4 }]}
              >
                <Text style={styles.smallButtonText}>참석 추가</Text>
              </Pressable>

              <Pressable onPress={() => setShowAdminVotes((v) => !v)}>
                <Text style={styles.editLink}>
                  {showAdminVotes ? "전체 인원 참석 관리 닫기" : "전체 인원 참석 관리 →"}
                </Text>
              </Pressable>
              {showAdminVotes && (
                <View style={{ gap: 6, marginTop: 6 }}>
                  {[...members]
                    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
                    .map((m) => {
                      const st = statusOf(m.id);
                      return (
                        <View key={m.id} style={styles.adminVoteRow}>
                          <Text style={styles.adminVoteName} numberOfLines={1}>
                            {m.name}
                            {m.isGuest ? " · 용병" : ""}
                          </Text>
                          <View style={{ flexDirection: "row", gap: 4 }}>
                            {VOTE_OPTIONS.map((o) => (
                              <Pressable
                                key={o.status}
                                onPress={() => adminSetVote(m.id, o.status)}
                                style={[
                                  styles.miniVoteBtn,
                                  st === o.status && { backgroundColor: o.color },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.miniVoteBtnText,
                                    st === o.status && { color: "#fff" },
                                  ]}
                                >
                                  {o.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      );
                    })}
                </View>
              )}
            </View>
          )}

          <View style={styles.adminBlock}>
            <Pressable onPress={() => setShowGuestForm((v) => !v)}>
              <Text style={styles.editLink}>{showGuestForm ? "용병 추가 닫기" : "+ 용병 추가"}</Text>
            </Pressable>
            {showGuestForm && (
              <View style={{ gap: 8, marginTop: 8 }}>
                <TextInput
                  style={styles.input}
                  placeholder="용병 이름"
                  value={guestForm.name}
                  onChangeText={(v) => setGuestForm((g) => ({ ...g, name: v }))}
                />
                <Text style={styles.smallLabel}>1순위 포지션</Text>
                <PosPicker value={guestForm.pos1} onChange={(v) => setGuestForm((g) => ({ ...g, pos1: v }))} />
                <Text style={styles.smallLabel}>2순위 포지션</Text>
                <PosPicker value={guestForm.pos2} onChange={(v) => setGuestForm((g) => ({ ...g, pos2: v }))} />
                <Pressable
                  onPress={addGuest}
                  disabled={addingGuest || !guestForm.name.trim()}
                  style={[styles.button, (addingGuest || !guestForm.name.trim()) && { opacity: 0.4 }]}
                >
                  <Text style={styles.buttonText}>
                    {addingGuest ? "추가 중…" : "용병 추가 + 이 경기 참석 등록"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}

      {event.type === "match" && (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>스쿼드 (4-1-2-2-1)</Text>
            {isSquadLocked ? (
              <Text style={styles.lockedBadge}>🔒 확정됨</Text>
            ) : squadApprovedBy.length > 0 ? (
              <Text style={styles.mutedText}>
                승인 {squadApprovedBy.length}/{SQUAD_APPROVAL_THRESHOLD}
              </Text>
            ) : null}
          </View>
          {isAdmin && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <Pressable onPress={regenerate} disabled={squadBusy} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>{currentSquad ? "다시 생성" : "자동 생성"}</Text>
              </Pressable>
              {currentSquad && (
                <Pressable
                  onPress={isSquadLocked ? unlockSquad : toggleSquadApproval}
                  disabled={squadBusy || (!isSquadLocked && !myId)}
                  style={[styles.smallButtonAmber, squadBusy && { opacity: 0.4 }]}
                >
                  <Text style={styles.smallButtonAmberText}>
                    {isSquadLocked
                      ? "확정 해제"
                      : `${iApprovedSquad ? "승인 취소" : "승인"} (${squadApprovedBy.length}/${SQUAD_APPROVAL_THRESHOLD})`}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
          {squadApprovedBy.length > 0 && (
            <Text style={styles.mutedText}>
              승인: {squadApprovedBy.map((mid) => memberName(mid)).join(", ")}
            </Text>
          )}

          {currentSquad ? (
            <>
              <View style={styles.rosterBox}>
                <Text style={styles.smallLabel}>전체 명단 · {rosterIds.length}명</Text>
                <Text style={styles.rosterText}>{rosterIds.map((id) => memberName(id)).join(", ")}</Text>
              </View>

              <View style={styles.quarterTabRow}>
                {currentSquad.quarters.map((_, qi) => (
                  <Pressable
                    key={qi}
                    onPress={() => setSquadQuarterIdx(qi)}
                    style={[styles.quarterTab, squadQuarterIdx === qi && styles.quarterTabActive]}
                  >
                    <Text
                      style={[
                        styles.quarterTabText,
                        squadQuarterIdx === qi && styles.quarterTabTextActive,
                      ]}
                    >
                      {qi + 1}쿼터
                    </Text>
                  </Pressable>
                ))}
              </View>
              {currentSquad.quarters[squadQuarterIdx] && (
                <View>
                  <Text style={styles.quarterBody}>
                    {currentSquad.quarters[squadQuarterIdx].starters
                      .map((s) =>
                        s.memberId2 != null
                          ? `${memberName(s.memberId)}/${memberName(s.memberId2)}`
                          : memberName(s.memberId)
                      )
                      .join(", ")}
                  </Text>
                  {currentSquad.quarters[squadQuarterIdx].bench.length > 0 && (
                    <Text style={styles.mutedText}>
                      벤치:{" "}
                      {currentSquad.quarters[squadQuarterIdx].bench.map((id) => memberName(id)).join(", ")}
                    </Text>
                  )}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.mutedText}>
              아직 스쿼드가 없어요. {isAdmin ? "위 버튼으로 자동 생성할 수 있어요." : "운영진이 생성하면 여기에 표시돼요."}
            </Text>
          )}
        </View>
      )}

      {event.type === "match" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>경기 기록</Text>
          <Text style={styles.mutedText}>
            쿼터별로 스코어와 득점·어시스트를 입력하면 자동으로 합산돼서 최종 스코어와 개인 기록에
            반영돼요. 참석 투표한 사람만 선택할 수 있어요.
          </Text>

          {isAdmin && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.smallLabel}>투표 없이 뛴 선수를 참석으로 추가</Text>
              <View style={styles.chipRow}>
                {members
                  .filter((m) => !attendIds.includes(m.id))
                  .map((m) => (
                    <Pressable
                      key={m.id}
                      onPress={() => setRecordAddPick(m.id)}
                      style={[styles.chip, recordAddPick === m.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, recordAddPick === m.id && styles.chipTextActive]}>
                        {m.name}
                      </Text>
                    </Pressable>
                  ))}
              </View>
              <Pressable
                onPress={recordAddAttend}
                disabled={!recordAddPick}
                style={[styles.smallButton, !recordAddPick && { opacity: 0.4 }]}
              >
                <Text style={styles.smallButtonText}>참석 추가</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.quarterTabRow}>
            {recordQuarters.map((_, qi) => (
              <Pressable
                key={qi}
                onPress={() => setRecordQuarterIdx(qi)}
                style={[styles.quarterTab, recordQuarterIdx === qi && styles.quarterTabActive]}
              >
                <Text
                  style={[styles.quarterTabText, recordQuarterIdx === qi && styles.quarterTabTextActive]}
                >
                  {qi + 1}쿼터
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.scoreRow}>
            <Text style={styles.smallLabel}>이 쿼터 득점</Text>
            <TextInput
              style={styles.numInput}
              keyboardType="number-pad"
              value={currentGoalQuarter.scored}
              onChangeText={(v) => updateQuarterScore(recordQuarterIdx, { scored: v })}
            />
            <Text style={styles.smallLabel}>실점</Text>
            <TextInput
              style={styles.numInput}
              keyboardType="number-pad"
              value={currentGoalQuarter.conceded}
              onChangeText={(v) => updateQuarterScore(recordQuarterIdx, { conceded: v })}
            />
          </View>

          {currentGoalQuarter.goals.length === 0 && (
            <Text style={styles.mutedText}>이 쿼터에 입력된 골이 없어요.</Text>
          )}
          {currentGoalQuarter.goals.map((g) => (
            <View key={g.key} style={styles.goalBlock}>
              <View style={styles.rowBetween}>
                <Text style={styles.smallLabel}>득점자</Text>
                <Pressable onPress={() => removeGoal(recordQuarterIdx, g.key)}>
                  <Text style={styles.deleteLink}>삭제</Text>
                </Pressable>
              </View>
              <View style={styles.chipRow}>
                {members
                  .filter((m) => attendIds.includes(m.id))
                  .map((m) => (
                    <Pressable
                      key={m.id}
                      onPress={() => updateGoal(recordQuarterIdx, g.key, { scorerId: String(m.id) })}
                      style={[styles.chip, g.scorerId === String(m.id) && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, g.scorerId === String(m.id) && styles.chipTextActive]}>
                        {m.name}
                      </Text>
                    </Pressable>
                  ))}
              </View>
              <Text style={[styles.smallLabel, { marginTop: 6 }]}>어시스트 (선택)</Text>
              <View style={styles.chipRow}>
                <Pressable
                  onPress={() => updateGoal(recordQuarterIdx, g.key, { assistId: "" })}
                  style={[styles.chip, g.assistId === "" && styles.chipActive]}
                >
                  <Text style={[styles.chipText, g.assistId === "" && styles.chipTextActive]}>없음</Text>
                </Pressable>
                {members
                  .filter((m) => attendIds.includes(m.id) && String(m.id) !== g.scorerId)
                  .map((m) => (
                    <Pressable
                      key={m.id}
                      onPress={() => updateGoal(recordQuarterIdx, g.key, { assistId: String(m.id) })}
                      style={[styles.chip, g.assistId === String(m.id) && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, g.assistId === String(m.id) && styles.chipTextActive]}>
                        {m.name}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          ))}
          <Pressable onPress={() => addGoal(recordQuarterIdx)} style={styles.addGoalBtn}>
            <Text style={styles.addGoalBtnText}>+ 이 쿼터에 골 추가</Text>
          </Pressable>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>
              전체 합산 스코어: {recordSummary.scored ?? "?"} : {recordSummary.conceded ?? "?"}
              {recordSummary.conceded === 0 ? " · 클린시트" : ""}
            </Text>
            {recordSummary.goals.size > 0 && (
              <Text style={styles.summarySub}>
                득점:{" "}
                {[...recordSummary.goals.entries()].map(([mid, n]) => `${memberName(mid)} ${n}`).join(", ")}
              </Text>
            )}
            {recordSummary.assists.size > 0 && (
              <Text style={styles.summarySub}>
                어시스트:{" "}
                {[...recordSummary.assists.entries()]
                  .map(([mid, n]) => `${memberName(mid)} ${n}`)
                  .join(", ")}
              </Text>
            )}
          </View>

          <Pressable onPress={saveRecords} disabled={savingRecords} style={[styles.button, savingRecords && { opacity: 0.4 }]}>
            <Text style={styles.buttonText}>{savingRecords ? "저장 중…" : "저장하고 게시"}</Text>
          </Pressable>
          {savedMsg ? <Text style={styles.savedMsg}>{savedMsg}</Text> : null}
        </View>
      )}

      {event.type === "match" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>MVP 투표</Text>
          {!myId && <Text style={styles.mutedText}>투표하려면 먼저 로그인해 주세요.</Text>}
          {myId && !amAttendee && (
            <Text style={styles.mutedText}>경기 참여자(참석 투표)만 MVP 투표를 할 수 있어요.</Text>
          )}
          {myId && amAttendee && (
            <>
              <View style={styles.chipRow}>
                {members
                  .filter((m) => attendIds.includes(m.id) && m.id !== myId)
                  .map((m) => {
                    const picked = mvpPick != null ? mvpPick === m.id : myMvpVote === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setMvpPick(m.id)}
                        style={[styles.chip, picked && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, picked && styles.chipTextActive]}>{m.name}</Text>
                      </Pressable>
                    );
                  })}
              </View>
              <Pressable
                onPress={voteMvp}
                disabled={votingMvp || !mvpPick}
                style={[styles.button, (votingMvp || !mvpPick) && { opacity: 0.4 }]}
              >
                <Text style={styles.buttonText}>{votingMvp ? "투표 중…" : "투표"}</Text>
              </Pressable>
            </>
          )}
          {mvpTally.length > 0 && (
            <View style={{ marginTop: 10, gap: 4 }}>
              {mvpTally.map((t) => (
                <Text key={t.memberId} style={styles.mvpTallyText}>
                  {t.isLeader ? "🏆 " : ""}
                  {memberName(t.memberId)} · {t.count}표
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>댓글</Text>
        {comments.length === 0 ? (
          <Text style={styles.mutedText}>아직 댓글이 없어요.</Text>
        ) : (
          <View style={{ gap: 8, marginTop: 6 }}>
            {comments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentBody}>{c.body}</Text>
                  <Text style={styles.mutedText}>
                    {memberName(c.memberId)} · {c.createdAt.slice(0, 10)}
                  </Text>
                </View>
                {(c.memberId === myId || isAdmin) && (
                  <Pressable onPress={() => deleteComment(c.id)}>
                    <Text style={styles.deleteLink}>삭제</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
        {myId && (
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="댓글을 입력하세요"
            />
            <Pressable
              onPress={postComment}
              disabled={postingComment || !commentText.trim()}
              style={[styles.postBtn, (!commentText.trim() || postingComment) && { opacity: 0.4 }]}
            >
              <Text style={styles.postBtnText}>등록</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 17, fontWeight: "800", color: colors.text, flex: 1 },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  score: { fontSize: 20, fontWeight: "800", color: colors.primary, marginTop: 8 },
  notes: { fontSize: 13, color: colors.text, marginTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  mutedText: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  editLink: { fontSize: 12, color: colors.primaryLight, fontWeight: "700" },
  deleteLink: { fontSize: 12, color: colors.danger, fontWeight: "600" },
  voteRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  voteBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  voteBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  buttonSecondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  buttonSecondaryText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  adminBlock: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  smallLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted, marginTop: 4 },
  smallButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  smallButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  smallButtonAmber: {
    alignSelf: "flex-start",
    backgroundColor: "#d97706",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallButtonAmberText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  adminVoteRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  adminVoteName: { flex: 1, fontSize: 12, color: colors.text },
  miniVoteBtn: { backgroundColor: "#f4f4f5", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  miniVoteBtnText: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
  lockedBadge: { fontSize: 11, fontWeight: "800", color: "#92400e", backgroundColor: "#fef3c7", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  rosterBox: { backgroundColor: "#fafafa", borderRadius: 10, padding: 10, marginTop: 8 },
  rosterText: { fontSize: 12, color: colors.text, marginTop: 4 },
  quarterTabRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  quarterTab: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: "#f4f4f5", alignItems: "center" },
  quarterTabActive: { backgroundColor: colors.primaryLight },
  quarterTabText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  quarterTabTextActive: { color: "#fff" },
  quarterLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  quarterBody: { fontSize: 13, color: colors.text, marginTop: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  numInput: {
    width: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 6,
    textAlign: "center",
    fontSize: 14,
    backgroundColor: "#fff",
  },
  goalBlock: { backgroundColor: "#fafafa", borderRadius: 10, padding: 10, marginTop: 8 },
  addGoalBtn: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 8,
  },
  addGoalBtnText: { fontSize: 12, fontWeight: "700", color: colors.primaryLight },
  summaryBox: { backgroundColor: "#fafafa", borderRadius: 10, padding: 10, marginTop: 12 },
  summaryText: { fontSize: 13, fontWeight: "700", color: colors.text },
  summarySub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  savedMsg: { textAlign: "center", color: colors.primaryLight, fontWeight: "700", fontSize: 13, marginTop: 8 },
  mvpTallyText: { fontSize: 13, color: colors.text },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  commentBody: { fontSize: 13, color: colors.text },
  commentInputRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  postBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  postBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
