"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Type } from "lucide-react";

interface TextNodeData {
  text?: string;
  tags?: string[];
}

export function TextNode({ data, selected }: NodeProps) {
  const nodeData = data as TextNodeData;
  
  return (
    <div className={`w-60 bg-card border transition-all duration-200 rounded-xl shadow-sm ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
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
             <Type className="w-3 h-3" />
          </div>
          <span className="text-xs font-semibold text-foreground">Descriptor</span>
        </div>

        <div className="min-h-[60px] text-sm leading-relaxed text-muted-foreground">
            {nodeData?.text || "(empty)"}
        </div>

        {nodeData?.tags?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-border/50">
            {nodeData.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
