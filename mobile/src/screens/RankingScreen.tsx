import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, ApiError } from "../api/client";
import type { PosCategory, RankingRow } from "../api/types";
import { POS_CATEGORY, POS_CATEGORY_LABELS } from "../constants";
import HallOfFameSection from "../components/HallOfFameSection";
import { colors } from "../theme";

const VIEW_TABS = [
  { key: "ranking" as const, label: "시즌 랭킹" },
  { key: "hof" as const, label: "명예의 전당" },
];

const POS_TABS: { key: PosCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "ATT", label: "공격" },
  { key: "MID", label: "미드필더" },
  { key: "DEF", label: "수비" },
];

type SortKey = "played" | "goals" | "assists" | "cleanCount" | "mvpCount" | "total";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "played", label: "출전" },
  { key: "goals", label: "골" },
  { key: "assists", label: "어시" },
  { key: "cleanCount", label: "CS" },
  { key: "mvpCount", label: "MVP" },
  { key: "total", label: "총점" },
];

const ALL_TIME = "ALL_TIME";
const MEDALS = ["🥇", "🥈", "🥉"];

function seasonLabel(season: number): string {
  return `${season} 시즌`;
}

export default function RankingScreen() {
  const [view, setView] = useState<"ranking" | "hof">("ranking");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState<number | typeof ALL_TIME>(ALL_TIME);
  const [tab, setTab] = useState<PosCategory | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<number[]>("/api/ranking/seasons")
      .then(setSeasons)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const qs = season === ALL_TIME ? "" : `?season=${season}`;
      const data = await api.get<RankingRow[]>(`/api/ranking${qs}`);
      setRows(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [season]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const clickSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const mvpRanking = rows.filter((r) => r.mvpCount > 0).sort((a, b) => b.mvpCount - a.mvpCount);

  const visibleRows = (tab === "ALL" ? rows : rows.filter((r) => POS_CATEGORY[r.member.pos1] === tab))
    .slice()
    .sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDir === "asc" ? diff : -diff;
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={styles.viewTabRow}>
        {VIEW_TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setView(t.key)}
            style={[styles.viewTab, view === t.key && styles.viewTabActive]}
          >
            <Text style={[styles.viewTabText, view === t.key && styles.viewTabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {view === "hof" && <HallOfFameSection />}

      {view === "ranking" && (
        <>
          <Text style={styles.headerTitle}>시즌 랭킹</Text>
          <Text style={styles.helpText}>
            출전 1.5점 · 골 1.4점 · 어시스트 1.25점 · 클린시트 시 GK·센터백·윙백 1.25점,
            수비형 미드필더 0.625점 (CS 열은 점수가 아니라 클린시트 기여 횟수예요)
          </Text>

          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setSeason(ALL_TIME)}
              style={[styles.chip, season === ALL_TIME && styles.chipActive]}
            >
              <Text style={[styles.chipText, season === ALL_TIME && styles.chipTextActive]}>전체</Text>
            </Pressable>
            {seasons.map((s) => (
              <Pressable
                key={s}
                onPress={() => setSeason(s)}
                style={[styles.chip, season === s && styles.chipActive]}
              >
                <Text style={[styles.chipText, season === s && styles.chipTextActive]}>
                  {seasonLabel(s)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.posTabRow}>
            {POS_TABS.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.posTab, tab === t.key && styles.posTabActive]}
              >
                <Text style={[styles.posTabText, tab === t.key && styles.posTabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {tab !== "ALL" && (
            <Text style={styles.subHint}>
              1순위 포지션이 {POS_CATEGORY_LABELS[tab]}인 선수만 표시돼요.
            </Text>
          )}

          {loading && (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!loading && mvpRanking.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>MVP 최다 선정</Text>
              {mvpRanking.map((r, i) => (
                <View key={r.member.id} style={styles.mvpRow}>
                  <Text style={styles.mvpMedal}>{MEDALS[i] ?? i + 1}</Text>
                  <Text style={styles.mvpName}>{r.member.name}</Text>
                  <Text style={styles.mvpCount}>{r.mvpCount}회</Text>
                </View>
              ))}
            </View>
          )}

          {!loading && (
            <View style={styles.card}>
              <View style={styles.sortRow}>
                {SORT_COLUMNS.map((c) => (
                  <Pressable key={c.key} onPress={() => clickSort(c.key)} style={styles.sortBtn}>
                    <Text style={[styles.sortBtnText, sortKey === c.key && styles.sortBtnTextActive]}>
                      {c.label} {sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {visibleRows.map((r, i) => (
                <View key={r.member.id} style={styles.rankRow}>
                  <Text style={styles.rank}>{MEDALS[i] ?? i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {r.member.name}
                      {r.member.backNo != null ? ` #${r.member.backNo}` : ""}
                      {r.streak >= 3 && <Text style={styles.streak}> 🔥{r.streak}</Text>}
                    </Text>
                    <Text style={styles.stats}>
                      출전 {r.played} · 골 {r.goals} · 도움 {r.assists} · CS {r.cleanCount} · MVP{" "}
                      {r.mvpCount}
                    </Text>
                  </View>
                  <Text style={styles.total}>{r.total.toFixed(1)}</Text>
                </View>
              ))}
              {visibleRows.length === 0 && <Text style={styles.empty}>기록이 없어요.</Text>}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  viewTabRow: { flexDirection: "row", gap: 6 },
  viewTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f4f4f5",
    alignItems: "center",
  },
  viewTabActive: { backgroundColor: colors.primary },
  viewTabText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  viewTabTextActive: { color: "#fff" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  helpText: {
    fontSize: 11,
    color: colors.textMuted,
    backgroundColor: "#f4f4f5",
    padding: 10,
    borderRadius: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f4f4f5",
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  chipTextActive: { color: "#fff" },
  posTabRow: { flexDirection: "row", gap: 6 },
  posTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f4f4f5",
    alignItems: "center",
  },
  posTabActive: { backgroundColor: colors.primaryLight },
  posTabText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  posTabTextActive: { color: "#fff" },
  subHint: { fontSize: 11, color: colors.textMuted, marginTop: -4 },
  error: { color: colors.danger },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: "800", color: colors.textMuted, marginBottom: 8 },
  mvpRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  mvpMedal: { width: 24, textAlign: "center" },
  mvpName: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.text },
  mvpCount: { fontSize: 13, fontWeight: "800", color: "#d97706" },
  sortRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  sortBtn: { paddingVertical: 4 },
  sortBtnText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  sortBtnTextActive: { color: colors.primaryLight },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rank: { width: 24, textAlign: "center", fontWeight: "800", color: colors.textMuted },
  name: { fontSize: 14, fontWeight: "700", color: colors.text },
  streak: { fontSize: 11, fontWeight: "800", color: "#f97316" },
  stats: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  total: { fontSize: 15, fontWeight: "800", color: colors.primary },
  empty: { textAlign: "center", color: colors.textMuted, paddingVertical: 20 },
});
