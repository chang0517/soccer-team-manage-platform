import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
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
import type { AnnouncementRow } from "../api/types";
import { colors } from "../theme";
import type { AppStackParamList } from "../navigation/types";

export default function NoticeDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "NoticeDetail">>();
  const { id } = route.params;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [item, setItem] = useState<AnnouncementRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [feedbackDate, setFeedbackDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get<AnnouncementRow>(`/api/announcements/${id}`);
      setItem(data);
      setTitle(data.title);
      setBody(data.body);
      setFeedbackDate(data.feedbackDate ?? "");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [id]);

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
  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "글을 찾을 수 없어요."}</Text>
      </View>
    );
  }

  const isCoachFeedback = item.category === "coach_feedback";
  const backTarget: keyof AppStackParamList = isCoachFeedback ? "CoachFeedback" : "MainTabs";
  const backLabel = isCoachFeedback ? "← 코치 피드백 목록" : "← 게시판";

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(
        `/api/announcements/${id}`,
        isCoachFeedback ? { title, body, feedbackDate } : { title, body }
      );
      setEditing(false);
      await load();
    } catch (e) {
      Alert.alert("저장 실패", e instanceof ApiError ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert("삭제", "이 글을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await api.del(`/api/announcements/${id}`);
          navigation.navigate(backTarget as never);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Pressable onPress={() => navigation.navigate(backTarget as never)}>
        <Text style={styles.backLink}>{backLabel}</Text>
      </Pressable>

      <View style={styles.card}>
        {editing ? (
          <View style={{ gap: 8 }}>
            {isCoachFeedback && (
              <>
                <Text style={styles.smallLabel}>날짜</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={feedbackDate}
                  onChangeText={setFeedbackDate}
                />
              </>
            )}
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={8}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={save}
                disabled={saving}
                style={[styles.button, { flex: 1 }, saving && { opacity: 0.4 }]}
              >
                <Text style={styles.buttonText}>{saving ? "저장 중…" : "저장"}</Text>
              </Pressable>
              <Pressable
                onPress={() => setEditing(false)}
                style={[styles.button, styles.buttonSecondary, { flex: 1 }]}
              >
                <Text style={styles.buttonSecondaryText}>취소</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                {isCoachFeedback && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>🗣️ 코치 피드백</Text>
                  </View>
                )}
                <Text style={styles.title}>{item.title}</Text>
              </View>
              {isAdmin && (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable onPress={() => setEditing(true)}>
                    <Text style={styles.editLink}>수정</Text>
                  </Pressable>
                  <Pressable onPress={remove}>
                    <Text style={styles.deleteLink}>삭제</Text>
                  </Pressable>
                </View>
              )}
            </View>
            <Text style={styles.sub}>
              {item.authorName} ·{" "}
              {isCoachFeedback && item.feedbackDate
                ? new Date(`${item.feedbackDate}T00:00:00`).toLocaleDateString("ko-KR")
                : new Date(item.createdAt).toLocaleString("ko-KR")}
            </Text>
            <Text style={styles.body}>{item.body}</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  backLink: { fontSize: 13, fontWeight: "700", color: colors.primaryLight },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: colors.primaryLight },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  editLink: { fontSize: 12, color: colors.primaryLight, fontWeight: "600" },
  deleteLink: { fontSize: 12, color: colors.danger, fontWeight: "600" },
  sub: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  body: { fontSize: 14, color: colors.text, lineHeight: 21, marginTop: 14 },
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
  textArea: { minHeight: 140, textAlignVertical: "top" },
  button: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  buttonSecondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  buttonSecondaryText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  error: { color: colors.danger },
});
