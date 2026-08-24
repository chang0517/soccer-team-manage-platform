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
import type { PosGroup } from "../api/types";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Signup">;

const POS_GROUPS: PosGroup[] = ["GK", "CB", "WB", "DM", "AM", "WG", "ST"];

function PosPicker({
  value,
  onChange,
}: {
  value: PosGroup;
  onChange: (p: PosGroup) => void;
}) {
  return (
    <View style={styles.posRow}>
      {POS_GROUPS.map((p) => (
        <Pressable
          key={p}
          onPress={() => onChange(p)}
          style={[styles.posChip, value === p && styles.posChipActive]}
        >
          <Text style={[styles.posChipText, value === p && styles.posChipTextActive]}>{p}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SignupScreen({ navigation }: Props) {
  const { signup, teamSlug, setTeamSlug } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pos1, setPos1] = useState<PosGroup>("CB");
  const [pos2, setPos2] = useState<PosGroup>("WB");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const valid = teamSlug.trim() && username.trim().length >= 3 && password.length >= 4 && displayName.trim();

  const submit = async () => {
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      await signup({
        teamSlug: teamSlug.trim(),
        username: username.trim(),
        password,
        displayName: displayName.trim(),
        pos1,
        pos2,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "가입에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>가입 신청 완료</Text>
        <View style={styles.card}>
          <Text style={{ fontSize: 14, color: colors.text }}>
            가입 요청이 접수됐어요. 운영진이 이름을 확인하고 승인하면 로그인할 수 있어요.
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate("Login")}>
          <Text style={styles.link}>로그인 화면으로</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>가입하기</Text>
      <View style={styles.card}>
        <Text style={styles.label}>팀 코드</Text>
        <TextInput
          style={styles.input}
          value={teamSlug}
          onChangeText={setTeamSlug}
          autoCapitalize="none"
          placeholder="운영진에게 받은 팀 코드"
        />
        <Text style={styles.label}>이름</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="실명 (운영진이 이걸 보고 승인해요)"
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
        <Text style={styles.label}>1순위 포지션</Text>
        <PosPicker value={pos1} onChange={setPos1} />
        <Text style={styles.label}>2순위 포지션</Text>
        <PosPicker value={pos2} onChange={setPos2} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, (loading || !valid) && styles.buttonDisabled]}
          onPress={submit}
          disabled={loading || !valid}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>가입 신청</Text>
          )}
        </Pressable>
      </View>
      <Pressable onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>이미 계정이 있나요? 로그인</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.bg, padding: 20, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
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
  posRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  posChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  posChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  posChipText: { fontSize: 12, color: colors.text, fontWeight: "600" },
  posChipTextActive: { color: "#fff" },
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
