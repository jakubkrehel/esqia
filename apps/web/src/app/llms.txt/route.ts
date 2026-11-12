import { source } from "../source";

export const dynamic = "force-static";

const llmsTxt = `# Esqia

> An inline markdown editor for React.

${source}`;

export function GET() {
  return new Response(llmsTxt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
