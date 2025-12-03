import { NextRequest, NextResponse } from "next/server";

interface NodeData {
  type: string;
  text?: string;
  alt?: string;
  note?: string;
  src?: string;
  role?: "subject" | "scene" | "style" | "reference";
}

interface EdgeData {
  source: string;
  target: string;
  label?: string;
}

interface ImageRef {
  url: string;
  alt: string;
  note?: string;
  role?: "subject" | "scene" | "style" | "reference";
}

interface RequestBody {
  prompt: string;
  images?: ImageRef[];
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

// Whisk-style analysis with role-specific understanding
async function analyzeWithGeminiWhisk(
  apiKey: string,
  images: ImageRef[],
  textDescriptors: string[],
  userPrompt: string,
  relationships: string[]
): Promise<string> {
  const parts: any[] = [];
  
  // Categorize images by role
  const subjectImages = images.filter(i => i.role === 'subject');
  const sceneImages = images.filter(i => i.role === 'scene');
  const styleImages = images.filter(i => i.role === 'style');
  const referenceImages = images.filter(i => !i.role || i.role === 'reference');
  
  // Add SUBJECT images first
  if (subjectImages.length > 0) {
    parts.push({ text: "\n=== SUBJECT REFERENCES (main character/object to feature) ===" });
    for (const img of subjectImages.slice(0, 2)) {
      const imageData = await urlToBase64(img.url);
      if (imageData) {
        parts.push({
          inlineData: { mimeType: imageData.mimeType, data: imageData.base64 }
        });
        parts.push({ text: `Subject: "${img.alt}"${img.note ? ` - ${img.note}` : ''}` });
      }
    }
  }
  
  // Add SCENE images
  if (sceneImages.length > 0) {
    parts.push({ text: "\n=== SCENE/ENVIRONMENT REFERENCES ===" });
    for (const img of sceneImages.slice(0, 2)) {
      const imageData = await urlToBase64(img.url);
      if (imageData) {
        parts.push({
          inlineData: { mimeType: imageData.mimeType, data: imageData.base64 }
        });
        parts.push({ text: `Scene: "${img.alt}"${img.note ? ` - ${img.note}` : ''}` });
      }
    }
  }
  
  // Add STYLE images
  if (styleImages.length > 0) {
    parts.push({ text: "\n=== STYLE/AESTHETIC REFERENCES ===" });
    for (const img of styleImages.slice(0, 2)) {
      const imageData = await urlToBase64(img.url);
      if (imageData) {
        parts.push({
          inlineData: { mimeType: imageData.mimeType, data: imageData.base64 }
        });
        parts.push({ text: `Style reference: "${img.alt}"${img.note ? ` - ${img.note}` : ''}` });
      }
    }
  }
  
  // Add general REFERENCE images
  if (referenceImages.length > 0) {
    parts.push({ text: "\n=== GENERAL REFERENCES ===" });
    for (const img of referenceImages.slice(0, 2)) {
      const imageData = await urlToBase64(img.url);
      if (imageData) {
        parts.push({
          inlineData: { mimeType: imageData.mimeType, data: imageData.base64 }
        });
        parts.push({ text: `Reference: "${img.alt}"${img.note ? ` - ${img.note}` : ''}` });
      }
    }
  }
  
  // Build Whisk-style analysis prompt
  const hasSubject = subjectImages.length > 0;
  const hasScene = sceneImages.length > 0;
  const hasStyle = styleImages.length > 0;
  
  const analysisPrompt = `You are an expert creative director creating prompts for AI image generation, similar to Google's Whisk tool.

TASK: Analyze the provided reference images and create ONE detailed image generation prompt that combines them.

${hasSubject ? 'SUBJECT IMAGES: Analyze the main subject(s)/character(s). Extract their key visual features, pose, expression, clothing, and characteristics.' : ''}

${hasScene ? 'SCENE IMAGES: Analyze the environment/background. Extract the setting, atmosphere, lighting conditions, and spatial composition.' : ''}

${hasStyle ? 'STYLE IMAGES: Analyze the artistic style. Extract the visual aesthetic, color palette, artistic technique, mood, and rendering style.' : ''}

${textDescriptors.length > 0 ? `TEXT DESCRIPTORS:\n${textDescriptors.map(t => `- ${t}`).join('\n')}` : ''}

${relationships.length > 0 ? `RELATIONSHIPS:\n${relationships.map(r => `- ${r}`).join('\n')}` : ''}

USER'S REQUEST: ${userPrompt}

CREATE A SINGLE PROMPT that:
1. ${hasSubject ? 'Places the SUBJECT from the subject reference' : 'Creates an appropriate subject'}
2. ${hasScene ? 'In the SCENE/ENVIRONMENT from the scene reference' : 'in a suitable environment'}
3. ${hasStyle ? 'Rendered in the STYLE of the style reference' : 'with professional quality'}
4. Incorporates all text descriptors as visual elements
5. Is 150-200 words, specific, and optimized for AI image generation

OUTPUT ONLY THE PROMPT TEXT. No quotes, no preamble, no explanation.`;

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
            temperature: 0.8,
            maxOutputTokens: 600,
          }
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Gemini analysis error:", data);
      return userPrompt;
    }

    const generatedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (generatedPrompt) {
      console.log("Gemini Whisk-style prompt:", generatedPrompt.slice(0, 150) + "...");
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

    // Extract image info from nodes (with roles)
    const imageRefs: ImageRef[] = nodes
      .filter(n => n.type === 'imageNode' && n.src && !n.src.startsWith('blob:'))
      .map(n => ({
        url: n.src!,
        alt: n.alt || 'image',
        note: n.note,
        role: n.role
      }));
    
    // Merge with images passed directly
    const allImages = [...imageRefs, ...images.filter(i => !i.url.startsWith('blob:'))];

    // Extract text descriptors from nodes
    const textDescriptors = nodes
      .filter(n => n.type === 'textNode' && n.text)
      .map(n => n.text as string);
    
    // Extract relationship labels from edges
    const relationships = edges
      .filter(e => e.label)
      .map(e => e.label as string);

    let finalPrompt = prompt || textDescriptors.join(", ") || "Generate an image";
    
    // Use Gemini for Whisk-style analysis if we have API key and content
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && (allImages.length > 0 || textDescriptors.length > 0)) {
      console.log("Using Gemini Whisk-style analysis...", {
        subjects: allImages.filter(i => i.role === 'subject').length,
        scenes: allImages.filter(i => i.role === 'scene').length,
        styles: allImages.filter(i => i.role === 'style').length,
        references: allImages.filter(i => !i.role || i.role === 'reference').length,
        textDescriptors: textDescriptors.length
      });
      
      finalPrompt = await analyzeWithGeminiWhisk(
        apiKey,
        allImages,
        textDescriptors,
        prompt || "Create a cohesive image combining all references",
        relationships
      );
    }

    // Generate image with Pollinations using the Whisk-enhanced prompt
    const seed = Math.floor(Math.random() * 1000000);
    const safePrompt = encodeURIComponent(finalPrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;

    console.log("Generating with enhanced prompt, length:", finalPrompt.length);

    return NextResponse.json({
      images: [{ url: imageUrl, prompt: finalPrompt }],
      provider: apiKey ? "gemini-whisk" : "pollinations",
      mode: allImages.length > 0 ? "whisk" : "generate",
      enhanced: !!apiKey,
      stats: {
        subjects: allImages.filter(i => i.role === 'subject').length,
        scenes: allImages.filter(i => i.role === 'scene').length,
        styles: allImages.filter(i => i.role === 'style').length,
      }
    });

  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
