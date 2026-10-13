"use client";

import React, { Suspense, use, type ReactNode } from "react";

/**
 * Skeleton placeholder used while a lazily-loaded section (code chunk or streamed data) arrives.
 */
export function SectionSkeleton({ height = 160 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-xl border border-zinc-800/50 bg-zinc-900/30 animate-pulse"
      style={{ height }}
      aria-busy="true"
      aria-label="Loading"
    />
  );
}

function Resolve<T>({ promise, children }: { promise: Promise<T>; children: (data: T) => ReactNode }) {
  const data = use(promise);
  return <>{children(data)}</>;
}

/**
 * Renders `children(data)` once `promise` resolves, showing `fallback` meanwhile.
 *
 * The org dashboard page starts the queries for rarely-viewed tabs (store, gallery,
 * marketing, AI insights, …) on the server but does NOT await them — the promise is
 * streamed to the browser, so the overview paints as soon as the core queries finish.
 */
export function Deferred<T>({
  promise,
  children,
  fallback,
}: {
  promise: Promise<T>;
  children: (data: T) => ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <Suspense fallback={fallback ?? <SectionSkeleton />}>
      <Resolve promise={promise}>{children}</Resolve>
    </Suspense>
  );
}
