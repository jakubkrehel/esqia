import { posToDOMRect } from "@tiptap/core";
import { type ReactNode, useEffect, useState } from "react";
import { Anchored } from "./anchored";
import type { ClientConfig } from "./api";
import { markOpen } from "./editor";
import { BoldIcon, CodeIcon, ItalicIcon, LinkIcon } from "./icons";
import type { Run } from "./run";

const SHOW_DELAY = 100;

export function Bubble({ run, config }: { run: Run; config: ClientConfig }) {
  const { editor } = run;
  const { from, to, empty } = editor.state.selection;
  const hasText = editor.state.doc.textBetween(from, to).length > 0;

  const [linkDraft, setLinkDraft] = useState<{
    from: number;
    href: string;
  } | null>(null);
  const linking = linkDraft && linkDraft.from === from ? linkDraft.href : null;
  const setLinking = (href: string | null) =>
    setLinkDraft(href === null ? null : { from, href });
  const inCode = editor.isActive("codeBlock");
  const settled = useSettledPointer(editor.view.dom);

  const open = !(
    empty ||
    !hasText ||
    inCode ||
    !settled ||
    (!editor.view.hasFocus() && linking === null)
  );

  const chain = () => editor.chain().focus();
  const button = (
    label: ReactNode,
    name: string,
    active: boolean,
    action: () => void
  ) => (
    <button
      aria-label={name}
      aria-pressed={active}
      key={name}
      onClick={action}
      onMouseDown={(e) => e.preventDefault()}
      type="button"
    >
      {label}
    </button>
  );

  const toggleJsxMark = (mark: ClientConfig["marks"][number]) => {
    const type = editor.schema.marks.jsx;
    const instance = type.create({
      close: `</${mark.tag}>`,
      name: mark.tag,
      open: markOpen(mark),
    });
    const active = editor.isActive("jsx", { open: markOpen(mark) });
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        if (active) {
          tr.removeMark(from, to, instance);
        } else {
          tr.addMark(from, to, instance);
        }
        return true;
      })
      .run();
  };

  return (
    <Anchored
      className="panel toolbar"
      context={editor.view.dom}
      gap={8}
      open={open}
      placement="top"
      rect={() => posToDOMRect(editor.view, from, to)}
    >
      {linking === null ? (
        <>
          {button(<BoldIcon />, "Bold", editor.isActive("bold"), () =>
            chain().toggleBold().run()
          )}
          {button(<ItalicIcon />, "Italic", editor.isActive("italic"), () =>
            chain().toggleItalic().run()
          )}
          {button(<CodeIcon />, "Code", editor.isActive("code"), () =>
            chain().toggleCode().run()
          )}
          {button(<LinkIcon />, "Link", editor.isActive("link"), () =>
            setLinking(
              (editor.getAttributes("link").href as string | undefined) ?? ""
            )
          )}
          {config.marks.length > 0 && <span className="sep" />}
          {config.marks.map((mark) =>
            button(
              mark.name,
              mark.name,
              editor.isActive("jsx", { open: markOpen(mark) }),
              () => toggleJsxMark(mark)
            )
          )}
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (linking.trim()) {
              chain()
                .extendMarkRange("link")
                .setLink({ href: linking.trim() })
                .run();
            } else {
              chain().extendMarkRange("link").unsetLink().run();
            }
            setLinking(null);
          }}
        >
          <input
            aria-label="Link URL"
            autoFocus
            onChange={(event) => setLinking(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setLinking(null);
                editor.commands.focus();
              }
            }}
            placeholder="Paste a link, or leave empty to remove"
            value={linking}
          />
        </form>
      )}
    </Anchored>
  );
}

function useSettledPointer(target: HTMLElement): boolean {
  const [settled, setSettled] = useState(true);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const press = () => {
      clearTimeout(timer);
      setSettled(false);
    };
    const release = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setSettled(true), SHOW_DELAY);
    };
    target.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      clearTimeout(timer);
      target.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [target]);
  return settled;
}
