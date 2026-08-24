import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api, ApiError } from "../api/client";
import type { RankingRow } from "../api/types";
import { colors } from "../theme";

export default function RankingScreen() {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get<RankingRow[]>("/api/ranking");
      setRows([...data].sort((a, b) => b.total - a.total));
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
      data={rows}
      keyExtractor={(r) => String(r.member.id)}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      ListEmptyComponent={<Text style={styles.empty}>기록이 없어요.</Text>}
      renderItem={({ item, index }) => (
        <View style={styles.row}>
          <Text style={styles.rank}>{index + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {item.member.name}
              {item.member.backNo != null ? ` #${item.member.backNo}` : ""}
            </Text>
            <Text style={styles.stats}>
              출전 {item.played} · 골 {item.goals} · 도움 {item.assists}
            </Text>
          </View>
          <Text style={styles.total}>{item.total.toFixed(1)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 12,
  },
  rank: { width: 24, textAlign: "center", fontWeight: "800", color: colors.textMuted },
  name: { fontSize: 14, fontWeight: "700", color: colors.text },
  stats: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  total: { fontSize: 16, fontWeight: "800", color: colors.primary },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  error: { color: colors.danger },
});
