"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { ProjectTabs } from "@/components/project-tabs";
import { AssetsPanel } from "@/components/assets-panel";
import { Graph } from "@/components/graph";
import { GeneratedModal } from "@/components/generated-modal";
import { ModeToggle } from "@/components/mode-toggle";
import { useProjects } from "@/store/use-projects";

export default function Home() {
  const { active } = useProjects();
  const p = active();
  const [showGen, setShowGen] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-foreground text-background flex items-center justify-center shadow-lg">
            <Layers className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">Fuseboard</span>
        </div>
        
        <div className="h-6 w-px bg-border mx-2" />
        
        <ProjectTabs />

        <div className="flex-1" />
        
        <ModeToggle />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex min-h-0 p-4 gap-4 bg-muted/10">
        {/* Sidebar */}
        <aside className="w-80 flex-shrink-0 flex flex-col">
          <AssetsPanel onOpenGenerated={() => setShowGen(true)} />
        </aside>

        {/* Canvas */}
        <section className="flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden relative">
          <Graph
            projectId={p?.id || "default"}
            onRequestGenerate={(prompt: string, images?: { id: string; alt: string; src: string }[]) => {
              console.log("Generated prompt:", prompt);
              console.log("Image refs:", images);
            }}
          />
        </section>
      </main>

      {/* Modal */}
      <GeneratedModal />
    </div>
  );
}
