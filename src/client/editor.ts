import { type AnyExtension, Extension, Mark, Node } from "@tiptap/core";
import Bold from "@tiptap/extension-bold";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";
import Document from "@tiptap/extension-document";
import Heading from "@tiptap/extension-heading";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Typography from "@tiptap/extension-typography";
import {
  Dropcursor,
  Gapcursor,
  Placeholder,
  UndoRedo,
} from "@tiptap/extensions";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import type { ClientConfig } from "./api";

interface Rendered {
  contentDOM?: HTMLElement;
  dom: HTMLElement;
}

export interface Templates {
  block: (
    kind: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "pre"
  ) => Rendered;
  mark: (kind: "strong" | "em" | "code" | "a") => Rendered;
}

const INLINE_TAGS = new Set([
  "A",
  "STRONG",
  "EM",
  "CODE",
  "B",
  "I",
  "S",
  "SUP",
  "SUB",
  "MARK",
]);

export function sampleTemplates(): Templates {
  const wrappers = [
    ...document.querySelectorAll<HTMLElement>("[data-esqia-file]"),
  ];
  const ofType = (type: string) =>
    wrappers.filter((wrapper) => wrapper.dataset.esqiaType === type);

  const paragraphs = ofType("paragraph")
    .map((wrapper) => wrapper.firstElementChild)
    .filter((el): el is HTMLElement => el instanceof HTMLElement);
  const paragraph = paragraphs.sort((a, b) => directText(b) - directText(a))[0];

  const headings = new Map<string, HTMLElement>();
  for (const wrapper of ofType("heading")) {
    const el = wrapper.firstElementChild;
    if (el instanceof HTMLElement && !headings.has(el.tagName)) {
      headings.set(el.tagName, el);
    }
  }

  const codeFigure = ofType("code")[0]?.firstElementChild as
    | HTMLElement
    | undefined;
  const inline = (selector: string) =>
    paragraphs
      .map((p) => p.querySelector<HTMLElement>(selector))
      .find(Boolean) ?? null;
  const marks = {
    a: inline("a[href]"),
    code: inline("code"),
    em: inline("em:not([class])"),
    strong: inline("strong"),
  };

  return {
    block(kind) {
      if (kind === "pre") {
        return codeTemplate(codeFigure);
      }
      if (kind === "p") {
        return paragraph ? textTemplate(paragraph) : bare("p");
      }
      const level = Number(kind.slice(1));
      const sample =
        headings.get(kind.toUpperCase()) ??
        [level + 1, level - 1, 2, 3, 1]
          .map((n) => headings.get(`H${n}`))
          .find(Boolean);
      if (!sample) {
        return bare(kind);
      }
      const rendered = textTemplate(sample);
      return retag(rendered, kind);
    },
    mark(kind) {
      const sample = marks[kind];
      if (!sample) {
        return bare(kind);
      }
      const dom = sample.cloneNode(false) as HTMLElement;
      dom.removeAttribute("id");
      dom.removeAttribute("href");
      return { contentDOM: dom, dom };
    },
  };
}

function directText(el: Element): number {
  let length = 0;
  for (const child of el.childNodes) {
    if (child.nodeType === 3) {
      length += child.textContent?.trim().length ?? 0;
    }
  }
  return length;
}

function bare(tag: string): Rendered {
  const dom = document.createElement(tag);
  return { contentDOM: dom, dom };
}

function textTemplate(sample: HTMLElement): Rendered {
  const dom = sample.cloneNode(true) as HTMLElement;
  for (const el of dom.querySelectorAll("[id]")) {
    el.removeAttribute("id");
  }
  dom.removeAttribute("id");
  for (const control of dom.querySelectorAll("a, button")) {
    if (!control.textContent?.trim()) {
      control.remove();
    }
  }

  let holder: HTMLElement = dom;
  for (;;) {
    if (directText(holder) > 0) {
      break;
    }
    const withText = [...holder.children].filter((child) =>
      child.textContent?.trim()
    );
    const only = withText[0];
    if (
      withText.length !== 1 ||
      !(only instanceof HTMLElement) ||
      INLINE_TAGS.has(only.tagName)
    ) {
      break;
    }
    holder = only;
  }
  holder.replaceChildren();
  return { contentDOM: holder, dom };
}

