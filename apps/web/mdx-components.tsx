import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

function Code({ className, ...props }: ComponentProps<"code">) {
  const isBlock =
    "data-language" in props || className?.startsWith("language-");
  return <code className={isBlock ? className : "code-inline"} {...props} />;
}

const components: MDXComponents = {
  a: ({ children, ...props }) => (
    <a className="article-underline" {...props}>
      {children}
    </a>
  ),
  code: Code,
  figcaption: (props) => (
    <figcaption
      className="border-gray-200 border-b px-4 py-2.5 font-text text-gray-1100 text-sm"
      {...props}
    />
  ),
  figure: (props) => (
    <figure className="my-6 preview-code overflow-hidden" {...props} />
  ),
  h1: ({ children, ...props }) => (
    <h1 className="mb-5 font-[550] font-text text-gray-1200" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-16 mb-5 font-[550] font-text text-gray-1200" {...props}>
      {children}
    </h2>
  ),
  li: (props) => (
    <li className="pl-1 font-text text-body text-text-paragraph" {...props} />
  ),
  p: (props) => (
    <p className="font-text text-body text-text-paragraph" {...props} />
  ),
  pre: (props) => (
    <pre
      className="overflow-x-auto p-4 font-mono text-[13px] **:font-mono"
      {...props}
    />
  ),
  strong: (props) => (
    <strong className="font-medium text-gray-1200" {...props} />
  ),
  ul: (props) => (
    <ul
      className="my-2 flex list-disc flex-col gap-2 pl-5 marker:text-gray-800"
      {...props}
    />
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
