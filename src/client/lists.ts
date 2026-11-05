import { type Attributes, InputRule, Node } from "@tiptap/core";
import type {
  DOMOutputSpec,
  NodeType,
  Node as PMNode,
  ResolvedPos,
} from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { Rendered, Templates } from "./templates";

export type BulletMarker = "-" | "*" | "+";
export type OrderedMarker = "." | ")";

export type ListAttrs =
  | { marker: BulletMarker; ordered: false; spread: boolean }
  | {
      increment: boolean;
      marker: OrderedMarker;
      ordered: true;
      spread: boolean;
      start: number;
    };

export function createListExtensions({
  blockId,
  spec,
  templates,
}: {
  blockId: Attributes;
  spec: (rendered: Rendered) => DOMOutputSpec;
  templates: Templates;
}) {
  return [
    Node.create({
      addAttributes: () => ({
        ...blockId,
        increment: { default: true, rendered: false },
        marker: { default: "-", rendered: false },
        ordered: { default: false, rendered: false },
        spread: { default: false, rendered: false },
        start: { default: 1, rendered: false },
      }),
      addInputRules() {
        return [
          listInputRule(this.type, /^([-*+])\s$/, (match) => ({
            marker: match[1] as BulletMarker,
            ordered: false,
          })),
          listInputRule(this.type, /^(\d+)([.)])\s$/, (match) => ({
            marker: match[2] as OrderedMarker,
            ordered: true,
            start: Number(match[1]),
          })),
        ];
      },
      content: "listItem+",
      group: "block",
      name: "list",
      renderHTML: ({ node }) =>
        spec(templates.list(node.attrs.ordered ? "ol" : "ul")),
    }),
    Node.create({
      addKeyboardShortcuts() {
        return {
          Backspace: ({ editor }) => {
            const { $from, empty } = editor.state.selection;
            if (
              !empty ||
              $from.parent.type !== this.type ||
              $from.parentOffset !== 0 ||
              $from.index(1) > 0
            ) {
              return false;
            }
            return editor.commands.command(({ tr }) =>
              itemToParagraph(tr, $from)
            );
          },
          Enter: ({ editor }) => {
            const { $from } = editor.state.selection;
            if ($from.parent.type !== this.type) {
              return false;
            }
            if ($from.parent.content.size > 0) {
              return editor.commands.splitBlock();
            }
            return editor.commands.command(({ tr }) =>
              itemToParagraph(tr, $from)
            );
          },
        };
      },
      content: "inline*",
      defining: true,
      name: "listItem",
      renderHTML: () => spec(templates.listItem()),
    }),
  ];
}

function listInputRule(
  list: NodeType,
  find: RegExp,
  attrs: (match: RegExpMatchArray) => Partial<ListAttrs>
) {
  return new InputRule({
    find,
    handler: ({ state, range, match }) => {
      const $from = state.doc.resolve(range.from);
      if ($from.parent.type.name !== "paragraph") {
        return null;
      }
      const { tr } = state;
      const start = $from.before();
      const content = $from.parent.content.cut(range.to - $from.start());
      tr.replaceWith(
        start,
        $from.after(),
        list.create(
          attrs(match),
          state.schema.nodes.listItem.create(null, content)
        )
      );
      tr.setSelection(TextSelection.create(tr.doc, start + 2));
    },
  });
}

function itemToParagraph(tr: Transaction, $item: ResolvedPos): boolean {
  const list = $item.node(1);
  const head = list.content.cut(0, $item.before(2) - $item.start(1));
  const tail = list.content.cut($item.after(2) - $item.start(1));
  const start = $item.before(1);
  const before = head.size > 0 ? list.copy(head) : null;
  const after =
    tail.size > 0
      ? list.type.create(
          {
            ...list.attrs,
            id: null,
            start: list.attrs.start + $item.index(1) + 1,
          },
          tail
        )
      : null;
  const paragraph = tr.doc.type.schema.nodes.paragraph.create(
    null,
    $item.parent.content
  );
  tr.replaceWith(
    start,
    $item.after(1),
    [before, paragraph, after].filter((node): node is PMNode => node !== null)
  );
  tr.setSelection(
    TextSelection.create(tr.doc, start + (before?.nodeSize ?? 0) + 1)
  );
  return true;
}
