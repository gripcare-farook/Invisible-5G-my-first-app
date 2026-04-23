import React from "react";
import {
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  keyboardType?: KeyboardTypeOptions;
  flex?: number;
}

export function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  suffix,
  keyboardType = "decimal-pad",
  flex,
}: Props) {
  const colors = useColors();
  return (
    <View style={flex ? { flex } : undefined}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputRow,
          { backgroundColor: colors.input, borderColor: colors.border },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType}
          style={[styles.input, { color: colors.foreground }]}
        />
        {suffix ? (
          <Text style={[styles.suffix, { color: colors.mutedForeground }]}>
            {suffix}
          </Text>
        ) : null}
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
  },
  suffix: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginLeft: 6,
  },
});
