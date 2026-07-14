import { describe, expect, it } from "vitest";

import { parseEnvironment } from "./parse-environment";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "development",
  PORT: "3001",
  DATABASE_URL: "postgresql://ebookstore:ebookstore_dev@postgres:5432/ebookstore",
};

describe("parseEnvironment", () => {
  it("returns a typed configuration for valid values", () => {
    expect(parseEnvironment(validEnvironment)).toEqual({
      nodeEnv: "development",
      port: 3001,
      databaseUrl: "postgresql://ebookstore:ebookstore_dev@postgres:5432/ebookstore",
    });
  });

  it.each(["", "local", "staging"])("rejects unsupported NODE_ENV value %j", (nodeEnv) => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        NODE_ENV: nodeEnv,
      }),
    ).toThrow("NODE_ENV must be one of");
  });

  it.each(["", "abc", "1.5", "0", "65536"])("rejects invalid PORT value %j", (port) => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        PORT: port,
      }),
    ).toThrow("PORT must");
  });

  it("rejects a missing DATABASE_URL", () => {
    const environment = { ...validEnvironment };
    delete environment.DATABASE_URL;

    expect(() => parseEnvironment(environment)).toThrow("DATABASE_URL is required.");
  });

  it.each(["not-a-url", "mysql://user:password@database:3306/ebookstore", "postgresql://database"])(
    "rejects invalid DATABASE_URL value %j",
    (databaseUrl) => {
      expect(() =>
        parseEnvironment({
          ...validEnvironment,
          DATABASE_URL: databaseUrl,
        }),
      ).toThrow("DATABASE_URL must");
    },
  );
});
