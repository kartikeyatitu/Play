-- Applied to production (Supabase project "Sportos") on 2026-10-14.
-- Blocks direct access through Supabase's public REST API. The Triq server connects as the table
-- owner (postgres) and is not affected.
ALTER TABLE "ListedAcademy"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginToken"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectoryLead"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClaimRequest"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesLead"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimit"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Receipt"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingInvoice"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TurfBooking"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrgMembership"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffAttendance" ENABLE ROW LEVEL SECURITY;
