import path from "node:path";
import createMDX from "@next/mdx";
import pierreDarkVibrant from "@pierre/theme/pierre-dark-vibrant";
import pierreLightVibrant from "@pierre/theme/pierre-light-vibrant";
import { withEsqia } from "esqia/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: { position: "bottom-right" },
  images: {
    remotePatterns: [
      new URL("https://oiszjiwtfc65cwa2.public.blob.vercel-storage.com/**"),
    ],
  },
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
          defaultLang: { block: "plaintext" },
          grid: false,
          keepBackground: false,
          theme: { dark: pierreDarkVibrant, light: pierreLightVibrant },
        },
      ],
    ],
    remarkPlugins: [["remark-smartypants", { dashes: false }], "esqia/remark"],
  },
});

export default withEsqia(withMDX(nextConfig), {
  smartypants: { dashes: false },
});
