"use client";

import { useMemo, useState } from "react";
import { Download, Trash2, X, Loader2, Sparkles, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useProjects } from "@/store/use-projects";
import { useUI } from "@/store/use-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function GeneratedModal() {
  const { generatedOpen, closeGenerated } = useUI();
  const { active, removeGenerated } = useProjects();
  const project = active();
  const items = useMemo(() => [...(project?.generated || [])].reverse(), [project]);

  const [zoomIndex, setZoomIndex] = useState(-1);

  const handleDelete = (id: string) => {
    removeGenerated(id);
    setZoomIndex(-1);
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || 'generated-image.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      // Fallback for data URLs
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'generated-image.png';
      a.click();
    }
  };

  const navigateZoom = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && zoomIndex > 0) {
      setZoomIndex(zoomIndex - 1);
    } else if (direction === 'next' && zoomIndex < items.length - 1) {
      setZoomIndex(zoomIndex + 1);
    }
  };

  return (
    <Dialog open={generatedOpen} onOpenChange={closeGenerated}>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Generated Library
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {project?.name} • {items.length} {items.length === 1 ? 'image' : 'images'}
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 p-6 overflow-auto">
          {!items.length ? (
            <div className="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center mb-6">
                <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No generated images yet</h3>
              <p className="text-sm text-center max-w-md">
                Add images and text to your canvas, then click Generate to create AI-powered visuals based on your content.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((g, i) => (
                <div
                  key={g.id}
                  className="group relative bg-card rounded-xl border border-border overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all duration-300"
                  onClick={() => setZoomIndex(i)}
                >
                  <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
                    {g.url ? (
                      <img
                        src={g.url}
                        alt={g.prompt?.slice(0, 60) || "generated"}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    )}
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-10 w-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (g.url) handleDownload(g.url, `generated-${g.id}.png`);
                        }}
                      >
                        <Download className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-10 w-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(g.id);
                        }}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-card">
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                      {g.prompt?.slice(0, 80) || "Generated image"}
                      {g.prompt && g.prompt.length > 80 ? "…" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lightbox */}
        {zoomIndex >= 0 && items[zoomIndex] && (
          <div
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center"
            onClick={() => setZoomIndex(-1)}
          >
            {/* Navigation arrows */}
            {zoomIndex > 0 && (
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateZoom('prev');
                }}
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>
            )}
            {zoomIndex < items.length - 1 && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateZoom('next');
                }}
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>
            )}

            <div
              className="relative w-full max-w-6xl mx-4 bg-card rounded-2xl border border-border overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                onClick={() => setZoomIndex(-1)}
              >
                <X className="w-5 h-5 text-white" />
              </button>

              {/* Image */}
              <div className="bg-black flex items-center justify-center min-h-[500px] max-h-[70vh]">
                {items[zoomIndex].url ? (
                  <img
                    src={items[zoomIndex].url}
                    alt="generated"
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                ) : (
                  <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Info panel */}
              <div className="p-6 border-t border-border bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium mb-2">Prompt</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-24 overflow-auto">
                      {items[zoomIndex].prompt || "No prompt recorded"}
                    </p>
                  </div>
                  
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (items[zoomIndex].url) {
                          handleDownload(items[zoomIndex].url, `generated-${items[zoomIndex].id}.png`);
                        }
                      }}
                      disabled={!items[zoomIndex].url}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(items[zoomIndex].id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
                
                {/* Image counter */}
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">
                    {zoomIndex + 1} of {items.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
