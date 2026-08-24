import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";
import { colors } from "../theme";
import type { AppStackParamList } from "../navigation/types";

export default function AccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!currentPassword || newPassword.length < 4) return;
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setSuccess(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "비밀번호 변경에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={[styles.card, { alignItems: "center", gap: 8 }]}>
        {user?.teamLogoUrl ? (
          <Image source={{ uri: user.teamLogoUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={{ fontSize: 24 }}>⚽</Text>
          </View>
        )}
        <Text style={styles.teamName}>{user?.teamName}</Text>
        <Text style={styles.mutedText}>
          {user?.displayName}님 ({user?.username})
        </Text>
      </View>

      <View style={styles.card}>
        <Pressable onPress={() => navigation.navigate("Members")}>
          <Text style={styles.linkRow}>👥 멤버 (선수 명단) →</Text>
        </Pressable>
      </View>

      {user?.role === "admin" && (
        <View style={[styles.card, styles.adminCard]}>
          <Text style={styles.adminTitle}>운영진</Text>
          <Pressable onPress={() => navigation.navigate("Admin")}>
            <Text style={styles.linkRow}>가입 승인 관리 →</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Fines")}>
            <Text style={styles.linkRow}>이번 달 미투표자 →</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("HistoricalStats")}>
            <Text style={styles.linkRow}>역대 기록 관리 →</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>비밀번호 변경</Text>
        <Text style={styles.label}>현재 비밀번호</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <Text style={styles.label}>새 비밀번호</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>비밀번호가 변경됐어요.</Text> : null}
        <Pressable
          onPress={submit}
          disabled={loading || !currentPassword || newPassword.length < 4}
          style={[
            styles.button,
            (loading || !currentPassword || newPassword.length < 4) && { opacity: 0.4 },
          ]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>변경</Text>}
        </Pressable>
      </View>

      <Pressable onPress={logout} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  logoFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  teamName: { fontSize: 16, fontWeight: "800", color: colors.text },
  mutedText: { fontSize: 12, color: colors.textMuted },
  adminCard: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", gap: 8 },
  adminTitle: { fontSize: 13, fontWeight: "700", color: colors.primary, marginBottom: 2 },
  linkRow: { fontSize: 13, fontWeight: "700", color: colors.primaryLight },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: "600", color: colors.textMuted, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 4,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 10 },
  success: { color: colors.primaryLight, fontSize: 13, marginTop: 10 },
  button: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  logoutBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: 14 },
});
