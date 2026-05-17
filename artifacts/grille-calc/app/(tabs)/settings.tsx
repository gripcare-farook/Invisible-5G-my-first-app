import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
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
import { Section } from "@/components/Section";
import { useColors } from "@/hooks/useColors";
import {
  DEFAULT_SETTINGS,
  Settings,
  loadSettings,
  saveSettings,
} from "@/lib/storage";

interface SettingsForm {
  baseLocation: string;
  wireCostPerMeter: string;
  labourCostPerSqft: string;
  channelCostPerPiece: string;
  fastenerCostPerPiece: string;
  stiffnerCostPerPiece: string;
  stiffnerCostPerMeter: string;
  costPerKm: string;
  targetProfitPerSqft: string;
}

function toForm(s: Settings): SettingsForm {
  return {
    baseLocation: s.baseLocation,
    wireCostPerMeter: String(s.wireCostPerMeter),
    labourCostPerSqft: String(s.labourCostPerSqft),
    channelCostPerPiece: String(s.channelCostPerPiece),
    fastenerCostPerPiece: String(s.fastenerCostPerPiece),
    stiffnerCostPerPiece: String(s.stiffnerCostPerPiece),
    stiffnerCostPerMeter: String(s.stiffnerCostPerMeter),
    costPerKm: String(s.costPerKm),
    targetProfitPerSqft: String(s.targetProfitPerSqft),
  };
}

function fromForm(f: SettingsForm): Settings {
  const num = (s: string, fb: number) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : fb;
  };
  return {
    baseLocation: f.baseLocation.trim() || DEFAULT_SETTINGS.baseLocation,
    wireCostPerMeter: num(f.wireCostPerMeter, DEFAULT_SETTINGS.wireCostPerMeter),
    labourCostPerSqft: num(f.labourCostPerSqft, DEFAULT_SETTINGS.labourCostPerSqft),
    channelCostPerPiece: num(f.channelCostPerPiece, DEFAULT_SETTINGS.channelCostPerPiece),
    fastenerCostPerPiece: num(f.fastenerCostPerPiece, DEFAULT_SETTINGS.fastenerCostPerPiece),
    stiffnerCostPerPiece: num(f.stiffnerCostPerPiece, DEFAULT_SETTINGS.stiffnerCostPerPiece),
    stiffnerCostPerMeter: num(f.stiffnerCostPerMeter, DEFAULT_SETTINGS.stiffnerCostPerMeter),
    costPerKm: num(f.costPerKm, DEFAULT_SETTINGS.costPerKm),
    targetProfitPerSqft: num(f.targetProfitPerSqft, DEFAULT_SETTINGS.targetProfitPerSqft),
  };
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<SettingsForm>(toForm(DEFAULT_SETTINGS));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setForm(toForm(s));
      setLoaded(true);
    })();
  }, []);

  const update = <K extends keyof SettingsForm>(
    k: K,
    v: SettingsForm[K],
  ) => setForm((p) => ({ ...p, [k]: v }));

  const onSave = async () => {
    const s = fromForm(form);
    await saveSettings(s);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert("Saved", "Default rates updated.");
  };

  const onReset = () => {
    Alert.alert("Reset defaults", "Restore factory default rates?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          await saveSettings(DEFAULT_SETTINGS);
          setForm(toForm(DEFAULT_SETTINGS));
        },
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  if (!loaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.primary, paddingTop: topPad + 12 },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.primaryForeground }]}>
          Settings
        </Text>
        <Text style={styles.headerSubtitle}>
          Default rates and base location
        </Text>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 180,
        }}
      >
        <Section title="Location" subtitle="Your office / godown">
          <LabeledInput
            label="Base Location"
            value={form.baseLocation}
            onChangeText={(v) => update("baseLocation", v)}
            keyboardType="default"
            placeholder="Tambaram, Chennai"
          />
          <LabeledInput
            label="Default Cost per km"
            value={form.costPerKm}
            onChangeText={(v) => update("costPerKm", v)}
            suffix="₹"
          />
        </Section>

        <Section title="Material Rates" subtitle="Default unit costs">
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
              label="Channel / 10ft pc"
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
          <View style={styles.row}>
            <LabeledInput
              flex={1}
              label="Stiffner / pc"
              value={form.stiffnerCostPerPiece}
              onChangeText={(v) => update("stiffnerCostPerPiece", v)}
              suffix="₹"
            />
            <LabeledInput
              flex={1}
              label="Stiffner / m"
              value={form.stiffnerCostPerMeter}
              onChangeText={(v) => update("stiffnerCostPerMeter", v)}
              suffix="₹"
            />
          </View>
        </Section>

        <Section title="Profit Target" subtitle="Used in quotation">
          <LabeledInput
            label="Target Profit / sqft"
            value={form.targetProfitPerSqft}
            onChangeText={(v) => update("targetProfitPerSqft", v)}
            suffix="₹"
          />
        </Section>

        <Pressable
          onPress={onReset}
          style={({ pressed }) => [
            styles.resetBtn,
            {
              borderColor: colors.destructive,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="rotate-ccw" size={18} color={colors.destructive} />
          <Text style={[styles.resetText, { color: colors.destructive }]}>
            Reset to defaults
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>

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
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="check" size={20} color={colors.primaryForeground} />
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
            Save Settings
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
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
  row: {
    flexDirection: "row",
    gap: 10,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  resetText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  actionBar: {
    position: "absolute",
    bottom: 84,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
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
  },
  actionText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
});
