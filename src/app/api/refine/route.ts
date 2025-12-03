import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ refined: "Add content to the canvas first, then click Refine!" });
    }

    const systemContext = `You are an expert creative director and prompt engineer for AI image generation.
Your task is to transform rough descriptors into professional, cohesive image generation prompts.

RULES:
1. Output ONLY the refined prompt text - no preambles, explanations, or formatting.
2. Keep the output under 150 words.
3. Focus on: subject, scene, lighting, mood, composition, and style.
4. If input includes image filenames (like "cat.jpg"), interpret them as subject references.
5. Make the prompt specific and evocative for image generation.
6. Always maintain the core intent of the user's input.
7. Add professional photography/cinematic qualities naturally.`;

    const userPrompt = `Transform this into a professional image generation prompt: "${prompt}"`;

    // Use Pollinations Text API for free AI text generation
    const response = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: userPrompt },
        ],
        model: "openai",
        seed: Math.floor(Math.random() * 100000),
      }),
    });

    if (!response.ok) {
      console.error("Pollinations API error:", response.status);
      // Fallback: enhance the prompt manually
      const enhanced = `${prompt}, professional photography, cinematic lighting, 8k resolution, highly detailed, dramatic composition`;
      return NextResponse.json({ refined: enhanced });
    }

    const text = await response.text();
    
    // Clean up the response
    const cleaned = text
      .trim()
      .replace(/^["']|["']$/g, '') // Remove wrapping quotes
      .replace(/^(Here is|Here's|The refined prompt is:?)/i, '') // Remove preambles
      .trim();

    return NextResponse.json({ refined: cleaned || prompt });

  } catch (error) {
    console.error("Refine error:", error);
    // Fallback on error
    return NextResponse.json({ 
      refined: "professional photography, cinematic lighting, highly detailed, dramatic composition" 
    });
  }
}
