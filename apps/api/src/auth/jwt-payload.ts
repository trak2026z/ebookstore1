export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: "USER" | "ADMIN";
}

export function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload["sub"] === "string" &&
    payload["sub"].length > 0 &&
    typeof payload["email"] === "string" &&
    (payload["role"] === "USER" || payload["role"] === "ADMIN")
  );
}
