import { redirect } from "next/navigation";

/** @deprecated City-specific landing page removed during globalisation. */
export default function GurgaonPage() {
  redirect("/academies");
}
