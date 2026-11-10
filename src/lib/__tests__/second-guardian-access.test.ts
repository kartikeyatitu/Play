import { describe, it, expect, vi, beforeEach } from "vitest";

const flags = vi.hoisted(() => ({ familyAccounts: true }));
const data = vi.hoisted(() => ({
  students: [
    { id: "kid1", parentId: "mum", orgId: "o1" },
    { id: "kid2", parentId: "other", orgId: "o1" },
  ],
  links: [{ userId: "dad", studentId: "kid1" }],
}));
vi.mock("@/lib/features", () => ({ FEATURES: flags }));
vi.mock("@/lib/db", () => ({
  db: {
    student: { findMany: vi.fn(async ({ where }: any) => data.students.filter((s) => s.parentId === where.parentId)) },
    guardianLink: { findMany: vi.fn(async ({ where }: any) => data.links.filter((l) => l.userId === where.userId)) },
  },
}));

import { myChildrenWhere } from "@/lib/family/guardians";
import { studentAccessFilter } from "@/lib/athlete-access";

beforeEach(() => {
  flags.familyAccounts = true;
});

describe("second guardians", () => {
  it("see the child they are linked to, and nobody else's", async () => {
    expect(await myChildrenWhere("dad")).toEqual({ id: { in: ["kid1"] } });
    expect(await myChildrenWhere("mum")).toEqual({ id: { in: ["kid1"] } });
    expect(await myChildrenWhere("stranger")).toEqual({ id: { in: [] } });
  });

  it("lose access when family accounts are off", async () => {
    flags.familyAccounts = false;
    expect(await myChildrenWhere("dad")).toEqual({ id: { in: [] } });
  });

  it("athlete pages accept the guardian list and keep the academy fence", () => {
    expect(studentAccessFilter({ id: "dad", role: "PARENT", orgId: "o1" }, ["kid1"])).toEqual({ id: { in: ["kid1"] }, orgId: "o1" });
    expect(studentAccessFilter({ id: "dad", role: "PARENT", orgId: "o1" })).toEqual({ parentId: "dad", orgId: "o1" });
  });
});
