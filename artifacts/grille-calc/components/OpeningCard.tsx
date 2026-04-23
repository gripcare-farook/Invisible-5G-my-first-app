import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LabeledInput } from "@/components/LabeledInput";
import { Segmented } from "@/components/Segmented";
import { useColors } from "@/hooks/useColors";
import {
  GapInches,
  ModelType,
  OpeningResults,
  fmtNum,
} from "@/lib/calculations";

export interface OpeningFormState {
  id: string;
  label: string;
  width: string;
  height: string;
  modelType: ModelType;
  gapInches: GapInches;
  stiffnerLineCount: string;
  channelOverride: string;
}

interface Props {
  index: number;
  total: number;
  state: OpeningFormState;
  results: OpeningResults;
  onChange: (next: OpeningFormState) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function OpeningCard({
  index,
  state,
  results,
  onChange,
  onDuplicate,
  onRemove,
  canRemove,
}: Props) {
  const colors = useColors();

  const update = <K extends keyof OpeningFormState>(
    key: K,
    value: OpeningFormState[K],
  ) => {
    onChange({ ...state, [key]: value });
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.indexBadge, { backgroundColor: colors.primary }]}>
          <Text
            style={[styles.indexText, { color: colors.primaryForeground }]}
          >
            {index + 1}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {state.label.trim() || `Opening ${index + 1}`}
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {results.sqft > 0
              ? `${fmtNum(results.sqft)} sqft`
              : "Enter dimensions"}
          </Text>
        </View>
        <Pressable
          onPress={onDuplicate}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.secondary,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Feather name="copy" size={16} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={onRemove}
          disabled={!canRemove}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.secondary,
              opacity: !canRemove ? 0.35 : pressed ? 0.6 : 1,
            },
          ]}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <LabeledInput
          label="Label (optional)"
          value={state.label}
          onChangeText={(v) => update("label", v)}
          placeholder="e.g. Living balcony"
          keyboardType="default"
        />
        <View style={styles.row}>
          <LabeledInput
            flex={1}
            label="Width"
            value={state.width}
            onChangeText={(v) => update("width", v)}
            suffix="ft"
            placeholder="0"
          />
          <LabeledInput
            flex={1}
            label="Height"
            value={state.height}
            onChangeText={(v) => update("height", v)}
            suffix="ft"
            placeholder="0"
          />
        </View>
        <Segmented
          label="Model Type"
          options={[
            { label: "Vertical", value: "vertical" },
            { label: "Horizontal", value: "horizontal" },
          ]}
          value={state.modelType}
          onChange={(v) => update("modelType", v)}
        />
        <Segmented
          label="Gap Size"
          options={[
            { label: '2"', value: 2 },
            { label: '3"', value: 3 },
            { label: '4"', value: 4 },
          ]}
          value={state.gapInches}
          onChange={(v) => update("gapInches", v)}
        />
        <View style={styles.row}>
          <LabeledInput
            flex={1}
            label="Stiffner"
            value={state.stiffnerLineCount}
            onChangeText={(v) => update("stiffnerLineCount", v)}
            suffix="lines"
          />
          <LabeledInput
            flex={1}
            label="Channel"
            value={state.channelOverride}
            onChangeText={(v) => update("channelOverride", v)}
            placeholder="auto"
            suffix="pcs"
          />
        </View>

        {results.sqft > 0 ? (
          <View
            style={[
              styles.miniSummary,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
          >
            <MiniStat
              label="Rope"
              value={`${fmtNum(results.totalRopeMeters)} m`}
              hint={`${results.ropeLineCount} lines`}
            />
            <MiniStat
              label="Channel"
              value={`${results.channelPieces} pcs`}
            />
            <MiniStat
              label="Fasteners"
              value={`${fmtNum(results.fastenerQty, 0)} pcs`}
            />
            <MiniStat
              label="Stiffner"
              value={
                results.stiffnerLineCount > 0
                  ? `${fmtNum(results.totalStiffnerMeters)} m`
                  : "—"
              }
              hint={
                results.stiffnerLineCount > 0
                  ? `${results.stiffnerLineCount} line${results.stiffnerLineCount === 1 ? "" : "s"}`
                  : undefined
              }
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const colors = useColors();
  return (
    <View style={miniStyles.cell}>
      <Text
        style={[miniStyles.label, { color: colors.mutedForeground }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[miniStyles.value, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      {hint ? (
        <Text
          style={[miniStyles.hint, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const miniStyles = StyleSheet.create({
  cell: {
    width: "50%",
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 0,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    marginTop: 2,
  },
  hint: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    marginTop: 1,
  },
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    width: "100%",
    maxWidth: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  subtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { gap: 12 },
  row: { flexDirection: "row", gap: 8 },
  miniSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
  },
});
