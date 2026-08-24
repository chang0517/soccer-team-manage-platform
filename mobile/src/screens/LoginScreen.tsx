import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import { colors } from "../theme";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { login, teamSlug, setTeamSlug } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!teamSlug.trim() || !username.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      await login(teamSlug.trim(), username.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "로그인에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>로그인</Text>
      <View style={styles.card}>
        <Text style={styles.label}>팀 코드</Text>
        <TextInput
          style={styles.input}
          value={teamSlug}
          onChangeText={setTeamSlug}
          autoCapitalize="none"
          placeholder="예: raven-fc"
        />
        <Text style={styles.label}>아이디</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, (loading || !username || !password) && styles.buttonDisabled]}
          onPress={submit}
          disabled={loading || !username || !password}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>로그인</Text>
          )}
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
        <Pressable onPress={() => navigation.navigate("FindId")}>
          <Text style={styles.link}>아이디 찾기</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("ResetPassword")}>
          <Text style={styles.link}>비밀번호 찾기</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => navigation.navigate("Signup")}>
        <Text style={styles.link}>계정이 없나요? 가입하기</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("NewTeam")}>
        <Text style={styles.link}>우리 팀이 아직 없나요? 새 팀 만들기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
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
  button: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  link: { textAlign: "center", color: colors.primaryLight, marginTop: 14, fontSize: 13 },
});
