import { describe, it, expect } from "vitest";
import { groupFamilies, parseSiblingSettings, validateSiblingSettings } from "@/lib/family/sibling-settings";

describe("sibling discount settings", () => {
  it("is off unless switched on with a percentage", () => {
    expect(parseSiblingSettings(null).enabled).toBe(false);
    expect(parseSiblingSettings("not json").enabled).toBe(false);
    expect(parseSiblingSettings({ enabled: true, secondChildPercent: 0 }).enabled).toBe(false);
    expect(parseSiblingSettings(JSON.stringify({ enabled: true, secondChildPercent: 10 }))).toEqual({ enabled: true, secondChildPercent: 10, thirdPlusPercent: 10 });
  });

  it("caps at 50% and refuses nonsense", () => {
    expect(validateSiblingSettings({ enabled: true, secondChildPercent: 60 }).ok).toBe(false);
    expect(validateSiblingSettings({ enabled: true, secondChildPercent: -1 }).ok).toBe(false);
    expect(validateSiblingSettings({ enabled: true, secondChildPercent: 0, thirdPlusPercent: 0 }).ok).toBe(false);
    expect(validateSiblingSettings({ enabled: false })).toEqual({ ok: true, settings: { enabled: false, secondChildPercent: 0, thirdPlusPercent: 0 } });
  });
});

describe("groupFamilies", () => {
  it("groups children by shared guardian, including linked guardians", () => {
    const students = [
      { id: "a", parentId: "mum" },
      { id: "b", parentId: "mum" },
      { id: "c", parentId: "dad2" },
      { id: "d", parentId: "solo" },
    ];
    // dad2 is also linked to a, so c joins a and b
    const fam = groupFamilies(students, [{ userId: "dad2", studentId: "a" }]).map((g) => g.sort()).sort((x, y) => y.length - x.length);
    expect(fam).toEqual([["a", "b", "c"], ["d"]]);
  });

  it("ignores links to children outside the list", () => {
    expect(groupFamilies([{ id: "a", parentId: "p" }], [{ userId: "p", studentId: "zzz" }])).toEqual([["a"]]);
  });
});
