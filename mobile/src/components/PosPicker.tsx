import { Pressable, StyleSheet, Text, View } from "react-native";
import { POS_GROUPS } from "../constants";
import type { PosGroup } from "../api/types";
import { colors } from "../theme";

export default function PosPicker({
  value,
  onChange,
}: {
  value: PosGroup;
  onChange: (p: PosGroup) => void;
}) {
  return (
    <View style={styles.row}>
      {POS_GROUPS.map((p) => (
        <Pressable
          key={p}
          onPress={() => onChange(p)}
          style={[styles.chip, value === p && styles.chipActive]}
        >
          <Text style={[styles.chipText, value === p && styles.chipTextActive]}>{p}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
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
});
