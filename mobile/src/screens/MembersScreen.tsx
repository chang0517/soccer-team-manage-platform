import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";
import type { Member, PosGroup } from "../api/types";
import { POS_LABELS } from "../constants";
import PosPicker from "../components/PosPicker";
import { colors } from "../theme";

interface Draft {
  name: string;
  backNo: string;
  pos1: PosGroup;
  pos2: PosGroup;
  isGuest: boolean;
  phone: string;
}

const EMPTY: Draft = { name: "", backNo: "", pos1: "CB", pos2: "WB", isGuest: false, phone: "" };

export default function MembersScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setMembers(await api.get<Member[]>("/api/members"));
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

  const add = async () => {
    if (!draft.name.trim()) return;
    setAdding(true);
    try {
      await api.post("/api/members", {
        name: draft.name.trim(),
        backNo: draft.backNo === "" ? null : Number(draft.backNo),
        pos1: draft.pos1,
        pos2: draft.pos2,
        isGuest: draft.isGuest,
        phone: draft.phone.trim() || null,
      });
      setDraft(EMPTY);
      setShowAdd(false);
      await load();
    } catch {
      Alert.alert("추가 실패", "잠시 후 다시 시도해 주세요.");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (m: Member) => {
    setEditingId(m.id);
    setEditDraft({
      name: m.name,
      backNo: m.backNo != null ? String(m.backNo) : "",
      pos1: m.pos1,
      pos2: m.pos2,
      isGuest: m.isGuest,
      phone: m.phone ?? "",
    });
  };

  const saveEdit = async (id: number) => {
    setSavingId(id);
    try {
      await api.patch(`/api/members/${id}`, {
        name: editDraft.name.trim(),
        backNo: editDraft.backNo === "" ? null : Number(editDraft.backNo),
        pos1: editDraft.pos1,
        pos2: editDraft.pos2,
        isGuest: editDraft.isGuest,
        phone: editDraft.phone.trim() || null,
      });
      setEditingId(null);
      await load();
    } catch {
      Alert.alert("저장 실패", "잠시 후 다시 시도해 주세요.");
    } finally {
      setSavingId(null);
    }
  };

  const remove = (m: Member) => {
    Alert.alert("멤버 삭제", `${m.name} 님을 삭제할까요? 투표·기록도 함께 삭제돼요.`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await api.del(`/api/members/${m.id}`);
          load();
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.headerTitle}>멤버</Text>
        <Text style={styles.mutedText}>총 {members.length}명</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isAdmin && (
        <View style={styles.addCard}>
          <Pressable onPress={() => setShowAdd((v) => !v)}>
            <Text style={styles.addToggle}>{showAdd ? "닫기" : "+ 멤버 추가"}</Text>
          </Pressable>
          {showAdd && (
            <View style={{ gap: 8, marginTop: 8 }}>
              <TextInput
                style={styles.input}
                placeholder="이름"
                value={draft.name}
                onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
              />
              <TextInput
                style={styles.input}
                placeholder="등번호 (선택)"
                keyboardType="number-pad"
                value={draft.backNo}
                onChangeText={(v) => setDraft((d) => ({ ...d, backNo: v }))}
              />
              <TextInput
                style={styles.input}
                placeholder="전화번호 (선택)"
                keyboardType="phone-pad"
                value={draft.phone}
                onChangeText={(v) => setDraft((d) => ({ ...d, phone: v }))}
              />
              <Text style={styles.smallLabel}>1순위 포지션</Text>
              <PosPicker value={draft.pos1} onChange={(v) => setDraft((d) => ({ ...d, pos1: v }))} />
              <Text style={styles.smallLabel}>2순위 포지션</Text>
              <PosPicker value={draft.pos2} onChange={(v) => setDraft((d) => ({ ...d, pos2: v }))} />
              <View style={styles.rowBetween}>
                <Text style={styles.smallLabel}>용병 (임시 참가자)</Text>
                <Switch
                  value={draft.isGuest}
                  onValueChange={(v) => setDraft((d) => ({ ...d, isGuest: v }))}
                />
              </View>
              <Pressable
                onPress={add}
                disabled={adding || !draft.name.trim()}
                style={[styles.button, (adding || !draft.name.trim()) && { opacity: 0.4 }]}
              >
                <Text style={styles.buttonText}>{adding ? "추가 중…" : "추가"}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <View style={styles.listCard}>
        {members.map((m) => {
          const canEdit = isAdmin || user?.memberId === m.id;
          const editing = editingId === m.id;
          return (
            <View key={m.id} style={styles.memberRow}>
              {editing ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={styles.input}
                    value={editDraft.name}
                    onChangeText={(v) => setEditDraft((d) => ({ ...d, name: v }))}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="등번호"
                    keyboardType="number-pad"
                    value={editDraft.backNo}
                    onChangeText={(v) => setEditDraft((d) => ({ ...d, backNo: v }))}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="전화번호"
                    keyboardType="phone-pad"
                    value={editDraft.phone}
                    onChangeText={(v) => setEditDraft((d) => ({ ...d, phone: v }))}
                  />
                  <PosPicker value={editDraft.pos1} onChange={(v) => setEditDraft((d) => ({ ...d, pos1: v }))} />
                  <PosPicker value={editDraft.pos2} onChange={(v) => setEditDraft((d) => ({ ...d, pos2: v }))} />
                  {isAdmin && (
                    <View style={styles.rowBetween}>
                      <Text style={styles.smallLabel}>용병</Text>
                      <Switch
                        value={editDraft.isGuest}
                        onValueChange={(v) => setEditDraft((d) => ({ ...d, isGuest: v }))}
                      />
                    </View>
                  )}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => saveEdit(m.id)}
                      disabled={savingId === m.id}
                      style={[styles.button, { flex: 1 }]}
                    >
                      <Text style={styles.buttonText}>저장</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingId(null)}
                      style={[styles.button, styles.buttonSecondary, { flex: 1 }]}
                    >
                      <Text style={styles.buttonSecondaryText}>취소</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={styles.backNoBadge}>
                    <Text style={styles.backNoText}>{m.backNo ?? "–"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>
                      {m.name}
                      {m.isGuest && <Text style={styles.guestBadge}>  용병</Text>}
                    </Text>
                    <Text style={styles.mutedText}>
                      1순위 {POS_LABELS[m.pos1]} · 2순위 {POS_LABELS[m.pos2]}
                    </Text>
                    {canEdit && m.phone && <Text style={styles.mutedText}>{m.phone}</Text>}
                  </View>
                  {canEdit && (
                    <Pressable onPress={() => startEdit(m)}>
                      <Text style={styles.editLink}>수정</Text>
                    </Pressable>
                  )}
                  {isAdmin && (
                    <Pressable onPress={() => remove(m)}>
                      <Text style={styles.deleteLink}>삭제</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  mutedText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  error: { color: colors.danger, fontSize: 13 },
  addCard: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  addToggle: { fontSize: 14, fontWeight: "700", color: colors.primary },
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
  button: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  buttonSecondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  buttonSecondaryText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  memberRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backNoBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  backNoText: { fontSize: 12, fontWeight: "800", color: colors.primary },
  memberName: { fontSize: 14, fontWeight: "700", color: colors.text },
  guestBadge: { fontSize: 10, fontWeight: "800", color: "#92400e" },
  editLink: { fontSize: 11, color: colors.primaryLight, fontWeight: "600" },
  deleteLink: { fontSize: 11, color: colors.danger, fontWeight: "600" },
});
