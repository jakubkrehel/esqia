import pierreDarkVibrant from "@pierre/theme/pierre-dark-vibrant";
import pierreLightVibrant from "@pierre/theme/pierre-light-vibrant";
import type { ReactNode } from "react";
import { codeToHtml } from "shiki";
import { CopyButton } from "@/components/copy-button";
import {
  CodeIcon,
  NextIcon,
  ReactIcon,
  TypescriptIcon,
} from "@/components/icons";

const NEXT_CONFIG = `import { withEsqia } from "esqia/next";

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      ...(process.env.NODE_ENV === "development" ? ["esqia/remark"] : []),
    ],
  },
});

export default withEsqia(withMDX(nextConfig));`;

const LAYOUT = `import { Esqia } from "esqia";

{process.env.NODE_ENV === "development" && <Esqia />}`;

async function CodeBlock({
  code,
  lang,
  title,
}: {
  code: string;
  lang: string;
  title: string;
}) {
  const html = await codeToHtml(code, {
    defaultColor: false,
    lang,
    themes: { dark: pierreDarkVibrant, light: pierreLightVibrant },
    transformers: [
      {
        code(node) {
          node.properties["data-theme"] = "";
        },
        pre(node) {
          node.properties.class =
            "tab-size-4 scrollbar-thin overflow-x-auto overscroll-x-contain p-3 font-mono text-[13px] [scrollbar-color:var(--color-gray-600)_transparent] **:font-mono [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-1";
          delete node.properties.style;
          delete node.properties.tabindex;
        },
      },
    ],
  });

  return (
    <figure className="preview-code my-8 overflow-hidden">
      <figcaption className="mx-1 mt-1 flex items-center justify-between gap-2 rounded-xl border border-preview-border bg-gray-100 py-1.5 pr-1.5 pl-3">
        <span className="flex min-w-0 items-center gap-2">
          <LanguageIcon lang={lang} title={title} />
          <span className="truncate font-mono text-[13px] text-gray-1100">
            {title}
          </span>
        </span>
        <CopyButton
          className="size-7 rounded-md"
          duration={2000}
          iconClassName="size-4"
          label="Copy code"
          text={code}
        />
      </figcaption>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  );
}

function LanguageIcon({ lang, title }: { lang: string; title: string }) {
  if (title.startsWith("next.config")) {
    return <NextIcon className="size-4 shrink-0 text-gray-1200" />;
  }
  if (lang === "tsx") {
    return <ReactIcon className="size-4 shrink-0 text-[#149eca]" />;
  }
  if (lang === "ts") {
    return <TypescriptIcon className="size-4 shrink-0 text-[#3178c6]" />;
  }
  return <CodeIcon className="size-4 shrink-0 text-gray-1000" />;
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-16 mb-5 font-[550] font-text text-gray-1200">
      {children}
    </h2>
  );
}

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="font-text text-body text-text-paragraph">{children}</p>;
}

function Key({ children }: { children: ReactNode }) {
  return <code className="code-inline">{children}</code>;
}

export function Docs() {
  return (
    <>
      <Heading>Setup</Heading>
      <Paragraph>Add the remark plugin last and wrap your config.</Paragraph>
      <CodeBlock code={NEXT_CONFIG} lang="ts" title="next.config.ts" />
      <Paragraph>Then mount it once in your root layout.</Paragraph>
      <CodeBlock code={LAYOUT} lang="tsx" title="app/layout.tsx" />
      <Paragraph>
        Outside of <Key>next dev</Key> nothing is added and your config is
        returned untouched.
      </Paragraph>
      <Heading>Shortcuts</Heading>
      <ul className="my-2 flex list-['-'] flex-col gap-2 pl-5 marker:text-gray-800">
        <li className="pl-2 font-text text-body text-text-paragraph">
          <Key>⌘</Key> <Key>E</Key> switches between reading and editing.
        </li>
        <li className="pl-2 font-text text-body text-text-paragraph">
          <Key>Esc</Key> or clicking away saves and hands the page back.
        </li>
        <li className="pl-2 font-text text-body text-text-paragraph">
          <Key>⌘</Key> <Key>Z</Key> outside the editor undoes the last change.
        </li>
      </ul>
    </>
  );
}
