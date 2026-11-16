export const NEXT_CONFIG = `import { withEsqia } from "esqia/next";

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      ...(process.env.NODE_ENV === "development" ? ["esqia/remark"] : []),
    ],
  },
});

export default withEsqia(withMDX(nextConfig));`;

export const OPTIONS = `export default withEsqia(withMDX(nextConfig), {
  snippets: [{ name: "Demo", source: "<Demo />" }],
  marks: [{ name: "Serif", tag: "em", className: "font-serif" }],
  smartypants: { dashes: false },
});`;

export const SNIPPETS = `export default withEsqia(withMDX(nextConfig), {
  snippets: [
    { name: "Demo", source: "<Demo />" },
    { name: "Newsletter", source: "<Newsletter />" },
  ],
});`;

export const MARKS = `export default withEsqia(withMDX(nextConfig), {
  marks: [{ name: "Serif", tag: "em", className: "font-serif" }],
});`;

export const SMARTYPANTS = `export default withEsqia(withMDX(nextConfig), {
  smartypants: { dashes: false },
});`;

export const LAYOUT = `import { Esqia } from "esqia";

{process.env.NODE_ENV === "development" && <Esqia />}`;
