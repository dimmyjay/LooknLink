// app/api/preview/route.js
import { NextResponse } from "next/server";
import ogs from "open-graph-scraper";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 });
  }

  try {
    const { result } = await ogs({ url });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch preview" }, { status: 500 });
  }
}
