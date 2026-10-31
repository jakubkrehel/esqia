import path from "node:path";
import createMDX from "@next/mdx";
import pierreDarkVibrant from "@pierre/theme/pierre-dark-vibrant";
import pierreLightVibrant from "@pierre/theme/pierre-light-vibrant";
import { withEsqe } from "esqe-dev/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // esqe sits bottom-left, where Next puts its own indicator by default.
  devIndicators: { position: "bottom-right" },
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  reactCompiler: true,
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
  },
};

const withMDX = createMDX({
  options: {
    rehypePlugins: [
      [
        "rehype-pretty-code",
        {
          grid: false,
          keepBackground: false,
          theme: { dark: pierreDarkVibrant, light: pierreLightVibrant },
        },
      ],
    ],
    remarkPlugins: [
      ["remark-smartypants", { dashes: false }],
      ...(process.env.NODE_ENV === "development" ? ["esqe-dev/remark"] : []),
    ],
  },
});

export default withEsqe(withMDX(nextConfig), {
  marks: [{ className: "font-libre-baskerville", name: "Serif", tag: "em" }],
  media: { upload: "public" },
  smartypants: { dashes: false },
});
