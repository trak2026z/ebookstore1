import { describe, expect, it } from "vitest";

import { parseJwtConfig } from "./jwt-config";

const validSecret =
  "test-secret-with-at-least-thirty-two-characters";

describe("parseJwtConfig", () => {
  it("returns configured values", () => {
    expect(
      parseJwtConfig({
        JWT_SECRET: validSecret,
        JWT_ACCESS_TOKEN_TTL_SECONDS: "1200",
      }),
    ).toEqual({
      secret: validSecret,
      accessTokenTtlSeconds: 1200,
    });
  });

  it("uses the default TTL", () => {
    expect(
      parseJwtConfig({
        JWT_SECRET: validSecret,
      }).accessTokenTtlSeconds,
    ).toBe(900);
  });

  it.each([undefined, "", "too-short"])(
    "rejects an invalid JWT secret %j",
    (jwtSecret) => {
      expect(() =>
        parseJwtConfig({
          JWT_SECRET: jwtSecret,
        }),
      ).toThrow(
        "JWT_SECRET must contain at least 32 characters.",
      );
    },
  );

  it.each(["", "abc", "1.5", "0", "-1"])(
    "rejects an invalid TTL %j",
    (ttl) => {
      expect(() =>
        parseJwtConfig({
          JWT_SECRET: validSecret,
          JWT_ACCESS_TOKEN_TTL_SECONDS: ttl,
        }),
      ).toThrow(
        "JWT_ACCESS_TOKEN_TTL_SECONDS must be a positive integer.",
      );
    },
  );
});
