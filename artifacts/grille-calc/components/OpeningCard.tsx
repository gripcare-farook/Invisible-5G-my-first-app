import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LabeledInput } from "@/components/LabeledInput";
import { Segmented } from "@/components/Segmented";
import { StatRow } from "@/components/StatRow";
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {state.label.trim() || `Opening ${index + 1}`}
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.mutedForeground }]}
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
          <Feather
            name="trash-2"
            size={16}
            color={colors.destructive}
          />
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
            label="Stiffner Lines"
            value={state.stiffnerLineCount}
            onChangeText={(v) => update("stiffnerLineCount", v)}
            suffix="lines"
          />
          <LabeledInput
            flex={1}
            label="Channel Override"
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
            <StatRow
              label="Rope"
              value={`${results.ropeLineCount} lines · ${fmtNum(results.totalRopeMeters)} m`}
            />
            <StatRow
              label="Channel"
              value={`${results.channelPieces} pcs`}
            />
            <StatRow
              label="Fasteners"
              value={`${fmtNum(results.fastenerQty, 0)} pcs`}
            />
            {results.stiffnerLineCount > 0 ? (
              <StatRow
                label="Stiffner"
                value={`${results.stiffnerLineCount} · ${fmtNum(results.totalStiffnerMeters)} m`}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  indexBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  subtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { gap: 12 },
  row: { flexDirection: "row", gap: 10 },
  miniSummary: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 2,
  },
});
