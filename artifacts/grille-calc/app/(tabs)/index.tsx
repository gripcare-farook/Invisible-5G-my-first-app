import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { LabeledInput } from "@/components/LabeledInput";
import { Section } from "@/components/Section";
import { Segmented } from "@/components/Segmented";
import { StatRow } from "@/components/StatRow";
import { useColors } from "@/hooks/useColors";
import {
  CalcResults,
  GapInches,
  ModelType,
  ProjectInputs,
  ShippingMode,
  StiffnerCostMode,
  calculate,
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

interface FormState {
  width: string;
  height: string;
  modelType: ModelType;
  gapInches: GapInches;
  stiffnerLineCount: string;
  clientName: string;

  channelOverride: string;

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

function buildInitialForm(s: Settings): FormState {
  return {
    width: "",
    height: "",
    modelType: "vertical",
    gapInches: 3,
    stiffnerLineCount: "0",
    clientName: "",

    channelOverride: "",

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

function formToInputs(f: FormState): ProjectInputs {
  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    width: num(f.width),
    height: num(f.height),
    modelType: f.modelType,
    gapInches: f.gapInches,
    stiffnerLineCount: num(f.stiffnerLineCount),
    clientName: f.clientName.trim(),
    channelOverride: f.channelOverride ? num(f.channelOverride) : null,
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

function inputsToForm(i: ProjectInputs): FormState {
  return {
    width: String(i.width || ""),
    height: String(i.height || ""),
    modelType: i.modelType,
    gapInches: i.gapInches,
    stiffnerLineCount: String(i.stiffnerLineCount || 0),
    clientName: i.clientName,
    channelOverride: i.channelOverride ? String(i.channelOverride) : "",
    wireCostPerMeter: String(i.wireCostPerMeter),
    labourCostPerSqft: String(i.labourCostPerSqft),
    channelCostPerPiece: String(i.channelCostPerPiece),
    fastenerCostPerPiece: String(i.fastenerCostPerPiece),
    stiffnerCostMode: i.stiffnerCostMode,
    stiffnerCostPerPiece: String(i.stiffnerCostPerPiece),
    stiffnerCostPerMeter: String(i.stiffnerCostPerMeter),
    miscCost: String(i.miscCost),
    connectorCost: String(i.connectorCost),
    baseLocation: i.baseLocation,
    siteLocation: i.siteLocation,
    shippingMode: i.shippingMode,
    shippingCostManual: String(i.shippingCostManual),
    distanceKm: String(i.distanceKm),
    costPerKm: String(i.costPerKm),
    sellingPricePerSqft: String(i.sellingPricePerSqft || ""),
    targetProfitPerSqft: String(i.targetProfitPerSqft),
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

  const [form, setForm] = useState<FormState>(() =>
    buildInitialForm(DEFAULT_SETTINGS),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setForm((prev) => ({
        ...prev,
        wireCostPerMeter:
          prev.wireCostPerMeter || String(s.wireCostPerMeter),
        labourCostPerSqft:
          prev.labourCostPerSqft || String(s.labourCostPerSqft),
        channelCostPerPiece:
          prev.channelCostPerPiece || String(s.channelCostPerPiece),
        fastenerCostPerPiece:
          prev.fastenerCostPerPiece || String(s.fastenerCostPerPiece),
        stiffnerCostPerPiece:
          prev.stiffnerCostPerPiece || String(s.stiffnerCostPerPiece),
        stiffnerCostPerMeter:
          prev.stiffnerCostPerMeter || String(s.stiffnerCostPerMeter),
        costPerKm: prev.costPerKm || String(s.costPerKm),
        baseLocation: prev.baseLocation || s.baseLocation,
        targetProfitPerSqft:
          prev.targetProfitPerSqft || String(s.targetProfitPerSqft),
      }));
      setSettingsLoaded(true);
    })();
  }, []);

  // Load project if navigated with projectId
  useFocusEffect(
    useCallback(() => {
      const id = params.projectId;
      if (!id) return;
      (async () => {
        const projects = await loadProjects();
        const p = projects.find((x) => x.id === id);
        if (p) {
          setForm(inputsToForm(p.inputs));
          setEditingId(p.id);
        }
        // Clear param so reload doesn't refire
        router.setParams({ projectId: "" });
      })();
    }, [params.projectId, router]),
  );

  const inputs = useMemo(() => formToInputs(form), [form]);
  const results = useMemo(() => calculate(inputs), [inputs]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (w: number, h: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setForm((p) => ({ ...p, width: String(w), height: String(h) }));
  };

  const onReset = () => {
    Alert.alert("Reset form", "Clear all current entries?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          const s = await loadSettings();
          setForm(buildInitialForm(s));
          setEditingId(null);
        },
      },
    ]);
  };

  const onSave = async () => {
    if (!form.width || !form.height) {
      Alert.alert("Missing info", "Please enter width and height first.");
      return;
    }
    const name =
      form.clientName.trim() ||
      `${fmtNum(parseFloat(form.width))}x${fmtNum(parseFloat(form.height))} ft`;
    const id = editingId ?? newId();
    const now = Date.now();
    const project: SavedProject = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      inputs: formToInputs(form),
    };
    await saveProject(project);
    setEditingId(id);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert("Saved", `Project "${name}" saved.`);
  };

  const onShare = async () => {
    if (!form.width || !form.height) {
      Alert.alert("Missing info", "Enter width and height to share.");
      return;
    }
    await shareSummary(inputs, results);
  };

  if (!settingsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="5G Invisible Grille"
        subtitle="Smart calculator for contractors"
        onReset={onReset}
      />
      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 120,
        }}
      >
        {/* PROJECT */}
        <Section title="Project" subtitle="Size and configuration">
          <LabeledInput
            label="Client / Project Name (optional)"
            value={form.clientName}
            onChangeText={(v) => update("clientName", v)}
            placeholder="e.g. Mr. Kumar - Sholinganallur"
            keyboardType="default"
          />
          <View style={styles.row}>
            <LabeledInput
              flex={1}
              label="Width"
              value={form.width}
              onChangeText={(v) => update("width", v)}
              suffix="ft"
              placeholder="0"
            />
            <LabeledInput
              flex={1}
              label="Height"
              value={form.height}
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
            value={form.modelType}
            onChange={(v) => update("modelType", v)}
          />
          <Segmented
            label="Gap Size"
            options={[
              { label: '2"', value: 2 },
              { label: '3"', value: 3 },
              { label: '4"', value: 4 },
            ]}
            value={form.gapInches}
            onChange={(v) => update("gapInches", v)}
          />
          <View style={styles.row}>
            <LabeledInput
              flex={1}
              label="Stiffner Lines"
              value={form.stiffnerLineCount}
              onChangeText={(v) => update("stiffnerLineCount", v)}
              suffix="lines"
            />
            <LabeledInput
              flex={1}
              label="Channel Override"
              value={form.channelOverride}
              onChangeText={(v) => update("channelOverride", v)}
              placeholder="auto"
              suffix="pcs"
            />
          </View>
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
        </Section>

        {/* MATERIAL */}
        <Section title="Material Summary" subtitle="Auto calculated">
          <StatRow label="Total Sqft" value={`${fmtNum(results.sqft)} sqft`} emphasis="strong" />
          <StatRow
            label="Rope Lines"
            value={`${results.ropeLineCount}`}
          />
          <StatRow
            label="Rope Required"
            value={`${fmtNum(results.totalRopeMeters)} m`}
            emphasis="strong"
          />
          <StatRow
            label="Channel Pieces"
            value={`${results.channelPieces} pcs`}
            emphasis="strong"
          />
          <StatRow
            label="Total Channel"
            value={`${fmtNum(results.totalChannelFeet, 0)} ft`}
          />
          <StatRow
            label="Fasteners"
            value={`${fmtNum(results.fastenerQty, 0)} pcs`}
            emphasis="strong"
          />
          <StatRow
            label="Stiffner Lines"
            value={`${results.stiffnerLineCount}`}
          />
          <StatRow
            label="Stiffner Required"
            value={`${fmtNum(results.totalStiffnerMeters)} m`}
            emphasis="strong"
          />
        </Section>

        {/* COSTS */}
        <Section title="Cost Inputs" subtitle="Editable rates">
          <View style={styles.row}>
            <LabeledInput
              flex={1}
              label="Wire / m"
              value={form.wireCostPerMeter}
              onChangeText={(v) => update("wireCostPerMeter", v)}
              suffix="₹"
            />
            <LabeledInput
              flex={1}
              label="Labour / sqft"
              value={form.labourCostPerSqft}
              onChangeText={(v) => update("labourCostPerSqft", v)}
              suffix="₹"
            />
          </View>
          <View style={styles.row}>
            <LabeledInput
              flex={1}
              label="Channel / pc"
              value={form.channelCostPerPiece}
              onChangeText={(v) => update("channelCostPerPiece", v)}
              suffix="₹"
            />
            <LabeledInput
              flex={1}
              label="Fastener / pc"
              value={form.fastenerCostPerPiece}
              onChangeText={(v) => update("fastenerCostPerPiece", v)}
              suffix="₹"
            />
          </View>
          <Segmented
            label="Stiffner Cost Mode"
            options={[
              { label: "Per Piece", value: "perPiece" },
              { label: "Per Meter", value: "perMeter" },
            ]}
            value={form.stiffnerCostMode}
            onChange={(v) => update("stiffnerCostMode", v)}
          />
          {form.stiffnerCostMode === "perPiece" ? (
            <LabeledInput
              label="Stiffner Cost / Piece"
              value={form.stiffnerCostPerPiece}
              onChangeText={(v) => update("stiffnerCostPerPiece", v)}
              suffix="₹"
            />
          ) : (
            <LabeledInput
              label="Stiffner Cost / Meter"
              value={form.stiffnerCostPerMeter}
              onChangeText={(v) => update("stiffnerCostPerMeter", v)}
              suffix="₹"
            />
          )}
          <View style={styles.row}>
            <LabeledInput
              flex={1}
              label="Misc Cost"
              value={form.miscCost}
              onChangeText={(v) => update("miscCost", v)}
              suffix="₹"
            />
            <LabeledInput
              flex={1}
              label="Connector / Joint"
              value={form.connectorCost}
              onChangeText={(v) => update("connectorCost", v)}
              suffix="₹"
            />
          </View>
        </Section>

        {/* SHIPPING */}
        <Section title="Shipping / Porter" subtitle="Site delivery cost">
          <LabeledInput
            label="Base Location"
            value={form.baseLocation}
            onChangeText={(v) => update("baseLocation", v)}
            keyboardType="default"
            placeholder="Tambaram, Chennai"
          />
          <LabeledInput
            label="Site Location"
            value={form.siteLocation}
            onChangeText={(v) => update("siteLocation", v)}
            keyboardType="default"
            placeholder="e.g. Sholinganallur"
          />
          <Segmented
            label="Shipping Mode"
            options={[
              { label: "Manual", value: "manual" },
              { label: "By Distance", value: "distance" },
            ]}
            value={form.shippingMode}
            onChange={(v) => update("shippingMode", v)}
          />
          {form.shippingMode === "manual" ? (
            <LabeledInput
              label="Porter / Transport Cost"
              value={form.shippingCostManual}
              onChangeText={(v) => update("shippingCostManual", v)}
              suffix="₹"
            />
          ) : (
            <View style={styles.row}>
              <LabeledInput
                flex={1}
                label="Distance"
                value={form.distanceKm}
                onChangeText={(v) => update("distanceKm", v)}
                suffix="km"
              />
              <LabeledInput
                flex={1}
                label="Cost / km"
                value={form.costPerKm}
                onChangeText={(v) => update("costPerKm", v)}
                suffix="₹"
              />
            </View>
          )}
        </Section>

        {/* COST SUMMARY */}
        <Section title="Cost Summary" subtitle="Internal breakdown">
          <StatRow label="Wire" value={fmtINR(results.wireCost)} />
          <StatRow label="Channel" value={fmtINR(results.channelCost)} />
          <StatRow label="Fastener" value={fmtINR(results.fastenerCost)} />
          <StatRow label="Stiffner" value={fmtINR(results.stiffnerCost)} />
          <StatRow label="Labour" value={fmtINR(results.labourCost)} />
          <StatRow label="Shipping" value={fmtINR(results.shippingCost)} />
          {results.otherCost > 0 ? (
            <StatRow label="Misc / Connectors" value={fmtINR(results.otherCost)} />
          ) : null}
          <StatRow
            label="Total Cost"
            value={fmtINR(results.totalCost)}
            emphasis="total"
          />
          <StatRow
            label="Cost / sqft"
            value={fmtINR(results.costPerSqft)}
            emphasis="strong"
          />
        </Section>

        {/* PROFIT */}
        <Section title="Selling Price & Profit" subtitle="Quotation">
          <View style={styles.row}>
            <LabeledInput
              flex={1}
              label="Selling / sqft"
              value={form.sellingPricePerSqft}
              onChangeText={(v) => update("sellingPricePerSqft", v)}
              suffix="₹"
            />
            <LabeledInput
              flex={1}
              label="Target Profit / sqft"
              value={form.targetProfitPerSqft}
              onChangeText={(v) => update("targetProfitPerSqft", v)}
              suffix="₹"
            />
          </View>
          <ProfitDisplay results={results} hasSelling={!!form.sellingPricePerSqft} />
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
            style={[
              styles.actionText,
              { color: colors.primaryForeground },
            ]}
          >
            Share Quote
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProfitDisplay({
  results,
  hasSelling,
}: {
  results: CalcResults;
  hasSelling: boolean;
}) {
  const colors = useColors();
  const profitColor =
    !hasSelling || results.profitPerSqft === 0
      ? colors.mutedForeground
      : results.profitPerSqft < 0
        ? colors.destructive
        : results.profitPerSqft < 50
          ? colors.warning
          : colors.success;
  const status = !hasSelling
    ? "Enter selling price"
    : results.profitPerSqft < 0
      ? "Loss"
      : results.profitPerSqft < 50
        ? "Low Profit"
        : "Good Profit";
  return (
    <View>
      <StatRow
        label="Recommended Price / sqft"
        value={fmtINR(results.recommendedSellingPrice)}
        emphasis="strong"
      />
      <StatRow
        label="Profit / sqft"
        value={fmtINR(results.profitPerSqft)}
        color={profitColor}
        emphasis="strong"
      />
      <StatRow
        label="Total Profit"
        value={fmtINR(results.totalProfit)}
        color={profitColor}
        emphasis="total"
      />
      <View
        style={[
          styles.statusPill,
          { backgroundColor: profitColor + "22", borderColor: profitColor },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: profitColor }]} />
        <Text style={[styles.statusText, { color: profitColor }]}>
          {status}
        </Text>
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
  row: {
    flexDirection: "row",
    gap: 10,
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  presetChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  actionBar: {
    position: "absolute",
    bottom: 84,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionPrimary: {
    flex: 1.4,
    borderColor: "transparent",
  },
  actionText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
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
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

// Keep ScrollView import for type purposes if not used elsewhere
void ScrollView;
