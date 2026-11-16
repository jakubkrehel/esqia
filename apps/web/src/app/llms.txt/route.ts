import { LAYOUT, NEXT_CONFIG, OPTIONS } from "@/lib/snippets";
import { source } from "../source";

export const dynamic = "force-static";

const prose = source
  .replace(/^<[A-Z]\w*[^>]*\/>\n+/gm, "")
  .replace(/<[A-Z]\w*[^>]*\/>/g, "")
  .trim();

const llmsTxt = `# Esqia

> An inline MDX editor for Next.js.

${prose}

## Setup

\`\`\`sh
npm install -D esqia
\`\`\`

Add \`esqia/remark\` after your other remark plugins and wrap your Next.js config with \`withEsqia\`.

\`\`\`ts
${NEXT_CONFIG}
\`\`\`

Then add the \`<Esqia />\` component to your root layout. Esqia only runs in development, so nothing changes in production.

\`\`\`tsx
${LAYOUT}
\`\`\`

To configure it, pass options as the second argument to \`withEsqia\`.

\`\`\`ts
${OPTIONS}
\`\`\`
`;

export function GET() {
  return new Response(llmsTxt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
