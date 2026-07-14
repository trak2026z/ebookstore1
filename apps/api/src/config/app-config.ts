export const APP_CONFIG = Symbol("APP_CONFIG");

export type NodeEnvironment = "development" | "test" | "production";

export interface AppConfig {
  readonly nodeEnv: NodeEnvironment;
  readonly port: number;
  readonly databaseUrl: string;
}
