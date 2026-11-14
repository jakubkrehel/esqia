import { source } from "../source";

export const dynamic = "force-static";

const llmsTxt = `# Esqia

> An inline MDX editor for Next.js.

${source}`;

export function GET() {
  return new Response(llmsTxt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
