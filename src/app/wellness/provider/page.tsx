import { redirect } from "next/navigation";

// Providers manage their profile and bookings in the TRIQ Connect dashboard.
export default function WellnessProviderPage() {
  redirect("/pros/dashboard");
}
