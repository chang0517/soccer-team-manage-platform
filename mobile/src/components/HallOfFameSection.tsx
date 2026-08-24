import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";
import type { HallOfFameRow, Member } from "../api/types";
import { colors } from "../theme";

type RoleKey =
  | "captainId"
  | "viceCaptainId"
  | "managerId"
  | "topScorerId"
  | "topAssistId"
  | "cleanSheetFirstId"
  | "overallFirstId";

const LEADERSHIP_FIELDS: { key: RoleKey; label: string; icon: string }[] = [
  { key: "captainId", label: "주장", icon: "👑" },
  { key: "viceCaptainId", label: "부주장", icon: "🎖️" },
  { key: "managerId", label: "총무", icon: "📋" },
];

const SEASON_FIELDS: { key: RoleKey; label: string; icon: string }[] = [
  { key: "topScorerId", label: "득점왕", icon: "⚽" },
  { key: "topAssistId", label: "어시왕", icon: "🎯" },
  { key: "cleanSheetFirstId", label: "클린시트 1등", icon: "🧤" },
];

const ROLE_FIELDS = [
  ...LEADERSHIP_FIELDS,
  { key: "overallFirstId" as const, label: "종합 1위", icon: "🏆" },
  ...SEASON_FIELDS,
];

type FormState = { year: string } & Record<RoleKey, string>;

const emptyForm = (): FormState => ({
  year: "",
  captainId: "",
  viceCaptainId: "",
  managerId: "",
  topScorerId: "",
  topAssistId: "",
  cleanSheetFirstId: "",
  overallFirstId: "",
});

function RoleItem({
  icon,
  label,
  member,
  featured,
}: {
  icon: string;
  label: string;
  member: Member | undefined;
  featured?: boolean;
}) {
  return (
    <View style={[styles.roleItem, featured && styles.roleItemFeatured]}>
      <View style={[styles.roleIcon, featured && styles.roleIconFeatured]}>
        <Text>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.roleLabel, featured && styles.roleLabelFeatured]}>{label}</Text>
        {member ? (
          <Text style={[styles.roleMember, featured && styles.roleMemberFeatured]}>
            {member.name}
          </Text>
        ) : (
          <Text style={styles.roleEmpty}>—</Text>
        )}
      </View>
    </View>
  );
}

