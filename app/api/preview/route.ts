// app/api/preview/route.ts
import { NextRequest, NextResponse } from "next/server";

async function fetchOGData(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) throw new Error("Failed to fetch URL");
    const html = await res.text();

    const ogTitle =
      html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
      "";

    const ogDescription =
      html.match(/<meta property="og:description" content="([^"]+)"/i)?.[1] ||
      html.match(/<meta name="description" content="([^"]+)"/i)?.[1] ||
      "";

    let ogImage =
      html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ||
      html.match(/<meta name="twitter:image" content="([^"]+)"/i)?.[1] ||
      "";

    // Normalize relative image URLs
    if (ogImage && !ogImage.startsWith("http")) {
      const baseUrl = new URL(url);
      ogImage = new URL(ogImage, baseUrl).href;
    }

    return {
      ogTitle,
      ogDescription,
      ogImage: ogImage ? { url: ogImage } : null,
    };
  } catch (error) {
    console.error("Error fetching OG data:", error);
    return { error: (error as Error).message };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const preview = await fetchOGData(url);
  return NextResponse.json(preview);
}
