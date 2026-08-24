import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api, ApiError } from "../api/client";
import type { EventItem } from "../api/types";
import { colors } from "../theme";

export default function ScheduleScreen() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get<EventItem[]>("/api/events");
      setEvents(data);
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
      data={events}
      keyExtractor={(e) => String(e.id)}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListEmptyComponent={<Text style={styles.empty}>등록된 일정이 없어요.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>
              {item.type === "match" ? "⚽" : "🤝"} {item.title}
            </Text>
            {item.scored != null && item.conceded != null && (
              <Text style={styles.score}>
                {item.scored} : {item.conceded}
              </Text>
            )}
          </View>
          <Text style={styles.cardSub}>
            {item.date} {item.time} {item.opponent ? `· vs ${item.opponent}` : ""}
          </Text>
          {item.location ? <Text style={styles.cardSub}>@ {item.location}</Text> : null}
        </View>
      )}
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
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  score: { fontSize: 15, fontWeight: "800", color: colors.primary },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  error: { color: colors.danger },
});
