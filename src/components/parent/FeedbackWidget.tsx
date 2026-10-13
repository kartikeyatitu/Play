"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { submitFeedback } from "@/app/actions/feedback";

type Feedback = {
  rating: number;
  comment: string | null;
};

export function FeedbackWidget({ parentId, existingFeedback }: { parentId: string; existingFeedback: Feedback | null }) {
  const [rating, setRating] = useState<number>(existingFeedback?.rating || 0);
  const [comment, setComment] = useState<string>(existingFeedback?.comment || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!existingFeedback);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);
    const result = await submitFeedback(parentId, rating, comment);
    if (result.success) {
      setSubmitted(true);
    }
    setIsSubmitting(false);
  };

  if (submitted) {
    return (
      <Card className="bg-zinc-900/40 border-zinc-800 text-zinc-100 max-w-md">
        <CardHeader>
          <CardTitle>Your Feedback</CardTitle>
          <CardDescription className="text-zinc-400">Thank you for sharing your thoughts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={`text-2xl ${star <= rating ? "text-amber-400" : "text-zinc-700"}`}>
                ★
              </span>
            ))}
          </div>
          {comment && (
            <div className="p-3 bg-zinc-950 rounded-md text-zinc-300 text-sm border border-zinc-800">
              {comment}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/40 border-zinc-800 text-zinc-100 max-w-md">
      <CardHeader>
        <CardTitle>Leave Feedback</CardTitle>
        <CardDescription className="text-zinc-400">How is your child's experience?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-medium text-zinc-300">Rating</label>
          <div className="flex gap-1 cursor-pointer">
            {[1, 2, 3, 4, 5].map((star) => (
              <span 
                key={star} 
                onClick={() => setRating(star)}
                className={`text-3xl hover:scale-110 transition-transform ${star <= rating ? "text-amber-400" : "text-zinc-700"}`}
              >
                ★
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <label className="text-sm font-medium text-zinc-300">Comments (Optional)</label>
          <textarea
            className="w-full min-h-[100px] p-3 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-700 resize-none text-sm"
            placeholder="Tell us more..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <Button 
          className="w-full" 
          onClick={handleSubmit} 
          disabled={rating === 0 || isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Feedback"}
        </Button>
      </CardContent>
    </Card>
  );
}
