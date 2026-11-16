import { defineConfig } from "tsdown";

export default defineConfig([
  {
    clean: true,
    dts: true,
    entry: { next: "src/next.ts", remark: "src/remark.ts" },
    fixedExtension: false,
    format: ["esm"],
    platform: "node",
  },
  {
    banner: '"use client";\n"use no memo";',
    dts: true,
    entry: { index: "src/client/index.tsx" },
    fixedExtension: false,
    format: ["esm"],
    platform: "browser",
  },
]);
