import { Kbd } from "@/components/kbd";

const SHORTCUTS = [
  {
    keys: ["⌘", "⌥", "E"],
    label: "Switch between reading and editing",
  },
  {
    keys: ["Esc"],
    label: "Save / Exit edit mode",
  },
  {
    keys: ["/"],
    label: "Open the insert menu",
  },
  {
    keys: ["⌘", "⇧", "↑"],
    label: "Move the block up",
  },
  {
    keys: ["⌘", "⇧", "↓"],
    label: "Move the block down",
  },
  {
    keys: ["⌘", "Z"],
    label: "Undo the last change inside the editor",
  },
  {
    keys: ["⌘", "⇧", "Z"],
    label: "Redo the latest undo",
  },
];

export function Shortcuts() {
  return (
    <>
      <h2 className="mt-16 mb-5 font-demibold font-text text-xl text-gray-1200">
        Keyboard Shortcuts
      </h2>
      <dl className="flex flex-col gap-2 font-text text-body text-text-paragraph">
        {SHORTCUTS.map(({ keys, label }) => (
          <div className="flex items-center gap-3" key={label}>
            <dt>{label}</dt>
            <span aria-hidden="true" className="h-px flex-1 bg-gray-400" />
            <dd className="flex flex-none items-center gap-1">
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
