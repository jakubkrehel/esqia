import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactNode } from "react";

const TIP_WARM_FOR = 300;
const TIP_GAP = 12;

export type TipHandle = Tooltip.Handle<ReactNode>;

export const createTips = (): TipHandle => Tooltip.createHandle<ReactNode>();

export function Tips({
  children,
  container,
  disabled,
  handle,
  side,
}: {
  children: ReactNode;
  container: HTMLElement | null;
  disabled: boolean;
  handle: TipHandle;
  side: "bottom" | "top";
}) {
  return (
    <Tooltip.Provider timeout={TIP_WARM_FOR}>
      {children}
      <Tooltip.Root disabled={disabled} disableHoverablePopup handle={handle}>
        {({ payload }) => (
          <Tooltip.Portal container={container}>
            <Tooltip.Positioner side={side} sideOffset={TIP_GAP}>
              <Tooltip.Popup className="tip">{payload}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export const MOD =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? "⌘"
    : "Ctrl";

export function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="keys">
      {keys.map((key) => (
        <kbd data-glyph={key} key={key}>
          {key}
        </kbd>
      ))}
    </span>
  );
}

export const UNDO_TIP = (
  <>
    Undo
    <Keys keys={[MOD, "Z"]} />
  </>
);

export const REDO_TIP = (
  <>
    Redo
    <Keys keys={[MOD, "⇧", "Z"]} />
  </>
);
