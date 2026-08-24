import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
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

export default function BoardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get<AnnouncementRow[]>("/api/announcements");
      setItems(data.filter((a) => a.category !== "coach_feedback"));
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
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setFormError("");
    try {
      await api.post("/api/announcements", { title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
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

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(a) => String(a.id)}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 10 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.headerTitle}>게시판</Text>
            {user?.role === "admin" && (
              <Pressable onPress={() => setShowForm((v) => !v)}>
                <Text style={styles.newButton}>{showForm ? "닫기" : "+ 공지 작성"}</Text>
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => navigation.navigate("CoachFeedback")}
            style={styles.coachLink}
          >
            <Text style={styles.coachLinkText}>🗣️ 코치 피드백 보기 →</Text>
          </Pressable>
          {showForm && (
            <View style={styles.formCard}>
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
                disabled={saving || !title.trim() || !body.trim()}
                style={[styles.button, (saving || !title.trim() || !body.trim()) && { opacity: 0.4 }]}
              >
                <Text style={styles.buttonText}>{saving ? "저장 중…" : "게시하기"}</Text>
              </Pressable>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>등록된 공지가 없어요.</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate("NoticeDetail", { id: item.id })}
        >
          <Text style={styles.cardTitle}>📢 {item.title}</Text>
          <Text style={styles.cardBody} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.cardSub}>
            {item.authorName} · {item.createdAt.slice(0, 10)}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  newButton: { fontSize: 13, fontWeight: "700", color: "#fff", backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  coachLink: { backgroundColor: "#eff6ff", borderRadius: 12, padding: 12 },
  coachLinkText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  formCard: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  cardBody: { fontSize: 13, color: colors.text, marginTop: 6 },
  cardSub: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  error: { color: colors.danger },
});
