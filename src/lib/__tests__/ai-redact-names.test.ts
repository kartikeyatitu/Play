import { describe, expect, it } from "vitest";
import { redactForModel, redactNames, type NamedPerson } from "@/lib/ai/redact-names";

const child = (name: string): NamedPerson => ({ name, role: "child" });
const parent = (name: string): NamedPerson => ({ name, role: "parent" });

describe("redactNames", () => {
  it("replaces student and parent names with stable role placeholders", () => {
    const people = [child("Aarav Sharma"), parent("Meera Sharma")];
    const r = redactNames("Aarav Sharma's mother Meera Sharma called about Aarav Sharma.", people);
    expect(r.redacted).toBe("[Child 1]'s mother [Parent 1] called about [Child 1].");
  });

  it("lets the longest name win over a shorter one at the same position", () => {
    const r = redactNames("Ravi Kumar paid; Ravi is absent.", [child("Ravi"), child("Ravi Kumar")]);
    // Sorted alphabetically: "Ravi" is Child 1, "Ravi Kumar" is Child 2.
    expect(r.redacted).toBe("[Child 2] paid; [Child 1] is absent.");
  });

  it("matches case-insensitively and across extra whitespace inside a name", () => {
    const r = redactNames("ANJALI  RAO and anjali rao and Anjali Rao", [child("Anjali Rao")]);
    expect(r.redacted).toBe("[Child 1] and [Child 1] and [Child 1]");
  });

  it("restore() maps placeholders in a model reply back to the names", () => {
    const people = [child("Aarav Sharma"), parent("Meera Sharma")];
    const original = "Aarav Sharma is improving. Tell Meera Sharma about it.";
    const r = redactNames(original, people);
    expect(r.restore(r.redacted)).toBe(original);
    expect(r.restore("[Parent 1] should hear that [child 1] is improving.")).toBe(
      "Meera Sharma should hear that Aarav Sharma is improving.",
    );
  });

  it("restore() leaves unknown placeholders alone", () => {
    const r = redactNames("Hello Ravi", [child("Ravi")]);
    expect(r.restore("[Child 9] and [Parent 1]")).toBe("[Child 9] and [Parent 1]");
  });

  it("does not replace names inside other words", () => {
    const r = redactNames("Ravindra and Ravi and Braviness", [child("Ravi")]);
    expect(r.redacted).toBe("Ravindra and [Child 1] and Braviness");
  });

  it("treats an apostrophe as a word boundary", () => {
    const r = redactNames("Ravi's fee is due", [child("Ravi")]);
    expect(r.redacted).toBe("[Child 1]'s fee is due");
  });

  it("escapes punctuation in names", () => {
    const r = redactNames("Ann-Marie O'Neil and Ann-Marie O'Neil.", [parent("Ann-Marie O'Neil")]);
    expect(r.redacted).toBe("[Parent 1] and [Parent 1].");
  });

  it("gives the same placeholders whatever order the roster arrives in", () => {
    const a = redactNames("Zoya and Asha", [child("Zoya"), child("Asha")]);
    const b = redactNames("Zoya and Asha", [child("Asha"), child("Zoya")]);
    expect(a.redacted).toBe("[Child 2] and [Child 1]");
    expect(b.redacted).toBe(a.redacted);
  });

  it("ignores duplicate names and names too short to match safely", () => {
    const r = redactNames("A is here, Dev is here, Dev again", [child("A"), child("Dev"), child("dev  ")]);
    expect(r.redacted).toBe("A is here, [Child 1] is here, [Child 1] again");
  });

  it("returns the text unchanged when the roster is empty", () => {
    const r = redactNames("Nothing to hide", []);
    expect(r.redacted).toBe("Nothing to hide");
    expect(r.restore("ok")).toBe("ok");
  });
});

describe("redactForModel", () => {
  it("also strips emails, phone numbers and dates of birth before names", () => {
    const people = [parent("Meera Sharma")];
    const r = redactForModel(
      "Meera Sharma meera@example.com +91 98765 43210 DOB 12/03/2015, born 3 March 2016",
      people,
    );
    expect(r.redacted).toBe("[Parent 1] [email removed] [number removed] DOB [date removed], born [date removed]");
  });

  it("keeps month-only dates, which the reports and questions use", () => {
    expect(redactForModel("Collections in March 2026", []).redacted).toBe("Collections in March 2026");
  });
});
