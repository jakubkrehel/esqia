import { Anchored } from "./anchored";
import type { SlashMenu } from "./commands";
import { MenuItem } from "./menu-item";
import type { Run } from "./run";

export function Slash({ run, slash }: { run: Run; slash: SlashMenu }) {
  if (slash.items.length === 0) {
    return null;
  }

  return (
    <>
      <Anchored
        className="panel menu"
        context={run.editor.view.dom}
        label="Insert block"
        placement="bottom-start"
        rect={slash.rect}
        role="listbox"
      >
        {slash.items.map((item, index) => (
          <MenuItem
            active={index === slash.active}
            hint={item.hint}
            key={item.id}
            label={item.label}
            onSelect={() => run.slash.choose(item)}
            option
          />
        ))}
      </Anchored>
      <div aria-live="polite" className="announce">
        {slash.items[slash.active]?.label}
      </div>
    </>
  );
}
