import type { RootContent } from "mdast";
import { type BlockType, blockType, parseMdx } from "./markdown";

export const WRAPPER = {
  end: "data-esqia-end",
  file: "data-esqia-file",
  removed: "data-esqia-removed",
  start: "data-esqia-start",
  type: "data-esqia-type",
  version: "data-esqia-v",
} as const;

export const BLOCK_SELECTOR = `[${WRAPPER.file}]`;
export const SAMPLES = "data-esqia-samples";

export interface WrapperFields {
  end: number;
  file: string;
  start: number;
  type: BlockType;
  version: string;
}

export function wrapperAttributes(fields: WrapperFields): [string, string][] {
  return [
    [WRAPPER.file, fields.file],
    [WRAPPER.start, String(fields.start)],
    [WRAPPER.end, String(fields.end)],
    [WRAPPER.type, fields.type],
    [WRAPPER.version, fields.version],
  ];
}

export function blockFields(
  node: RootContent,
  file: string,
  version: string
): WrapperFields | null {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined || node.type === "mdxjsEsm") {
    return null;
  }
  return { end, file, start, type: blockType(node), version };
}

export function sourceBlocks(
  source: string,
  file: string,
  version: string
): WrapperFields[] {
  return parseMdx(source).children.flatMap(
    (node) => blockFields(node, file, version) ?? []
  );
}
