import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";
import type { PollDetail } from "../api/types";
import { colors } from "../theme";

const EMPTY_OPTIONS = ["", ""];

export default function PollsScreen() {
  const { user } = useAuth();
  const myId = user?.memberId ?? null;
  const isAdmin = user?.role === "admin";
  const [polls, setPolls] = useState<PollDetail[]>([]);
  const [picks, setPicks] = useState<Record<number, Set<number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [votingId, setVotingId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<string[]>(EMPTY_OPTIONS);
  const [multiSelect, setMultiSelect] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [newOptionDrafts, setNewOptionDrafts] = useState<Record<number, string>>({});
  const [addingOptionId, setAddingOptionId] = useState<number | null>(null);
  const [expandedOptionId, setExpandedOptionId] = useState<number | null>(null);
  const [busyPollId, setBusyPollId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get<PollDetail[]>(
        `/api/polls${myId ? `?memberId=${myId}` : ""}`
      );
      setPolls(data);
      setPicks(Object.fromEntries(data.map((p) => [p.id, new Set(p.myOptionIds)])));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [myId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const updateOption = (i: number, value: string) =>
    setOptions((os) => os.map((o, idx) => (idx === i ? value : o)));
  const addOptionField = () => setOptions((os) => [...os, ""]);
  const removeOptionField = (i: number) => setOptions((os) => os.filter((_, idx) => idx !== i));

  const submitPoll = async () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!title.trim() || cleanOptions.length < 2) return;
    setSaving(true);
    setFormError("");
    try {
      await api.post("/api/polls", { title: title.trim(), options: cleanOptions, multiSelect });
      setTitle("");
      setOptions(EMPTY_OPTIONS);
      setMultiSelect(true);
      setShowForm(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "생성에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const togglePick = (poll: PollDetail, optionId: number) =>
    setPicks((prev) => {
      if (!poll.multiSelect) return { ...prev, [poll.id]: new Set([optionId]) };
      const next = new Set(prev[poll.id] ?? []);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return { ...prev, [poll.id]: next };
    });

  const vote = async (pollId: number) => {
    if (!myId) return;
    const optionIds = [...(picks[pollId] ?? [])];
    if (optionIds.length === 0) return;
    setVotingId(pollId);
    try {
      await api.post(`/api/polls/${pollId}/vote`, { memberId: myId, optionIds });
      await load();
    } catch {
      // 실패해도 화면은 유지 — 다시 시도하면 됨
    } finally {
      setVotingId(null);
    }
  };

  const toggleClosed = async (poll: PollDetail) => {
    setBusyPollId(poll.id);
    try {
      await api.patch(`/api/polls/${poll.id}`, { closed: !poll.closed });
      await load();
    } finally {
      setBusyPollId(null);
    }
  };

  const removePoll = (pollId: number) => {
    Alert.alert("투표 삭제", "이 투표를 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          setBusyPollId(pollId);
          try {
            await api.del(`/api/polls/${pollId}`);
            await load();
          } finally {
            setBusyPollId(null);
          }
        },
      },
    ]);
  };

  const addPollOption = async (pollId: number) => {
    const label = (newOptionDrafts[pollId] ?? "").trim();
    if (!label) return;
    setAddingOptionId(pollId);
    try {
      await api.post(`/api/polls/${pollId}/options`, { label });
      setNewOptionDrafts((d) => ({ ...d, [pollId]: "" }));
      await load();
    } finally {
      setAddingOptionId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={polls}
      keyExtractor={(p) => String(p.id)}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 10 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.headerTitle}>이벤트 투표</Text>
            {myId && (
              <Pressable onPress={() => setShowForm((v) => !v)}>
                <Text style={styles.newButton}>{showForm ? "닫기" : "+ 투표 만들기"}</Text>
              </Pressable>
            )}
          </View>
          {showForm && (
            <View style={styles.formCard}>
              <TextInput
                style={styles.input}
                placeholder="예: 이번 월드컵 우승은 어디?"
                value={title}
                onChangeText={setTitle}
              />
              {options.map((o, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 6 }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={`보기 ${i + 1}`}
                    value={o}
                    onChangeText={(v) => updateOption(i, v)}
                  />
                  {options.length > 2 && (
                    <Pressable onPress={() => removeOptionField(i)} style={styles.removeOptionBtn}>
                      <Text style={styles.removeOptionBtnText}>✕</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable onPress={addOptionField}>
                <Text style={styles.addOptionLink}>+ 보기 추가</Text>
              </Pressable>
              <View style={styles.rowBetween}>
                <Text style={styles.smallLabel}>복수 선택 허용 (만든 후에는 바꿀 수 없어요)</Text>
                <Switch value={multiSelect} onValueChange={setMultiSelect} />
              </View>
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              <Pressable
                onPress={submitPoll}
                disabled={
                  saving || !title.trim() || options.map((o) => o.trim()).filter(Boolean).length < 2
                }
                style={[
                  styles.button,
                  (saving || !title.trim() || options.map((o) => o.trim()).filter(Boolean).length < 2) && {
                    opacity: 0.4,
                  },
                ]}
              >
                <Text style={styles.buttonText}>{saving ? "만드는 중…" : "투표 만들기"}</Text>
              </Pressable>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>진행 중인 투표가 없어요.</Text>}
      renderItem={({ item }) => {
        const total = Object.values(item.voteCounts).reduce((a, b) => a + b, 0) || 1;
        const myPicks = picks[item.id] ?? new Set<number>();
        const alreadyVoted = item.myOptionIds.length > 0;
        const canManage = myId === item.createdBy || isAdmin;
        const busy = busyPollId === item.id;
        return (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>🗳️ {item.title}</Text>
                <Text style={styles.mutedText}>
                  {item.creatorName} · 참여 {item.voterCount}명
                  {!item.multiSelect && " · 단일 선택"}
                  {item.closed && " · 마감됨"}
                </Text>
              </View>
              {canManage && (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable
                    onPress={() => toggleClosed(item)}
                    disabled={busy}
                    style={styles.manageBtn}
                  >
                    <Text style={styles.manageBtnText}>{item.closed ? "재개" : "마감"}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => removePoll(item.id)}
                    disabled={busy}
                    style={styles.manageBtnDanger}
                  >
                    <Text style={styles.manageBtnDangerText}>삭제</Text>
                  </Pressable>
                </View>
              )}
            </View>
            <View style={{ marginTop: 8, gap: 6 }}>
              {item.options.map((o) => {
                const count = item.voteCounts[o.id] ?? 0;
                const pct = Math.round((count / total) * 100);
                const picked = myPicks.has(o.id);
                const voters = item.optionVoters[o.id] ?? [];
                const isExpanded = expandedOptionId === o.id;
                return (
                  <View key={o.id}>
                    <Pressable
                      onPress={() => myId && !item.closed && togglePick(item, o.id)}
                      disabled={!myId || item.closed}
                      style={[styles.optionBox, picked && styles.optionBoxPicked]}
                    >
                      <View style={[styles.barFill, { width: `${pct}%` }]} />
                      <View style={styles.optionContent}>
                        <Text style={[styles.optionLabel, picked && { color: colors.primary, fontWeight: "700" }]}>
                          {picked ? "✓ " : ""}
                          {o.label}
                        </Text>
                        <Pressable
                          onPress={() => setExpandedOptionId((cur) => (cur === o.id ? null : o.id))}
                          hitSlop={6}
                        >
                          <Text style={styles.optionCount}>
                            {count}표 · {pct}%
                          </Text>
                        </Pressable>
                      </View>
                    </Pressable>
                    {isExpanded && (
                      <Text style={styles.votersText}>
                        {voters.length > 0 ? voters.join(", ") : "아직 투표한 사람이 없어요."}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
            {canManage && !item.closed && (
              <View style={styles.addOptionRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="보기 추가"
                  value={newOptionDrafts[item.id] ?? ""}
                  onChangeText={(v) => setNewOptionDrafts((d) => ({ ...d, [item.id]: v }))}
                />
                <Pressable
                  onPress={() => addPollOption(item.id)}
                  disabled={addingOptionId === item.id || !(newOptionDrafts[item.id] ?? "").trim()}
                  style={[
                    styles.addOptionBtn,
                    (addingOptionId === item.id || !(newOptionDrafts[item.id] ?? "").trim()) && {
                      opacity: 0.4,
                    },
                  ]}
                >
                  <Text style={styles.addOptionBtnText}>추가</Text>
                </Pressable>
              </View>
            )}
            {myId && !item.closed && (
              <Pressable
                onPress={() => vote(item.id)}
                disabled={votingId === item.id || myPicks.size === 0}
                style={[
                  styles.voteButton,
                  (votingId === item.id || myPicks.size === 0) && { opacity: 0.4 },
                ]}
              >
                <Text style={styles.voteButtonText}>
                  {votingId === item.id ? "저장 중…" : alreadyVoted ? "투표 변경하기" : "투표하기"}
                </Text>
              </Pressable>
            )}
            {!myId && <Text style={styles.mutedText}>로그인하면 투표할 수 있어요.</Text>}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  newButton: { fontSize: 13, fontWeight: "700", color: "#fff", backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  formCard: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  smallLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted, flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  removeOptionBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  removeOptionBtnText: { color: colors.textMuted, fontSize: 14 },
  addOptionLink: { fontSize: 13, fontWeight: "700", color: colors.primaryLight },
  button: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  manageBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  manageBtnText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  manageBtnDanger: {
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  manageBtnDangerText: { fontSize: 11, fontWeight: "700", color: colors.danger },
  mutedText: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  votersText: { fontSize: 11, color: colors.textMuted, marginTop: 3, paddingHorizontal: 4 },
  optionBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  optionBoxPicked: { borderColor: colors.primaryLight },
  barFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#dbeafe",
  },
  optionContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionLabel: { fontSize: 12, color: colors.text, flexShrink: 1 },
  optionCount: { fontSize: 10, color: colors.textMuted },
  addOptionRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  addOptionBtn: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  addOptionBtnText: { color: colors.primaryLight, fontWeight: "700", fontSize: 12 },
  voteButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  voteButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  error: { color: colors.danger },
});
