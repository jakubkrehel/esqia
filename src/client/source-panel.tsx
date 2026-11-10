import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Anchored } from "./anchored";
import type { SourceDraft } from "./source-draft";
import { Keys, MOD } from "./toolbar-tip";

const INDENT = "  ";

export function SourcePanel({
  anchor,
  draft,
  onOpen,
}: {
  anchor: RefObject<HTMLElement | null>;
  draft: SourceDraft;
  onOpen?: () => void;
}) {
  const { text, saving, problem } = useSyncExternalStore(
    draft.subscribe,
    draft.getSnapshot,
    draft.getSnapshot
  );
  const [shaking, setShaking] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const name = draft.block.file.split("/").at(-1);

  const commit = async () => {
    if (!(await draft.commit()) && draft.getSnapshot().problem) {
      setShaking(true);
    }
  };
  const commitOutside = useEffectEvent((event: PointerEvent) => {
    if (panel.current && !event.composedPath().includes(panel.current)) {
      void commit();
    }
  });

  useEffect(() => {
    const end = field.current?.value.length ?? 0;
    field.current?.setSelectionRange(end, end);
  }, [draft]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => commitOutside(event);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      draft.cancel();
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void commit();
    } else if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.setRangeText(
        INDENT,
        event.currentTarget.selectionStart,
        event.currentTarget.selectionEnd,
        "end"
      );
      draft.change(event.currentTarget.value);
    }
  };

  return (
    <Anchored
      className="panel source"
      context={draft.block.el}
      focus={field}
      label="Edit source"
      placement="bottom-start"
      rect={() => anchor.current?.getBoundingClientRect() ?? null}
    >
      <div
        className="source-body"
        data-saving={saving ? "" : undefined}
        data-shaking={shaking ? "" : undefined}
        onAnimationEnd={() => setShaking(false)}
        ref={panel}
      >
        <textarea
          aria-invalid={problem !== null}
          aria-label={`MDX source of ${name}, line ${draft.line}`}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          onChange={(event) => draft.change(event.target.value)}
          onKeyDown={onKeyDown}
          readOnly={saving}
          ref={field}
          spellCheck={false}
          value={text}
        />
        <div className="source-footer">
          {problem ? (
            <span className="source-problem" role="alert" title={problem}>
              {problem}
            </span>
          ) : (
            <button
              className="source-file"
              disabled={!onOpen}
              onClick={onOpen}
              type="button"
            >
              {name}:{draft.line}
            </button>
          )}
          <span className="source-keys">
            <span>
              Save
              <Keys keys={[MOD, "↵"]} />
            </span>
            <span>
              Cancel
              <Keys keys={["Esc"]} />
            </span>
          </span>
        </div>
      </div>
    </Anchored>
  );
}
