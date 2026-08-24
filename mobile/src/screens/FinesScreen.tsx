import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";
import type { FineNotice } from "../api/types";
import { colors } from "../theme";

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function FinesScreen() {
  const { teamSlug } = useAuth();
  const [{ year, month }, setYearMonth] = useState(currentYearMonth());
  const [notices, setNotices] = useState<FineNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get<{ notices: FineNotice[] }>(
        `/api/admin/monthly-nonvoters?year=${year}&month=${month}&teamSlug=${encodeURIComponent(teamSlug)}`
      );
      setNotices(data.notices ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [year, month, teamSlug]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const copy = async (n: FineNotice) => {
    await Clipboard.setStringAsync(n.message);
    setCopiedId(n.memberId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const years = [year - 1, year, year + 1];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.headerTitle}>이번 달 미투표자 · 벌금 안내</Text>
      <Text style={styles.helpText}>
        회칙상 그 달 경기 투표는 그 달 1일 자정까지 완료해야 해요. 아래는 선택한 달의
        경기 중 하나라도 투표하지 않은 정식 멤버 목록이에요(용병 제외). 메시지를
        복사해서 직접 보낼 수 있어요.
      </Text>

      <View style={styles.pickerRow}>
        <View style={styles.pickerGroup}>
          {years.map((y) => (
            <Pressable
              key={y}
              onPress={() => setYearMonth((v) => ({ ...v, year: y }))}
              style={[styles.pickerChip, year === y && styles.pickerChipActive]}
            >
              <Text style={[styles.pickerChipText, year === y && styles.pickerChipTextActive]}>
                {y}년
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.monthGrid}>
        {months.map((mo) => (
          <Pressable
            key={mo}
            onPress={() => setYearMonth((v) => ({ ...v, month: mo }))}
            style={[styles.pickerChip, month === mo && styles.pickerChipActive]}
          >
            <Text style={[styles.pickerChipText, month === mo && styles.pickerChipTextActive]}>
              {mo}월
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && (
        <View style={{ paddingVertical: 20 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && notices.length === 0 && (
        <Text style={styles.empty}>
          {year}년 {month}월엔 미투표자가 없어요. 🎉
        </Text>
      )}

      {!loading &&
        notices.map((n) => (
          <View key={n.memberId} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>
                {n.name}
                {!n.phone && (
                  <View style={styles.noPhoneBadge}>
                    <Text style={styles.noPhoneBadgeText}> 번호 없음</Text>
                  </View>
                )}
              </Text>
              <Pressable onPress={() => copy(n)} style={styles.copyButton}>
                <Text style={styles.copyButtonText}>
                  {copiedId === n.memberId ? "복사됨!" : "메시지 복사"}
                </Text>
              </Pressable>
            </View>
            {n.phone && <Text style={styles.phone}>{n.phone}</Text>}
            <Text style={styles.missed}>
              미투표 경기: {n.missedEvents.map((e) => `${e.title}(${e.date})`).join(", ")}
            </Text>
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{n.message}</Text>
            </View>
          </View>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  helpText: { fontSize: 12, color: colors.textMuted, backgroundColor: "#f4f4f5", padding: 10, borderRadius: 10 },
  pickerRow: { flexDirection: "row" },
  pickerGroup: { flexDirection: "row", gap: 6 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  pickerChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickerChipText: { fontSize: 12, color: colors.text, fontWeight: "600" },
  pickerChipTextActive: { color: "#fff" },
  error: { color: colors.danger },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 15, fontWeight: "800", color: colors.text },
  noPhoneBadge: { backgroundColor: "#fee2e2", borderRadius: 999, paddingHorizontal: 6 },
  noPhoneBadgeText: { fontSize: 10, fontWeight: "800", color: "#b91c1c" },
  copyButton: { backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  copyButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  phone: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  missed: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  messageBox: { backgroundColor: "#fafafa", borderRadius: 10, padding: 10, marginTop: 8 },
  messageText: { fontSize: 12, color: colors.text },
});
