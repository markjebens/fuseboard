import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Node, Edge } from "@xyflow/react";

export interface Asset {
  id: string;
  type: "image" | "video" | "text";
  url?: string;
  text?: string;
  name?: string;
}

export interface GeneratedItem {
  id: string;
  url: string;
  prompt?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  assets: Asset[];
  nodes: Node[];
  edges: Edge[];
  selectedAssetId: string | null;
  lastGenerated: {
    prompt: string;
    imageRefs: { id: string; alt: string; src: string }[];
    ts: number;
  } | null;
  generated: GeneratedItem[];
}

// ✅ NEW: Theme/Character Preset Interface
export interface Preset {
  id: string;
  name: string;
  type: "theme" | "character";
  nodes: Node[]; // The subgraph that makes up this theme
  edges: Edge[];
  thumbnail?: string;
}

interface ProjectsState {
  projects: Project[];
  presets: Preset[]; // ✅ Global library of presets
  activeId: string | null;
  active: () => Project;
  addProject: (name?: string) => string;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  setActive: (id: string) => void;
  addAssets: (assets: Omit<Asset, "id">[]) => void;
  setGraph: (graph: { nodes: Node[]; edges: Edge[] }) => void;
  markGenerated: (payload: Project["lastGenerated"]) => void;
  addGenerated: (items: Omit<GeneratedItem, "id" | "createdAt">[]) => void;
  
  // ✅ Preset Actions
  savePreset: (name: string, type: "theme" | "character", nodes: Node[], edges: Edge[]) => void;
  deletePreset: (id: string) => void;
}

const makeEmptyProject = (name = "Untitled"): Project => ({
  id: nanoid(),
  name,
  assets: [],
  nodes: [],
  edges: [],
  selectedAssetId: null,
  lastGenerated: null,
  generated: [],
});

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: [makeEmptyProject("Campaign 1")],
  presets: [],
  activeId: null,

  active() {
    const { projects, activeId } = get();
    return projects.find((p) => p.id === activeId) || projects[0];
  },

  addProject(name) {
    const p = makeEmptyProject(name);
    set((s) => ({ projects: [...s.projects, p], activeId: p.id }));
    return p.id;
  },

  rename(id, name) {
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
  },

  remove(id) {
    set((s) => {
      const next = s.projects.filter((p) => p.id !== id);
      return { projects: next, activeId: next[0]?.id ?? null };
    });
  },

  setActive(id) {
    set({ activeId: id });
  },

  addAssets(filesOrTexts) {
    const p = get().active();
    const toAdd = filesOrTexts.map((a) => ({ ...a, id: nanoid() }));
    set((s) => ({
      projects: s.projects.map((pr) =>
        pr.id === p.id ? { ...pr, assets: [...pr.assets, ...toAdd] } : pr
      ),
    }));
  },

  setGraph({ nodes, edges }) {
    const p = get().active();
    set((s) => ({
      projects: s.projects.map((pr) =>
        pr.id === p.id ? { ...pr, nodes, edges } : pr
      ),
    }));
  },

  markGenerated(payload) {
    const p = get().active();
    set((s) => ({
      projects: s.projects.map((pr) =>
        pr.id === p.id ? { ...pr, lastGenerated: payload } : pr
      ),
    }));
  },

  addGenerated(items) {
    const p = get().active();
    const toAdd = items.map((it) => ({
      ...it,
      id: nanoid(),
      createdAt: Date.now(),
    }));
    set((s) => ({
      projects: s.projects.map((pr) =>
        pr.id === p.id
          ? { ...pr, generated: [...(pr.generated || []), ...toAdd] }
          : pr
      ),
    }));
  },

  savePreset(name, type, nodes, edges) {
    const newPreset: Preset = {
      id: nanoid(),
      name,
      type,
      nodes: JSON.parse(JSON.stringify(nodes)), // Deep copy
      edges: JSON.parse(JSON.stringify(edges)),
    };
    set((s) => ({ presets: [...s.presets, newPreset] }));
  },

  deletePreset(id) {
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
  },
}));
