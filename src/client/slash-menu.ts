import type { Editor } from "@tiptap/core";
import type { ClientConfig } from "../shared/config";
import {
  type SlashItem,
  type SlashMenu,
  type SlashState,
  slashItems,
} from "./commands";
import { Store } from "./store";

export class SlashMenuStore extends Store<SlashMenu | null> {
  private readonly config: ClientConfig;
  private readonly editor: () => Editor;

  constructor(config: ClientConfig, editor: () => Editor) {
    super(null);
    this.config = config;
    this.editor = editor;
  }

  get open() {
    return this.snapshot !== null;
  }

  show = (state: SlashState | null) => {
    if (!state) {
      this.set(null);
      return;
    }
    const query = state.query.trim().toLowerCase();
    const previous = this.snapshot;
    this.set({
      ...state,
      active: previous?.query === query ? previous.active : 0,
      items: slashItems(this.config, query).filter(
        (item) => item.id !== "text"
      ),
      query,
    });
  };

  key = (event: KeyboardEvent): boolean => {
    const slash = this.snapshot;
    const count = slash?.items.length ?? 0;
    if (!slash || count === 0) {
      return false;
    }
    const step = (by: number) => {
      this.set({ ...slash, active: (slash.active + by + count) % count });
      return true;
    };
    if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
      return step(1);
    }
    if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
      return step(-1);
    }
    if (event.key === "Enter") {
      const item = slash.items[slash.active];
      if (item) {
        this.choose(item);
      }
      return true;
    }
    return false;
  };

  choose(item: SlashItem) {
    const slash = this.snapshot;
    if (!slash) {
      return;
    }
    const editor = this.editor();
    editor.chain().focus().deleteRange(slash.range).run();
    item.apply(editor);
  }
}
