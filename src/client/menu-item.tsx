import { useEffect, useRef } from "react";

export function MenuItem({
  label,
  hint,
  active,
  option,
  onSelect,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  option?: boolean;
  onSelect: () => void;
}) {
  const item = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = item.current;
    const list = el?.parentElement;
    if (!(active && el && list)) {
      return;
    }
    const bottom = el.offsetTop + el.offsetHeight;
    if (el.offsetTop < list.scrollTop) {
      list.scrollTop = el.offsetTop;
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [active]);

  return (
    <button
      data-active={active ? "" : undefined}
      onClick={onSelect}
      onMouseDown={(event) => event.preventDefault()}
      ref={item}
      type="button"
      {...(option
        ? { "aria-selected": Boolean(active), role: "option", tabIndex: -1 }
        : {})}
    >
      <span>{label}</span>
      {hint && <span className="hint">{hint}</span>}
    </button>
  );
}
