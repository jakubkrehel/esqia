import type { Smartypants } from "./markdown";

export interface EsqiaOptions {
  /** Inline JSX the toolbar can wrap a selection in, e.g. a font. */
  marks?: { name: string; tag: string; className: string }[];
  /** The options you pass to `remark-smartypants`, so the editor shows the same punctuation the page does. */
  smartypants?: Smartypants;
  /** Blocks offered in the `/` menu, inserted verbatim. */
  snippets?: { name: string; source: string }[];
}

export interface ClientConfig {
  marks: NonNullable<EsqiaOptions["marks"]>;
  smartypants: Smartypants;
  snippets: NonNullable<EsqiaOptions["snippets"]>;
}

/** The options with defaults filled in, as the client uses them. */
export function clientConfig(options: EsqiaOptions): ClientConfig {
  return {
    marks: options.marks ?? [],
    smartypants: options.smartypants ?? false,
    snippets: options.snippets ?? [],
  };
}
