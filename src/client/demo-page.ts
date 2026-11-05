import type { Editor } from "@tiptap/core";
import type { ClientConfig } from "../shared/config";
import { type MemoryStore, memoryStore } from "../shared/history";
import { type BlockRange, mapSpan } from "../shared/ops";
import { fileWrappers, hideBlock, markRemoved, readBlock } from "./blocks";
import { renderClosedRun, restampFile } from "./demo-render";
import { memoryBackend } from "./memory-backend";
import type {
  EditingHost,
  PageClosing,
  PageOpening,
  PageSync,
  RunPage,
} from "./page";

export function demoHost(
  sources: Record<string, string>,
  config: ClientConfig
): EditingHost {
  const store = memoryStore((file) => {
    const source = sources[file];
    if (source === undefined) {
      throw new Error(`esqia: the demo has no source for ${file}.`);
    }
    const rendered = fileWrappers(file)[0];
    return {
      hash: (rendered && readBlock(rendered).version) || "demo",
      source,
    };
  });
  const backend = memoryBackend(store, config);
  return {
    backend: {
      ...backend,
      revert: () => {
        location.reload();
        return Promise.resolve({ reverted: [], skipped: [] });
      },
    },
    sync: demoSync(store),
  };
}

function demoSync(store: MemoryStore): PageSync {
  const open = new Set<DemoPage>();

  return {
    applied({ file, hash, ops, run }) {
      const runs = [...open].filter((page) => page.file === file);
      for (const page of runs) {
        page.track(
          hash,
          page === run?.page ? run.range : mapSpan(ops, page.range)
        );
      }
      restampFile(
        { after: store.text(file), before: store.previous(file), file, ops },
        hash,
        runs
      );
    },
    open(opening) {
      const page = new DemoPage(
        opening,
        () => store.text(opening.file),
        () => open.delete(page)
      );
      open.add(page);
      return page;
    },
  };
}

class DemoPage implements RunPage {
  readonly file: string;
  readonly root: HTMLElement;
  range: BlockRange;
  private readonly editor: Editor;
  private readonly own: HTMLElement[];
  private readonly source: () => string;
  private readonly onClose: () => void;

  constructor(
    { blocks, editor, file, range, root }: PageOpening,
    source: () => string,
    onClose: () => void
  ) {
    this.editor = editor;
    this.file = file;
    this.range = range;
    this.root = root;
    this.source = source;
    this.onClose = onClose;
    this.own = blocks.map((block) => block.el);
    for (const el of this.own) {
      hideBlock(el);
    }
  }

  track(_version: string, range: BlockRange) {
    this.range = range;
  }

  close({ version }: PageClosing) {
    this.onClose();
    const { editor, file, range, root } = this;
    const text = this.source().slice(range.start, range.end);
    renderClosedRun({ editor, file, range, root, text, version });
    for (const el of this.own) {
      markRemoved(el);
    }
    return Promise.resolve(true);
  }
}
