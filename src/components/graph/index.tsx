"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nanoid } from "nanoid";
import {
  Plus,
  Image as ImageIcon,
  Type,
  Zap,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Wand2,
  Save,
  Sparkles,
  Palette,
  User,
} from "lucide-react";

import { useProjects } from "@/store/use-projects";
import { useUI } from "@/store/use-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImageNode } from "./image-node";
import { TextNode } from "./text-node";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

const nodeTypes = {
  imageNode: ImageNode,
  textNode: TextNode,
};

const supabase = createClient();

// Upload helper
async function uploadMediaToStorage(file: File) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Please sign in again.");

  const ext = file.name.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const path = `${user.id}/canvas/${timestamp}-${randomId}.${ext}`;
  
  const { error: uploadError } = await supabase.storage
    .from("assets")
    .upload(path, file, { cacheControl: "3600", upsert: false });
    
  if (uploadError) throw uploadError;
  
  const { data } = supabase.storage.from("assets").getPublicUrl(path);
  return data.publicUrl;
}

// Build prompt from nodes
function buildSimplePrompt(nodes: Node[]) {
  const texts = nodes
    .filter(n => n.type === 'textNode')
    .map(n => (n.data?.text as string) || "")
    .filter(Boolean);
  const imgs = nodes
    .filter(n => n.type === 'imageNode')
    .map(n => (n.data?.alt as string) || "image reference")
    .filter(Boolean);
  return [...texts, ...imgs].join(", ");
}

