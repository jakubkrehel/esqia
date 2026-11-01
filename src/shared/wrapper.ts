import type { BlockType } from "./markdown";

export const WRAPPER = {
  end: "data-esqia-end",
  file: "data-esqia-file",
  removed: "data-esqia-removed",
  run: "data-esqia-run",
  start: "data-esqia-start",
  type: "data-esqia-type",
  version: "data-esqia-v",
} as const;

export const BLOCK_SELECTOR = `[${WRAPPER.file}]`;

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
