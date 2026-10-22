import { NextResponse } from "next/server";

import { findNearby, isCovered } from "@/lib/toilets";
import { loadDataset } from "@/lib/toilets/dataset";

const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 5000;

function readNumber(params: URLSearchParams, key: string) {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return null;

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = readNumber(params, "lat");
  const lng = readNumber(params, "lng");
  const radius = readNumber(params, "radius");

  if (
    lat === null ||
    lng === null ||
    radius === null ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180 ||
    radius < MIN_RADIUS_M ||
    radius > MAX_RADIUS_M
  ) {
    return NextResponse.json({ error: "invalid-query" }, { status: 400 });
  }

  let dataset;
  try {
    dataset = await loadDataset();
  } catch {
    return NextResponse.json({ error: "data-unavailable" }, { status: 503 });
  }

  const origin = { lat, lng };

  return NextResponse.json({
    baseDate: dataset.baseDate,
    supported: isCovered(dataset.toilets, origin),
    toilets: findNearby(dataset.toilets, origin, radius),
  });
}
