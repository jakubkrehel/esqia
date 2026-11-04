import type { Editor } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { ClientConfig } from "../shared/config";
import { LINE_BREAK } from "../shared/markdown";

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
    { apply: heading(1), hint: "#", id: "h1", label: "Heading 1" },
    { apply: heading(2), hint: "##", id: "h2", label: "Heading 2" },
    { apply: heading(3), hint: "###", id: "h3", label: "Heading 3" },
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

export function spacerInPlace(tr: Transaction, $from: ResolvedPos) {
  const { paragraph, spacer } = tr.doc.type.schema.nodes;
  const before = $from.before();
  tr.replaceWith(before, $from.after(), [spacer.create(), paragraph.create()]);
  tr.setSelection(TextSelection.near(tr.doc.resolve(before + 2)));
}
