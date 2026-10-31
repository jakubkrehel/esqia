import type { NextConfig } from "next";
import { type EsqeOptions, sidecarAddress, startSidecar } from "./server/server";

export type { EsqeOptions } from "./server/server";

type ConfigFunction = (phase: string, context: { defaultConfig: NextConfig }) => NextConfig | Promise<NextConfig>;

const shared = globalThis as typeof globalThis & { __esqeSidecar?: Promise<unknown> };

/**
 * Starts the editing sidecar during `next dev` and tells the client where to find it.
 * Returns the config untouched in any other environment. Returns an object for an
 * object, so wrappers that must stay outermost (like `withInterfere`) can still wrap it.
 */
export function withEsqe<T extends NextConfig | ConfigFunction>(config: T, options: EsqeOptions = {}): T {
  if (process.env.NODE_ENV !== "development") return config;

  const root = process.cwd();
  const { url, token } = sidecarAddress(root);
  shared.__esqeSidecar ??= startSidecar(root, options).catch((error: unknown) => {
    console.error(`esqe: ${error instanceof Error ? error.message : String(error)}`);
  });

  const withEnv = (resolved: NextConfig): NextConfig => ({
    ...resolved,
    env: { ...resolved.env, NEXT_PUBLIC_ESQE_URL: url, NEXT_PUBLIC_ESQE_TOKEN: token },
  });

  if (typeof config === "function") {
    return (async (phase: string, context: { defaultConfig: NextConfig }) => withEnv(await config(phase, context))) as T;
  }
  return withEnv(config) as T;
}
