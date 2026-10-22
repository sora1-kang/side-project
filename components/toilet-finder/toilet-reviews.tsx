"use client";

import { useState } from "react";
import { StarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_COMMENT_LENGTH, type ReviewSummary } from "@/lib/reviews";

type Props = {
  toiletName: string;
  summary: ReviewSummary | undefined;
  onSubmit: (input: { rating: number; comment: string }) => Promise<boolean>;
};

export function ToiletReviews({ toiletName, summary, onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("saving");

    if (await onSubmit({ rating, comment })) {
      setOpen(false);
      setRating(0);
      setComment("");
      setState("idle");
    } else {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1 text-sm">
        <StarIcon className="size-4 fill-current text-amber-500" aria-hidden />
        {summary?.average != null ? (
          <span>
            {summary.average.toFixed(1)}{" "}
            <span className="text-muted-foreground">(후기 {summary.count}개)</span>
          </span>
        ) : (
          <span className="text-muted-foreground">아직 평점이 없습니다</span>
        )}
      </p>

      {summary && summary.reviews.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {summary.reviews.map((review) => (
            <li key={review.id} className="text-muted-foreground">
              <span aria-label={`별점 ${review.rating}점`}>{"★".repeat(review.rating)}</span>{" "}
              {review.comment}
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
          후기 남기기
        </Button>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={submit} aria-label={`${toiletName} 후기 작성`}>
          <div role="radiogroup" aria-label="별점" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value}점`}
                onClick={() => setRating(value)}
              >
                <StarIcon
                  className={`size-6 ${value <= rating ? "fill-current text-amber-500" : "text-muted-foreground"}`}
                  aria-hidden
                />
              </button>
            ))}
          </div>
          <textarea
            className="min-h-16 rounded-md border bg-background p-2 text-sm"
            aria-label="후기"
            placeholder="이용 후기를 남겨 주세요 (선택)"
            maxLength={MAX_COMMENT_LENGTH}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          {state === "error" && (
            <p role="alert" className="text-sm text-destructive">
              저장하지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={rating === 0 || state === "saving"}>
              저장
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              취소
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
