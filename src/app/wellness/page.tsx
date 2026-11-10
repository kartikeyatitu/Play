import { redirect } from "next/navigation";

// Wellness providers live in TRIQ Connect now (one directory, same providers and bookings).
export default function WellnessPage() {
  redirect("/pros");
}
