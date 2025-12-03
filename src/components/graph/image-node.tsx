"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Image as ImageIcon } from "lucide-react";

interface ImageNodeData {
  src?: string;
  alt?: string;
  note?: string;
  uploading?: boolean;
  uploadError?: boolean;
}

export function ImageNode({ data, selected }: NodeProps) {
  const nodeData = data as ImageNodeData;
  
  return (
    <div className={`w-60 bg-card border transition-all duration-200 rounded-xl shadow-sm overflow-hidden ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-background !border-2 !border-primary"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-background !border-2 !border-primary"
      />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center text-primary">
             <ImageIcon className="w-3 h-3" />
          </div>
          <span className="text-xs font-semibold text-foreground">Image Reference</span>
        </div>

        <div className="aspect-video rounded-lg overflow-hidden bg-muted border border-border/50 relative group">
          {nodeData?.src ? (
            <>
              <img
                src={nodeData.src}
                alt={nodeData?.alt || "image"}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  // Show fallback for broken images (e.g., dead blob URLs)
                  const target = e.currentTarget;
                  target.style.display = 'none';
                }}
              />
              {/* Fallback if image fails to load */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/60 pointer-events-none">
                <ImageIcon className="w-8 h-8" />
                <span className="text-xs">Image unavailable</span>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
            </div>
          )}
          {nodeData.uploading && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center text-xs font-medium">
              Uploading…
            </div>
          )}
          {nodeData.uploadError && (
            <div className="absolute inset-0 bg-destructive/80 text-destructive-foreground flex items-center justify-center text-xs font-semibold text-center px-2">
              Upload failed
            </div>
          )}
        </div>

        <div className="mt-2">
            <p className="text-xs font-medium truncate">{nodeData.alt || "Untitled Image"}</p>
            {nodeData.note && <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{nodeData.note}</p>}
        </div>
      </div>
    </div>
  );
}
