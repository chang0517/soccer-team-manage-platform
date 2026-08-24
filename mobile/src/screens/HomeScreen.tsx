import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";
import type { EventItem } from "../api/types";
import { colors } from "../theme";
import type { AppStackParamList, MainTabParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList & MainTabParamList>;

function eventLine(e: EventItem): string {
  const parts = [e.date];
  if (e.time) parts.push(e.time);
  if (e.opponent) parts.push(`vs ${e.opponent}`);
  if (e.location) parts.push(`@ ${e.location}`);
  return parts.join(" · ");
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get<EventItem[]>("/api/events");
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = data
        .filter((e) => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
        .slice(0, 5);
      setEvents(upcoming);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {user?.teamLogoUrl ? (
            <Image source={{ uri: user.teamLogoUrl }} style={styles.logo} />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={{ fontSize: 16 }}>⚽</Text>
            </View>
          )}
          <View>
            <Text style={styles.teamName}>{user?.teamName ?? "팀"}</Text>
            <Text style={styles.greeting}>{user?.displayName}님, 안녕하세요</Text>
          </View>
        </View>
        <Pressable onPress={() => navigation.navigate("Account")} style={styles.settingsBtn}>
          <Text style={{ fontSize: 16 }}>⚙️</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => String(e.id)}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
          ListHeaderComponent={<Text style={styles.sectionTitle}>다가오는 일정</Text>}
          ListEmptyComponent={<Text style={styles.empty}>예정된 일정이 없어요.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}
            >
              <Text style={styles.cardTitle}>
                {item.type === "match" ? "⚽" : "🤝"} {item.title}
              </Text>
              <Text style={styles.cardSub}>{eventLine(item)}</Text>
            </Pressable>
          )}
          contentContainerStyle={{ padding: 16, gap: 10 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff" },
  logoFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  teamName: { color: "#fff", fontSize: 18, fontWeight: "800" },
  greeting: { color: "#dbeafe", fontSize: 12, marginTop: 2 },
  settingsBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textMuted, marginBottom: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  error: { color: colors.danger, textAlign: "center", marginTop: 40 },
});
