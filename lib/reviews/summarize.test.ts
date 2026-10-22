import { expect, test } from "vitest";

import { parseReviewInput, summarizeByToilet } from "./summarize";

test("별점은 1~5 정수여야 하고 후기는 비어 있어도 된다", () => {
  expect(parseReviewInput({ toiletId: "a", rating: 4 })).toEqual({ toiletId: "a", rating: 4, comment: "" });
  expect(parseReviewInput({ toiletId: "a", rating: 0 })).toBeNull();
  expect(parseReviewInput({ toiletId: "a", rating: 3.5 })).toBeNull();
  expect(parseReviewInput({ toiletId: "a", rating: 6 })).toBeNull();
  expect(parseReviewInput({ rating: 3 })).toBeNull();
});

test("후기는 500자까지만 받는다", () => {
  expect(parseReviewInput({ toiletId: "a", rating: 3, comment: "가".repeat(500) })).not.toBeNull();
  expect(parseReviewInput({ toiletId: "a", rating: 3, comment: "가".repeat(501) })).toBeNull();
});

test("화장실별 평균 별점과 최근 후기를 묶는다", () => {
  const rows = [
    { id: "3", toilet_id: "a", rating: 5, comment: "깨끗해요", created_at: "2026-10-22T03:00:00Z" },
    { id: "2", toilet_id: "a", rating: 2, comment: null, created_at: "2026-10-22T02:00:00Z" },
    { id: "1", toilet_id: "b", rating: 4, comment: "보통", created_at: "2026-10-22T01:00:00Z" },
  ];

  const result = summarizeByToilet(rows, ["a", "b", "c"]);

  expect(result.a.average).toBe(3.5);
  expect(result.a.count).toBe(2);
  expect(result.a.reviews.map((r) => r.comment)).toEqual(["깨끗해요"]);
  expect(result.c).toEqual({ average: null, count: 0, reviews: [] });
});
