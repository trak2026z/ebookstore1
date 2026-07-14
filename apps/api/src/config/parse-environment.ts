import type { AppConfig, NodeEnvironment } from "./app-config";

const SUPPORTED_NODE_ENVIRONMENTS: readonly NodeEnvironment[] = [
  "development",
  "test",
  "production",
];

const MIN_PORT = 1;
const MAX_PORT = 65_535;

export function parseEnvironment(environment: NodeJS.ProcessEnv): AppConfig {
  return {
    nodeEnv: parseNodeEnvironment(environment["NODE_ENV"]),
    port: parsePort(environment["PORT"]),
    databaseUrl: parseDatabaseUrl(environment["DATABASE_URL"]),
  };
}

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  if (value !== undefined && SUPPORTED_NODE_ENVIRONMENTS.includes(value as NodeEnvironment)) {
    return value as NodeEnvironment;
  }

  throw new Error(`NODE_ENV must be one of: ${SUPPORTED_NODE_ENVIRONMENTS.join(", ")}.`);
}

function parsePort(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error("PORT must be an integer.");
  }

  const port = Number(value);

  if (!Number.isSafeInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`PORT must be between ${MIN_PORT} and ${MAX_PORT}.`);
  }

  return port;
}

function parseDatabaseUrl(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error("DATABASE_URL is required.");
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid URL.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
  }

  if (url.hostname.length === 0 || url.pathname.length <= 1) {
    throw new Error("DATABASE_URL must include a host and database name.");
  }

  return value;
}
