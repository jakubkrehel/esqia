import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";
import { Kbd } from "@/components/kbd";
import { MDXBlockImage, MDXBlockVideo } from "@/components/mdx/media";
import { Point } from "@/components/point";

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
    <h1
      className="mb-5 font-demibold font-text text-body text-gray-1200"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mt-16 mb-5 font-demibold font-text text-xl text-gray-1200"
      {...props}
    >
      {children}
    </h2>
  ),
  img: MDXBlockImage,
  Kbd,
  li: (props) => (
    <li className="pl-2 font-text text-body text-text-paragraph" {...props} />
  ),
  ol: (props) => (
    <ol
      className="my-2 flex list-decimal flex-col gap-2 pl-5 marker:text-gray-800"
      {...props}
    />
  ),
  Point,
  p: (props) => (
    <p
      className="relative font-text text-body text-text-paragraph has-[>[data-media]]:my-8 has-[>[data-point]]:my-2 has-[>[data-point]]:pl-10"
      {...props}
    />
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
      className="my-2 flex list-['-'] flex-col gap-2 pl-5 marker:text-gray-800"
      {...props}
    />
  ),
  Video: MDXBlockVideo,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
