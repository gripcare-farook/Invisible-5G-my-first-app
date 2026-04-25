import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { LabeledInput } from "@/components/LabeledInput";
import { OpeningCard, OpeningFormState } from "@/components/OpeningCard";
import { Section } from "@/components/Section";
import { Segmented } from "@/components/Segmented";
import { StatRow } from "@/components/StatRow";
import { useColors } from "@/hooks/useColors";
import {
  Opening,
  ProjectTotals,
  SharedInputs,
  ShippingMode,
  StiffnerCostMode,
  calculateProject,
  fmtINR,
  fmtNum,
} from "@/lib/calculations";
import { shareSummary } from "@/lib/share";
import {
  DEFAULT_SETTINGS,
  SavedProject,
  Settings,
  loadProjects,
  loadSettings,
  newId,
  saveProject,
} from "@/lib/storage";

interface SharedFormState {
  clientName: string;

  wireCostPerMeter: string;
  labourCostPerSqft: string;
  channelCostPerPiece: string;
  fastenerCostPerPiece: string;
  stiffnerCostMode: StiffnerCostMode;
  stiffnerCostPerPiece: string;
  stiffnerCostPerMeter: string;
  miscCost: string;
  connectorCost: string;

  baseLocation: string;
  siteLocation: string;
  shippingMode: ShippingMode;
  shippingCostManual: string;
  distanceKm: string;
  costPerKm: string;

  sellingPricePerSqft: string;
  targetProfitPerSqft: string;
}

function buildEmptyOpening(): OpeningFormState {
  return {
    id: newId(),
    label: "",
    width: "",
    height: "",
    modelType: "vertical",
    gapInches: 2,
    stiffnerLineCount: "0",
    channelInputMode: "pcs",
    channelOverride: "",
  };
}

function buildSharedFromSettings(s: Settings): SharedFormState {
  return {
    clientName: "",
    wireCostPerMeter: String(s.wireCostPerMeter),
    labourCostPerSqft: String(s.labourCostPerSqft),
    channelCostPerPiece: String(s.channelCostPerPiece),
    fastenerCostPerPiece: String(s.fastenerCostPerPiece),
    stiffnerCostMode: "perPiece",
    stiffnerCostPerPiece: String(s.stiffnerCostPerPiece),
    stiffnerCostPerMeter: String(s.stiffnerCostPerMeter),
    miscCost: "0",
    connectorCost: "0",
    baseLocation: s.baseLocation,
    siteLocation: "",
    shippingMode: "manual",
    shippingCostManual: "0",
    distanceKm: "0",
    costPerKm: String(s.costPerKm),
    sellingPricePerSqft: "",
    targetProfitPerSqft: String(s.targetProfitPerSqft),
  };
}

const num = (s: string): number => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

function formToOpening(f: OpeningFormState): Opening {
  return {
    id: f.id,
    label: f.label.trim(),
    width: num(f.width),
    height: num(f.height),
    modelType: f.modelType,
    gapInches: f.gapInches,
    stiffnerLineCount: num(f.stiffnerLineCount),
    channelInputMode: f.channelInputMode,
    channelOverride: f.channelOverride ? num(f.channelOverride) : null,
  };
}

function openingToForm(o: Opening): OpeningFormState {
  return {
    id: o.id,
    label: o.label,
    width: o.width ? String(o.width) : "",
    height: o.height ? String(o.height) : "",
    modelType: o.modelType,
    gapInches: o.gapInches,
    stiffnerLineCount: String(o.stiffnerLineCount || 0),
    channelInputMode: o.channelInputMode ?? "pcs",
    channelOverride: o.channelOverride ? String(o.channelOverride) : "",
  };
}

