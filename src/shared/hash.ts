import { createHash } from "node:crypto";

export function hashSource(source: string): string {
  return createHash("sha1").update(source).digest("hex").slice(0, 10);
}
