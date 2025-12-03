import { NextRequest, NextResponse } from "next/server";

interface RequestBody {
  prompt: string;
  images?: { url: string; alt: string }[];
  provider?: "gemini" | "pollinations";
}

async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
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
    const { prompt, images = [], provider = "gemini" } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // ---------------------------------------------------------
    // 1. Google Gemini (Multimodal - understands images + generates)
    // ---------------------------------------------------------
    if (provider === "gemini" && process.env.GEMINI_API_KEY) {
      const apiKey = process.env.GEMINI_API_KEY;
      
      // Build the request parts
      const parts: any[] = [];
      
      // Add images first if any
      if (images.length > 0) {
        for (const img of images) {
          const imageData = await urlToBase64(img.url);
          if (imageData) {
            parts.push({
              inlineData: {
                mimeType: imageData.mimeType,
                data: imageData.base64
              }
            });
            // Add context about what this image represents
            parts.push({ text: `[Reference image: ${img.alt || 'visual reference'}]` });
          }
        }
      }
      
      // Add the generation prompt
      const enhancedPrompt = images.length > 0 
        ? `Based on the reference images provided above, create a new image that: ${prompt}. 
           Incorporate the visual style, subjects, and elements from the reference images.
           Generate a high-quality, professional image.`
        : `Generate a high-quality, professional image: ${prompt}`;
      
      parts.push({ text: enhancedPrompt });

      // Use Gemini 2.0 Flash for image generation
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
        // Fall back to Pollinations if Gemini didn't return images
        console.log("Gemini didn't return images, falling back to Pollinations");
        return generateWithPollinations(prompt);
      }

      return NextResponse.json({
        images: generatedImages,
        provider: "gemini",
        mode: images.length > 0 ? "reference" : "generate"
      });
    }

    // ---------------------------------------------------------
    // 2. Pollinations.ai (Free fallback - text only)
    // ---------------------------------------------------------
    return generateWithPollinations(prompt);

  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function generateWithPollinations(prompt: string) {
  const seed = Math.floor(Math.random() * 1000000);
  const safePrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;

  return NextResponse.json({
    images: [{ url, prompt }],
    provider: "pollinations",
    mode: "generate"
  });
}
