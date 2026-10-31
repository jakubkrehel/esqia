# esqe

Edit a Next.js site's MDX from the rendered page during development. Press the feather button in the bottom-left (or ⌘⇧E), click any paragraph or heading and type. Changes save into the `.mdx` file and Fast Refresh renders the real page.

## Setup

```ts
// next.config.ts
import { withEsqe } from "esqe-dev/next";

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      // …your plugins
      ...(process.env.NODE_ENV === "development" ? ["esqe-dev/remark"] : []),
    ],
  },
});

export default withEsqe(withMDX(nextConfig), {
  marks: [{ className: "font-libre-baskerville", name: "Serif", tag: "em" }],
  snippets: [{ name: "Demo", source: "<Demo />" }],
  media: { path: "{dir}/" },
});
```

```tsx
// app/layout.tsx
import { Esqe } from "esqe-dev";

{process.env.NODE_ENV === "development" && <Esqe />}
```

Keep `esqe-dev/remark` last. The button sits bottom-left, where Next shows its dev indicator by default, so move Next's with `devIndicators: { position: "bottom-right" }`. Outside `next dev`, nothing is added and the config is returned untouched.

## How it works

- **`esqe-dev/remark`** wraps each top-level block in a `display: contents` div that records its file, source offsets, type and a hash of the file.
- **`withEsqe`** starts a sidecar on `127.0.0.1`, on a port derived from the project path. It reads files, applies edits that must still match the text they replace, uploads media and keeps undo history. It accepts only localhost origins and a per-project token, and it only touches `.md` and `.mdx` files inside the project.
- **`<Esqe />`** draws its UI in a shadow root. Clicking a block hides the rendered run of text blocks around it, up to the nearest JSX on either side, and mounts a ProseMirror editor in its place. The editor's elements are cloned from the page, so it looks like the site. Blocks you didn't touch are written back byte for byte.

## Editing

| | |
| --- | --- |
| Select text | Toolbar: Text / H2 / H3, bold, italic, code, link, your `marks` |
| `/` on an empty line | Headings, code block, spacer, image, video, your `snippets` |
| Paste or drop an image/video | Uploads it (Vercel Blob if `BLOB_READ_WRITE_TOKEN` is set, else `public/`) and inserts `media.image` / `media.video` |
| Hover a block | `+` adds a paragraph below; drag the grip to move it; click the grip to delete it |
| Esc or click away | Saves and hands the page back |
| ⌘Z outside the editor | Undoes the last write |

If the file changes in your editor mid-session, the write is refused and the block reopens from disk.

## Development

```sh
pnpm build   # tsup + tsc declarations
pnpm test    # round trip over every content.mdx in ../jakub.kr and ../interfaces, ops, sidecar
```
