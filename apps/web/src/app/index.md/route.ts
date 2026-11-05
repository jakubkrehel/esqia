import { source } from "../source";

export const dynamic = "force-static";

export function GET() {
  return new Response(source, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
