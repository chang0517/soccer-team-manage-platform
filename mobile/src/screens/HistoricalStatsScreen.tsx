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
import { api, ApiError } from "../api/client";
import type { HistoricalStats, Member } from "../api/types";
import { colors } from "../theme";

interface Draft {
  games: string;
  goals: string;
  assists: string;
  cleanPts: string;
  bonusPts: string;
}

const toDraft = (s?: HistoricalStats): Draft => ({
  games: s ? String(s.games) : "0",
  goals: s ? String(s.goals) : "0",
  assists: s ? String(s.assists) : "0",
  cleanPts: s ? String(s.cleanPts) : "0",
  bonusPts: s ? String(s.bonusPts) : "0",
});

const FIELDS: { key: keyof Draft; label: string }[] = [
  { key: "games", label: "출전" },
  { key: "goals", label: "골" },
  { key: "assists", label: "어시" },
  { key: "cleanPts", label: "CS점수" },
  { key: "bonusPts", label: "보너스" },
];

export default function HistoricalStatsScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<HistoricalStats[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [m, s] = await Promise.all([
        api.get<Member[]>("/api/members"),
        api.get<HistoricalStats[]>("/api/admin/historical-stats"),
      ]);
      setMembers(m);
      setStats(s);
      const byMember = new Map(s.map((row) => [row.memberId, row]));
      setDrafts(Object.fromEntries(m.map((mem) => [mem.id, toDraft(byMember.get(mem.id))])));
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

  const setDraft = (memberId: number, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [memberId]: { ...d[memberId], ...patch } }));

  const save = async (memberId: number) => {
    const d = drafts[memberId];
    setSavingId(memberId);
    try {
      await api.put("/api/admin/historical-stats", {
        memberId,
        games: d.games,
        goals: d.goals,
        assists: d.assists,
        cleanPts: d.cleanPts,
        bonusPts: d.bonusPts,
      });
      await load();
    } catch {
      Alert.alert("저장 실패", "잠시 후 다시 시도해 주세요.");
    } finally {
      setSavingId(null);
    }
  };

  const remove = (memberId: number, name: string) => {
    Alert.alert("기록 삭제", `${name}의 역대 누적 기록을 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          setSavingId(memberId);
          try {
            await api.del("/api/admin/historical-stats", { memberId });
            await load();
          } finally {
            setSavingId(null);
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
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const hasEntry = new Set(stats.map((s) => s.memberId));
  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.headerTitle}>역대 누적 기록(랭킹) 관리</Text>
      <Text style={styles.helpText}>
        앱 도입 이전 스프레드시트로 관리하던 역대 누적 기록을 멤버별로 추가·수정할 수
        있어요. 여기서 입력한 값은 랭킹에 기준치로 더해져요.
      </Text>

      {sortedMembers.map((m) => {
        const d = drafts[m.id] ?? toDraft();
        const busy = savingId === m.id;
        return (
          <View key={m.id} style={styles.card}>
            <Text style={styles.memberName}>
              {m.name}
              {m.backNo != null && <Text style={styles.mutedText}> #{m.backNo}</Text>}
            </Text>
            <View style={styles.fieldGrid}>
              {FIELDS.map((f) => (
                <View key={f.key} style={styles.fieldItem}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    keyboardType="number-pad"
                    value={d[f.key]}
                    onChangeText={(v) => setDraft(m.id, { [f.key]: v } as Partial<Draft>)}
                  />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable
                onPress={() => save(m.id)}
                disabled={busy}
                style={[styles.button, { flex: 1 }, busy && { opacity: 0.4 }]}
              >
                <Text style={styles.buttonText}>저장</Text>
              </Pressable>
              {hasEntry.has(m.id) && (
                <Pressable
                  onPress={() => remove(m.id, m.name)}
                  disabled={busy}
                  style={[styles.buttonDanger, { flex: 1 }, busy && { opacity: 0.4 }]}
                >
                  <Text style={styles.buttonDangerText}>삭제</Text>
                </Pressable>
              )}
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
  error: { color: colors.danger },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  memberName: { fontSize: 15, fontWeight: "800", color: colors.text },
  mutedText: { fontSize: 12, fontWeight: "400", color: colors.textMuted },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  fieldItem: { width: "18%", minWidth: 60 },
  fieldLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 13,
    textAlign: "center",
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
