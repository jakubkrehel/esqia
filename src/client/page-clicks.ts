import { useEffect } from "react";
import { blockAt, editableBlockAt } from "./blocks";
import type { Session } from "./session";

export function usePageClicks(
  host: HTMLElement,
  session: Session,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const activeRun = () => session.getSnapshot().run;

    const onPointerDown = (event: PointerEvent) => {
      if (event.composedPath().includes(host)) {
        return;
      }
      const run = activeRun();
      if (run && !run.root.contains(event.target as Node)) {
        void session.close();
      }
    };
    const onClick = (event: MouseEvent) => {
      if (event.composedPath().includes(host)) {
        return;
      }
      const target = event.target as Element;
      if (activeRun()?.root.contains(target)) {
        if (target.closest("a")) {
          event.preventDefault();
        }
        return;
      }
      const sourceOf = event.altKey && session.canOpen && blockAt(target);
      if (sourceOf) {
        event.preventDefault();
        event.stopPropagation();
        void session.openInEditor(sourceOf);
        return;
      }
      const block = editableBlockAt(target);
      if (!block) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void session.open({
        at: "run",
        block,
        caret: { x: event.clientX, y: event.clientY },
      });
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [host, session, enabled]);
}
