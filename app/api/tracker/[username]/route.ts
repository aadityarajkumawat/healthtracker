import { get, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const USERNAME = /^[a-z0-9_-]{3,32}$/;
const MAX_BODY_BYTES = 500_000;

function normalizedUsername(value: string) {
  return decodeURIComponent(value).trim().toLowerCase();
}

function invalidUsername() {
  return NextResponse.json({ error: "Username must be 3–32 characters using letters, numbers, _ or -." }, { status: 400 });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const username = normalizedUsername((await params).username);
  if (!USERNAME.test(username)) return invalidUsername();

  try {
    const result = await get(`trackers/${username}.json`, { access: "private", useCache: false });
    if (!result) return NextResponse.json({ exists: false, data: null }, { headers: { "Cache-Control": "no-store" } });
    const data = await new Response(result.stream).json();
    return NextResponse.json({ exists: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Cloud storage is unavailable." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const username = normalizedUsername((await params).username);
  if (!USERNAME.test(username)) return invalidUsername();

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Tracker data is too large." }, { status: 413 });

  const body = await request.json();
  if (!body || !Array.isArray(body.foods) || !Array.isArray(body.logs) || !Array.isArray(body.weights) || typeof body.goal !== "number") {
    return NextResponse.json({ error: "Invalid tracker data." }, { status: 400 });
  }

  const data = { foods: body.foods, logs: body.logs, weights: body.weights, goal: body.goal, updatedAt: new Date().toISOString() };
  try {
    await put(`trackers/${username}.json`, JSON.stringify(data), {
      access: "private", addRandomSuffix: false, allowOverwrite: true,
      contentType: "application/json", cacheControlMaxAge: 60,
    });
    return NextResponse.json({ ok: true, updatedAt: data.updatedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Cloud storage is unavailable." }, { status: 503 });
  }
}
