import type { NextConfig } from "next";
import {
  type EsqiaOptions,
  sidecarAddress,
  startSidecar,
} from "./server/server";

export type { EsqiaOptions } from "./server/server";

type ConfigFunction = (
  phase: string,
  context: { defaultConfig: NextConfig }
) => NextConfig | Promise<NextConfig>;

const shared = globalThis as typeof globalThis & {
  __esqiaSidecar?: Promise<unknown>;
};

export function withEsqia<T extends NextConfig | ConfigFunction>(
  config: T,
  options: EsqiaOptions = {}
): T {
  if (process.env.NODE_ENV !== "development") {
    return config;
  }

  const root = process.cwd();
  const { url, token } = sidecarAddress(root);
  shared.__esqiaSidecar ??= startSidecar(root, options).catch(
    (error: unknown) => {
      console.error(
        `esqia: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  );

  const withEnv = (resolved: NextConfig): NextConfig => ({
    ...resolved,
    env: {
      ...resolved.env,
      NEXT_PUBLIC_ESQIA_TOKEN: token,
      NEXT_PUBLIC_ESQIA_URL: url,
    },
  });

  if (typeof config === "function") {
    return (async (phase: string, context: { defaultConfig: NextConfig }) =>
      withEnv(await config(phase, context))) as T;
  }
  return withEnv(config) as T;
}
