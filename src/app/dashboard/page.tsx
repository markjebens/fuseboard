"use client";

// Prevent static prerendering - this page requires authentication
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Layers, LogOut, User, Loader2 } from "lucide-react";
import { ProjectTabs } from "@/components/project-tabs";
import { AssetsPanel } from "@/components/assets-panel";
import { Graph } from "@/components/graph";
import { GeneratedModal } from "@/components/generated-modal";
import { ModeToggle } from "@/components/mode-toggle";
import { useProjects } from "@/store/use-projects";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export default function Dashboard() {
  const { active, init, isLoading } = useProjects();
  const p = active();
  const [showGen, setShowGen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        init();
      }
    };
    getUser();
  }, [supabase.auth, init]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (isLoading && !user) {
     return (
       <div className="h-screen w-screen flex items-center justify-center bg-background">
         <Loader2 className="w-8 h-8 animate-spin text-primary" />
       </div>
     );
  }

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

        {/* User Menu */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full text-sm">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground max-w-[150px] truncate">
                {user.email}
              </span>
            </div>
          )}
          <ModeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full w-8 h-8"
            onClick={handleSignOut}
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex min-h-0 p-4 gap-4 bg-muted/10">
        {/* Sidebar */}
        <aside className="w-80 flex-shrink-0 flex flex-col">
          <AssetsPanel onOpenGenerated={() => setShowGen(true)} />
        </aside>

        {/* Canvas */}
        <section className="flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden relative">
          {isLoading ? (
             <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading project...</p>
                </div>
             </div>
          ) : null}
          
          <Graph
            key={p?.id || "default"} // Force remount when switching projects
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
