import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { LINE_BREAK } from "../shared/ops";
import type { ClientConfig } from "./api";
import { spacerInPlace } from "./editor";

export interface SlashState {
  query: string;
  range: { from: number; to: number };
  rect: () => DOMRect | null;
}

export interface SlashItem {
  apply: (editor: Editor) => void;
  hint?: string;
  id: string;
  label: string;
}

export interface SlashMenu extends SlashState {
  active: number;
  items: SlashItem[];
}

export function slashItems(config: ClientConfig, query: string): SlashItem[] {
  const heading = (level: 1 | 2 | 3) => (editor: Editor) => {
    editor.chain().focus().setHeading({ level }).run();
  };
  const items: SlashItem[] = [
    { apply: () => undefined, id: "text", label: "Text" },
    { apply: heading(2), hint: "##", id: "h2", label: "Heading 2" },
    { apply: heading(3), hint: "###", id: "h3", label: "Heading 3" },
    { apply: heading(1), hint: "#", id: "h1", label: "Heading 1" },
    {
      apply: (editor) => editor.chain().focus().setCodeBlock().run(),
      hint: "```",
      id: "code",
      label: "Code block",
    },
    {
      apply: insertSpacer,
      hint: LINE_BREAK,
      id: "spacer",
      label: "Line break",
    },
    ...config.snippets.map((snippet) => ({
      apply: (editor: Editor) => insertBlock(editor, snippet.source),
      hint:
        snippet.source.length > 24
          ? `${snippet.source.slice(0, 22)}…`
          : snippet.source,
      id: `snippet:${snippet.name}`,
      label: snippet.name,
    })),
  ];
  return items.filter((item) => item.label.toLowerCase().includes(query));
}

export function placeCaret(
  editor: Editor,
  caret?: { index: number; offset: number }
) {
  const { doc } = editor.state;
  let pos = 1;
  if (caret) {
    doc.forEach((node, offset, index) => {
      if (index === caret.index) {
        pos = offset + 1 + inlinePos(node, caret.offset);
      }
    });
  }
  const selection = TextSelection.near(
    doc.resolve(Math.min(pos, doc.content.size))
  );
  editor.view.dispatch(editor.state.tr.setSelection(selection));
  editor.view.focus();
}

export function insertBlock(editor: Editor, raw: string) {
  const { $from } = editor.state.selection;
  const node = editor.schema.nodes.jsxBlock.create({ raw });
  const emptyParagraph =
    $from.depth === 1 &&
    $from.parent.type.name === "paragraph" &&
    $from.parent.content.size === 0;
  const tr = editor.state.tr;
  if (emptyParagraph) {
    tr.replaceWith($from.before(), $from.after(), node);
  } else {
    tr.insert($from.after(1), node);
  }
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

export function insertSpacer(editor: Editor) {
  const { tr } = editor.state;
  spacerInPlace(tr, editor.state.selection.$from);
  editor.view.dispatch(tr);
}

function inlinePos(node: PMNode, offset: number): number {
  if (!node.isTextblock) {
    return 0;
  }
  let remaining = offset;
  let pos = 0;
  let done = false;
  node.forEach((child) => {
    if (done) {
      return;
    }
    const length = child.isText ? (child.text?.length ?? 0) : 1;
    if (remaining <= length) {
      pos += remaining;
      done = true;
      return;
    }
    remaining -= length;
    pos += child.nodeSize;
  });
  return pos;
}
