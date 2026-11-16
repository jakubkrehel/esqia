import { WRAPPER } from "../shared/wrapper";
import { sidecar } from "./api";
import {
  type Block,
  fileBlocks,
  hideBlock,
  showBlock,
  watchBlocks,
} from "./blocks";
import { LivePage, type LivePages } from "./live-page";
import {
  type AppliedEdit,
  type EditingHost,
  type PageOpening,
  type Preview,
  type RunPage,
  trackRuns,
} from "./page";

const STALLED_AFTER = 3000;

class OpenPages implements LivePages {
  private readonly pages = new Set<LivePage>();
  private readonly waiting = new Map<LivePage, (refreshed: boolean) => void>();
  private stalled: ReturnType<typeof setTimeout> | undefined;

  track(edit: AppliedEdit) {
    trackRuns(this.pages, edit);
  }

  open(opening: PageOpening): RunPage {
    const page = new LivePage(opening, this);
    this.pages.add(page);
    this.watchForStall();
    return page;
  }

  refreshed(page: LivePage, current: () => boolean): Promise<boolean> {
    if (current()) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const unwatch = watchBlocks(() => {
        if (current()) {
          done(true);
        }
      });
      const done = (refreshed: boolean) => {
        unwatch();
        this.waiting.delete(page);
        this.watchForStall();
        resolve(refreshed);
      };
      this.waiting.set(page, done);
      this.watchForStall();
    });
  }

  closed(page: LivePage) {
    this.pages.delete(page);
    this.watchForStall();
    for (const other of this.pages) {
      other.arrange();
    }
  }

  private watchForStall() {
    clearTimeout(this.stalled);
    if (this.waiting.size === 0 || this.waiting.size < this.pages.size) {
      return;
    }
    this.stalled = setTimeout(() => {
      location.reload();
      for (const done of this.waiting.values()) {
        done(false);
      }
    }, STALLED_AFTER);
  }
}

const pages = new OpenPages();

export const liveHost: EditingHost = {
  backend: sidecar,
  sync: {
    applied: (edit) => pages.track(edit),
    moving: (block, target) => previewed(block, previewMove(block, target)),
    open: (opening) => pages.open(opening),
    refreshes: true,
    removing: (block) => {
      hideBlock(block.el);
      return previewed(block, () => showBlock(block.el));
    },
    reverted: () => undefined,
  },
};

function previewed({ el }: Block, restore: () => void): Preview {
  return (writtenAt) => {
    if (writtenAt === null) {
      restore();
    } else {
      onRefresh(el, writtenAt, restore);
    }
  };
}

function onRefresh(el: HTMLElement, version: string, then: () => void) {
  const refreshed = () =>
    !el.isConnected || el.getAttribute(WRAPPER.version) !== version;
  if (refreshed()) {
    then();
    return;
  }
  const unwatch = watchBlocks(() => {
    if (refreshed()) {
      unwatch();
      then();
    }
  });
}

function previewMove(block: Block, target: Block | null): () => void {
  const copy = block.el.cloneNode(true) as HTMLElement;
  for (const name of Object.values(WRAPPER)) {
    copy.removeAttribute(name);
  }
  if (target) {
    target.el.before(copy);
  } else {
    fileBlocks(block.file)
      .findLast((b) => b.el.parentElement === block.el.parentElement)
      ?.el.after(copy);
  }
  hideBlock(block.el);
  return () => {
    copy.remove();
    showBlock(block.el);
  };
}