function GraphInner() {
  const { 
    active, 
    activeId,
    setGraph: setGraphStore, 
    addGenerated, 
    savePreset 
  } = useProjects();
  const { setGenHint, openGenerated } = useUI(); 
  const reactFlowInstance = useReactFlow();

  // Get the active project
  const project = active();

  // UI State
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetType, setPresetType] = useState<"theme" | "character">("theme");
  const [connectLabel, setConnectLabel] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [promptPreview, setPromptPreview] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  // React Flow state - initialize empty, will sync from project
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  // Track which project we're synced to
  const syncedProjectIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // CRITICAL: Sync nodes/edges ONLY when project changes (not when store updates from local changes)
  useEffect(() => {
    const currentProjectId = project?.id;
    
    // Only sync when switching to a different project
    if (currentProjectId && currentProjectId !== syncedProjectIdRef.current) {
      const currentNodes = project?.nodes || [];
      const currentEdges = project?.edges || [];
      
      console.log("Syncing canvas to project:", currentProjectId, 
                  "nodes:", currentNodes.length, 
                  "edges:", currentEdges.length);
      
      // Clear any pending saves for old project
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      
      // Update React Flow state
      setNodes(currentNodes);
      setEdges(currentEdges);
      syncedProjectIdRef.current = currentProjectId;
      
      // Clear prompt preview for new project
      setPromptPreview("");
      setSelectedId(null);
    }
  }, [project?.id, setNodes, setEdges]);

  // Save to store with debounce
  useEffect(() => {
    const currentProjectId = syncedProjectIdRef.current;
    
    // Don't save if we haven't synced yet or if project just changed
    if (!currentProjectId || currentProjectId !== project?.id) {
      return;
    }
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce save - capture projectId at save time
    saveTimeoutRef.current = setTimeout(() => {
      console.log("Saving graph for project:", currentProjectId, "nodes:", nodes.length);
      setGraphStore({ nodes, edges, projectId: currentProjectId });
    }, 1500);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges, project?.id, setGraphStore]);

  // Computed
  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) || null, [nodes, selectedId]);

  // Handlers
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            label: connectLabel || undefined,
            animated: true,
            style: { stroke: "var(--muted-foreground)", strokeWidth: 2 },
            labelBgStyle: { fill: "var(--background)", fillOpacity: 0.8 },
            labelStyle: { fill: "var(--foreground)", fontSize: 11, fontWeight: 500 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--muted-foreground)" },
          },
          eds
        )
      ),
    [setEdges, connectLabel]
  );

  const addTextNode = useCallback(() => {
    const id = nanoid(8);
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "textNode",
        position: { x: 200, y: 200 }, 
        data: { text: "New descriptor", tags: [] },
      },
    ]);
  }, [setNodes]);

  const addImageNode = useCallback(() => fileRef.current?.click(), []);
  
  const createImageNodeFromFile = useCallback(
    async (file: File, pos?: { x: number; y: number }) => {
      const id = nanoid(8);
      const objectUrl = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

      // Add node with temporary blob URL
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: "imageNode",
          position: pos || { x: 100, y: 100 },
          data: { src: objectUrl, alt: cleanName, note: "", uploading: true },
        },
      ]);

      try {
        // Upload to Supabase
        const publicUrl = await uploadMediaToStorage(file);
        URL.revokeObjectURL(objectUrl);
        
        // Update node with permanent URL
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, src: publicUrl, uploading: false } } : n
          )
        );
      } catch (err) {
        console.error("Failed to upload image", err);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, uploadError: true, uploading: false } } : n
          )
        );
      }
    },
    [setNodes]
  );

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    createImageNodeFromFile(file);
    e.target.value = "";
  }, [createImageNodeFromFile]);

  const onSelectionChange = useCallback(({ nodes: n }: { nodes: Node[] }) => {
    setSelectedId(n && n.length ? n[0].id : null);
  }, []);

  const updateSelectedData = useCallback((patch: Record<string, unknown>) => {
    if (!selected) return;
    setNodes((nds) => nds.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, [selected, setNodes]);

  const deleteSelected = useCallback(() => {
    const idToDelete = selectedId;
    if (!idToDelete) {
      console.log("No node selected to delete");
      return;
    }
    
    console.log("Deleting node:", idToDelete);
    
    // Clear selection first
    setSelectedId(null);
    
    // Remove edges connected to this node
    setEdges((currentEdges) => {
      const filtered = currentEdges.filter((e) => e.source !== idToDelete && e.target !== idToDelete);
      console.log("Edges after delete:", filtered.length);
      return filtered;
    });
    
    // Remove the node
    setNodes((currentNodes) => {
      const filtered = currentNodes.filter((n) => n.id !== idToDelete);
      console.log("Nodes after delete:", filtered.length);
      return filtered;
    });
  }, [selectedId, setEdges, setNodes]);

  // AI Features
  const handleRefinePrompt = useCallback(async () => {
    setIsRefining(true);
    try {
      const crudePrompt = buildSimplePrompt(nodes);
      if (!crudePrompt) {
        setPromptPreview("Add some nodes to the canvas first!");
        setIsRefining(false);
        return;
      }
      
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ prompt: crudePrompt })
      });
      const data = await res.json();
      setPromptPreview(data.refined || crudePrompt);
    } catch (e) {
      console.error(e);
      setPromptPreview(buildSimplePrompt(nodes));
    } finally {
      setIsRefining(false);
    }
  }, [nodes]);

  const handleGenerate = useCallback(async () => {
    const prompt = promptPreview.trim() || buildSimplePrompt(nodes);
    if (!prompt && nodes.length === 0) {
      alert("Please add some nodes or write a prompt first!");
      return;
    }
    
    setIsGenerating(true);
    setGenHint(true);
    setLastStatus(null);

    try {
      // Collect ALL image references from canvas nodes
      const imageRefs = nodes
        .filter(n => n.type === 'imageNode' && n.data?.src)
        .map(n => ({
          url: n.data.src as string,
          alt: (n.data.alt as string) || 'reference image',
          note: (n.data.note as string) || ''
        }))
        .filter(img => !img.url.startsWith('blob:')); // Only use uploaded images
      
      // Collect ALL node data for context (including Whisk-style roles)
      const nodeData = nodes.map(n => ({
        type: n.type || 'unknown',
        text: n.data?.text as string,
        alt: n.data?.alt as string,
        note: n.data?.note as string,
        src: n.data?.src as string,
        role: n.data?.role as string // Whisk-style role: subject, scene, style, reference
      }));
      
      // Collect edge/connection data
      const edgeData = edges.map(e => ({
        source: e.source,
        target: e.target,
        label: e.label as string
      }));
      
      console.log("Generating with:", { 
        prompt, 
        images: imageRefs.length,
        nodes: nodeData.length,
        edges: edgeData.length
      });
      
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
          prompt: prompt || "Generate based on the canvas content",
          images: imageRefs,
          nodes: nodeData,
          edges: edgeData
        })
      });
      
      const data = await res.json();
      console.log("Generation result:", data);

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.images && data.images.length > 0) {
        await addGenerated(data.images.map((img: any) => ({
          url: img.url,
          prompt: prompt || "Canvas-based generation",
        })));
        setLastStatus(`✓ Generated via Gemini!`);
        openGenerated();
      } else {
        throw new Error("No images returned");
      }
    } catch (e: any) {
      console.error("Generation failed:", e);
      setLastStatus("✗ Failed");
      alert("Generation failed: " + (e.message || e));
    } finally {
      setIsGenerating(false);
    }
  }, [promptPreview, nodes, edges, addGenerated, setGenHint, openGenerated]);

  // Drag & Drop
  const onDragOver = useCallback((evt: React.DragEvent) => {
    evt.preventDefault();
    evt.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(async (evt: React.DragEvent) => {
    evt.preventDefault();
    const pos = reactFlowInstance.screenToFlowPosition({ x: evt.clientX, y: evt.clientY });

    // Handle preset drops
    const presetPayload = evt.dataTransfer.getData("application/x-preset");
    if (presetPayload) {
      try {
        const preset = JSON.parse(presetPayload);
        const newNodes = preset.nodes.map((n: any) => ({
          ...n,
          id: nanoid(),
          position: { x: n.position.x + pos.x, y: n.position.y + pos.y },
          selected: true
        }));
        setNodes((nds) => [...nds, ...newNodes]);
        return;
      } catch {}
    }

    // Handle asset drops
    const assetPayload = evt.dataTransfer.getData("application/x-asset");
    if (assetPayload) {
      try {
        const asset = JSON.parse(assetPayload);
        if (asset.type === "image" && asset.url) {
          setNodes((nds) => [
            ...nds,
            {
              id: nanoid(8),
              type: "imageNode",
              position: pos,
              data: { src: asset.url, alt: asset.name || "image" },
            },
          ]);
          return;
        }
        if (asset.type === "text" && asset.text) {
          setNodes((nds) => [
            ...nds,
            {
              id: nanoid(8),
              type: "textNode",
              position: pos,
              data: { text: asset.text, tags: asset.tags || [] },
            },
          ]);
          return;
        }
      } catch {}
    }
    
    // Handle file drops
    if (evt.dataTransfer.files?.length) {
      await createImageNodeFromFile(evt.dataTransfer.files[0], pos);
    }
  }, [createImageNodeFromFile, setNodes, reactFlowInstance]);

  const handleSavePreset = () => {
    if (!presetName) return;
    savePreset(presetName, presetType, nodes, edges);
    setSaveDialogOpen(false);
    setPresetName("");
  };

  const handleResetCanvas = () => {
    if (nodes.length > 0 && !confirm("Clear all nodes from the canvas?")) return;
    setNodes([]);
    setEdges([]);
  };

  return (
    <div className="h-full w-full relative">
      {/* Left control panel */}
      <div className="absolute top-4 left-4 z-10 w-64 glass rounded-xl shadow-sm border border-border/50">
        <div className="flex items-center justify-between p-3 border-b border-border/50 bg-card/50 rounded-t-xl">
          <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">Tools</h3>
          <button onClick={() => setLeftOpen((v) => !v)} className="p-1 hover:bg-secondary rounded-md transition-colors">
            {leftOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        {leftOpen && (
          <div className="p-3 space-y-2">
            <Button variant="ghost" className="w-full justify-start h-9" onClick={addTextNode}>
              <Type className="w-4 h-4 mr-2 text-primary" />
              Add Descriptor
            </Button>
            <Button variant="ghost" className="w-full justify-start h-9" onClick={addImageNode}>
              <ImageIcon className="w-4 h-4 mr-2 text-primary" />
              Add Image
            </Button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            
            <div className="h-px bg-border/50 my-2" />
            
            <div className="pt-1">
              <label className="text-[10px] text-muted-foreground mb-1.5 block uppercase tracking-wide">Connection Label</label>
              <Input
                placeholder="relationship..."
                value={connectLabel}
                onChange={(e) => setConnectLabel(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <Button variant="outline" size="sm" className="w-full mt-2 text-xs" onClick={() => setSaveDialogOpen(true)}>
              <Save className="w-3 h-3 mr-2" />
              Save as Theme
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-destructive" onClick={handleResetCanvas}>
              Reset Canvas
            </Button>
          </div>
        )}
      </div>

      {/* Right inspector panel */}
      <div className="absolute top-4 right-4 z-10 w-80 glass rounded-xl shadow-lg border border-border/50 flex flex-col max-h-[calc(100%-32px)]">
        <div className="flex items-center justify-between p-3 border-b border-border/50 bg-card/50 rounded-t-xl">
          <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">Inspector</h3>
          <button onClick={() => setRightOpen((v) => !v)} className="p-1 hover:bg-secondary rounded-md transition-colors">
            {rightOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        
        {rightOpen && (
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* AI Prompt Section */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h4 className="font-medium text-sm">AI Prompt Agent</h4>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPromptPreview("")}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              
              <Textarea 
                value={promptPreview}
                onChange={e => setPromptPreview(e.target.value)}
                placeholder="Describe your vision or use Refine to auto-generate from canvas..."
                className="text-xs min-h-[100px] bg-background/50 resize-none"
              />
              
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="text-xs h-8"
                  onClick={handleRefinePrompt}
                  disabled={isRefining}
                >
                  {isRefining ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Wand2 className="w-3 h-3 mr-2" />}
                  Refine
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="text-xs h-8 bg-foreground text-background hover:bg-foreground/90"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Zap className="w-3 h-3 mr-2" />}
                  Generate
                </Button>
              </div>
              {lastStatus && (
                <div className={cn("text-[10px] text-center font-medium", lastStatus.includes("✓") ? "text-green-500" : "text-red-500")}>
                  {lastStatus}
                </div>
              )}
            </div>

            {/* Node Editor */}
            {selected ? (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Editing: {selected.type}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={deleteSelected}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                
                {selected.type === 'textNode' && (
                  <Textarea 
                    value={selected.data.text as string} 
                    onChange={e => updateSelectedData({text: e.target.value})}
                    className="text-sm min-h-[80px]"
                    placeholder="Enter descriptor..."
                  />
                )}
                {selected.type === 'imageNode' && (
                  <div className="space-y-3">
                    {/* Whisk-style Role Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Image Role (Whisk-style)</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { value: 'subject', label: 'Subject', icon: '👤', color: 'bg-blue-500/10 border-blue-500/30 text-blue-600' },
                          { value: 'scene', label: 'Scene', icon: '🏔️', color: 'bg-green-500/10 border-green-500/30 text-green-600' },
                          { value: 'style', label: 'Style', icon: '🎨', color: 'bg-purple-500/10 border-purple-500/30 text-purple-600' },
                          { value: 'reference', label: 'Reference', icon: '📷', color: 'bg-muted border-border text-muted-foreground' },
                        ].map(role => (
                          <button
                            key={role.value}
                            onClick={() => updateSelectedData({ role: role.value })}
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all",
                              (selected.data.role || 'reference') === role.value
                                ? role.color + " ring-2 ring-offset-1 ring-offset-background"
                                : "bg-background border-border hover:bg-muted"
                            )}
                          >
                            <span>{role.icon}</span>
                            <span>{role.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <Input 
                      value={selected.data.alt as string || ''}
                      onChange={e => updateSelectedData({alt: e.target.value})}
                      placeholder="Describe what this image shows..."
                      className="h-8"
                    />
                    <Textarea 
                      value={selected.data.note as string || ""} 
                      onChange={e => updateSelectedData({note: e.target.value})}
                      className="text-xs min-h-[60px]"
                      placeholder="Additional details for AI..."
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground border-2 border-dashed border-border rounded-xl">
                Select a node to edit
              </div>
            )}
          </div>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        onDragOver={onDragOver}
        onDrop={onDrop}
        className="bg-background"
      >
        <MiniMap className="!bg-card !border-border rounded-lg" />
        <Controls className="!bg-card !border-border !text-foreground rounded-lg overflow-hidden" />
        <Background color="var(--border)" gap={24} size={1} variant={BackgroundVariant.Dots} />
      </ReactFlow>

      {/* Save Preset Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Theme / Character</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="e.g. Noir Detective Style" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <div className="flex gap-2">
                <Button 
                  variant={presetType === 'theme' ? 'default' : 'outline'} 
                  onClick={() => setPresetType('theme')}
                  className="flex-1"
                >
                  <Palette className="w-4 h-4 mr-2" /> Theme
                </Button>
                <Button 
                  variant={presetType === 'character' ? 'default' : 'outline'} 
                  onClick={() => setPresetType('character')}
                  className="flex-1"
                >
                  <User className="w-4 h-4 mr-2" /> Character
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSavePreset}>Save to Library</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Graph() {
  return (
    <ReactFlowProvider>
      <GraphInner />
    </ReactFlowProvider>
  );
}
