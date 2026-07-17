export interface HealthResponse {
  readonly status: "ok";
}

export interface ReadinessResponse {
  readonly status: "ready";
  readonly checks: {
    readonly database: "ok";
  };
}
