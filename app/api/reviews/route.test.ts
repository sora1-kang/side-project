import { beforeEach, expect, test, vi } from "vitest";

import { GET, POST } from "@/app/api/reviews/route";

const store = vi.hoisted(() => ({ loadSummaries: vi.fn(), saveReview: vi.fn() }));
vi.mock("@/lib/reviews/store", () => store);

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/reviews", { method: "POST", body: JSON.stringify(body) })
  );
}

beforeEach(() => {
  store.loadSummaries.mockReset();
  store.saveReview.mockReset();
});

test("별점과 후기를 저장한다", async () => {
  store.saveReview.mockResolvedValue(undefined);

  const res = await post({ toiletId: "a", rating: 5, comment: " 깨끗해요 " });

  expect(res.status).toBe(201);
  expect(store.saveReview).toHaveBeenCalledWith("a", expect.objectContaining({ rating: 5, comment: "깨끗해요" }));
});

test("별점이 없거나 범위를 벗어나면 저장하지 않는다", async () => {
  expect((await post({ toiletId: "a", comment: "좋아요" })).status).toBe(400);
  expect((await post({ toiletId: "a", rating: 9 })).status).toBe(400);
  expect(store.saveReview).not.toHaveBeenCalled();
});

test("저장소 오류는 503으로 알린다", async () => {
  store.saveReview.mockRejectedValue(new Error("supabase-not-configured"));

  expect((await post({ toiletId: "a", rating: 3 })).status).toBe(503);
});

test("화장실 id 목록으로 요약을 조회한다", async () => {
  store.loadSummaries.mockResolvedValue({ a: { average: 4, count: 1, reviews: [] } });

  const res = await GET(new Request("http://localhost/api/reviews?toiletIds=a,b"));

  expect(store.loadSummaries).toHaveBeenCalledWith(["a", "b"]);
  expect((await res.json()).summaries.a.average).toBe(4);
  expect((await GET(new Request("http://localhost/api/reviews"))).status).toBe(400);
});
