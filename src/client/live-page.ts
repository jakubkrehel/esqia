import type { BlockRange } from "../shared/ops";
import { WRAPPER } from "../shared/wrapper";
import { fileBlocks } from "./blocks";
import type { PageClosing, PageOpening, RunPage } from "./page";

export class LivePage implements RunPage {
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
      el.style.setProperty("display", "contents");
    }
    return true;
  }

  private hide() {
    for (const block of fileBlocks(this.file)) {
      const range = this.ranges.get(block.version);
      const inside =
        range && block.start >= range.start && block.start < range.end;
      if (inside && block.el.style.display !== "none") {
        block.el.style.setProperty("display", "none", "important");
        this.hidden.add(block.el);
      } else if (!inside && this.hidden.has(block.el)) {
        block.el.style.setProperty("display", "contents");
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
