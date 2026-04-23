import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Option<T extends string | number> {
  label: string;
  value: T;
}

interface Props<T extends string | number> {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: Props<T>) {
  const colors = useColors();
  return (
    <View>
      {label ? (
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.row,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              style={[
                styles.item,
                active && {
                  backgroundColor: colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.itemText,
                  {
                    color: active
                      ? colors.primaryForeground
                      : colors.foreground,
                  },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  item: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  itemText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
