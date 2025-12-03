import { NextRequest, NextResponse } from "next/server";

interface ImagePayload {
  base64: string;
  mime: string;
  name: string;
}

interface RequestBody {
  prompt: string;
  mode?: "auto" | "remix" | "generate";
  images?: {
    scene?: ImagePayload;
    character?: ImagePayload;
    collage?: ImagePayload;
  };
  similarity?: number;
  provider?: "pollinations" | "ideogram";
}

// Helper to strip "data:image/..." prefix if present for Pollinations (it prefers raw prompt or URLs, but we'll use the prompt mostly)
// Pollinations doesn't support image-to-image well via simple GET, so we'll focus on text-to-image for the free tier
// unless we use their new POST endpoint if available. For now, we'll use GET for reliability.

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { prompt, provider = "pollinations", images } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // ---------------------------------------------------------
    // 1. Pollinations.ai (Free, Unlimited)
    // ---------------------------------------------------------
    if (provider === "pollinations" || !process.env.IDEOGRAM_API_KEY) {
      // Pollinations is simple: Just a URL. 
      // To make it feel like an "API", we generate the URL and return it.
      // We append a random seed to ensure fresh generation.
      const seed = Math.floor(Math.random() * 1000000);
      const safePrompt = encodeURIComponent(prompt);
      // Model 'flux' is usually available and high quality
      const url = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;

      // We simulate a "job" by just returning this URL. 
      // The frontend will load it as an <img>.
      return NextResponse.json({
        images: [{ url, prompt }],
        provider: "pollinations",
        mode: "generate" // Pollinations doesn't support image-ref mixing easily yet
      });
    }

    // ---------------------------------------------------------
    // 2. Ideogram (Premium, requires Key)
    // ---------------------------------------------------------
    if (provider === "ideogram" && process.env.IDEOGRAM_API_KEY) {
      const URL_GENERATE = "https://api.ideogram.ai/v1/ideogram-v3/generate";
      const fm = new FormData();
      fm.append("prompt", prompt);
      
      const response = await fetch(URL_GENERATE, {
        method: "POST",
        headers: { "Api-Key": process.env.IDEOGRAM_API_KEY! },
        body: fm,
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Ideogram error");
      
      return NextResponse.json({
        images: data.data?.map((d: { url: string }) => ({ url: d.url, prompt })) || [],
        provider: "ideogram"
      });
    }

    return NextResponse.json({ error: "Invalid provider configuration" }, { status: 400 });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
