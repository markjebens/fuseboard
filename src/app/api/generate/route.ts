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
    // Skip blob URLs
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

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { prompt, images = [], nodes = [], edges = [] } = body;

    if (!prompt && nodes.length === 0) {
      return NextResponse.json({ error: "Missing prompt or canvas content" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ 
        error: "Gemini API key not configured. Please add GEMINI_API_KEY to environment variables." 
      }, { status: 500 });
    }

    // Build context from all nodes and connections
    let contextDescription = "";
    
    // Describe text nodes
    const textNodes = nodes.filter(n => n.type === 'textNode' && n.text);
    if (textNodes.length > 0) {
      contextDescription += "Text descriptors:\n";
      textNodes.forEach(n => {
        contextDescription += `- ${n.text}\n`;
      });
    }
    
    // Describe image nodes
    const imageNodes = nodes.filter(n => n.type === 'imageNode');
    if (imageNodes.length > 0) {
      contextDescription += "\nImage references:\n";
      imageNodes.forEach(n => {
        contextDescription += `- ${n.alt || 'Image'}${n.note ? ` (Note: ${n.note})` : ''}\n`;
      });
    }
    
    // Describe connections/relationships
    if (edges.length > 0) {
      contextDescription += "\nRelationships between elements:\n";
      edges.forEach(e => {
        const sourceNode = nodes.find(n => n.type === 'textNode' ? false : true); // simplified
        contextDescription += `- ${e.label || 'connected to'}\n`;
      });
    }

    // Build the request parts for Gemini
    const parts: any[] = [];
    
    // Add images first
    let imagesAdded = 0;
    for (const img of images) {
      if (imagesAdded >= 5) break; // Limit to 5 images
      
      const imageData = await urlToBase64(img.url);
      if (imageData) {
        parts.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.base64
          }
        });
        parts.push({ 
          text: `[Reference image: "${img.alt || 'visual reference'}"${img.note ? ` - ${img.note}` : ''}]` 
        });
        imagesAdded++;
      }
    }
    
    // Build the comprehensive prompt
    const fullPrompt = `You are an expert AI image generator. Generate a high-quality, professional image based on the following:

${contextDescription ? `CANVAS CONTEXT:\n${contextDescription}\n` : ''}
${imagesAdded > 0 ? `REFERENCE IMAGES: ${imagesAdded} images provided above. Incorporate their visual style, subjects, colors, and aesthetic.\n` : ''}
USER REQUEST: ${prompt}

Generate an image that:
1. Faithfully incorporates ALL the descriptors and traits mentioned
2. Uses the reference images as strong visual inspiration (style, composition, mood)
3. Creates a cohesive, professional result
4. Is suitable for commercial/advertising use

Generate the image now.`;

    parts.push({ text: fullPrompt });

    console.log("Sending to Gemini:", { 
      prompt: fullPrompt.slice(0, 200) + "...", 
      imagesCount: imagesAdded 
    });

    // Call Gemini 2.0 Flash for image generation
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["image", "text"],
            responseMimeType: "image/png"
          }
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Gemini API error:", data);
      throw new Error(data.error?.message || "Gemini API error");
    }

    // Extract generated image from response
    const generatedImages: { url: string; prompt: string }[] = [];
    
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          // Convert base64 to data URL
          const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          generatedImages.push({ url: dataUrl, prompt });
        }
      }
    }

    if (generatedImages.length === 0) {
      // Check if there's a text response explaining why
      const textResponse = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
      throw new Error(textResponse || "Gemini did not return an image. Try a different prompt.");
    }

    return NextResponse.json({
      images: generatedImages,
      provider: "gemini",
      mode: imagesAdded > 0 ? "reference" : "generate"
    });

  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
