import { create } from "zustand";
import { v4 as uuidv4 } from "uuid"; // Use uuid instead of nanoid
import type { Node, Edge } from "@xyflow/react";
import { createClient } from "@/lib/supabase/client";

// Supabase client for store actions
const supabase = createClient();

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

export interface Preset {
  id: string;
  name: string;
  type: "theme" | "character";
  nodes: Node[];
  edges: Edge[];
  thumbnail?: string;
}

interface ProjectsState {
  projects: Project[];
  presets: Preset[];
  activeId: string | null;
  isLoading: boolean;
  
  // Actions
  init: () => Promise<void>; // Load data from Supabase
  active: () => Project;
  addProject: (name?: string) => Promise<string>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setActive: (id: string) => void;
  addAssets: (assets: Omit<Asset, "id">[]) => Promise<void>;
  setGraph: (graph: { nodes: Node[]; edges: Edge[] }) => Promise<void>;
  markGenerated: (payload: Project["lastGenerated"]) => void;
  addGenerated: (items: Omit<GeneratedItem, "id" | "createdAt">[]) => Promise<void>;
  
  savePreset: (name: string, type: "theme" | "character", nodes: Node[], edges: Edge[]) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  removeGenerated: (id: string) => Promise<void>;
}

const makeEmptyProject = (name = "Untitled", id = uuidv4()): Project => ({
  id,
  name,
  assets: [],
  nodes: [],
  edges: [],
  selectedAssetId: null,
  lastGenerated: null,
  generated: [],
});

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: [makeEmptyProject("Demo Project")], // Default demo project
  presets: [],
  activeId: null,
  isLoading: false,

  init: async () => {
    set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Projects
      const { data: dbProjects } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!dbProjects || dbProjects.length === 0) {
        // Create default project if none exist
        const newId = uuidv4();
        await supabase.from("projects").insert({ id: newId, name: "My First Project", user_id: user.id });
        set({ projects: [makeEmptyProject("My First Project", newId)], activeId: newId, isLoading: false });
        return;
      }

      // 2. Load full project details (nodes, edges, assets, etc.)
      // For simplicity, we load the active project details on demand or load all basic info now
      // Let's load everything for now (optimization: load only active project fully later)
      const projects: Project[] = [];
      
      for (const p of dbProjects) {
        // Fetch nodes
        const { data: nodes } = await supabase.from("graph_nodes").select("*").eq("project_id", p.id);
        // Fetch edges
        const { data: edges } = await supabase.from("graph_edges").select("*").eq("project_id", p.id);
        // Fetch assets
        const { data: assets } = await supabase.from("assets").select("*").eq("project_id", p.id);
        // Fetch generated
        const { data: generated } = await supabase.from("generated_images").select("*").eq("project_id", p.id);

        projects.push({
          id: p.id,
          name: p.name,
          nodes: nodes?.map(n => ({
            id: n.node_id,
            type: n.type,
            position: { x: n.position_x, y: n.position_y },
            data: n.data,
          })) || [],
          edges: edges?.map(e => ({
            id: e.edge_id,
            source: e.source_node_id,
            target: e.target_node_id,
            label: e.label,
          })) || [],
          assets: assets?.map(a => ({
            id: a.id,
            type: a.type as any,
            url: a.url,
            text: a.text_content,
            name: a.name
          })) || [],
          generated: generated?.map(g => ({
            id: g.id,
            url: g.url,
            prompt: g.prompt_text,
            createdAt: new Date(g.created_at).getTime()
          })) || [],
          selectedAssetId: null,
          lastGenerated: null
        });
      }

      set({ projects, activeId: projects[0]?.id ?? null });

      // 3. Fetch Presets
      const { data: dbPresets } = await supabase.from("presets").select("*").eq("user_id", user.id);
      if (dbPresets) {
        set({
          presets: dbPresets.map(p => ({
            id: p.id,
            name: p.name,
            type: p.type as any,
            nodes: p.nodes,
            edges: p.edges,
            thumbnail: p.thumbnail_url
          }))
        });
      }

    } catch (e) {
      console.error("Failed to init projects:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  active() {
    const { projects, activeId } = get();
    return projects.find((p) => p.id === activeId) || projects[0] || makeEmptyProject();
  },

  addProject: async (name) => {
    const id = uuidv4();
    const p = makeEmptyProject(name, id);
    
    // Optimistic update
    set((s) => ({ projects: [...s.projects, p], activeId: p.id }));

    // Persist
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("projects").insert({ id, name: name || "Untitled", user_id: user.id });
    }
    
    return id;
  },

  rename: async (id, name) => {
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
    await supabase.from("projects").update({ name }).eq("id", id);
  },

  remove: async (id) => {
    set((s) => {
      const next = s.projects.filter((p) => p.id !== id);
      return { projects: next, activeId: next[0]?.id ?? null };
    });
    await supabase.from("projects").delete().eq("id", id);
  },

  setActive(id) {
    set({ activeId: id });
  },

  addAssets: async (filesOrTexts) => {
    const p = get().active();
    const toAdd = filesOrTexts.map((a) => ({ ...a, id: uuidv4() }));
    
    set((s) => ({
      projects: s.projects.map((pr) =>
        pr.id === p.id ? { ...pr, assets: [...pr.assets, ...toAdd] } : pr
      ),
    }));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Persist assets
    const dbAssets = toAdd.map(a => ({
      id: a.id,
      project_id: p.id,
      user_id: user.id,
      type: a.type,
      url: a.url, // Note: for real file uploads, you'd upload to Storage first and get a URL
      text_content: a.text,
      name: a.name
    }));

    await supabase.from("assets").insert(dbAssets);
  },

  setGraph: async ({ nodes, edges }) => {
    const p = get().active();
    
    // Update local state immediately
    set((s) => ({
      projects: s.projects.map((pr) =>
        pr.id === p.id ? { ...pr, nodes, edges } : pr
      ),
    }));

    // Debounce saving to Supabase is handled by the caller usually, but let's do a basic save here
    // For production, use a proper debounce utility or React Query mutations
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Sync Nodes (Upsert)
    const dbNodes = nodes.map(n => ({
        project_id: p.id,
        node_id: n.id,
        type: n.type,
        position_x: n.position.x,
        position_y: n.position.y,
        data: n.data
    }));
    
    // Sync Edges
    const dbEdges = edges.map(e => ({
        project_id: p.id,
        edge_id: e.id,
        source_node_id: e.source,
        target_node_id: e.target,
        label: e.label as string
    }));

    // We delete old ones and insert new ones to keep it synced (simplest approach for graph)
    // Or upsert. Since we want to remove deleted nodes, delete-insert is safer for now
    // Optimization: In a real app, track diffs.
    
    // Using upsert might leave orphans. Let's clear for this project and re-insert.
    // Warning: This is heavy. In a high-scale app, diffing is needed.
    await supabase.from("graph_nodes").delete().eq("project_id", p.id);
    await supabase.from("graph_edges").delete().eq("project_id", p.id);
    
    if (dbNodes.length) await supabase.from("graph_nodes").insert(dbNodes);
    if (dbEdges.length) await supabase.from("graph_edges").insert(dbEdges);
  },

  markGenerated(payload) {
    const p = get().active();
    set((s) => ({
      projects: s.projects.map((pr) =>
        pr.id === p.id ? { ...pr, lastGenerated: payload } : pr
      ),
    }));
  },

  addGenerated: async (items) => {
    const p = get().active();
    const toAdd = items.map((it) => ({
      ...it,
      id: uuidv4(),
      createdAt: Date.now(),
    }));
    
    set((s) => ({
      projects: s.projects.map((pr) =>
        pr.id === p.id
          ? { ...pr, generated: [...(pr.generated || []), ...toAdd] }
          : pr
      ),
    }));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dbImages = toAdd.map(img => ({
        id: img.id,
        project_id: p.id,
        user_id: user.id,
        url: img.url,
        prompt_text: img.prompt
    }));

    await supabase.from("generated_images").insert(dbImages);
  },

  savePreset: async (name, type, nodes, edges) => {
    const newPreset: Preset = {
      id: uuidv4(),
      name,
      type,
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    set((s) => ({ presets: [...s.presets, newPreset] }));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("presets").insert({
        id: newPreset.id,
        user_id: user.id,
        name,
        type,
        nodes: newPreset.nodes,
        edges: newPreset.edges
    });
  },

  deletePreset: async (id) => {
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
    await supabase.from("presets").delete().eq("id", id);
  },

  removeGenerated: async (id) => {
    const p = get().active();
    set((s) => ({
      projects: s.projects.map((pr) =>
        pr.id === p.id
          ? { ...pr, generated: (pr.generated || []).filter((g) => g.id !== id) }
          : pr
      ),
    }));
    await supabase.from("generated_images").delete().eq("id", id);
  },
}));
