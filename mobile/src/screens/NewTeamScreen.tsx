import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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

type Props = NativeStackScreenProps<AuthStackParamList, "NewTeam">;

const SLUG_RE = /^[a-z0-9-]{3,30}$/;

export default function NewTeamScreen({ navigation }: Props) {
  const { createTeam } = useAuth();
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const valid =
    teamName.trim() &&
    SLUG_RE.test(teamSlug.trim()) &&
    displayName.trim() &&
    username.trim().length >= 3 &&
    password.length >= 4;

  const submit = async () => {
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      await createTeam({
        teamName: teamName.trim(),
        teamSlug: teamSlug.trim(),
        displayName: displayName.trim(),
        username: username.trim(),
        password,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "팀 생성에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>새 팀 만들기</Text>
      <Text style={styles.hint}>
        여기서 만든 계정이 이 팀의 첫 운영진이 돼요. 팀원들은 아래에서 정할 팀
        코드로 가입 신청을 하고, 운영진이 승인하면 합류합니다.
      </Text>
      <View style={styles.card}>
        <Text style={styles.label}>팀 이름</Text>
        <TextInput
          style={styles.input}
          value={teamName}
          onChangeText={setTeamName}
          placeholder="예: Raven FC"
        />
        <Text style={styles.label}>팀 코드</Text>
        <TextInput
          style={styles.input}
          value={teamSlug}
          onChangeText={(v) => setTeamSlug(v.toLowerCase())}
          autoCapitalize="none"
          placeholder="영문 소문자·숫자·하이픈"
        />
        <View style={styles.divider} />
        <Text style={styles.label}>내 이름</Text>
        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />
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
          style={[styles.button, (loading || !valid) && styles.buttonDisabled]}
          onPress={submit}
          disabled={loading || !valid}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>팀 만들기</Text>
          )}
        </Pressable>
      </View>
      <Pressable onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>이미 팀이 있나요? 로그인</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.bg, padding: 20, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: "center", marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
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
