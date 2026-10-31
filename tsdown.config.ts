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
    // Next needs the directive at the top of the client entry to treat it as a client component.
    banner: '"use client";',
    dts: true,
    entry: { index: "src/client/index.tsx" },
    fixedExtension: false,
    format: ["esm"],
    platform: "browser",
  },
]);
