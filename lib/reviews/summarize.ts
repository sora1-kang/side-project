export type ReviewInput = { rating: number; comment: string };

export type Review = ReviewInput & { id: string; createdAt: string };

export type ReviewSummary = {
  average: number | null;
  count: number;
  reviews: Review[];
};

export const MAX_COMMENT_LENGTH = 500;
export const RECENT_REVIEW_LIMIT = 3;

/** 요청 본문이 별점(1~5 정수)과 후기(500자 이하)를 갖췄는지 확인하고, 아니면 null을 돌려준다. */
export function parseReviewInput(body: unknown): (ReviewInput & { toiletId: string }) | null {
  if (typeof body !== "object" || body === null) return null;
  const { toiletId, rating, comment } = body as Record<string, unknown>;

  if (typeof toiletId !== "string" || toiletId.trim() === "") return null;
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) return null;

  const text = comment === undefined ? "" : comment;
  if (typeof text !== "string" || text.trim().length > MAX_COMMENT_LENGTH) return null;

  return { toiletId, rating: rating as number, comment: text.trim() };
}

type Row = { id: string; toilet_id: string; rating: number; comment: string | null; created_at: string };

/** 최신순 행을 화장실별로 묶어 평균 별점과 최근 후기를 만든다. */
export function summarizeByToilet(rows: readonly Row[], toiletIds: readonly string[]) {
  const result: Record<string, ReviewSummary> = {};

  for (const id of toiletIds) {
    const own = rows.filter((row) => row.toilet_id === id);
    const total = own.reduce((sum, row) => sum + row.rating, 0);

    result[id] = {
      average: own.length === 0 ? null : Math.round((total / own.length) * 10) / 10,
      count: own.length,
      reviews: own
        .filter((row) => row.comment)
        .slice(0, RECENT_REVIEW_LIMIT)
        .map((row) => ({
          id: row.id,
          rating: row.rating,
          comment: row.comment as string,
          createdAt: row.created_at,
        })),
    };
  }

  return result;
}
