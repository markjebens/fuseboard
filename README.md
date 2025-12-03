# Fuseboard

A visual node-based graph builder for composing AI image generation prompts. Drag images and text descriptors onto a canvas, connect them, and generate structured prompts for AI image generators.

![Fuseboard](https://via.placeholder.com/1200x600/121316/5aa9ff?text=Fuseboard)

## Features

- 🎨 **Visual Prompt Building** — Drag and drop images and text descriptors onto an infinite canvas
- 🔗 **Node Connections** — Connect elements to define relationships and priority
- ⚡ **Smart Prompt Generation** — Automatically composes structured prompts from your graph
- 🖼️ **AI Image Generation** — Generate images directly using the Ideogram API
- 📁 **Project Management** — Create and manage multiple projects with separate workspaces
- 💾 **Auto-Save** — Your work is automatically saved to local storage
- 🌙 **Dark Theme** — Beautiful dark interface designed for creative work

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui + Radix UI primitives
- **State Management**: Zustand
- **Graph Canvas**: @xyflow/react (ReactFlow)
- **AI API**: Ideogram API

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

1. Clone the repository and navigate to the fuseboard directory:

```bash
cd fuseboard
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file with your Ideogram API key:

```bash
cp .env.example .env.local
# Edit .env.local and add your IDEOGRAM_API_KEY
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Adding Assets

1. **Images**: Drag and drop images into the Assets panel or click the dropzone to browse
2. **Text Traits**: Click "Add Text Trait" to add descriptive text like "moody lighting" or "cyberpunk city"

### Building Your Graph

1. Drag assets from the sidebar onto the canvas to create nodes
2. Connect nodes by dragging from one handle to another
3. Add connection labels to describe relationships (e.g., "lighting style", "background")
4. Select nodes to edit their properties in the Inspector panel

### Generating Content

1. Click **"Generate Prompt"** to compose a prompt from your graph
2. Review and edit the prompt in the Preview panel
3. Click **"Generate Content"** to send to the AI generator
4. View results in the **Generated Library**

### Special Node Types

Name your images to give them special roles:
- **Scene/Background/Base**: Used as the base composition
- **Human/Person/Character**: Used for character reference
- **Product/Bottle/Brand**: Used for product placement

## Environment Variables

| Variable | Description |
|----------|-------------|
| `IDEOGRAM_API_KEY` | Your Ideogram API key for image generation |

## Project Structure

```
fuseboard/
├── src/
│   ├── app/
│   │   ├── api/generate/     # API route for image generation
│   │   ├── globals.css       # Global styles + Tailwind v4 config
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Main page
│   ├── components/
│   │   ├── graph/            # ReactFlow canvas components
│   │   ├── ui/               # shadcn UI components
│   │   ├── assets-panel.tsx
│   │   ├── generated-modal.tsx
│   │   └── project-tabs.tsx
│   ├── lib/
│   │   └── utils.ts          # Utility functions
│   └── store/
│       ├── use-projects.ts   # Projects state
│       └── use-ui.ts         # UI state
├── package.json
└── README.md
```

## License

MIT

