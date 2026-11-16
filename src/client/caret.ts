import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export function textRangeIn(
  el: HTMLElement,
  point?: { x: number; y: number }
): { anchor: number; head: number } | null {
  const selection = document.getSelection();
  const { anchorNode, focusNode } = selection ?? {};
  if (
    selection &&
    anchorNode &&
    focusNode &&
    !selection.isCollapsed &&
    el.contains(anchorNode) &&
    el.contains(focusNode)
  ) {
    return {
      anchor: textOffsetOf(el, anchorNode, selection.anchorOffset),
      head: textOffsetOf(el, focusNode, selection.focusOffset),
    };
  }
  const offset = point && textOffsetAt(el, point.x, point.y);
  return offset == null ? null : { anchor: offset, head: offset };
}

function textOffsetAt(el: HTMLElement, x: number, y: number): number | null {
  let node: Node | null = null;
  let offset = 0;
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    node = position?.offsetNode ?? null;
    offset = position?.offset ?? 0;
  } else {
    const range = document.caretRangeFromPoint?.(x, y);
    node = range?.startContainer ?? null;
    offset = range?.startOffset ?? 0;
  }
  if (!node || !el.contains(node)) {
    return null;
  }
  return textOffsetOf(el, node, offset);
}

function textOffsetOf(el: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(el, 0);
  range.setEnd(node, offset);
  let length = range.toString().length;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (isBetweenItems(text) && range.intersectsNode(text)) {
      length -= text === node ? offset : text.length;
    }
  }
  return length;
}

function isBetweenItems(text: Text): boolean {
  const parent = text.parentElement?.tagName;
  return (parent === "UL" || parent === "OL") && !text.data.trim();
}

export interface Caret {
  anchor: number;
  head: number;
  index: number;
}

export function placeCaret(editor: Editor, caret?: Caret) {
  const { doc } = editor.state;
  const selection =
    caret && caret.index < doc.childCount
      ? caretSelection(editor.view, caret)
      : TextSelection.near(doc.resolve(1));
  editor.view.dispatch(editor.state.tr.setSelection(selection));
  editor.view.focus();
}

function caretSelection(view: EditorView, { anchor, head, index }: Caret) {
  const { doc } = view.state;
  let before = 0;
  for (let i = 0; i < index; i++) {
    before += doc.child(i).nodeSize;
  }
  const dom = view.nodeDOM(before);
  if (doc.child(index).isAtom || !dom) {
    return TextSelection.near(doc.resolve(before + 1));
  }
  const pos = (offset: number) =>
    posAtTextOffset(view, dom, offset, before + 1);
  return anchor === head
    ? TextSelection.near(doc.resolve(pos(anchor)))
    : TextSelection.create(doc, pos(anchor), pos(head));
}

function posAtTextOffset(
  view: EditorView,
  block: Node,
  offset: number,
  empty: number
): number {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let last: Text | null = null;
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (remaining <= text.length) {
      return view.posAtDOM(text, remaining);
    }
    remaining -= text.length;
    last = text;
  }
  return last ? view.posAtDOM(last, last.length) : empty;
}
