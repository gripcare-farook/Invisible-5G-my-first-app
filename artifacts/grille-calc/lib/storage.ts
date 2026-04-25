import AsyncStorage from "@react-native-async-storage/async-storage";
import { Opening, SharedInputs } from "./calculations";

const KEY_SETTINGS = "@grille/settings_v1";
const KEY_PROJECTS = "@grille/projects_v2";

export interface Settings {
  baseLocation: string;
  wireCostPerMeter: number;
  labourCostPerSqft: number;
  channelCostPerPiece: number;
  fastenerCostPerPiece: number;
  stiffnerCostPerPiece: number;
  stiffnerCostPerMeter: number;
  costPerKm: number;
  targetProfitPerSqft: number;
}

export const DEFAULT_SETTINGS: Settings = {
  baseLocation: "Tambaram, Chennai",
  wireCostPerMeter: 10,
  labourCostPerSqft: 40,
  channelCostPerPiece: 1100,
  fastenerCostPerPiece: 15,
  stiffnerCostPerPiece: 2,
  stiffnerCostPerMeter: 80,
  costPerKm: 25,
  targetProfitPerSqft: 100,
};

export interface SavedProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  openings: Opening[];
  shared: SharedInputs;
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
}

export async function loadProjects(): Promise<SavedProject[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PROJECTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedProject[];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function saveProject(p: SavedProject): Promise<void> {
  const all = await loadProjects();
  const idx = all.findIndex((x) => x.id === p.id);
  if (idx >= 0) all[idx] = p;
  else all.push(p);
  await AsyncStorage.setItem(KEY_PROJECTS, JSON.stringify(all));
}

export async function deleteProject(id: string): Promise<void> {
  const all = await loadProjects();
  const next = all.filter((x) => x.id !== id);
  await AsyncStorage.setItem(KEY_PROJECTS, JSON.stringify(next));
}

export function newId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}
