import { describe, expect, it } from "vitest";

import type { HealthResponse } from "./index.js";

describe("HealthResponse", () => {
  it("accepts the supported health status", () => {
    const response: HealthResponse = { status: "ok" };

    expect(response.status).toBe("ok");
  });
});
