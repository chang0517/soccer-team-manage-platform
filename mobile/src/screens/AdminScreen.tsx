import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
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
import type { AppUser, Member, PosGroup, UserRole } from "../api/types";
import PosPicker from "../components/PosPicker";
import { colors } from "../theme";

interface ApprovalDraft {
  mode: "link" | "new";
  memberId: string;
  pos1: PosGroup;
  pos2: PosGroup;
  backNo: string;
  phone: string;
  role: UserRole;
}

function initialDraft(u: AppUser): ApprovalDraft {
  return {
    mode: "link",
    memberId: "",
    pos1: u.draftPos1 ?? "CB",
    pos2: u.draftPos2 ?? "WB",
    backNo: u.draftBackNo != null ? String(u.draftBackNo) : "",
    phone: u.draftPhone ?? "",
    role: u.role,
  };
}

export default function AdminScreen() {
  const { user } = useAuth();
  const [pending, setPending] = useState<AppUser[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [drafts, setDrafts] = useState<Record<number, ApprovalDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [p, m] = await Promise.all([
        api.get<AppUser[]>("/api/admin/pending-users"),
        api.get<Member[]>("/api/members"),
      ]);
      setPending(p);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const u of p) {
          if (!next[u.id]) next[u.id] = initialDraft(u);
        }
        return next;
      });
      setMembers(m);
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

  const setDraft = (id: number, patch: Partial<ApprovalDraft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const approve = async (u: AppUser) => {
    const draft = drafts[u.id];
    setBusyId(u.id);
    const body =
      draft.mode === "link"
        ? {
            action: "approve",
            memberId: draft.memberId ? Number(draft.memberId) : null,
            role: draft.role,
          }
        : {
            action: "approve",
            newMember: {
              name: u.displayName,
              pos1: draft.pos1,
              pos2: draft.pos2,
              backNo: draft.backNo === "" ? null : Number(draft.backNo),
              phone: draft.phone.trim() || null,
            },
            role: draft.role,
          };
    try {
      await api.post(`/api/admin/users/${u.id}`, body);
      await load();
    } catch {
      Alert.alert("승인 실패", "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = (u: AppUser) => {
    Alert.alert("가입 거절", `${u.displayName}(${u.username}) 가입을 거절할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "거절",
        style: "destructive",
        onPress: async () => {
          setBusyId(u.id);
          try {
            await api.post(`/api/admin/users/${u.id}`, { action: "reject" });
            await load();
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.headerTitle}>운영진 · 가입 승인</Text>
      <Text style={styles.helpText}>
        가입 신청자가 실제 팀원인지 이름을 보고 확인한 다음, 기존 멤버와 연결하거나 새
        멤버로 등록해 승인하세요.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {pending.length === 0 && (
        <Text style={styles.empty}>승인 대기 중인 가입 신청이 없어요.</Text>
      )}

      {pending.map((u) => {
        const draft = drafts[u.id] ?? initialDraft(u);
        const busy = busyId === u.id;
        return (
          <View key={u.id} style={styles.card}>
            <Text style={styles.userName}>
              {u.displayName} <Text style={styles.mutedText}>@{u.username}</Text>
            </Text>
            {u.role === "admin" && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>운영진 이름으로 자동 배정됨</Text>
              </View>
            )}
            <Text style={styles.dateText}>
              {new Date(u.createdAt).toLocaleString("ko-KR")} 가입 신청
            </Text>

            <Text style={styles.smallLabel}>권한</Text>
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => setDraft(u.id, { role: "player" })}
                style={[styles.chip, draft.role === "player" && styles.chipActive]}
              >
                <Text style={[styles.chipText, draft.role === "player" && styles.chipTextActive]}>
                  일반 선수
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDraft(u.id, { role: "admin" })}
                style={[styles.chip, draft.role === "admin" && styles.chipActive]}
              >
                <Text style={[styles.chipText, draft.role === "admin" && styles.chipTextActive]}>
                  운영진
                </Text>
              </Pressable>
            </View>

            <View style={styles.chipRow}>
              <Pressable
                onPress={() => setDraft(u.id, { mode: "link" })}
                style={[styles.modeBtn, draft.mode === "link" && styles.modeBtnActive]}
              >
                <Text style={[styles.modeBtnText, draft.mode === "link" && styles.modeBtnTextActive]}>
                  기존 멤버와 연결
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDraft(u.id, { mode: "new" })}
                style={[styles.modeBtn, draft.mode === "new" && styles.modeBtnActive]}
              >
                <Text style={[styles.modeBtnText, draft.mode === "new" && styles.modeBtnTextActive]}>
                  새 멤버로 추가
                </Text>
              </Pressable>
            </View>

            {draft.mode === "link" ? (
              <View style={{ gap: 6, marginTop: 4 }}>
                <Pressable
                  onPress={() => setDraft(u.id, { memberId: "" })}
                  style={[styles.memberOption, draft.memberId === "" && styles.memberOptionActive]}
                >
                  <Text style={styles.memberOptionText}>멤버 선택 안 함 (나중에 연결)</Text>
                </Pressable>
                {members.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setDraft(u.id, { memberId: String(m.id) })}
                    style={[
                      styles.memberOption,
                      draft.memberId === String(m.id) && styles.memberOptionActive,
                    ]}
                  >
                    <Text style={styles.memberOptionText}>
                      {m.name}
                      {m.backNo != null ? ` #${m.backNo}` : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={styles.helpTextSmall}>
                  가입 신청자가 스스로 입력한 값이 미리 채워져 있어요 — 필요하면 바꾸세요.
                </Text>
                <Text style={styles.smallLabel}>1순위 포지션</Text>
                <PosPicker value={draft.pos1} onChange={(v) => setDraft(u.id, { pos1: v })} />
                <Text style={styles.smallLabel}>2순위 포지션</Text>
                <PosPicker value={draft.pos2} onChange={(v) => setDraft(u.id, { pos2: v })} />
                <TextInput
                  style={styles.input}
                  placeholder="등번호 (선택)"
                  keyboardType="number-pad"
                  value={draft.backNo}
                  onChangeText={(v) => setDraft(u.id, { backNo: v })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="전화번호 (선택)"
                  keyboardType="phone-pad"
                  value={draft.phone}
                  onChangeText={(v) => setDraft(u.id, { phone: v })}
                />
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => approve(u)}
                disabled={busy}
                style={[styles.button, { flex: 1 }, busy && { opacity: 0.4 }]}
              >
                <Text style={styles.buttonText}>승인</Text>
              </Pressable>
              <Pressable
                onPress={() => reject(u)}
                disabled={busy}
                style={[styles.buttonDanger, { flex: 1 }, busy && { opacity: 0.4 }]}
              >
                <Text style={styles.buttonDangerText}>거절</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  helpText: { fontSize: 13, color: colors.textMuted },
  helpTextSmall: { fontSize: 11, color: colors.textMuted },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 20 },
  error: { color: colors.danger, fontSize: 13 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  userName: { fontSize: 15, fontWeight: "800", color: colors.text },
  mutedText: { fontWeight: "400", color: colors.textMuted },
  adminBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fef3c7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  adminBadgeText: { fontSize: 11, fontWeight: "800", color: "#92400e" },
  dateText: { fontSize: 11, color: colors.textMuted, marginBottom: 6 },
  smallLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f4f4f5",
    alignItems: "center",
  },
  modeBtnActive: { backgroundColor: colors.primaryLight },
  modeBtnText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  modeBtnTextActive: { color: "#fff" },
  memberOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  memberOptionActive: { borderColor: colors.primaryLight, backgroundColor: "#eff6ff" },
  memberOptionText: { fontSize: 13, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  buttonDanger: {
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonDangerText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
});