function sharedToInputs(f: SharedFormState): SharedInputs {
  return {
    clientName: f.clientName.trim(),
    wireCostPerMeter: num(f.wireCostPerMeter),
    labourCostPerSqft: num(f.labourCostPerSqft),
    channelCostPerPiece: num(f.channelCostPerPiece),
    fastenerCostPerPiece: num(f.fastenerCostPerPiece),
    stiffnerCostMode: f.stiffnerCostMode,
    stiffnerCostPerPiece: num(f.stiffnerCostPerPiece),
    stiffnerCostPerMeter: num(f.stiffnerCostPerMeter),
    miscCost: num(f.miscCost),
    connectorCost: num(f.connectorCost),
    baseLocation: f.baseLocation.trim(),
    siteLocation: f.siteLocation.trim(),
    shippingMode: f.shippingMode,
    shippingCostManual: num(f.shippingCostManual),
    distanceKm: num(f.distanceKm),
    costPerKm: num(f.costPerKm),
    sellingPricePerSqft: num(f.sellingPricePerSqft),
    targetProfitPerSqft: num(f.targetProfitPerSqft),
  };
}

function sharedToForm(s: SharedInputs): SharedFormState {
  return {
    clientName: s.clientName,
    wireCostPerMeter: String(s.wireCostPerMeter),
    labourCostPerSqft: String(s.labourCostPerSqft),
    channelCostPerPiece: String(s.channelCostPerPiece),
    fastenerCostPerPiece: String(s.fastenerCostPerPiece),
    stiffnerCostMode: s.stiffnerCostMode,
    stiffnerCostPerPiece: String(s.stiffnerCostPerPiece),
    stiffnerCostPerMeter: String(s.stiffnerCostPerMeter),
    miscCost: String(s.miscCost),
    connectorCost: String(s.connectorCost),
    baseLocation: s.baseLocation,
    siteLocation: s.siteLocation,
    shippingMode: s.shippingMode,
    shippingCostManual: String(s.shippingCostManual),
    distanceKm: String(s.distanceKm),
    costPerKm: String(s.costPerKm),
    sellingPricePerSqft: s.sellingPricePerSqft
      ? String(s.sellingPricePerSqft)
      : "",
    targetProfitPerSqft: String(s.targetProfitPerSqft),
  };
}

const PRESETS = [
  { label: "50 sqft", w: 10, h: 5 },
  { label: "100 sqft", w: 10, h: 10 },
  { label: "150 sqft", w: 15, h: 10 },
];

