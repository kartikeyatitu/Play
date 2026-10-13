import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { getMyAttendance } from "@/app/actions/team";
import { StaffHome } from "@/components/team/StaffHome";

export const metadata: Metadata = { title: "Triq | Staff" };

/** Home for support staff (receptionist, accountant, groundsman, physio): daily check-in and their month. */
export default async function StaffPage() {
  const session = await requireAuth(["STAFF"]);
  if (!session.orgId) redirect("/login");
  const data = await getMyAttendance();
  return <StaffHome name={session.name || "there"} data={data} logoutAction={logout} />;
}
