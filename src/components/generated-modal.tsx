"use client";

import { useMemo, useState } from "react";
import { Download, Trash2, X, Loader2 } from "lucide-react";
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
  const items = useMemo(() => project?.generated || [], [project]);

  const [zoomIndex, setZoomIndex] = useState(-1);

  const handleDelete = (id: string) => {
    removeGenerated(id);
    setZoomIndex(-1);
  };

  return (
    <Dialog open={generatedOpen} onOpenChange={closeGenerated}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="text-lg font-semibold">
            {project?.name || "Project"} — Generated Library
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
          {!items.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <p className="text-sm">
                Generated content will appear here while it&apos;s being created…
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((g, i) => (
                <div
                  key={g.id}
                  className="group relative bg-surface rounded-xl border border-border overflow-hidden cursor-pointer hover:border-primary/30 transition-all duration-200"
                  onClick={() => setZoomIndex(i)}
                >
                  <div className="aspect-square bg-background flex items-center justify-center">
                    {g.url ? (
                      <img
                        src={g.url}
                        alt={g.prompt?.slice(0, 60) || "generated"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {g.prompt?.slice(0, 100) || "—"}
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
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setZoomIndex(-1)}
          >
            <div
              className="relative max-w-5xl w-full max-h-[90vh] bg-card rounded-2xl border border-border overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                onClick={() => setZoomIndex(-1)}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="bg-background flex items-center justify-center min-h-[400px] max-h-[60vh] overflow-hidden">
                {items[zoomIndex].url ? (
                  <img
                    src={items[zoomIndex].url}
                    alt="generated"
                    className="max-w-full max-h-[60vh] object-contain"
                  />
                ) : (
                  <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
                )}
              </div>

              <div className="p-6 border-t border-border">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-4 max-h-32 overflow-auto">
                  {items[zoomIndex].prompt || "—"}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    asChild
                    disabled={!items[zoomIndex].url}
                  >
                    <a href={items[zoomIndex].url || "#"} download>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(items[zoomIndex].id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

