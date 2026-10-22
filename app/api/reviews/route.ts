import { NextResponse } from "next/server";

import { parseReviewInput } from "@/lib/reviews";
import { loadSummaries, saveReview } from "@/lib/reviews/store";

const MAX_IDS = 50;

export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("toiletIds") ?? "")
    .split(",")
    .filter(Boolean);

  if (ids.length === 0 || ids.length > MAX_IDS) {
    return NextResponse.json({ error: "invalid-query" }, { status: 400 });
  }

  try {
    return NextResponse.json({ summaries: await loadSummaries(ids) });
  } catch {
    return NextResponse.json({ error: "reviews-unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const input = parseReviewInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "invalid-review" }, { status: 400 });
  }

  try {
    await saveReview(input.toiletId, input);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "reviews-unavailable" }, { status: 503 });
  }
}
