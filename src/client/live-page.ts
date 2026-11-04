import type { BlockRange } from "../shared/ops";
import { WRAPPER } from "../shared/wrapper";
import { sidecar } from "./api";
import { fileBlocks, hideBlock, isHidden, showBlock } from "./blocks";
import type { EditingHost, PageClosing, PageOpening, RunPage } from "./page";

export const liveHost: EditingHost = {
  backend: sidecar,
  sync: {
    applied: ({ hash, run }) => run?.page.track(hash, run.range),
    open: (opening) => new LivePage(opening),
  },
};

class LivePage implements RunPage {
  private readonly file: string;
  private readonly ranges = new Map<string, BlockRange>();
  private readonly hidden = new Set<HTMLElement>();
  private readonly observer: MutationObserver;

  constructor({ file, range, version }: PageOpening) {
    this.file = file;
    this.ranges.set(version, range);
    this.hide();
    this.observer = new MutationObserver(() => this.hide());
    this.observer.observe(document.body, {
      attributeFilter: [WRAPPER.version, WRAPPER.start],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  track(version: string, range: BlockRange) {
    this.ranges.set(version, range);
  }

  async close({ discard, version, wrote }: PageClosing): Promise<boolean> {
    if (wrote && !discard && !(await waitForVersion(this.file, version))) {
      location.reload();
      return false;
    }
    this.observer.disconnect();
    for (const el of this.hidden) {
      showBlock(el);
    }
    return true;
  }

  private hide() {
    for (const block of fileBlocks(this.file)) {
      const range = this.ranges.get(block.version);
      const inside =
        range && block.start >= range.start && block.start < range.end;
      if (inside && !isHidden(block.el)) {
        hideBlock(block.el);
        this.hidden.add(block.el);
      } else if (!inside && this.hidden.has(block.el)) {
        showBlock(block.el);
        this.hidden.delete(block.el);
      }
    }
  }
}

function waitForVersion(
  file: string,
  version: string,
  timeout = 3000
): Promise<boolean> {
  const current = () =>
    fileBlocks(file).every((block) => block.version === version);
  if (current()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!current()) {
        return;
      }
      finish(true);
    });
    const timer = setTimeout(() => finish(false), timeout);
    const finish = (ok: boolean) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(ok);
    };
    observer.observe(document.body, {
      attributeFilter: [WRAPPER.version],
      attributes: true,
      childList: true,
      subtree: true,
    });
  });
}
