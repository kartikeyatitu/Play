import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LevelProvider } from "@/components/mind/reading-level";

// C1 content is not indexed until the sports-psychologist review is recorded.
export const metadata: Metadata = {
  title: "Mind & Performance | Triq",
  robots: { index: false, follow: false },
};

// The reading-level choice lives in this provider for the visit only; it is never stored.
export default function MindLayout({ children }: { children: ReactNode }) {
  return <LevelProvider>{children}</LevelProvider>;
}
