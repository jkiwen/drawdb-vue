import {
  IndexedDBStorageAdapter,
  MemoryStorageAdapter,
  type StorageAdapter,
} from "@drawdb/core";

/**
 * The persistence of the standalone application.
 *
 * The application stores its diagrams in the browser (IndexedDB). A browser
 * without IndexedDB (or a test) falls back to the memory adapter, so that the
 * application stays usable.
 */
let adapter: StorageAdapter | undefined;

export function hasIndexedDB(): boolean {
  return typeof globalThis.indexedDB !== "undefined";
}

export function getStorage(): StorageAdapter {
  if (!adapter) {
    adapter = hasIndexedDB()
      ? new IndexedDBStorageAdapter()
      : new MemoryStorageAdapter();
  }
  return adapter;
}

/** Replace the adapter of the application. Used by the tests. */
export function setStorage(next: StorageAdapter): void {
  adapter = next;
}