function retag(rendered: Rendered, tag: string): Rendered {
  if (rendered.dom.tagName.toLowerCase() === tag) {
    return rendered;
  }
  const dom = document.createElement(tag);
  for (const { name, value } of rendered.dom.attributes) {
    dom.setAttribute(name, value);
  }
  dom.append(...rendered.dom.childNodes);
  return {
    contentDOM:
      rendered.contentDOM === rendered.dom ? dom : rendered.contentDOM,
    dom,
  };
}

function codeTemplate(figure: HTMLElement | undefined): Rendered {
  const sourcePre =
    figure?.tagName === "PRE" ? figure : figure?.querySelector("pre");
  if (!figure || !sourcePre) {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    pre.append(code);
    return { contentDOM: code, dom: pre };
  }
  const dom = figure.cloneNode(true) as HTMLElement;
  for (const button of dom.querySelectorAll("button")) {
    button.remove();
  }
  const pre = (
    dom.tagName === "PRE" ? dom : dom.querySelector("pre")
  ) as HTMLElement;
  const code = document.createElement("code");
  code.className = pre.querySelector("code")?.className ?? "";
  code.style.whiteSpace = "pre";
  pre.replaceChildren(code);
  return { contentDOM: code, dom };
}

const blockId = {
  id: { default: null, keepOnSplit: false, rendered: false },
};

export interface EditorOptions {
  config: ClientConfig;
  spacers: boolean;
  templates: Templates;
}

