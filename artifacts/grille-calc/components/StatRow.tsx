import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  value: string;
  emphasis?: "normal" | "strong" | "total";
  color?: string;
}

export function StatRow({ label, value, emphasis = "normal", color }: Props) {
  const colors = useColors();
  const valueColor = color ?? colors.foreground;
  return (
    <View
      style={[
        styles.row,
        emphasis === "total" && {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 12,
          marginTop: 4,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: colors.mutedForeground },
          emphasis === "total" && {
            color: colors.foreground,
            fontFamily: "Inter_700Bold",
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          { color: valueColor },
          emphasis === "strong" && { fontFamily: "Inter_700Bold", fontSize: 17 },
          emphasis === "total" && { fontFamily: "Inter_700Bold", fontSize: 19 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    flexShrink: 1,
  },
  value: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    textAlign: "right",
  },
});
