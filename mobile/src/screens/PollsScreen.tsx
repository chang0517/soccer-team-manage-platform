import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";
import type { PollDetail } from "../api/types";
import { colors } from "../theme";

export default function PollsScreen() {
  const { user } = useAuth();
  const myId = user?.memberId ?? null;
  const [polls, setPolls] = useState<PollDetail[]>([]);
  const [picks, setPicks] = useState<Record<number, Set<number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [votingId, setVotingId] = useState<number | null>(null);

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
      ListEmptyComponent={<Text style={styles.empty}>진행 중인 투표가 없어요.</Text>}
      renderItem={({ item }) => {
        const total = Object.values(item.voteCounts).reduce((a, b) => a + b, 0) || 1;
        const myPicks = picks[item.id] ?? new Set<number>();
        const alreadyVoted = item.myOptionIds.length > 0;
        return (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>🗳️ {item.title}</Text>
              {item.closed && <Text style={styles.closedBadge}>마감</Text>}
            </View>
            <Text style={styles.mutedText}>
              {item.creatorName} · 참여 {item.voterCount}명{!item.multiSelect && " · 단일 선택"}
            </Text>
            <View style={{ marginTop: 8, gap: 6 }}>
              {item.options.map((o) => {
                const count = item.voteCounts[o.id] ?? 0;
                const pct = Math.round((count / total) * 100);
                const picked = myPicks.has(o.id);
                return (
                  <Pressable
                    key={o.id}
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
                      <Text style={styles.optionCount}>
                        {count}표 · {pct}%
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  closedBadge: {
    fontSize: 10,
    color: colors.textMuted,
    backgroundColor: colors.bg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mutedText: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
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
