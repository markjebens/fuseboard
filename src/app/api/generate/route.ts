import { NextRequest, NextResponse } from "next/server";

interface NodeData {
  type: string;
  text?: string;
  alt?: string;
  note?: string;
  src?: string;
}

interface EdgeData {
  source: string;
  target: string;
  label?: string;
}

interface RequestBody {
  prompt: string;
  images?: { url: string; alt: string; note?: string }[];
  nodes?: NodeData[];
  edges?: EdgeData[];
}

async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    if (url.startsWith('blob:')) return null;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return { base64, mimeType: contentType };
  } catch (error) {
    console.error("Failed to fetch image:", url, error);
    return null;
  }
}

// Use Gemini to analyze images and create a detailed prompt
async function analyzeWithGemini(
  apiKey: string,
  images: { url: string; alt: string; note?: string }[],
  textDescriptors: string[],
  userPrompt: string,
  relationships: string[]
): Promise<string> {
  const parts: any[] = [];
  
  // Add images for analysis
  let imagesAdded = 0;
  for (const img of images.slice(0, 4)) { // Limit to 4 images
    const imageData = await urlToBase64(img.url);
    if (imageData) {
      parts.push({
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.base64
        }
      });
      parts.push({ 
        text: `[This image is labeled: "${img.alt}"${img.note ? `. Note: ${img.note}` : ''}]` 
      });
      imagesAdded++;
    }
  }
  
  // Build analysis request
  const analysisPrompt = `You are an expert creative director creating prompts for AI image generation.

TASK: Analyze the provided content and create ONE detailed image generation prompt.

${imagesAdded > 0 ? `REFERENCE IMAGES: ${imagesAdded} images provided above. Describe their key visual elements, style, colors, composition, subjects, and mood.` : ''}

${textDescriptors.length > 0 ? `TEXT DESCRIPTORS:\n${textDescriptors.map(t => `- ${t}`).join('\n')}` : ''}

${relationships.length > 0 ? `RELATIONSHIPS:\n${relationships.map(r => `- ${r}`).join('\n')}` : ''}

USER'S VISION: ${userPrompt}

Create a single, detailed image generation prompt (150-200 words) that:
1. Incorporates the visual style and elements from the reference images
2. Includes all the text descriptors as visual elements
3. Respects the relationships between elements
4. Fulfills the user's vision
5. Uses specific, evocative language for lighting, composition, mood, and style
6. Is optimized for AI image generation

OUTPUT ONLY THE PROMPT TEXT, nothing else. No quotes, no preamble, no explanation.`;

  parts.push({ text: analysisPrompt });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Gemini analysis error:", data);
      return userPrompt; // Fall back to user prompt
    }

    const generatedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (generatedPrompt) {
      console.log("Gemini enhanced prompt:", generatedPrompt.slice(0, 100) + "...");
      return generatedPrompt.trim();
    }
    
    return userPrompt;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return userPrompt;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { prompt, images = [], nodes = [], edges = [] } = body;

    if (!prompt && nodes.length === 0) {
      return NextResponse.json({ error: "Missing prompt or canvas content" }, { status: 400 });
    }

    // Extract text descriptors from nodes
    const textDescriptors = nodes
      .filter(n => n.type === 'textNode' && n.text)
      .map(n => n.text as string);
    
    // Extract relationship labels from edges
    const relationships = edges
      .filter(e => e.label)
      .map(e => e.label as string);

    let finalPrompt = prompt || textDescriptors.join(", ");
    
    // If we have Gemini API key and images/content to analyze, enhance the prompt
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && (images.length > 0 || textDescriptors.length > 0)) {
      console.log("Using Gemini to analyze and enhance prompt...");
      finalPrompt = await analyzeWithGemini(
        apiKey,
        images,
        textDescriptors,
        prompt || "Create a cohesive image based on the provided content",
        relationships
      );
    }

    // Generate image with Pollinations using the enhanced prompt
    const seed = Math.floor(Math.random() * 1000000);
    const safePrompt = encodeURIComponent(finalPrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;

    console.log("Generating image with Pollinations, prompt length:", finalPrompt.length);

    return NextResponse.json({
      images: [{ url: imageUrl, prompt: finalPrompt }],
      provider: apiKey ? "gemini+pollinations" : "pollinations",
      mode: images.length > 0 ? "reference" : "generate",
      enhanced: !!apiKey
    });

  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
