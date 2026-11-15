import { posToDOMRect } from "@tiptap/core";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ClientConfig } from "../shared/config";
import { Anchored } from "./anchored";
import { markOpen } from "./editor";
import { BoldIcon, CodeLargeIcon, ItalicIcon, LinkIcon } from "./icons";
import type { Run } from "./run";

const SHOW_DELAY = 600;

export function Bubble({ run, config }: { run: Run; config: ClientConfig }) {
  const { editor } = run;
  const { from, to, empty } = editor.state.selection;
  const hasText = editor.state.doc.textBetween(from, to).length > 0;

  const selection = `${from}:${to}`;
  const inCode = editor.isActive("codeBlock");
  const linkField = useRef<HTMLInputElement>(null);
  const settled = useSettledSelection(editor.view.dom, selection);
  const selecting = !(
    empty ||
    !hasText ||
    inCode ||
    !settled ||
    !editor.view.hasFocus()
  );
  const { draft, linking, open, setDraft } = useLinkDraft(
    selection,
    selecting,
    linkField
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
      focus={linking ? linkField : undefined}
      gap={8}
      open={open}
      placement="top"
      rect={() => posToDOMRect(editor.view, from, to)}
    >
      {draft === null ? (
        <>
          {button(<BoldIcon />, "Bold", editor.isActive("bold"), () =>
            chain().toggleBold().run()
          )}
          {button(<ItalicIcon />, "Italic", editor.isActive("italic"), () =>
            chain().toggleItalic().run()
          )}
          {button(<CodeLargeIcon />, "Code", editor.isActive("code"), () =>
            chain().toggleCode().run()
          )}
          {button(<LinkIcon />, "Link", editor.isActive("link"), () =>
            setDraft(
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
            if (draft.trim()) {
              chain()
                .extendMarkRange("link")
                .setLink({ href: draft.trim() })
                .run();
            } else {
              chain().extendMarkRange("link").unsetLink().run();
            }
            setDraft(null);
          }}
        >
          <input
            aria-label="Link URL"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setDraft(null);
                editor.commands.focus();
              }
            }}
            placeholder="Paste a link, or leave empty to remove"
            ref={linkField}
            value={draft}
          />
        </form>
      )}
    </Anchored>
  );
}

function useLinkDraft(
  selection: string,
  selecting: boolean,
  field: RefObject<HTMLInputElement | null>
) {
  const [link, setLink] = useState<{
    at: string;
    dismissed: boolean;
    href: string;
  } | null>(null);

  if (link && !link.dismissed && link.at !== selection) {
    setLink({ ...link, dismissed: true });
  }
  if (link?.dismissed && selecting) {
    setLink(null);
  }
  const linking = link !== null && !link.dismissed && link.at === selection;
  const open = linking || selecting;

  useEffect(() => {
    if (!linking) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const panel = field.current?.closest(".toolbar");
      if (!(panel && event.composedPath().includes(panel))) {
        setLink((current) => current && { ...current, dismissed: true });
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [linking, field]);

  return {
    draft: linking || !open ? (link?.href ?? null) : null,
    linking,
    open,
    setDraft: (href: string | null) =>
      setLink(href === null ? null : { at: selection, dismissed: false, href }),
  };
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
