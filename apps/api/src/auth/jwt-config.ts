const MINIMUM_JWT_SECRET_LENGTH = 32;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900;

export interface JwtConfig {
  readonly secret: string;
  readonly accessTokenTtlSeconds: number;
}

export function parseJwtConfig(
  environment: NodeJS.ProcessEnv,
): JwtConfig {
  return {
    secret: parseJwtSecret(environment["JWT_SECRET"]),
    accessTokenTtlSeconds: parseAccessTokenTtl(
      environment["JWT_ACCESS_TOKEN_TTL_SECONDS"],
    ),
  };
}

function parseJwtSecret(value: string | undefined): string {
  if (
    value === undefined ||
    value.length < MINIMUM_JWT_SECRET_LENGTH
  ) {
    throw new Error(
      `JWT_SECRET must contain at least ${MINIMUM_JWT_SECRET_LENGTH} characters.`,
    );
  }

  return value;
}

function parseAccessTokenTtl(
  value: string | undefined,
): number {
  if (value === undefined) {
    return DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(
      "JWT_ACCESS_TOKEN_TTL_SECONDS must be a positive integer.",
    );
  }

  const ttlSeconds = Number(value);

  if (
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds <= 0
  ) {
    throw new Error(
      "JWT_ACCESS_TOKEN_TTL_SECONDS must be a positive integer.",
    );
  }

  return ttlSeconds;
}
