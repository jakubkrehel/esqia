import type { Smartypants } from "./markdown";

export interface EsqiaOptions {
  /** Inline JSX the toolbar can wrap a selection in, e.g. a font. */
  marks?: { name: string; tag: string; className: string }[];
  media?: {
    /** Where pasted and dropped files go. Defaults to Vercel Blob when a token is set, else `public/`. */
    upload?: "vercel-blob" | "public";
    /** Path prefix for uploads. `{dir}` is the name of the folder the MDX file sits in. */
    path?: string;
    /** Inserted for an image. Placeholders: `{url}`, `{width}`, `{height}`, `{name}`. */
    image?: string;
    /** Inserted for a video. Same placeholders as `image`. */
    video?: string;
  };
  /** The options you pass to `remark-smartypants`, so the editor shows the same punctuation the page does. */
  smartypants?: Smartypants;
  /** Blocks offered in the `/` menu, inserted verbatim. */
  snippets?: { name: string; source: string }[];
}

export interface ClientConfig {
  marks: NonNullable<EsqiaOptions["marks"]>;
  media: { image: string; video: string };
  smartypants: Smartypants;
  snippets: NonNullable<EsqiaOptions["snippets"]>;
}

/** The options with defaults filled in, as the client uses them. */
export function clientConfig(options: EsqiaOptions): ClientConfig {
  return {
    marks: options.marks ?? [],
    media: {
      image:
        options.media?.image ??
        '<Image src="{url}" alt="" width={{width}} height={{height}} />',
      video:
        options.media?.video ??
        '<Video src="{url}" width={{width}} height={{height}} />',
    },
    smartypants: options.smartypants ?? false,
    snippets: options.snippets ?? [],
  };
}
