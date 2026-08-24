import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, ApiError, getSavedTeamSlug } from "../api/client";
import { colors } from "../theme";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

export default function ResetPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<"username" | "code" | "result">("username");
  const [teamSlug, setTeamSlug] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [phoneHint, setPhoneHint] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

  useEffect(() => {
    getSavedTeamSlug().then((s) => setTeamSlug(s ?? ""));
  }, []);

  const requestCode = async () => {
    if (!teamSlug.trim() || !username.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.post<{ phoneHint?: string }>("/api/auth/reset-password/request", {
        teamSlug: teamSlug.trim(),
        username: username.trim(),
      });
      setPhoneHint(data.phoneHint ?? "");
      setStep("code");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "인증번호 발송에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.post<{ tempPassword: string }>("/api/auth/reset-password/verify", {
        teamSlug: teamSlug.trim(),
        username: username.trim(),
        code: code.trim(),
      });
      setTempPassword(data.tempPassword);
      setStep("result");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "인증에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "result") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>임시 비밀번호 발급 완료</Text>
        <View style={styles.card}>
          <Text style={styles.tempPassword}>{tempPassword}</Text>
          <Text style={styles.hint}>이 비밀번호로 로그인한 뒤, 설정에서 바로 바꿔 주세요.</Text>
        </View>
        <Pressable onPress={() => navigation.navigate("Login")}>
          <Text style={styles.link}>로그인하러 가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>비밀번호 찾기</Text>
      <View style={styles.card}>
        <Text style={styles.label}>팀 코드</Text>
        <TextInput
          style={styles.input}
          value={teamSlug}
          onChangeText={setTeamSlug}
          editable={step === "username"}
          autoCapitalize="none"
        />
        <Text style={styles.label}>아이디</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          editable={step === "username"}
          autoCapitalize="none"
        />
        {step === "username" ? (
          <Pressable
            onPress={requestCode}
            disabled={loading || !teamSlug.trim() || !username.trim()}
            style={[styles.button, (loading || !teamSlug.trim() || !username.trim()) && styles.buttonDisabled]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>인증번호 받기</Text>}
          </Pressable>
        ) : (
          <>
            {phoneHint ? <Text style={styles.hint}>{phoneHint}(으)로 인증번호를 보냈어요.</Text> : null}
            <Text style={styles.label}>인증번호</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="6자리 숫자"
            />
            <Pressable
              onPress={verifyCode}
              disabled={loading || !code.trim()}
              style={[styles.button, (loading || !code.trim()) && styles.buttonDisabled]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>확인</Text>}
            </Pressable>
            <Pressable onPress={() => setStep("username")}>
              <Text style={styles.retryLink}>아이디를 다시 입력할게요</Text>
            </Pressable>
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <Pressable onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>로그인으로 돌아가기</Text>
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
  button: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  retryLink: { textAlign: "center", color: colors.textMuted, fontSize: 12, marginTop: 10 },
  error: { color: colors.danger, fontSize: 13, marginTop: 10 },
  link: { textAlign: "center", color: colors.primaryLight, marginTop: 14, fontSize: 13 },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
  tempPassword: { fontSize: 24, fontWeight: "800", color: colors.primaryLight, textAlign: "center", letterSpacing: 2 },
});
