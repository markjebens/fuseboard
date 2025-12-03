"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useProjects } from "@/store/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ProjectTabs() {
  const { projects, activeId, setActive, addProject, remove, rename } =
    useProjects();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(`Project ${projects.length + 1}`);

  const handleCreate = () => {
    addProject(name.trim() || "Untitled");
    setName(`Project ${projects.length + 2}`);
    setCreating(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {projects.map((p) => (
        <div
          key={p.id}
          className={cn(
            "group flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer transition-all duration-200",
            (activeId ?? projects[0].id) === p.id
              ? "bg-primary text-primary-foreground border-transparent font-semibold shadow-sm"
              : "bg-secondary border-border hover:bg-secondary/80 text-secondary-foreground"
          )}
          onClick={() => setActive(p.id)}
        >
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) =>
              rename(p.id, e.currentTarget.textContent || "Untitled")
            }
            className="outline-none min-w-[40px]"
          >
            {p.name}
          </span>
          {projects.length > 1 && (
            <button
              className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                remove(p.id);
              }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      {!creating ? (
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-dashed"
          onClick={() => setCreating(true)}
        >
          <Plus className="w-4 h-4 mr-1" />
          New
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            className="w-40 h-8 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <Button size="sm" onClick={handleCreate}>
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCreating(false)}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

