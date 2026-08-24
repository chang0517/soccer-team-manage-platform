import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import type { AnnouncementRow } from "../api/types";
import { colors } from "../theme";
import type { AppStackParamList } from "../navigation/types";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

export default function CoachFeedbackScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [feedbackDate, setFeedbackDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setItems(await api.get<AnnouncementRow[]>("/api/announcements"));
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

  const submit = async () => {
    if (!title.trim() || !body.trim() || !feedbackDate) return;
    setSaving(true);
    setFormError("");
    try {
      await api.post("/api/announcements", {
        title: title.trim(),
        body: body.trim(),
        category: "coach_feedback",
        feedbackDate,
      });
      setTitle("");
      setBody("");
      setFeedbackDate(todayStr());
      setShowForm(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "작성에 실패했어요.");
    } finally {
      setSaving(false);
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

  const feedback = items.filter((a) => a.category === "coach_feedback");
  const groups = new Map<string, AnnouncementRow[]>();
  for (const a of feedback) {
    const key = a.feedbackDate ?? a.createdAt.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  const sortedDates = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.headerTitle}>🗣️ 코치 피드백</Text>
        {isAdmin && (
          <Pressable onPress={() => setShowForm((v) => !v)}>
            <Text style={styles.newButton}>{showForm ? "닫기" : "+ 피드백 기록"}</Text>
          </Pressable>
        )}
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.smallLabel}>날짜</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={feedbackDate}
            onChangeText={setFeedbackDate}
          />
          <TextInput
            style={styles.input}
            placeholder="제목"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="내용"
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={5}
          />
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <Pressable
            onPress={submit}
            disabled={saving || !title.trim() || !body.trim() || !feedbackDate}
            style={[
              styles.button,
              (saving || !title.trim() || !body.trim() || !feedbackDate) && { opacity: 0.4 },
            ]}
          >
            <Text style={styles.buttonText}>{saving ? "저장 중…" : "기록하기"}</Text>
          </Pressable>
        </View>
      )}

      {feedback.length === 0 && (
        <Text style={styles.empty}>아직 기록된 코치 피드백이 없어요.</Text>
      )}

      {sortedDates.map((date) => (
        <View key={date} style={{ gap: 6 }}>
          <Text style={styles.dateHeader}>{formatDateHeader(date)}</Text>
          {groups.get(date)!.map((a) => (
            <Pressable
              key={a.id}
              style={styles.card}
              onPress={() => navigation.navigate("NoticeDetail", { id: a.id })}
            >
              <Text style={styles.cardTitle}>{a.title}</Text>
              <Text style={styles.cardSub}>{a.authorName}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
  smallLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  button: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  dateHeader: { fontSize: 11, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  cardSub: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 20 },
  error: { color: colors.danger },
});
