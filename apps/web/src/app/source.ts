import { readFileSync } from "node:fs";
import path from "node:path";

export const CONTENT = "src/app/content.mdx";
export const source = readFileSync(path.join(process.cwd(), CONTENT), "utf8");
