import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt, nodes } = await request.json();

    if (!prompt && !nodes) {
      return NextResponse.json({ error: "Missing prompt or nodes" }, { status: 400 });
    }

    // Construct a meta-prompt for the AI
    const systemContext = `You are an expert creative director.
    Your goal is to take a rough collection of descriptors and visual references and turn them into a cohesive image generation prompt.
    
    The user input is a raw string of text descriptors and image filenames/labels.
    
    Rules:
    1. Analyze the input. If it contains filenames like "IMG_123.jpg", ignore the random numbers but look for semantic clues (e.g. "cat_photo.jpg" -> "cat").
    2. Synthesize the text descriptors into a cohesive scene.
    3. Use detailed, sensory language (lighting, composition, texture).
    4. Do NOT invent major subject matter if it's not implied. If the input is just "style: noir", generate a generic noir scene. If it says "robot", make it a robot.
    5. Keep it under 100 words.
    6. Return ONLY the refined prompt text. No quotes, no preamble.
    `;

    // Call Pollinations Text API (Free)
    const response = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: `Refine this rough input into a prompt: "${prompt}"` },
        ],
        model: "openai", 
        seed: Math.floor(Math.random() * 1000),
      }),
    });

    if (!response.ok) {
      // Fallback
      return NextResponse.json({ 
        refined: prompt + ", high quality, detailed, 8k resolution" 
      });
    }

    const text = await response.text();
    return NextResponse.json({ refined: text.trim() });

  } catch (error) {
    console.error("Refine error:", error);
    return NextResponse.json({ error: "Failed to refine prompt" }, { status: 500 });
  }
}
