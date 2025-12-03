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
  Settings2,
  Download,
  Sparkles,
  Palette,
  User
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

const nodeTypes = {
  imageNode: ImageNode,
  textNode: TextNode,
};

// ... (rest of the file remains unchanged)

const EDGE_COLOR = "var(--muted-foreground)";

// Helper functions
async function objectUrlToBase64(url: string) {
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const buf = await blob.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return { base64: btoa(binary), mime: blob.type || "image/png" };
  } catch (e) {
    console.warn("Failed to convert blob to base64", e);
    return null;
  }
}

function normLine(s: string) {
  return s.replace(/\s+/g, " ").replace(/\s([,.;:!?])/g, "$1").trim();
}
function dedupeLines(lines: string[]) {
  const seen = new Set<string>();
  return lines.filter((l) => {
    const k = l.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function buildSimplePrompt(nodes: Node[]) {
  const texts = nodes
    .filter(n => n.type === 'textNode')
    .map(n => (n.data?.text as string) || "")
    .join(", ");
  const imgs = nodes.filter(n => n.type === 'imageNode').map(n => (n.data?.alt as string) || "image").join(", ");
  return [texts, imgs].filter(Boolean).join(" ");
}

function GraphInner({ projectId = "default" }: { projectId?: string; onRequestGenerate?: any }) {
  const { setGraph: setGraphStore, markGenerated: markGeneratedStore, addGenerated, savePreset } = useProjects();
  const { setGenHint } = useUI();
  const storageKey = `fuseboard-graph:${projectId}`;
  const reactFlowInstance = useReactFlow();

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetType, setPresetType] = useState<"theme" | "character">("theme");

  const saved = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const [nodes, setNodes, onNodesChange] = useNodesState(saved?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved?.edges || []);
  
  const [connectLabel, setConnectLabel] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) || null, [nodes, selectedId]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [promptPreview, setPromptPreview] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    try {
        const slimNodes = nodes.map(n => n.type === 'imageNode' ? {...n, data: {...n.data, src: null}} : n);
        localStorage.setItem(storageKey, JSON.stringify({ nodes: slimNodes, edges, v: 1 }));
    } catch (e) { console.warn("Storage full"); }
  }, [storageKey, nodes, edges]);

  useEffect(() => {
    setGraphStore({ nodes, edges });
  }, [nodes, edges, setGraphStore]);

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
    const pos = reactFlowInstance.screenToFlowPosition({ x: window.innerWidth/2, y: window.innerHeight/2 });
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "textNode",
        position: { x: pos.x + Math.random()*50, y: pos.y + Math.random()*50 },
        data: { text: "New descriptor", tags: [] },
      },
    ]);
  }, [setNodes, reactFlowInstance]);

  const addImageNode = useCallback(() => fileRef.current?.click(), []);
  const createImageNodeFromFile = useCallback((file: File, pos?: { x: number; y: number }) => {
      const id = nanoid(8);
      const objectUrl = URL.createObjectURL(file);
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: "imageNode",
          position: pos || { x: 100, y: 100 },
          data: { src: objectUrl, srcKind: "objectURL", alt: file.name, note: "" },
        },
      ]);
    }, [setNodes]);

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
    if (!selected) return;
    setEdges((eds) => eds.filter((e) => e.source !== selected.id && e.target !== selected.id));
    setNodes((nds) => nds.filter((n) => n.id !== selected.id));
    setSelectedId(null);
  }, [selected, setEdges, setNodes]);

  const handleRefinePrompt = useCallback(async () => {
    setIsRefining(true);
    try {
        const crudePrompt = buildSimplePrompt(nodes);
        const res = await fetch('/api/refine', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: crudePrompt })
        });
        const data = await res.json();
        if (data.refined) {
            setPromptPreview(data.refined);
        } else {
            setPromptPreview(crudePrompt);
        }
    } catch (e) {
        console.error(e);
        setPromptPreview(buildSimplePrompt(nodes));
    } finally {
        setIsRefining(false);
    }
  }, [nodes]);

  const handleGenerate = useCallback(async () => {
      const prompt = promptPreview.trim() || buildSimplePrompt(nodes);
      if (!prompt) {
          alert("Please add some nodes or text first!");
          return;
      }
      
      setIsGenerating(true);
      setGenHint(true);

      try {
          const res = await fetch('/api/generate', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ 
                  prompt, 
                  provider: 'pollinations' 
              })
          });
          const data = await res.json();
          if (data.images) {
              addGenerated(data.images.map((img: any) => ({
                  url: img.url,
                  prompt,
              })));
          } else {
              throw new Error(data.error || "No images returned");
          }
      } catch (e) {
          alert("Generation failed: " + e);
      } finally {
          setIsGenerating(false);
      }
  }, [promptPreview, nodes, addGenerated, setGenHint]);

  const onDragOver = useCallback((evt: React.DragEvent) => {
    evt.preventDefault();
    evt.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback((evt: React.DragEvent) => {
      evt.preventDefault();
      const bounds = evt.currentTarget.getBoundingClientRect();
      const pos = reactFlowInstance.screenToFlowPosition({ x: evt.clientX, y: evt.clientY });

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

      const assetPayload = evt.dataTransfer.getData("application/x-asset");
      if (assetPayload) {
        try {
          const asset = JSON.parse(assetPayload);
          if (asset.type === "image" && asset.blobUrl) {
            const id = nanoid(8);
            setNodes((nds) => [...nds, {
                id, type: "imageNode", position: pos,
                data: { src: asset.blobUrl, srcKind: "objectURL", alt: asset.name || "image" },
            }]);
            return;
          }
          if (asset.type === "text" && asset.text) {
            const id = nanoid(8);
            setNodes((nds) => [...nds, {
                id, type: "textNode", position: pos,
                data: { text: asset.text, tags: asset.tags || [] },
            }]);
            return;
          }
        } catch {}
      }
      
      if (evt.dataTransfer.files?.length) {
          createImageNodeFromFile(evt.dataTransfer.files[0], pos);
      }
    }, [createImageNodeFromFile, setNodes, reactFlowInstance]);

    const handleSavePreset = () => {
        if (!presetName) return;
        const nodesToSave = selected ? [selected] : nodes;
        savePreset(presetName, presetType, nodes, edges);
        setSaveDialogOpen(false);
        setPresetName("");
    };

  return (
    <div className="h-full w-full relative">
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
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-destructive" onClick={() => setNodes([])}>
                Reset Canvas
            </Button>
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4 z-10 w-80 glass rounded-xl shadow-lg border border-border/50 flex flex-col max-h-[calc(100%-32px)]">
        <div className="flex items-center justify-between p-3 border-b border-border/50 bg-card/50 rounded-t-xl">
          <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">Inspector</h3>
          <button onClick={() => setRightOpen((v) => !v)} className="p-1 hover:bg-secondary rounded-md transition-colors">
            {rightOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        
        {rightOpen && (
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
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
                    placeholder="Describe your vision or use Refine to auto-generate..."
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
            </div>

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
                        <div className="space-y-2">
                             <Input 
                                value={selected.data.alt as string}
                                onChange={e => updateSelectedData({alt: e.target.value})}
                                placeholder="Image name/role..."
                                className="h-8"
                            />
                             <Textarea 
                                value={selected.data.note as string || ""} 
                                onChange={e => updateSelectedData({note: e.target.value})}
                                className="text-xs min-h-[60px]"
                                placeholder="Notes for AI..."
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

export function Graph(props: any) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
