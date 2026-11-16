# esqia

An easy way to edit MDX directly on your page.

```sh
npm install -D esqia
```

Add `esqia/remark` after your other remark plugins and wrap your config.

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

Then render it in your root layout.

```tsx
// app/layout.tsx
import { Esqia } from "esqia";

{process.env.NODE_ENV === "development" && <Esqia />}
```

Press ⌘⌥E, click into any markdown on the page and edit it. The change is saved to the `.mdx` file.

Esqia only runs in `next dev` and requires Next.js 15 and React 19 or later.

Options, shortcuts and a live demo are available at [esqia.jakub.kr](https://esqia.jakub.kr).

## License

MIT
