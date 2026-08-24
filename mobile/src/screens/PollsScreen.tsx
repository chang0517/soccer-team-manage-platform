import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api, ApiError } from "../api/client";
import type { PollDetail } from "../api/types";
import { colors } from "../theme";

export default function PollsScreen() {
  const [polls, setPolls] = useState<PollDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get<PollDetail[]>("/api/polls");
      setPolls(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
        return (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>🗳️ {item.title}</Text>
              {item.closed && <Text style={styles.closedBadge}>마감</Text>}
            </View>
            <View style={{ marginTop: 8, gap: 6 }}>
              {item.options.map((o) => {
                const count = item.voteCounts[o.id] ?? 0;
                const pct = Math.round((count / total) * 100);
                return (
                  <View key={o.id}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.optionLabel}>{o.label}</Text>
                      <Text style={styles.optionCount}>{count}표</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={styles.cardSub}>참여 {item.voterCount}명</Text>
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
  optionLabel: { fontSize: 12, color: colors.text },
  optionCount: { fontSize: 11, color: colors.textMuted },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.bg, marginTop: 3 },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.primaryLight },
  cardSub: { fontSize: 11, color: colors.textMuted, marginTop: 10 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  error: { color: colors.danger },
});
