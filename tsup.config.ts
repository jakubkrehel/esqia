import { defineConfig } from "tsup";

const external = ["react", "react-dom", "next"];

export default defineConfig([
  {
    entry: { remark: "src/remark.ts", next: "src/next.ts" },
    format: "esm",
    platform: "node",
    target: "node22",
    clean: true,
    external,
  },
  {
    entry: { "client/index": "src/client/index.tsx" },
    format: "esm",
    platform: "browser",
    target: "es2022",
    external,
    banner: { js: '"use client";' },
    // Left as references so Next inlines the values `withEsqe` sets.
    env: {},
  },
]);