export default function CalculatorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string }>();

  const [openings, setOpenings] = useState<OpeningFormState[]>(() => [
    buildEmptyOpening(),
  ]);
  const [shared, setShared] = useState<SharedFormState>(() =>
    buildSharedFromSettings(DEFAULT_SETTINGS),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setShared(buildSharedFromSettings(s));
      setSettingsLoaded(true);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const id = params.projectId;
      if (!id) return;
      (async () => {
        const projects = await loadProjects();
        const p = projects.find((x) => x.id === id);
        if (p) {
          setOpenings(
            p.openings.length > 0
              ? p.openings.map(openingToForm)
              : [buildEmptyOpening()],
          );
          setShared(sharedToForm(p.shared));
          setEditingId(p.id);
        }
        router.setParams({ projectId: "" });
      })();
    }, [params.projectId, router]),
  );

  const sharedInputs = useMemo(() => sharedToInputs(shared), [shared]);
  const openingInputs = useMemo(
    () => openings.map(formToOpening),
    [openings],
  );
  const totals: ProjectTotals = useMemo(
    () => calculateProject(openingInputs, sharedInputs),
    [openingInputs, sharedInputs],
  );

  const updateShared = <K extends keyof SharedFormState>(
    key: K,
    value: SharedFormState[K],
  ) => {
    setShared((p) => ({ ...p, [key]: value }));
  };

  const updateOpening = (idx: number, next: OpeningFormState) => {
    setOpenings((prev) => {
      const copy = prev.slice();
      copy[idx] = next;
      return copy;
    });
  };

  const addOpening = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setOpenings((prev) => [...prev, buildEmptyOpening()]);
  };

  const duplicateOpening = (idx: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setOpenings((prev) => {
      const src = prev[idx];
      if (!src) return prev;
      const copy: OpeningFormState = {
        ...src,
        id: newId(),
        label: src.label ? `${src.label} (copy)` : "",
      };
      const next = prev.slice();
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const removeOpening = (idx: number) => {
    if (openings.length <= 1) return;
    Alert.alert("Remove opening", `Delete Opening ${idx + 1}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setOpenings((prev) => prev.filter((_, i) => i !== idx));
        },
      },
    ]);
  };

  const applyPreset = (w: number, h: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setOpenings((prev) => {
      if (prev.length === 0) return prev;
      const copy = prev.slice();
      const last = copy[copy.length - 1];
      if (!last) return prev;
      copy[copy.length - 1] = {
        ...last,
        width: String(w),
        height: String(h),
      };
      return copy;
    });
  };

  const onReset = () => {
    Alert.alert("Reset project", "Clear all openings and entries?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          const s = await loadSettings();
          setShared(buildSharedFromSettings(s));
          setOpenings([buildEmptyOpening()]);
          setEditingId(null);
        },
      },
    ]);
  };

  const onSave = async () => {
    const hasAnySize = openings.some((o) => o.width && o.height);
    if (!hasAnySize) {
      Alert.alert(
        "Missing info",
        "Enter width and height for at least one opening.",
      );
      return;
    }
    const name =
      shared.clientName.trim() ||
      `${openings.length} opening${openings.length === 1 ? "" : "s"} · ${fmtNum(totals.totalSqft)} sqft`;
    const id = editingId ?? newId();
    const now = Date.now();
    const project: SavedProject = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      openings: openingInputs,
      shared: sharedInputs,
    };
    await saveProject(project);
    setEditingId(id);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert("Saved", `Project "${name}" saved.`);
  };

  const onShare = async () => {
    const hasAnySize = openings.some((o) => o.width && o.height);
    if (!hasAnySize) {
      Alert.alert(
        "Missing info",
        "Enter width and height for at least one opening.",
      );
      return;
    }
    await shareSummary(openingInputs, sharedInputs, totals);
  };

  if (!settingsLoaded) return null;

  const profitColor = !shared.sellingPricePerSqft
    ? colors.mutedForeground
    : totals.profitPerSqft < 0
      ? colors.destructive
      : totals.profitPerSqft < 50
        ? colors.warning
        : colors.success;
  const profitStatus = !shared.sellingPricePerSqft
    ? "Enter selling price"
    : totals.profitPerSqft < 0
      ? "Loss"
      : totals.profitPerSqft < 50
        ? "Low Profit"
        : "Good Profit";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="5G Invisible Grille"
        subtitle={`${openings.length} opening${openings.length === 1 ? "" : "s"} · ${fmtNum(totals.totalSqft)} sqft`}
        onReset={onReset}
      />
      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 12,
          paddingBottom: insets.bottom + 180,
        }}
      >
        {/* CLIENT */}
        <Section title="Project" subtitle="Client and quick presets">
          <LabeledInput
            label="Client / Project Name (optional)"
            value={shared.clientName}
            onChangeText={(v) => updateShared("clientName", v)}
            placeholder="e.g. Mr. Kumar - Sholinganallur"
            keyboardType="default"
          />
          <View style={styles.presetRow}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.label}
                onPress={() => applyPreset(p.w, p.h)}
                style={({ pressed }) => [
                  styles.presetChip,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.presetText, { color: colors.foreground }]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.helpText, { color: colors.mutedForeground }]}>
            Presets fill width/height into the last opening.
          </Text>
        </Section>

        {/* OPENINGS */}
        {openings.map((o, i) => (
          <OpeningCard
            key={o.id}
            index={i}
            total={openings.length}
            state={o}
            results={totals.openings[i]!}
            onChange={(next) => updateOpening(i, next)}
            onDuplicate={() => duplicateOpening(i)}
            onRemove={() => removeOpening(i)}
            canRemove={openings.length > 1}
          />
        ))}

        <Pressable
          onPress={addOpening}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.primary,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="plus-circle" size={20} color={colors.primary} />
          <Text style={[styles.addBtnText, { color: colors.primary }]}>
            Add Opening
          </Text>
        </Pressable>

        {/* COSTS */}
        <Section title="Cost Inputs" subtitle="Applied to all openings">
          <View style={styles.row}>
            <LabeledInput
              flex={1}
              label="Wire / m"
              value={shared.wireCostPerMeter}
              onChangeText={(v) => updateShared("wireCostPerMeter", v)}
              suffix="₹"
            />
            <LabeledInput
              flex={1}
              label="Labour / sqft"
              value={shared.labourCostPerSqft}
              onChangeText={(v) => updateShared("labourCostPerSqft", v)}
              suffix="₹"
            />
          </View>
          <View style={styles.row}>
            <LabeledInput
              flex={1}
              label="Channel / pc"
              value={shared.channelCostPerPiece}
              onChangeText={(v) => updateShared("channelCostPerPiece", v)}
              suffix="₹"
            />
            <LabeledInput
              flex={1}
              label="Fastener / pc"
              value={shared.fastenerCostPerPiece}
              onChangeText={(v) => updateShared("fastenerCostPerPiece", v)}
              suffix="₹"
            />
          </View>
          <Segmented
            label="Stiffner Cost Mode"
            options={[
              { label: "Per Piece", value: "perPiece" },
              { label: "Per Meter", value: "perMeter" },
            ]}
            value={shared.stiffnerCostMode}
            onChange={(v) => updateShared("stiffnerCostMode", v)}
          />
          {shared.stiffnerCostMode === "perPiece" ? (
            <LabeledInput
              label="Stiffner Cost / Piece"
              value={shared.stiffnerCostPerPiece}
              onChangeText={(v) => updateShared("stiffnerCostPerPiece", v)}
              suffix="₹"
            />
          ) : (
            <LabeledInput
              label="Stiffner Cost / Meter"
              value={shared.stiffnerCostPerMeter}
              onChangeText={(v) => updateShared("stiffnerCostPerMeter", v)}
              suffix="₹"
            />
          )}
          <View style={styles.row}>
            <LabeledInput
              flex={1}
              label="Misc Cost"
              value={shared.miscCost}
              onChangeText={(v) => updateShared("miscCost", v)}
              suffix="₹"
            />
            <LabeledInput
              flex={1}
              label="Connector / Joint"
              value={shared.connectorCost}
              onChangeText={(v) => updateShared("connectorCost", v)}
              suffix="₹"
            />
          </View>
        </Section>

        {/* SHIPPING */}
        <Section title="Shipping / Porter" subtitle="Site delivery cost">
          <LabeledInput
            label="Base Location"
            value={shared.baseLocation}
            onChangeText={(v) => updateShared("baseLocation", v)}
            keyboardType="default"
            placeholder="Tambaram, Chennai"
          />
          <LabeledInput
            label="Site Location"
            value={shared.siteLocation}
            onChangeText={(v) => updateShared("siteLocation", v)}
            keyboardType="default"
            placeholder="e.g. Sholinganallur"
          />
          <Segmented
            label="Shipping Mode"
            options={[
              { label: "Manual", value: "manual" },
              { label: "By Distance", value: "distance" },
            ]}
            value={shared.shippingMode}
            onChange={(v) => updateShared("shippingMode", v)}
          />
          {shared.shippingMode === "manual" ? (
            <LabeledInput
              label="Porter / Transport Cost"
              value={shared.shippingCostManual}
              onChangeText={(v) => updateShared("shippingCostManual", v)}
              suffix="₹"
            />
          ) : (
            <View style={styles.row}>
              <LabeledInput
                flex={1}
                label="Distance"
                value={shared.distanceKm}
                onChangeText={(v) => updateShared("distanceKm", v)}
                suffix="km"
              />
              <LabeledInput
                flex={1}
                label="Cost / km"
                value={shared.costPerKm}
                onChangeText={(v) => updateShared("costPerKm", v)}
                suffix="₹"
              />
            </View>
          )}
        </Section>

        {/* TOTAL PROJECT SUMMARY */}
        <Section
          title="Total Project Summary"
          subtitle={`Combined across ${openings.length} opening${openings.length === 1 ? "" : "s"}`}
        >
          <StatRow
            label="Total Sqft"
            value={`${fmtNum(totals.totalSqft)} sqft`}
            emphasis="strong"
          />
          <StatRow
            label="Total Rope"
            value={`${fmtNum(totals.totalRopeMeters)} m`}
          />
          <StatRow
            label="Total Channels"
            value={`${totals.totalChannelPieces} pcs`}
          />
          <StatRow
            label="Total Fasteners"
            value={`${fmtNum(totals.totalFasteners, 0)} pcs`}
          />
          <StatRow
            label="Total Stiffner"
            value={`${totals.totalStiffnerLines} · ${fmtNum(totals.totalStiffnerMeters)} m`}
          />
        </Section>

        {/* COST SUMMARY */}
        <Section title="Cost Summary" subtitle="All openings combined">
          <StatRow label="Wire" value={fmtINR(totals.wireCost)} />
          <StatRow label="Channel" value={fmtINR(totals.channelCost)} />
          <StatRow label="Fastener" value={fmtINR(totals.fastenerCost)} />
          <StatRow label="Stiffner" value={fmtINR(totals.stiffnerCost)} />
          <StatRow
            label="Total Labour"
            value={fmtINR(totals.labourCost)}
            emphasis="strong"
          />
          <StatRow label="Shipping" value={fmtINR(totals.shippingCost)} />
          {totals.otherCost > 0 ? (
            <StatRow
              label="Misc / Connectors"
              value={fmtINR(totals.otherCost)}
            />
          ) : null}
          <StatRow
            label="Total Cost"
            value={fmtINR(totals.totalCost)}
            emphasis="total"
          />
          <StatRow
            label="Cost / sqft"
            value={fmtINR(totals.costPerSqft)}
            emphasis="strong"
          />
        </Section>

        {/* PROFIT */}
        <Section title="Selling Price & Profit" subtitle="Quotation">
          <View style={styles.row}>
            <LabeledInput
              flex={1}
              label="Selling / sqft"
              value={shared.sellingPricePerSqft}
              onChangeText={(v) => updateShared("sellingPricePerSqft", v)}
              suffix="₹"
            />
            <LabeledInput
              flex={1}
              label="Target Profit / sqft"
              value={shared.targetProfitPerSqft}
              onChangeText={(v) => updateShared("targetProfitPerSqft", v)}
              suffix="₹"
            />
          </View>
          <StatRow
            label="Recommended Price / sqft"
            value={fmtINR(totals.recommendedSellingPrice)}
            emphasis="strong"
          />
          <StatRow
            label="Profit / sqft"
            value={fmtINR(totals.profitPerSqft)}
            color={profitColor}
            emphasis="strong"
          />
          <StatRow
            label="Total Profit"
            value={fmtINR(totals.totalProfit)}
            color={profitColor}
            emphasis="total"
          />
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: profitColor + "22",
                borderColor: profitColor,
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: profitColor }]} />
            <Text style={[styles.statusText, { color: profitColor }]}>
              {profitStatus}
            </Text>
          </View>
        </Section>
      </KeyboardAwareScrollView>

      {/* Action Bar */}
      <View
        style={[
          styles.actionBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          },
        ]}
      >
        <Pressable
          onPress={addOpening}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="plus" size={20} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>
            Add
          </Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="save" size={20} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>
            {editingId ? "Update" : "Save"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onShare}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionPrimary,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="share-2" size={20} color={colors.primaryForeground} />
          <Text
            style={[styles.actionText, { color: colors.primaryForeground }]}
          >
            Share
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Header({
  title,
  subtitle,
  onReset,
}: {
  title: string;
  subtitle: string;
  onReset: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.primary,
          paddingTop: topPad + 12,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: colors.primaryForeground }]}>
          {title}
        </Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
      <Pressable
        onPress={onReset}
        style={({ pressed }) => [
          styles.headerBtn,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Feather name="refresh-cw" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  headerSubtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", gap: 10 },
  presetRow: { flexDirection: "row", gap: 8 },
  presetChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  helpText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    marginBottom: 18,
  },
  addBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  actionBar: {
    position: "absolute",
    bottom: 84,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 6,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionPrimary: {
    flex: 1.3,
    borderColor: "transparent",
  },
  actionText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
