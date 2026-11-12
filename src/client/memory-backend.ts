import type { ClientConfig } from "../shared/config";
import { EditHistory, type FileStore } from "../shared/history";
import { settle } from "../shared/outcome";
import type { Backend } from "./api";

export function memoryBackend(store: FileStore, config: ClientConfig): Backend {
  const history = new EditHistory(store);

  return {
    changes: () => Promise.resolve(history.changes()),
    config: () => Promise.resolve(config),
    edit: async (name, hash, intent, group) =>
      settle(await history.edit(name, hash, intent, group)),
    redo: async (name) => settle(await history.redo(name)),
    revert: () => history.revertAll(),
    source: (name) => history.source(name),
    undo: async (name) => settle(await history.undo(name)),
  };
}
