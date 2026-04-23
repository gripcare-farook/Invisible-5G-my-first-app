import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { calculateProject, fmtINR, fmtNum } from "@/lib/calculations";
import {
  SavedProject,
  deleteProject,
  loadProjects,
  newId,
  saveProject,
} from "@/lib/storage";
import { shareSummary } from "@/lib/share";

export default function ProjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await loadProjects();
    setProjects(list);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onOpen = (p: SavedProject) => {
    router.push({ pathname: "/", params: { projectId: p.id } });
  };

  const onDuplicate = async (p: SavedProject) => {
    const now = Date.now();
    const copy: SavedProject = {
      id: newId(),
      name: `${p.name} (copy)`,
      createdAt: now,
      updatedAt: now,
      openings: p.openings.map((o) => ({ ...o, id: newId() })),
      shared: { ...p.shared },
    };
    await saveProject(copy);
    reload();
  };

  const onDelete = (p: SavedProject) => {
    Alert.alert("Delete project", `Delete "${p.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteProject(p.id);
          reload();
        },
      },
    ]);
  };

  const onShare = async (p: SavedProject) => {
    const totals = calculateProject(p.openings, p.shared);
    await shareSummary(p.openings, p.shared, totals);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.primary, paddingTop: topPad + 12 },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.primaryForeground }]}>
          Saved Projects
        </Text>
        <Text style={styles.headerSubtitle}>
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </Text>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 12,
          paddingBottom: insets.bottom + 100,
          flexGrow: 1,
        }}
        scrollEnabled={projects.length > 0}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Feather
                name="folder"
                size={42}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No saved projects
              </Text>
              <Text
                style={[
                  styles.emptyText,
                  { color: colors.mutedForeground },
                ]}
              >
                Calculate a job and tap Save to keep it here.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const totals = calculateProject(item.openings, item.shared);
          const profit = totals.profitPerSqft;
          const profitColor = !item.shared.sellingPricePerSqft
            ? colors.mutedForeground
            : profit < 0
              ? colors.destructive
              : profit < 50
                ? colors.warning
                : colors.success;
          return (
            <Pressable
              onPress={() => onOpen(item)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.cardTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.cardMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {item.openings.length} opening
                    {item.openings.length === 1 ? "" : "s"} •{" "}
                    {fmtNum(totals.totalSqft)} sqft
                    {item.shared.siteLocation
                      ? ` • ${item.shared.siteLocation}`
                      : ""}
                  </Text>
                </View>
                <View
                  style={[
                    styles.profitBadge,
                    { backgroundColor: profitColor + "22" },
                  ]}
                >
                  <Text style={[styles.profitVal, { color: profitColor }]}>
                    {fmtINR(totals.totalProfit)}
                  </Text>
                  <Text style={[styles.profitLbl, { color: profitColor }]}>
                    profit
                  </Text>
                </View>
              </View>
              <View style={styles.cardStats}>
                <Stat label="Total" value={fmtINR(totals.totalCost)} />
                <Stat label="Cost/sqft" value={fmtINR(totals.costPerSqft)} />
                <Stat
                  label="Channels"
                  value={`${totals.totalChannelPieces} pcs`}
                />
              </View>
              <View
                style={[
                  styles.cardActions,
                  { borderTopColor: colors.border },
                ]}
              >
                <CardAction
                  icon="edit-2"
                  label="Open"
                  onPress={() => onOpen(item)}
                />
                <CardAction
                  icon="copy"
                  label="Duplicate"
                  onPress={() => onDuplicate(item)}
                />
                <CardAction
                  icon="share-2"
                  label="Share"
                  onPress={() => onShare(item)}
                />
                <CardAction
                  icon="trash-2"
                  label="Delete"
                  destructive
                  onPress={() => onDelete(item)}
                />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text
        style={[styles.statVal, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function CardAction({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const colors = useColors();
  const color = destructive ? colors.destructive : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Feather name={icon} size={16} color={color} />
      <Text style={[styles.actionLbl, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 22 },
  headerSubtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  cardMeta: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 3,
  },
  profitBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "flex-end",
  },
  profitVal: { fontFamily: "Inter_700Bold", fontSize: 14 },
  profitLbl: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardStats: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statBlock: { flex: 1 },
  statLbl: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statVal: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  actionLbl: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
