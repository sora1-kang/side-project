import { createClient } from "@supabase/supabase-js";

import { summarizeByToilet, type ReviewInput } from "./summarize";

/** 서버에서만 쓴다. 로그인이 없으므로 publishable 키와 RLS 정책으로 접근을 제한한다. */
function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("supabase-not-configured");

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function loadSummaries(toiletIds: string[]) {
  const { data, error } = await client()
    .from("reviews")
    .select("id, toilet_id, rating, comment, created_at")
    .in("toilet_id", toiletIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return summarizeByToilet(data, toiletIds);
}

export async function saveReview(toiletId: string, { rating, comment }: ReviewInput) {
  const { error } = await client()
    .from("reviews")
    .insert({ toilet_id: toiletId, rating, comment: comment || null });

  if (error) throw new Error(error.message);
}
