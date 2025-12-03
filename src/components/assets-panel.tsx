"use client";

import { useCallback, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Video,
  Type,
  Upload,
  Sparkles,
  GripVertical,
  Palette,
  User,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useProjects } from "@/store/use-projects";
import { useUI } from "@/store/use-ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface AssetsPanelProps {
  onOpenGenerated?: () => void;
  onDragPreset?: (preset: any) => void;
}

// Image component with error handling
function AssetImage({ src, alt }: { src?: string; alt?: string }) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!src || error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-secondary">
        <AlertTriangle className="w-4 h-4 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
        </div>
      )}
      <img
        src={src}
        alt={alt || "asset"}
        className={cn("w-full h-full object-cover", loading && "opacity-0")}
        onLoad={() => setLoading(false)}
        onError={() => {
          console.error("Failed to load image:", src);
          setError(true);
          setLoading(false);
        }}
      />
    </>
  );
}

export function AssetsPanel({ onOpenGenerated, onDragPreset }: AssetsPanelProps) {
  const { active, addAssets, removeAsset, presets, deletePreset } = useProjects();
  const { genHint, openGenerated, clearGenHint } = useUI();
  const inputRef = useRef<HTMLInputElement>(null);
  const p = active();
  const supabase = createClient();
  
  const [activeTab, setActiveTab] = useState("assets");
  const [isUploading, setIsUploading] = useState(false);

  const uploadFileToStorage = useCallback(
    async (file: File) => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        throw new Error("You must be signed in to upload assets.");
      }
      
      // Create a clean filename
      const ext = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const path = `${user.id}/library/${timestamp}-${randomId}.${ext}`;
      
      console.log("Uploading file to path:", path);
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("assets")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        
      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }
      
      console.log("Upload successful:", uploadData);
      
      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      console.log("Public URL:", urlData.publicUrl);
      
      return urlData.publicUrl;
    },
    [supabase]
  );

  const onFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (!fileArray.length) return;
      
      setIsUploading(true);
      
      try {
        const uploads: { type: "image" | "video"; url: string; name: string }[] = [];
        
        for (const file of fileArray) {
          console.log("Processing file:", file.name, file.type);
          
          if (file.type.startsWith("image/")) {
            const url = await uploadFileToStorage(file);
            uploads.push({ type: "image", url, name: file.name });
          } else if (file.type.startsWith("video/")) {
            const url = await uploadFileToStorage(file);
            uploads.push({ type: "video", url, name: file.name });
          }
        }
        
        if (uploads.length) {
          console.log("Adding assets to store:", uploads);
          await addAssets(uploads);
        }
      } catch (err) {
        console.error("Upload failed:", err);
        alert("Failed to upload: " + (err instanceof Error ? err.message : "Unknown error"));
      } finally {
        setIsUploading(false);
      }
    },
    [addAssets, uploadFileToStorage]
  );

  const onAddText = () => {
    const text = prompt(
      'Describe a trait, style, or instruction (e.g. "moody lighting, cyberpunk city, f/1.8 bokeh")'
    );
    if (!text) return;
    addAssets([{ type: "text", text }]);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    await onFiles(e.dataTransfer.files);
  };

  const handleOpenGenerated = () => {
    openGenerated();
    clearGenHint();
    onOpenGenerated?.();
  };

  return (
    <div
      className="h-full flex flex-col bg-card rounded-2xl border border-border overflow-hidden shadow-sm"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/20">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Library
        </h3>
      </div>

      {/* Tabs for Assets vs Themes */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-4">
          <TabsList className="w-full grid grid-cols-2 bg-secondary/50">
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="presets">Themes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="assets" className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
          {/* Dropzone */}
          <div
            className="group border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/50 transition-all duration-200"
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Uploading assets…</p>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-sm text-muted-foreground">
                  Drop images or videos
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  or click to browse
                </p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={async (e) => {
                if (e.target.files) {
                  await onFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
          </div>

          {/* Add Text Button */}
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={onAddText}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Text Trait
          </Button>

          {/* Library List */}
          <div className="space-y-2">
            {p.assets.map((a) => (
              <div
                key={a.id}
                className="group flex items-center gap-3 p-2 bg-background rounded-xl border border-border hover:border-primary/30 cursor-grab active:cursor-grabbing transition-all duration-200 shadow-sm"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/x-asset",
                    JSON.stringify(
                      a.type === "text"
                        ? { type: "text", text: a.text }
                        : { type: a.type, name: a.name, url: a.url }
                    )
                  );
                }}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {a.type === "image" && (
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-secondary border border-border flex-shrink-0 relative">
                    <AssetImage src={a.url} alt={a.name} />
                  </div>
                )}
                {a.type === "video" && (
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-secondary border border-border flex-shrink-0 flex items-center justify-center">
                    <Video className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                {a.type === "text" && (
                  <div className="w-10 h-10 rounded-md bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                    <Type className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">
                    {a.type === "text"
                      ? a.text?.slice(0, 30) + (a.text && a.text.length > 30 ? "…" : "")
                      : a.name || a.type}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {a.type}
                  </p>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAsset(a.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {p.assets.length === 0 && (
              <div className="text-center py-8 px-4">
                <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3">
                  <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Your asset library is empty
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="presets" className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
          <div className="space-y-3">
             <div className="p-4 bg-secondary/30 rounded-lg border border-border text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  Save selections from the graph to create reusable themes.
                </p>
             </div>
            
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="group relative flex items-center gap-3 p-3 bg-background rounded-xl border border-border hover:border-primary/50 cursor-grab active:cursor-grabbing transition-all duration-200 shadow-sm"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-preset", JSON.stringify(preset));
                }}
              >
                <div className={cn(
                  "w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 border border-border",
                  preset.type === 'theme' ? "bg-purple-500/10 text-purple-500" : "bg-orange-500/10 text-orange-500"
                )}>
                  {preset.type === 'theme' ? <Palette className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">
                    {preset.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {preset.nodes.length} Nodes • {preset.type}
                  </p>
                </div>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePreset(preset.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            {presets.length === 0 && (
               <p className="text-sm text-muted-foreground text-center py-8">
                 No saved themes yet. Select nodes in the graph and click "Save as Theme".
               </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-background">
        <Button
          variant="default"
          className="w-full relative bg-gradient-to-r from-primary to-primary/90 hover:to-primary text-primary-foreground shadow-md"
          onClick={handleOpenGenerated}
        >
          {genHint && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 animate-pulse border-2 border-background" />
          )}
          <Sparkles className="w-4 h-4 mr-2" />
          Generated Library
        </Button>
        {genHint && (
          <p className="text-xs text-center text-muted-foreground mt-2 animate-fade-in">
            Generating...
          </p>
        )}
      </div>
    </div>
  );
}
