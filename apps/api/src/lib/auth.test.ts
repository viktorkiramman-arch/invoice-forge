import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth.js";

describe("password hashing", () => {
  it("accepts the original password and rejects another value", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("incorrect", stored)).toBe(false);
  });

  it("rejects malformed stored password values without comparing them", () => {
    expect(verifyPassword("anything", "")).toBe(false);
    expect(verifyPassword("anything", "missing-delimiter")).toBe(false);
    expect(verifyPassword("anything", "salt:not-hex")).toBe(false);
  });
});
