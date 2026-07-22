import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./normalize-email";

describe("normalizeEmail", () => {
  it("trims surrounding whitespace and converts the email to lowercase", () => {
    expect(normalizeEmail(" User@Example.COM ")).toBe("user@example.com");
  });
});
