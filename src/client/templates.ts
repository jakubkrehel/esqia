import { BLOCK_SELECTOR } from "../shared/wrapper";

export interface Rendered {
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
  const wrappers = [...document.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)];
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
