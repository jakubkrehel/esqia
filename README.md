# esqia

Edit a Next.js site's MDX from the rendered page during development. Press the square button in the bottom-left (or ⌘⌥E), click any paragraph or heading and type. Changes save into the `.mdx` file and Fast Refresh renders the real page.

## Setup

```ts
// next.config.ts
import { withEsqia } from "esqia/next";

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      // …your plugins
      ...(process.env.NODE_ENV === "development" ? ["esqia/remark"] : []),
    ],
  },
});

export default withEsqia(withMDX(nextConfig), {
  snippets: [{ name: "Demo", source: "<Demo />" }],
  marks: [{ name: "Serif", tag: "em", className: "font-serif" }],
  smartypants: { dashes: false },
});
```

```tsx
// app/layout.tsx
import { Esqia } from "esqia";

{process.env.NODE_ENV === "development" && <Esqia />}
```

Keep `esqia/remark` last. The button sits bottom-left, where Next shows its dev indicator by default, so move Next's with `devIndicators: { position: "bottom-right" }`. Outside `next dev`, nothing is added and the config is returned untouched.

## How it works

- **`esqia/remark`** wraps each top-level block in a `display: contents` div that records its file, source offsets, type and a hash of the file.
- **`withEsqia`** starts a sidecar on `127.0.0.1`, on a port derived from the project path. It reads files, applies edits that must still match the text they replace and keeps undo history. It accepts only localhost origins and a per-project token, and it only touches `.md` and `.mdx` files inside the project.
- **`<Esqia />`** draws its UI in a shadow root. Clicking a block hides the rendered run of text blocks around it, up to the nearest JSX on either side, and mounts a ProseMirror editor in its place. The editor's elements are cloned from the page, so it looks like the site. Blocks you didn't touch are written back byte for byte.

## Editing

| | |
| --- | --- |
| ⌘⌥E | Switches between reading and editing |
| Select text | Toolbar: bold, italic, code, link, your `marks` |
| `/` on an empty line | Text, headings, code block, line break, your `snippets` |
| `- `, `* ` or `+ ` | Starts a bulleted list; `1. ` or `1) ` starts a numbered one |
| Enter in a list | Adds an item; on an empty item, ends the list |
| Backspace at the start of the first item | Turns it back into text |
| ⇧↵ in a paragraph | Splits it with a `<br />` between the halves; typing `<br />` on a line adds one too |
| ⌘⇧↑ / ⌘⇧↓ | Moves the block or list item under the caret |
| ↑ / ↓ at the edge of the editor | Moves into the next run of text |
| Hover a block | Trash deletes it; `+` inserts a block below; drag the grip to move it |
| ⌥-click a block | Opens your editor at that block's line |
| Esc or click away | Saves and hands the page back |
| ⌘Z | Inside the editor, undoes typing; outside it, undoes the last write, and ⌘⇧Z redoes it |

If the file changes in your editor mid-session, the write is refused and the editor closes. Click the block to reopen it from disk.

## Development

```sh
pnpm build   # tsdown
pnpm test    # round trip over every content.mdx in ../jakub.kr and ../interfaces, ops, sidecar
```
