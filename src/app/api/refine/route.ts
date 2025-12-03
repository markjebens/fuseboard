import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt, nodes } = await request.json();

    if (!prompt && !nodes) {
      return NextResponse.json({ error: "Missing prompt or nodes" }, { status: 400 });
    }

    // Construct a meta-prompt for the AI
    const systemContext = `You are an expert creative director and prompt engineer for high-end advertising agencies. 
    Your goal is to take a rough collection of descriptors and visual references and turn them into a cohesive, professional image generation prompt.
    
    The user is providing a graph of nodes (images and text descriptors).
    
    Rules:
    1. detailed, sensory language.
    2. Focus on lighting, composition, texture, and mood.
    3. Keep it under 200 words.
    4. Do not include "Here is the prompt" preamble, just return the prompt text.
    5. If specific "Character" or "Product" nodes are mentioned, ensure they are emphasized as the focal point.
    `;

    // Call Pollinations Text API (Free)
    // It mimics OpenAI API structure
    const response = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: `Refine this into a single cohesive prompt: ${prompt}` },
        ],
        model: "openai", // Pollinations auto-routes to best available free model
        seed: Math.floor(Math.random() * 1000),
      }),
    });

    if (!response.ok) {
      // Fallback if external service is down
      return NextResponse.json({ 
        refined: prompt + ", cinematic lighting, 8k resolution, highly detailed, professional photography, commercial aesthetic" 
      });
    }

    const text = await response.text();
    return NextResponse.json({ refined: text.trim() });

  } catch (error) {
    console.error("Refine error:", error);
    return NextResponse.json({ error: "Failed to refine prompt" }, { status: 500 });
  }
}

