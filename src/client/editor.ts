import {
  type AnyExtension,
  type Editor,
  Extension,
  InputRule,
  Mark,
  Node,
} from "@tiptap/core";
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
import Suggestion from "@tiptap/suggestion";
import type { ClientConfig } from "../shared/config";
import { LINE_BREAK } from "../shared/markdown";
import { moveCurrentBlock, type SlashState, spacerInPlace } from "./commands";
import { createListExtensions } from "./lists";
import { jsxBlockPreview, type Rendered, type Templates } from "./templates";

const blockId = {
  id: { default: null, keepOnSplit: false, rendered: false },
};

export interface SlashHandlers {
  onChange: (slash: SlashState | null) => void;
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export interface EditorOptions {
  config: ClientConfig;
  slash: SlashHandlers;
  spacers: boolean;
  templates: Templates;
}

export function createExtensions({
  templates,
  config,
  slash,
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
    ...createListExtensions({ blockId, spec, templates }),
    Node.create({
      addAttributes: () => ({
        ...blockId,
        auto: { default: false, rendered: false },
        raw: { default: LINE_BREAK, rendered: false },
      }),
      addInputRules() {
        return [
          new InputRule({
            find: /^<br\s?\/>$/,
            handler: ({ state, range }) => {
              const $from = state.doc.resolve(range.from);
              if ($from.parent.type.name !== "paragraph") {
                return null;
              }
              spacerInPlace(state.tr, $from);
            },
          }),
        ];
      },
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
        const rendered = templates.component(raw);
        if (rendered) {
          return spec(rendered);
        }
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
        const rendered = templates.componentMark(mark.attrs.open);
        if (rendered) {
          return spec(rendered);
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
      placeholder: ({ node }) =>
        node.type.name === "paragraph"
          ? "Write, or press / for blocks. Shift+Enter adds a line break."
          : "",
      showOnlyCurrent: true,
    }),
    Extension.create({
      addProseMirrorPlugins() {
        return [slashSuggestion(this.editor, slash)];
      },
      name: "esqiaSlash",
      priority: 1000,
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
          Enter: ({ editor }) => spacers && splitWithSpacer(editor, true),
          "Mod-Shift-ArrowDown": ({ editor }) => moveCurrentBlock(editor, 1),
          "Mod-Shift-ArrowUp": ({ editor }) => moveCurrentBlock(editor, -1),
          "Shift-Enter": ({ editor }) => splitWithSpacer(editor, false),
        };
      },
      name: "esqiaKeys",
    }),
  ];
}

function slashSuggestion(editor: Editor, slash: SlashHandlers) {
  const toState = (props: {
    query: string;
    range: SlashState["range"];
    clientRect?: (() => DOMRect | null) | null;
  }): SlashState => ({
    query: props.query,
    range: props.range,
    rect: () => props.clientRect?.() ?? null,
  });
  return Suggestion({
    allow: ({ state, range }) => {
      const $from = state.doc.resolve(range.from);
      return $from.depth === 1 && $from.parent.type.name === "paragraph";
    },
    allowSpaces: true,
    char: "/",
    decorationClass: "esqia-slash",
    decorationEmptyClass: "esqia-slash-empty",
    editor,
    render: () => ({
      onExit: () => slash.onChange(null),
      onKeyDown: ({ event }) => slash.onKeyDown(event),
      onStart: (props) => slash.onChange(toState(props)),
      onUpdate: (props) => slash.onChange(toState(props)),
    }),
    startOfLine: true,
  });
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

function splitWithSpacer(editor: Editor, auto: boolean): boolean {
  const { $from, empty } = editor.state.selection;
  if (
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
        editor.schema.nodes.spacer.create({ auto })
      );
      return true;
    })
    .run();
}

export function markOpen(mark: { tag: string; className: string }): string {
  return `<${mark.tag} className="${mark.className}">`;
}
