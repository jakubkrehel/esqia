import type { PhrasingContent } from "mdast";
import { parseMdx } from "../shared/markdown";
import { type Block, pageWrappers, readBlock } from "./blocks";
import { sliceOf } from "./parse-run";

export interface Rendered {
  contentDOM?: HTMLElement;
  dom: HTMLElement;
}

export interface Templates {
  block: (
    kind: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "pre"
  ) => Rendered;
  component: (raw: string) => Rendered | null;
  componentMark: (open: string) => Rendered | null;
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

export function sampleTemplates(file: string, source: string): Templates {
  const blocks = pageWrappers().map(readBlock);
  const components = renderedComponents(
    blocks.filter((block) => block.file === file && block.type === "paragraph"),
    source
  );
  const ofType = (type: string) =>
    blocks.filter((block) => block.type === type).map((block) => block.el);

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
    component(raw) {
      const sample = components.elements.get(raw);
      return sample ? { dom: sampleClone(sample, true) } : null;
    },
    componentMark(open) {
      const sample = components.marks.get(open);
      if (!sample) {
        return null;
      }
      const dom = sampleClone(sample, false);
      return { contentDOM: dom, dom };
    },
    mark(kind) {
      const sample = marks[kind];
      if (!sample) {
        return bare(kind);
      }
      const dom = sampleClone(sample, false);
      dom.removeAttribute("href");
      return { contentDOM: dom, dom };
    },
  };
}

const LAYOUT_PROPERTIES = [
  "flex-direction",
  "flex-wrap",
  "align-items",
  "justify-items",
  "grid-template-columns",
  "row-gap",
  "column-gap",
] as const;

export function matchLayout(editor: HTMLElement, root: HTMLElement) {
  let parent = root.parentElement;
  while (parent && getComputedStyle(parent).display === "contents") {
    parent = parent.parentElement;
  }
  if (!parent) {
    return;
  }
  const layout = getComputedStyle(parent);
  if (!/flex|grid/.test(layout.display)) {
    return;
  }
  for (const property of LAYOUT_PROPERTIES) {
    editor.style.setProperty(property, layout.getPropertyValue(property));
  }
  editor.style.display = layout.display.includes("grid") ? "grid" : "flex";
}

function renderedComponents(
  paragraphs: Block[],
  source: string
): { elements: Map<string, HTMLElement>; marks: Map<string, HTMLElement> } {
  const elements = new Map<string, HTMLElement>();
  const marks = new Map<string, HTMLElement>();
  const nodes = new Map(
    parseMdx(source).children.map((node) => [node.position?.start.offset, node])
  );
  for (const { el, start } of paragraphs) {
    const rendered = el.firstElementChild;
    const node = nodes.get(start);
    if (!(rendered && node?.type === "paragraph")) {
      continue;
    }
    const inline = node.children.filter(
      (child: PhrasingContent) => child.type !== "text"
    );
    const children = [...rendered.children];
    if (inline.length !== children.length) {
      continue;
    }
    inline.forEach((child, index) => {
      const element = children[index];
      if (
        !(child.type === "mdxJsxTextElement" && element instanceof HTMLElement)
      ) {
        return;
      }
      const open = child.position?.start.offset;
      const first = child.children[0]?.position?.start.offset;
      if (first === undefined) {
        elements.set(sliceOf(child, source), element);
      } else if (open !== undefined) {
        marks.set(source.slice(open, first), element);
      }
    });
  }
  return { elements, marks };
}

function sampleClone(sample: HTMLElement, deep: boolean): HTMLElement {
  const dom = sample.cloneNode(deep) as HTMLElement;
  dom.removeAttribute("id");
  return dom;
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

export function jsxBlockPreview(raw: string): Rendered {
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
