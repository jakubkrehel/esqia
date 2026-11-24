import pierreDarkVibrant from "@pierre/theme/pierre-dark-vibrant";
import pierreLightVibrant from "@pierre/theme/pierre-light-vibrant";
import { IconReact } from "central-icons/IconReact";
import { IconTypescript } from "central-icons/IconTypescript";
import { IconCodeMedium } from "central-icons-outlined/IconCodeMedium";
import { Fragment, type ReactNode } from "react";
import {
  type BundledLanguage,
  codeToTokens,
  type ThemeRegistration,
} from "shiki";
import { CopyButton } from "@/components/copy-button";
import { NextIcon } from "@/components/icons";
import {
  LAYOUT,
  MARKS,
  NEXT_CONFIG,
  OPTIONS,
  SMARTYPANTS,
  SNIPPETS,
} from "@/lib/snippets";

function shikiTheme(theme: typeof pierreLightVibrant): ThemeRegistration {
  return {
    colors: theme.colors,
    name: theme.name,
    tokenColors: [...theme.tokenColors],
    type: theme.type,
  };
}

const THEMES = {
  dark: shikiTheme(pierreDarkVibrant),
  light: shikiTheme(pierreLightVibrant),
};

async function CodeBlock({
  code,
  lang,
  title,
}: {
  code: string;
  lang: BundledLanguage;
  title: string;
}) {
  const { tokens } = await codeToTokens(code, {
    defaultColor: false,
    lang,
    themes: THEMES,
  });

  return (
    <figure className="preview-code my-6 overflow-hidden">
      <figcaption className="mx-1 mt-1 flex items-center justify-between gap-2 rounded-xl bg-gray-100 py-1.5 shadow-custom pr-1.5 pl-3">
        <span className="flex min-w-0 items-center gap-2">
          <LanguageIcon lang={lang} title={title} />
          <span className="truncate font-mono text-small text-gray-1100">
            {title}
          </span>
        </span>
        <CopyButton duration={2000} label="Copy code" size="sm" text={code} />
      </figcaption>
      <pre className="tab-size-4 scrollbar-thin overflow-x-auto overscroll-x-contain p-3 font-mono text-small [scrollbar-color:var(--color-gray-600)_transparent] **:font-mono [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-1">
        <code data-theme="">
          {tokens.map((line, index) => (
            <Fragment key={index}>
              {index > 0 && "\n"}
              <span>
                {line.map((token) => (
                  <span key={token.offset} style={token.htmlStyle}>
                    {token.content}
                  </span>
                ))}
              </span>
            </Fragment>
          ))}
        </code>
      </pre>
    </figure>
  );
}

function LanguageIcon({ lang, title }: { lang: string; title: string }) {
  if (title.startsWith("next.config")) {
    return <NextIcon className="size-4 shrink-0 text-gray-1200" />;
  }
  if (lang === "tsx") {
    return <IconReact className="size-4 shrink-0 text-react" />;
  }
  if (lang === "ts") {
    return <IconTypescript className="size-4 shrink-0 text-typescript" />;
  }
  return <IconCodeMedium className="size-4 shrink-0 text-gray-1000" />;
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-16 mb-4 font-demibold font-text text-gray-1200 text-xl sm:mt-24">
      {children}
    </h2>
  );
}

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="font-text text-body text-text-paragraph">{children}</p>;
}

function InlineCode({ children }: { children: ReactNode }) {
  return <code className="code-inline">{children}</code>;
}

export function Docs() {
  return (
    <>
      <Heading>Setup</Heading>
      <Paragraph>
        Add <InlineCode>esqia/remark</InlineCode> after your other remark
        plugins and wrap your Next.js config with{" "}
        <InlineCode>withEsqia</InlineCode>.
      </Paragraph>
      <CodeBlock code={NEXT_CONFIG} lang="ts" title="next.config.ts" />
      <Paragraph>
        Then add the <InlineCode>{"<Esqia />"}</InlineCode> component to your
        root layout. Esqia only runs in development, so nothing changes in
        production.
      </Paragraph>
      <CodeBlock code={LAYOUT} lang="tsx" title="app/layout.tsx" />
      <Paragraph>
        To configure it, pass options as the second argument to{" "}
        <InlineCode>withEsqia</InlineCode>.
      </Paragraph>
      <CodeBlock code={OPTIONS} lang="ts" title="next.config.ts" />
      <Paragraph>
        <InlineCode>snippets</InlineCode> are blocks you can insert while
        writing, like your own components. Type <InlineCode>/</InlineCode> on an
        empty line to pick one.
      </Paragraph>
      <CodeBlock code={SNIPPETS} lang="ts" title="next.config.ts" />
      <Paragraph>
        <InlineCode>marks</InlineCode> add buttons to the toolbar that appears
        when you select text, like one for a serif font.
      </Paragraph>
      <CodeBlock code={MARKS} lang="ts" title="next.config.ts" />
      <Paragraph>
        <InlineCode>smartypants</InlineCode> takes the same settings as{" "}
        <InlineCode>remark-smartypants</InlineCode>, if your site uses it, so
        quotes and dashes look right while you type.
      </Paragraph>
      <CodeBlock code={SMARTYPANTS} lang="ts" title="next.config.ts" />
    </>
  );
}
