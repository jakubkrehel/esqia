# esqia

Edit the MDX on your Next.js site from the page itself. It only runs in `next dev`.

Press ⌘⌥E, click a paragraph and type. The change is saved to the `.mdx` file.

## Install

```sh
pnpm add -D esqia
```

## Setup

Wrap your config and add the remark plugin last.

```ts
// next.config.ts
import { withEsqia } from "esqia/next";

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      ...(process.env.NODE_ENV === "development" ? ["esqia/remark"] : []),
    ],
  },
});

export default withEsqia(withMDX(nextConfig));
```

Then render it in your layout.

```tsx
// app/layout.tsx
import { Esqia } from "esqia";

{process.env.NODE_ENV === "development" && <Esqia />}
```

The button sits in the bottom-left corner, where Next puts its dev indicator. Move Next's with `devIndicators: { position: "bottom-right" }`.

## Options

`withEsqia` takes a second argument.

```ts
withEsqia(withMDX(nextConfig), {
  snippets: [{ name: "Demo", source: "<Demo />" }],
  marks: [{ name: "Serif", tag: "em", className: "font-serif" }],
  smartypants: { dashes: false },
});
```

`snippets` show up in the `/` menu and `marks` in the selection toolbar.

## Editing

| | |
| --- | --- |
| ⌘⌥E | Turn editing on or off |
| Select text | Bold, italic, code, link and your marks |
| `/` on an empty line | Headings, code blocks, line breaks and your snippets |
| ⇧↵ | Line break |
| ⌘⇧↑ / ⌘⇧↓ | Move the block or list item |
| Hover a block | Delete it, add one below or drag it |
| ⌥-click a block | Open it in your editor |
| Esc or click away | Save |
| ⌘Z / ⌘⇧Z | Undo and redo |

If the file changes on disk while you are editing, the save is refused. Click the block to open it again.

## Development

```sh
pnpm dev
pnpm test
```
