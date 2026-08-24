import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";
import type { CommentRow, EventItem, Member, VoteRow, VoteStatus } from "../api/types";
import { colors } from "../theme";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "EventDetail">;

const VOTE_OPTIONS: { status: VoteStatus; label: string; color: string }[] = [
  { status: "attend", label: "참석", color: colors.primaryLight },
  { status: "maybe", label: "미정", color: "#d97706" },
  { status: "absent", label: "불참", color: "#71717a" },
];

const SQUAD_APPROVAL_THRESHOLD = 3;

export default function EventDetailScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { user } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [detail, memberList, commentList] = await Promise.all([
        api.get<{ event: EventItem; votes: VoteRow[] }>(`/api/events/${eventId}`),
        api.get<Member[]>("/api/members"),
        api.get<CommentRow[]>(`/api/events/${eventId}/comments`),
      ]);
      setEvent(detail.event);
      setVotes(detail.votes);
      setMembers(memberList);
      setComments(commentList);
      navigation.setOptions({ title: detail.event.title });
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

  const castVote = async (status: VoteStatus) => {
    if (!user?.memberId) return;
    setVoting(true);
    setVoteError("");
    try {
      await api.post(`/api/events/${eventId}/vote`, { memberId: user.memberId, status });
      await load();
    } catch (e) {
      setVoteError(e instanceof ApiError ? e.message : "투표에 실패했어요.");
    } finally {
      setVoting(false);
    }
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

  const counts: Record<VoteStatus, number> = { attend: 0, maybe: 0, absent: 0 };
  for (const v of votes) counts[v.status]++;
  const myStatus = votes.find((v) => v.memberId === user?.memberId)?.status ?? null;
  const attendNames = votes
    .filter((v) => v.status === "attend")
    .map((v) => memberName(v.memberId));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {event.type === "match" ? "⚽" : "🤝"} {event.title}
        </Text>
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
      </View>

      {event.type === "match" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>참석 투표</Text>
          {user?.memberId ? (
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
                    <Text
                      style={[styles.voteBtnText, myStatus === o.status && { color: "#fff" }]}
                    >
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
        </View>
      )}

      {event.squad && (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>스쿼드</Text>
            <Text style={styles.mutedText}>
              {(event.squad.approvedBy?.length ?? 0) >= SQUAD_APPROVAL_THRESHOLD
                ? "✅ 확정됨"
                : `승인 대기 (${event.squad.approvedBy?.length ?? 0}/${SQUAD_APPROVAL_THRESHOLD})`}
            </Text>
          </View>
          {event.squad.quarters.map((q, i) => (
            <View key={i} style={{ marginTop: 8 }}>
              <Text style={styles.quarterLabel}>{i + 1}쿼터</Text>
              <Text style={styles.quarterBody}>
                {q.starters
                  .map((s) =>
                    s.memberId2 != null
                      ? `${memberName(s.memberId)}/${memberName(s.memberId2)}`
                      : memberName(s.memberId)
                  )
                  .join(", ")}
              </Text>
              {q.bench.length > 0 && (
                <Text style={styles.mutedText}>벤치: {q.bench.map((id) => memberName(id)).join(", ")}</Text>
              )}
            </View>
          ))}
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
                {(c.memberId === user?.memberId || user?.role === "admin") && (
                  <Pressable onPress={() => deleteComment(c.id)}>
                    <Text style={styles.deleteLink}>삭제</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
        {user?.memberId && (
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
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  score: { fontSize: 20, fontWeight: "800", color: colors.primary, marginTop: 8 },
  notes: { fontSize: 13, color: colors.text, marginTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  mutedText: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
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
  quarterLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  quarterBody: { fontSize: 13, color: colors.text, marginTop: 2 },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  commentBody: { fontSize: 13, color: colors.text },
  deleteLink: { fontSize: 11, color: colors.danger },
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
