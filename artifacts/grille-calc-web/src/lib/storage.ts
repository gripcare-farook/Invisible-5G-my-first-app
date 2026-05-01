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
  appsScriptUrl: string;
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
  appsScriptUrl: "",
};

export interface SavedProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  openings: Opening[];
  shared: SharedInputs;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
}

export function loadProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(KEY_PROJECTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedProject[];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveProject(p: SavedProject): void {
  const all = loadProjects();
  const idx = all.findIndex((x) => x.id === p.id);
  if (idx >= 0) all[idx] = p;
  else all.push(p);
  localStorage.setItem(KEY_PROJECTS, JSON.stringify(all));
}

export function deleteProject(id: string): void {
  const all = loadProjects();
  const next = all.filter((x) => x.id !== id);
  localStorage.setItem(KEY_PROJECTS, JSON.stringify(next));
}

export function newId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}
