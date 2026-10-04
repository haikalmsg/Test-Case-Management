"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border bg-white p-10 text-center">
      <h2 className="text-xl font-semibold">We couldn’t load this page</h2>
      <p className="my-4 text-sm text-muted-foreground">
        Check your connection and Supabase configuration, then try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
