import {
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

const TIP_DELAY = 400;
const TIP_WARM_FOR = 300;

type TipId = "undo" | "redo" | "revert" | "open" | "outline";

interface Tip {
  id: TipId;
  instant: boolean;
  open: boolean;
  x: number;
}

export function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const open = useRef(false);
  const warmUntil = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (button: HTMLElement, id: TipId) => {
    clearTimeout(timer.current);
    const x = button.offsetLeft + button.offsetWidth / 2;
    const reveal = (instant: boolean) => {
      open.current = true;
      setTip({ id, instant, open: true, x });
    };
    if (performance.now() < warmUntil.current) {
      reveal(true);
    } else {
      timer.current = setTimeout(() => reveal(false), TIP_DELAY);
    }
  };

  const hide = () => {
    clearTimeout(timer.current);
    if (open.current) {
      open.current = false;
      warmUntil.current = performance.now() + TIP_WARM_FOR;
    }
    setTip((current) => current && { ...current, instant: false, open: false });
  };

  const bind = (id: TipId) => ({
    onBlur: hide,
    onFocus: (event: FocusEvent<HTMLButtonElement>) => {
      if (event.currentTarget.matches(":focus-visible")) {
        show(event.currentTarget, id);
      }
    },
    onPointerDown: hide,
    onPointerEnter: (event: PointerEvent<HTMLButtonElement>) =>
      show(event.currentTarget, id),
    onPointerLeave: hide,
  });

  return { bind, tip };
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

function tipLabel(id: TipId): ReactNode {
  switch (id) {
    case "undo":
      return (
        <>
          Undo
          <Keys keys={[MOD, "Z"]} />
        </>
      );
    case "redo":
      return (
        <>
          Redo
          <Keys keys={[MOD, "⇧", "Z"]} />
        </>
      );
    case "revert":
      return "Revert all";
    case "open":
      return "Open in editor";
    default:
      return "Theme";
  }
}

export function ToolbarTip({ tip }: { tip: Tip }) {
  return (
    <div
      aria-hidden="true"
      className="tip"
      data-instant={tip.instant ? "" : undefined}
      data-open={tip.open ? "" : undefined}
      style={{ left: tip.x }}
    >
      {tipLabel(tip.id)}
    </div>
  );
}
