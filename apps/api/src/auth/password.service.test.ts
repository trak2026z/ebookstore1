import { describe, expect, it } from "vitest";

import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("hashes and verifies a password", async () => {
    const password = "Correct-Horse-42";
    const passwordHash = await service.hash(password);

    expect(passwordHash).not.toBe(password);
    await expect(service.verify(passwordHash, password)).resolves.toBe(true);
    await expect(service.verify(passwordHash, "wrong-password")).resolves.toBe(false);
  });
});
