import type { Diagram } from "../models/diagram.ts";
import {
  assertDiagramId,
  StorageError,
  type StorageAdapter,
} from "./storage-adapter.ts";

export interface IndexedDBStorageAdapterOptions {
  /** Name of the IndexedDB database. Defaults to `drawdb`. */
  dbName?: string;
  /** Name of the object store holding diagrams. Defaults to `diagrams`. */
  storeName?: string;
  /** Schema version. Defaults to `1`. */
  version?: number;
}

const DEFAULT_DB_NAME = "drawdb";
const DEFAULT_STORE_NAME = "diagrams";
const DEFAULT_VERSION = 1;

/**
 * Browser storage adapter backed by IndexedDB.
 *
 * The adapter talks to the raw IndexedDB API so that `@drawdb/core` stays
 * free of runtime dependencies.
 */
export class IndexedDBStorageAdapter implements StorageAdapter {
  private readonly dbName: string;
  private readonly storeName: string;
  private readonly version: number;

  private db: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase> | null = null;

  constructor(options: IndexedDBStorageAdapterOptions = {}) {
    this.dbName = options.dbName ?? DEFAULT_DB_NAME;
    this.storeName = options.storeName ?? DEFAULT_STORE_NAME;
    this.version = options.version ?? DEFAULT_VERSION;
  }

  async load(id: string): Promise<Diagram | undefined> {
    const record = await this.request<Diagram | undefined>(
      "readonly",
      (store) => store.get(id) as IDBRequest<Diagram | undefined>,
    );
    return record;
  }

  async save(diagram: Diagram): Promise<void> {
    assertDiagramId(diagram);
    const record = {
      ...diagram,
      lastModified: new Date().toISOString(),
    };
    await this.request("readwrite", (store) => store.put(record));
  }

  async delete(id: string): Promise<void> {
    await this.request("readwrite", (store) => store.delete(id));
  }

  async list(): Promise<Diagram[]> {
    const records = await this.request<Diagram[]>(
      "readonly",
      (store) => store.getAll() as IDBRequest<Diagram[]>,
    );
    return records;
  }

  async listIds(): Promise<string[]> {
    const keys = await this.request<IDBValidKey[]>(
      "readonly",
      (store) => store.getAllKeys() as IDBRequest<IDBValidKey[]>,
    );
    return keys.map((key) => String(key));
  }

  async clear(): Promise<void> {
    await this.request("readwrite", (store) => store.clear());
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
    this.opening = null;
  }

  /** Open (and if needed create) the underlying database. */
  private async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (!this.opening) {
      this.opening = new Promise<IDBDatabase>((resolve, reject) => {
        const factory = globalThis.indexedDB;
        if (!factory) {
          reject(
            new StorageError(
              "unavailable",
              "IndexedDB is not available in this environment.",
            ),
          );
          return;
        }

        let settled = false;
        const request = factory.open(this.dbName, this.version);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, {
              keyPath: "id",
            });
            store.createIndex("database", "database", { unique: false });
            store.createIndex("lastModified", "lastModified", {
              unique: false,
            });
          }
        };

        request.onsuccess = () => {
          if (settled) {
            request.result.close();
            return;
          }
          settled = true;
          this.db = request.result;
          resolve(request.result);
        };

        request.onerror = () => {
          if (settled) return;
          settled = true;
          reject(
            new StorageError(
              "unknown",
              `Failed to open IndexedDB database "${this.dbName}".`,
              request.error,
            ),
          );
        };

        request.onblocked = () => {
          if (settled) return;
          settled = true;
          reject(
            new StorageError(
              "unknown",
              `Opening IndexedDB database "${this.dbName}" is blocked by another connection.`,
            ),
          );
        };
      }).catch((error) => {
        this.opening = null;
        throw error;
      });
    }
    return this.opening;
  }

  /** Run a single request inside a transaction and await its result. */
  private async request<T = unknown>(
    mode: IDBTransactionMode,
    handler: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();

    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(this.storeName, mode);
      } catch (error) {
        reject(
          new StorageError(
            "unknown",
            `Failed to open a transaction on "${this.storeName}".`,
            error,
          ),
        );
        return;
      }

      let request: IDBRequest<T>;
      try {
        request = handler(tx.objectStore(this.storeName));
      } catch (error) {
        reject(
          new StorageError(
            "unknown",
            `Failed to run the IndexedDB request on "${this.storeName}".`,
            error,
          ),
        );
        return;
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new StorageError(
            "unknown",
            `The IndexedDB request on "${this.storeName}" failed.`,
            request.error,
          ),
        );
      tx.onabort = () =>
        reject(
          new StorageError(
            "unknown",
            `The IndexedDB transaction on "${this.storeName}" was aborted.`,
            tx.error,
          ),
        );
    });
  }
}
