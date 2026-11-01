export function MenuItem({
  label,
  hint,
  active,
  tone,
  option,
  onSelect,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  tone?: "danger";
  option?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      data-active={active ? "" : undefined}
      data-tone={tone}
      onClick={onSelect}
      onMouseDown={(event) => event.preventDefault()}
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
