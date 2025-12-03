-- Fuseboard Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/nrquawqhiwekdafavzue/sql)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Untitled Project',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster user queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- ============================================
-- ASSETS TABLE (Images, Videos, Text Traits)
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('image', 'video', 'text')),
    name TEXT,
    url TEXT, -- For image/video (Supabase Storage URL)
    text_content TEXT, -- For text assets
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);

-- ============================================
-- GRAPH NODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS graph_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL, -- ReactFlow node ID
    type TEXT NOT NULL CHECK (type IN ('imageNode', 'textNode')),
    position_x FLOAT NOT NULL DEFAULT 0,
    position_y FLOAT NOT NULL DEFAULT 0,
    data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Flexible storage for node data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_project_id ON graph_nodes(project_id);

-- ============================================
-- GRAPH EDGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS graph_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    edge_id TEXT NOT NULL, -- ReactFlow edge ID
    source_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, edge_id)
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_project_id ON graph_edges(project_id);

-- ============================================
-- PROMPTS TABLE (Generated prompts history)
-- ============================================
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_prompt TEXT, -- The unrefined prompt from graph
    refined_prompt TEXT, -- AI-refined version
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompts_project_id ON prompts(project_id);

-- ============================================
-- GENERATED IMAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS generated_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
    url TEXT NOT NULL, -- Generated image URL
    prompt_text TEXT, -- The prompt used
    provider TEXT DEFAULT 'pollinations', -- pollinations, ideogram, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_images_project_id ON generated_images(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_user_id ON generated_images(user_id);

-- ============================================
-- PRESETS TABLE (Saved Themes/Characters)
-- ============================================
CREATE TABLE IF NOT EXISTS presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('theme', 'character')),
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presets_user_id ON presets(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view their own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON projects
    FOR DELETE USING (auth.uid() = user_id);

-- Assets policies
CREATE POLICY "Users can view their own assets" ON assets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assets" ON assets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets" ON assets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets" ON assets
    FOR DELETE USING (auth.uid() = user_id);

-- Graph nodes policies (through project ownership)
CREATE POLICY "Users can manage nodes in their projects" ON graph_nodes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = graph_nodes.project_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Graph edges policies (through project ownership)
CREATE POLICY "Users can manage edges in their projects" ON graph_edges
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = graph_edges.project_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Prompts policies
CREATE POLICY "Users can view their own prompts" ON prompts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own prompts" ON prompts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompts" ON prompts
    FOR DELETE USING (auth.uid() = user_id);

-- Generated images policies
CREATE POLICY "Users can view their own generated images" ON generated_images
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own generated images" ON generated_images
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated images" ON generated_images
    FOR DELETE USING (auth.uid() = user_id);

-- Presets policies
CREATE POLICY "Users can view their own presets" ON presets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own presets" ON presets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presets" ON presets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presets" ON presets
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_graph_nodes_updated_at
    BEFORE UPDATE ON graph_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_presets_updated_at
    BEFORE UPDATE ON presets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STORAGE BUCKET FOR ASSETS
-- ============================================
-- Run this separately in Supabase Dashboard > Storage

-- 1. Create a bucket called 'assets'
-- 2. Set it to public or private based on your needs
-- 3. Add the following policy:
/*
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true);

CREATE POLICY "Users can upload to their folder" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'assets' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view their files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'assets' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'assets' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );
*/

