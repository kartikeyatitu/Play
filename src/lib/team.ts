// Team roles and permissions. Pure and client-safe: no DB or server-only imports here.

/** A person's role inside one academy (stored on OrgMembership.role). */
export const TEAM_ROLES = ["OWNER", "MANAGER", "COACH", "STAFF"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** Kinds of support staff (stored on OrgMembership.staffRole when role is STAFF). */
export const STAFF_ROLES = ["RECEPTIONIST", "ACCOUNTANT", "GROUNDSMAN", "PHYSIO", "OTHER"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PAY_TYPES = ["MONTHLY", "PER_SESSION"] as const;
export type PayType = (typeof PAY_TYPES)[number];

export const STAFF_ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LEAVE", "HALF_DAY"] as const;
export type StaffAttendanceStatus = (typeof STAFF_ATTENDANCE_STATUSES)[number];

export const ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  COACH: "Coach",
  STAFF: "Staff",
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  RECEPTIONIST: "Receptionist",
  ACCOUNTANT: "Accountant",
  GROUNDSMAN: "Groundsman",
  PHYSIO: "Physio",
  OTHER: "Other staff",
};

export const ATTENDANCE_LABELS: Record<StaffAttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LEAVE: "On leave",
  HALF_DAY: "Half day",
};

/** Everything a team member can be allowed to do in an academy. */
export const PERMISSIONS = {
  "students.manage": "Add and edit students and parents",
  "batches.manage": "Create and change batches and schedules",
  "attendance.mark": "Mark student attendance",
  "fees.collect": "Record payments and send receipts",
  "fees.manage": "Change fee plans, discounts and dues",
  "leads.manage": "Handle enquiries, trials and admissions",
  "bookings.manage": "Manage facilities and court bookings",
  "team.manage": "Add team members and mark staff attendance",
  "payroll.view": "See salaries and payouts",
  "payroll.manage": "Set salaries and mark payouts as paid",
  "reports.view": "See reports and analytics",
  "settings.manage": "Academy settings, payment setup and billing",
  "store.manage": "Manage kit store products and orders",
  "sponsorship.manage": "Manage sponsors, campaigns, proposals and deliverables",
  "funding.approve": "Approve sponsorship money commitments and scholarship budgets",
} as const;
export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

const STAFF_DEFAULTS: Record<StaffRole, Permission[]> = {
  RECEPTIONIST: ["students.manage", "leads.manage", "fees.collect", "store.manage"],
  ACCOUNTANT: ["fees.collect", "fees.manage", "payroll.view", "payroll.manage", "reports.view"],
  GROUNDSMAN: ["bookings.manage"],
  PHYSIO: [],
  OTHER: [],
};

/** Default permissions for a role (and staff role), before any per-person overrides. */
export function defaultPermissions(role: TeamRole, staffRole?: StaffRole | null): Permission[] {
  switch (role) {
    case "OWNER":
      return [...ALL_PERMISSIONS];
    case "MANAGER":
      // Money commitments (funding.approve) stay with the owner unless granted to a person explicitly.
      return ALL_PERMISSIONS.filter((p) => p !== "settings.manage" && p !== "funding.approve");
    case "COACH":
      return ["attendance.mark"];
    case "STAFF":
      return STAFF_DEFAULTS[(staffRole as StaffRole) || "OTHER"] ?? [];
  }
}

/** Default permissions plus the overrides stored on the membership (JSON object of booleans). */
export function effectivePermissions(role: string, staffRole?: string | null, overridesJson?: string | null): Set<Permission> {
  const base = new Set<Permission>(isTeamRole(role) ? defaultPermissions(role, isStaffRole(staffRole) ? staffRole : null) : []);
  if (role === "OWNER") return base; // owners always have everything
  const overrides = parsePermissionOverrides(overridesJson);
  for (const [perm, allowed] of Object.entries(overrides)) {
    if (!isPermission(perm) || perm === "settings.manage") continue; // settings stay owner-only
    if (allowed) base.add(perm);
    else base.delete(perm);
  }
  return base;
}

export function parsePermissionOverrides(json?: string | null): Record<string, boolean> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed)) if (isPermission(k) && typeof v === "boolean") out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** Which app a person lands in for an academy, based on their role there. */
export function appRoleFor(role: TeamRole): "ADMIN" | "COACH" | "STAFF" {
  if (role === "OWNER" || role === "MANAGER") return "ADMIN";
  if (role === "COACH") return "COACH";
  return "STAFF";
}

export function roleLabel(role: string, staffRole?: string | null): string {
  if (role === "STAFF" && isStaffRole(staffRole)) return STAFF_ROLE_LABELS[staffRole];
  return isTeamRole(role) ? ROLE_LABELS[role] : role;
}

export const isTeamRole = (v: unknown): v is TeamRole => typeof v === "string" && (TEAM_ROLES as readonly string[]).includes(v);
export const isStaffRole = (v: unknown): v is StaffRole => typeof v === "string" && (STAFF_ROLES as readonly string[]).includes(v);
export const isPayType = (v: unknown): v is PayType => typeof v === "string" && (PAY_TYPES as readonly string[]).includes(v);
export const isPermission = (v: unknown): v is Permission => typeof v === "string" && v in PERMISSIONS;
export const isStaffAttendanceStatus = (v: unknown): v is StaffAttendanceStatus =>
  typeof v === "string" && (STAFF_ATTENDANCE_STATUSES as readonly string[]).includes(v);