export function createExtensions({
  templates,
  config,
  spacers,
}: EditorOptions): AnyExtension[] {
  const spec = (rendered: Rendered) => rendered as unknown as DOMOutputSpec;

  return [
    Document,
    Text,
    Paragraph.extend({
      addAttributes: () => blockId,
      renderHTML: () => spec(templates.block("p")),
    }),
    Heading.extend({
      addAttributes: () => ({
        ...blockId,
        level: { default: 2, rendered: false },
      }),
      renderHTML: ({ node }) =>
        spec(templates.block(`h${node.attrs.level}` as "h2")),
    }).configure({ levels: [1, 2, 3, 4, 5, 6] }),
    CodeBlock.extend({
      addAttributes: () => ({
        ...blockId,
        language: { default: null, rendered: false },
        meta: { default: null, rendered: false },
      }),
      renderHTML: () => spec(templates.block("pre")),
    }).configure({ enableTabIndentation: true }),
    Node.create({
      addAttributes: () => ({
        ...blockId,
        raw: { default: "<br />", rendered: false },
      }),
      atom: true,
      group: "block",
      name: "spacer",
      renderHTML: () => ["div", { "data-esqia-spacer": "" }, ["br"]],
      selectable: true,
    }),
    Node.create({
      addAttributes: () => ({
        ...blockId,
        raw: { default: "", rendered: false },
      }),
      atom: true,
      draggable: true,
      group: "block",
      name: "jsxBlock",
      renderHTML: ({ node }) => spec(jsxBlockPreview(node.attrs.raw)),
      selectable: true,
    }),
    Node.create({
      addAttributes: () => ({ raw: { default: "", rendered: false } }),
      atom: true,
      group: "inline",
      inline: true,
      name: "jsxInline",
      renderHTML: ({ node }) => {
        const raw: string = node.attrs.raw;
        const name = /^<([\w.]+)/.exec(raw)?.[1];
        return [
          "span",
          { "data-esqia-jsx-inline": "", title: raw },
          name ? `‹${name}›` : raw,
        ];
      },
      selectable: true,
    }),
    Bold.extend({ renderHTML: () => spec(templates.mark("strong")) }),
    Italic.extend({ renderHTML: () => spec(templates.mark("em")) }),
    Code.extend({
      excludes: "",
      renderHTML: () => spec(templates.mark("code")),
    }),
    Link.extend({
      renderHTML: ({ mark }) => {
        const rendered = templates.mark("a");
        rendered.dom.setAttribute("href", mark.attrs.href);
        return spec(rendered);
      },
    }).configure({ autolink: false, linkOnPaste: true, openOnClick: false }),
    Mark.create({
      addAttributes: () => ({
        close: { default: "", rendered: false },
        name: { default: "", rendered: false },
        open: { default: "", rendered: false },
      }),
      excludes: "",
      inclusive: false,
      name: "jsx",
      renderHTML: ({ mark }) => {
        const configured = config.marks.find(
          (m) => markOpen(m) === mark.attrs.open
        );
        if (configured) {
          return [configured.tag, { class: configured.className }, 0];
        }
        return [
          "span",
          {
            "data-esqia-jsx": mark.attrs.name,
            title: `${mark.attrs.open}…${mark.attrs.close}`,
          },
          0,
        ];
      },
    }),
    ...(config.smartypants && config.smartypants.quotes !== false
      ? [quotesAsTyped(config.smartypants.ellipses !== false)]
      : []),
    UndoRedo,
    Dropcursor.configure({ color: "oklch(74.6% 0.16 232.661)", width: 2 }),
    Gapcursor,
    Placeholder.configure({
      placeholder: "Write, or press / for blocks",
      showOnlyCurrent: true,
    }),
    Extension.create({
      addKeyboardShortcuts() {
        return {
          Backspace: ({ editor }) => {
            const { $from, empty } = editor.state.selection;
            if (!empty || $from.parentOffset !== 0 || $from.depth !== 1) {
              return false;
            }
            const before = $from.before();
            const previous = editor.state.doc.resolve(before).nodeBefore;
            if (previous?.type.name !== "spacer") {
              return false;
            }
            return editor
              .chain()
              .command(({ tr }) => {
                tr.delete(before - previous.nodeSize, before);
                return true;
              })
              .joinBackward()
              .run();
          },
          Enter: ({ editor }) => {
            const { $from, empty } = editor.state.selection;
            if (
              !spacers ||
              !empty ||
              $from.parent.type.name !== "paragraph" ||
              $from.parent.content.size === 0
            ) {
              return false;
            }
            return editor
              .chain()
              .splitBlock()
              .command(({ tr }) => {
                tr.insert(
                  tr.selection.$from.before(),
                  editor.schema.nodes.spacer.create()
                );
                return true;
              })
              .run();
          },
        };
      },
      name: "esqiaKeys",
    }),
  ];
}

function quotesAsTyped(ellipsis: boolean) {
  const off = [
    "emDash",
    "leftArrow",
    "rightArrow",
    "copyright",
    "trademark",
    "servicemark",
    "registeredTrademark",
    "oneHalf",
    "plusMinus",
    "notEqual",
    "laquo",
    "raquo",
    "multiplication",
    "superscriptTwo",
    "superscriptThree",
    "oneQuarter",
    "threeQuarters",
  ];
  return Typography.configure({
    ...Object.fromEntries(off.map((rule) => [rule, false])),
    ...(ellipsis ? {} : { ellipsis: false }),
  });
}

export function markOpen(mark: { tag: string; className: string }): string {
  return `<${mark.tag} className="${mark.className}">`;
}

function jsxBlockPreview(raw: string): Rendered {
  const dom = document.createElement("div");
  dom.dataset.esqiaJsxBlock = "";
  const src =
    /\bsrc=["']([^"']+)["']/.exec(raw)?.[1] ??
    /!\[[^\]]*\]\(([^)\s]+)/.exec(raw)?.[1];
  if (src && /\.(mp4|webm|mov)(\?|$)/i.test(src)) {
    const video = document.createElement("video");
    Object.assign(video, {
      autoplay: true,
      loop: true,
      muted: true,
      playsInline: true,
      src,
    });
    dom.append(video);
  } else if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    dom.append(img);
  } else {
    const code = document.createElement("code");
    code.textContent = raw;
    dom.append(code);
  }
  return { dom };
}
