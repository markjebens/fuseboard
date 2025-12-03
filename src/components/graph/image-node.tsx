import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Image as ImageIcon, Loader2, AlertTriangle, User, Mountain, Palette } from "lucide-react";
import { useState } from "react";

export type ImageRole = "subject" | "scene" | "style" | "reference";

interface ImageNodeData {
  src?: string;
  alt?: string;
  note?: string;
  role?: ImageRole;
  uploading?: boolean;
  uploadError?: boolean;
}

const roleConfig = {
  subject: { 
    label: "Subject", 
    icon: User, 
    color: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    description: "Main subject/character"
  },
  scene: { 
    label: "Scene", 
    icon: Mountain, 
    color: "bg-green-500/10 text-green-500 border-green-500/30",
    description: "Background/environment"
  },
  style: { 
    label: "Style", 
    icon: Palette, 
    color: "bg-purple-500/10 text-purple-500 border-purple-500/30",
    description: "Visual style/aesthetic"
  },
  reference: { 
    label: "Reference", 
    icon: ImageIcon, 
    color: "bg-muted text-muted-foreground border-border",
    description: "General reference"
  },
};

export function ImageNode({ data, selected }: NodeProps) {
  const nodeData = data as ImageNodeData;
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  
  const showImage = nodeData?.src && !nodeData.uploadError && !imgError;
  const isUploading = nodeData?.uploading;
  const hasError = nodeData?.uploadError || imgError;
  
  const role = nodeData.role || "reference";
  const config = roleConfig[role];
  const RoleIcon = config.icon;
  
  return (
    <div className={`w-64 bg-card border-2 transition-all duration-200 rounded-xl shadow-sm overflow-hidden ${selected ? 'border-primary ring-2 ring-primary/20' : config.color.split(' ')[2] || 'border-border'}`}>
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

      {/* Role Badge */}
      <div className={`px-3 py-1.5 flex items-center gap-2 ${config.color.split(' ').slice(0, 2).join(' ')} border-b ${config.color.split(' ')[2]}`}>
        <RoleIcon className="w-3.5 h-3.5" />
        <span className="text-xs font-bold uppercase tracking-wider">{config.label}</span>
        {isUploading && (
          <Loader2 className="w-3 h-3 animate-spin ml-auto" />
        )}
      </div>

      <div className="p-3">
        <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted border border-border/50 relative group">
          {isUploading ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40 mb-1" />
              <span className="text-[10px] text-muted-foreground">Uploading...</span>
            </div>
          ) : hasError ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-2">
              <AlertTriangle className="w-6 h-6 text-destructive/60 mb-1" />
              <span className="text-[10px] text-muted-foreground">Image unavailable</span>
            </div>
          ) : showImage ? (
            <>
              {imgLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
                </div>
              )}
              <img
                src={nodeData.src}
                alt={nodeData?.alt || "image"}
                className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setImgLoading(false)}
                onError={() => {
                  console.error("Failed to load image in node:", nodeData.src);
                  setImgError(true);
                  setImgLoading(false);
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
            </div>
          )}
        </div>

        <div className="mt-2">
          <p className="text-sm font-medium truncate">{nodeData.alt || "Untitled Image"}</p>
          {nodeData.note && <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{nodeData.note}</p>}
        </div>
      </div>
    </div>
  );
}
