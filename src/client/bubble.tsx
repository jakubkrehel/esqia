import { posToDOMRect } from "@tiptap/core";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { ClientConfig } from "../shared/config";
import { Anchored } from "./anchored";
import { markOpen } from "./editor";
import { BoldIcon, CodeIcon, ItalicIcon, LinkIcon } from "./icons";
import type { Run } from "./run";

const SHOW_DELAY = 400;

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
  const linkField = useRef<HTMLInputElement>(null);
  const settled = useSettledSelection(editor.view.dom, `${from}:${to}`);

  const open =
    linking !== null ||
    !(empty || !hasText || inCode || !settled || !editor.view.hasFocus());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { selection } = editor.state;
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k" ||
        selection.empty ||
        editor.isActive("codeBlock")
      ) {
        return;
      }
      event.preventDefault();
      setLinkDraft({
        from: selection.from,
        href: (editor.getAttributes("link").href as string | undefined) ?? "",
      });
    };
    const { dom } = editor.view;
    dom.addEventListener("keydown", onKeyDown);
    return () => dom.removeEventListener("keydown", onKeyDown);
  }, [editor]);

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
      focus={linking === null ? undefined : linkField}
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
            onChange={(event) => setLinking(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setLinking(null);
                editor.commands.focus();
              }
            }}
            placeholder="Paste a link, or leave empty to remove"
            ref={linkField}
            value={linking}
          />
        </form>
      )}
    </Anchored>
  );
}

function useSettledSelection(target: HTMLElement, selection: string) {
  const [pressed, setPressed] = useState(false);
  const [settledOn, setSettledOn] = useState<string | null>(null);

  useEffect(() => {
    const press = () => setPressed(true);
    const release = () => setPressed(false);
    target.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      target.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [target]);

  useEffect(() => {
    if (pressed) {
      return;
    }
    const timer = setTimeout(() => setSettledOn(selection), SHOW_DELAY);
    return () => clearTimeout(timer);
  }, [pressed, selection]);

  return !pressed && settledOn === selection;
}