function MemberPicker({
  members,
  value,
  onChange,
}: {
  members: Member[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      <Pressable onPress={() => onChange("")} style={[styles.chip, value === "" && styles.chipActive]}>
        <Text style={[styles.chipText, value === "" && styles.chipTextActive]}>(없음)</Text>
      </Pressable>
      {members.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => onChange(String(m.id))}
          style={[styles.chip, value === String(m.id) && styles.chipActive]}
        >
          <Text style={[styles.chipText, value === String(m.id) && styles.chipTextActive]}>
            {m.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function HallOfFameSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<HallOfFameRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const memberById = new Map(members.map((m) => [m.id, m]));
  const memberOf = (id: number | null) => (id != null ? memberById.get(id) : undefined);

  const load = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([
        api.get<HallOfFameRow[]>("/api/hall-of-fame"),
        api.get<Member[]>("/api/members"),
      ]);
      setRows(r);
      setMembers(m);
    } catch {
      // 목록 로딩 실패는 조용히 무시 — 랭킹 탭은 계속 보여야 함
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const startEdit = (row: HallOfFameRow) => {
    setForm({
      year: String(row.year),
      captainId: row.captainId != null ? String(row.captainId) : "",
      viceCaptainId: row.viceCaptainId != null ? String(row.viceCaptainId) : "",
      managerId: row.managerId != null ? String(row.managerId) : "",
      topScorerId: row.topScorerId != null ? String(row.topScorerId) : "",
      topAssistId: row.topAssistId != null ? String(row.topAssistId) : "",
      cleanSheetFirstId: row.cleanSheetFirstId != null ? String(row.cleanSheetFirstId) : "",
      overallFirstId: row.overallFirstId != null ? String(row.overallFirstId) : "",
    });
    setShowForm(true);
    setError("");
  };

  const submit = async () => {
    if (!form.year.trim()) {
      setError("연도를 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/api/hall-of-fame", form);
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: number) => {
    Alert.alert("삭제", "이 연도 기록을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await api.del(`/api/hall-of-fame/${id}`);
          await load();
        },
      },
    ]);
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>{user?.teamName ?? "OUR TEAM"}</Text>
        <Text style={styles.heroTitle}>🏆 명예의 전당</Text>
        <Text style={styles.heroSub}>역대 주장단과 매 시즌 최고의 기록을 새겨둡니다.</Text>
        {isAdmin && (
          <Pressable
            onPress={() => {
              setShowForm((v) => !v);
              if (!showForm) setForm(emptyForm());
            }}
            style={styles.heroButton}
          >
            <Text style={styles.heroButtonText}>{showForm ? "닫기" : "+ 연도 추가/수정"}</Text>
          </Pressable>
        )}
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.smallLabel}>연도</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 2026"
            keyboardType="number-pad"
            value={form.year}
            onChangeText={(v) => setForm({ ...form, year: v })}
          />
          {ROLE_FIELDS.map((f) => (
            <View key={f.key} style={{ marginTop: 8 }}>
              <Text style={styles.smallLabel}>
                {f.icon} {f.label}
              </Text>
              <MemberPicker
                members={members}
                value={form[f.key]}
                onChange={(v) => setForm({ ...form, [f.key]: v })}
              />
            </View>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={submit}
            disabled={saving || !form.year.trim()}
            style={[styles.button, (saving || !form.year.trim()) && { opacity: 0.4 }]}
          >
            <Text style={styles.buttonText}>{saving ? "저장 중…" : "저장"}</Text>
          </Pressable>
        </View>
      )}

      {rows.length === 0 && (
        <Text style={styles.empty}>아직 등록된 명예의 전당 기록이 없어요.</Text>
      )}

      {rows.map((row) => (
        <View key={row.id} style={styles.yearCard}>
          <View style={styles.yearHeader}>
            <Text style={styles.yearHeaderText}>✦ {row.year} 시즌</Text>
            {isAdmin && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable onPress={() => startEdit(row)}>
                  <Text style={styles.yearHeaderLink}>수정</Text>
                </Pressable>
                <Pressable onPress={() => remove(row.id)}>
                  <Text style={styles.yearHeaderLinkDanger}>삭제</Text>
                </Pressable>
              </View>
            )}
          </View>
          <View style={{ padding: 12, gap: 8 }}>
            <RoleItem icon="🏆" label="종합 1위" member={memberOf(row.overallFirstId)} featured />
            <Text style={styles.groupLabel}>리더십</Text>
            {LEADERSHIP_FIELDS.map((f) => (
              <RoleItem key={f.key} icon={f.icon} label={f.label} member={memberOf(row[f.key])} />
            ))}
            <Text style={styles.groupLabel}>시즌 기록</Text>
            {SEASON_FIELDS.map((f) => (
              <RoleItem key={f.key} icon={f.icon} label={f.label} member={memberOf(row[f.key])} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 20,
    gap: 4,
  },
  heroKicker: { fontSize: 11, fontWeight: "700", color: "#bfdbfe", letterSpacing: 1 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 2 },
  heroSub: { fontSize: 13, color: "#dbeafe", marginTop: 2 },
  heroButton: {
    alignSelf: "flex-start",
    backgroundColor: "#fbbf24",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
  },
  heroButtonText: { fontSize: 13, fontWeight: "800", color: "#78350f" },
  formCard: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  smallLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  error: { color: colors.danger, fontSize: 12, marginTop: 8 },
  button: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 10 },
  yearCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  yearHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  yearHeaderText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  yearHeaderLink: { fontSize: 12, fontWeight: "700", color: "#fff" },
  yearHeaderLinkDanger: { fontSize: 12, fontWeight: "700", color: "#fca5a5" },
  groupLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginTop: 6,
  },
  roleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 10,
  },
  roleItemFeatured: { backgroundColor: "#fef3c7" },
  roleIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  roleIconFeatured: { backgroundColor: "#fbbf24", borderColor: "#fbbf24" },
  roleLabel: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  roleLabelFeatured: { color: "#92400e" },
  roleMember: { fontSize: 14, fontWeight: "700", color: colors.text },
  roleMemberFeatured: { color: "#78350f" },
  roleEmpty: { fontSize: 13, color: "#d4d4d8" },
});
