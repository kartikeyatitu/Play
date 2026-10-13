import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/landing-page";
import { FREE_PLAN } from "@/lib/pricing";

const title = "Triq — Run your sports academy from your phone";
const description = `Attendance in seconds, fees collected on time and parents updated automatically. Built for Indian sports coaches and academies. Free up to ${FREE_PLAN.maxStudents} students.`;

// /home is kept for old links (contact page, emails, QR codes). Canonical URL is "/".
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/", siteName: "Triq", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image", title, description },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LandingPage searchParams={await searchParams} page="/home" />;
}
