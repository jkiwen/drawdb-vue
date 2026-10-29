import type {
  DatabaseType,
  DialectDiagnostic,
  LogicalDomain,
  LogicalFamilyId,
  LogicalTypeFamily,
  TypeMapping,
  TypeScopeLayer,
  TypeScopeLevel,
  TypeScopeSnapshot,
} from "@drawdb/core";
import {
  BUILTIN_FAMILIES,
  emptyTypeScope,
  registerDomain as registerDomainIn,
  updateFamilyMapping as updateMappingIn,
  upsertScopeLayer,
} from "@drawdb/core";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

/**
 * The key of the persisted type scope. The diagram layer is never persisted
 * here: it belongs to the document, and P6 only edits the application and
 * workspace layers (spec section 5).
 */
export const TYPE_SCOPE_STORAGE_KEY = "drawdb:type-scope";

/** The outcome of an edit: refused edits carry the diagnostic to show. */
export type TypeScopeOutcome =
  | { ok: true }
  | { ok: false; diagnostic: DialectDiagnostic };

/** The layers the panel and the DSM are allowed to edit. */
export const EDITABLE_LEVELS: readonly TypeScopeLevel[] = ["application", "workspace"];

function emptySnapshot(): TypeScopeSnapshot {
  return emptyTypeScope();
}

/**
 * Reads the persisted scope. A broken entry falls back to the builtins rather
 * than throwing: a user whose storage holds garbage can still open the editor.
 */
export function readTypeScope(storage: Pick<Storage, "getItem"> = localStorage): TypeScopeSnapshot {
  const raw = storage.getItem(TYPE_SCOPE_STORAGE_KEY);
  if (!raw) {
    return emptySnapshot();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<TypeScopeSnapshot> | null;
    if (!parsed || typeof parsed !== "object") {
      return emptySnapshot();
    }
    return {
      application: normalizeLayer(parsed.application),
      workspace: normalizeLayer(parsed.workspace),
      diagram: {},
    };
  } catch {
    return emptySnapshot();
  }
}

function normalizeLayer(value: unknown): TypeScopeLayer {
  if (!value || typeof value !== "object") {
    return {};
  }
  const layer = value as TypeScopeLayer;
  return {
    families: layer.families && typeof layer.families === "object" ? layer.families : undefined,
    domains: layer.domains && typeof layer.domains === "object" ? layer.domains : undefined,
  };
}

function persist(snapshot: TypeScopeSnapshot): void {
  const payload: TypeScopeSnapshot = {
    application: snapshot.application,
    workspace: snapshot.workspace,
    diagram: {},
  };
  try {
    localStorage.setItem(TYPE_SCOPE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // A full or blocked storage keeps the in-memory scope working for this session.
  }
}

/** Applies the family overrides of both editable layers on top of the builtins. */
function mergeFamilies(snapshot: TypeScopeSnapshot): LogicalTypeFamily[] {
  return BUILTIN_FAMILIES.map((family) => {
    let merged = family;
    for (const level of EDITABLE_LEVELS) {
      const override = snapshot[level].families?.[family.id];
      if (!override) {
        continue;
      }
      merged = {
        ...merged,
        ...(override.defaultParams ? { defaultParams: override.defaultParams } : {}),
        mappings: { ...merged.mappings, ...(override.mappings ?? {}) },
      };
    }
    return merged;
  });
}

/** Every domain the scope answers with, nearest layer first. */
function mergeDomains(snapshot: TypeScopeSnapshot): LogicalDomain[] {
  const byName = new Map<string, LogicalDomain>();
  for (const level of [...EDITABLE_LEVELS].reverse()) {
    for (const domain of Object.values(snapshot[level].domains ?? {})) {
      byName.set(domain.name, domain);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const useTypeScopeStore = defineStore("type-scope", () => {
  const snapshot = ref<TypeScopeSnapshot>(readTypeScope());

  function commit(next: TypeScopeSnapshot): void {
    snapshot.value = { application: next.application, workspace: next.workspace, diagram: {} };
    persist(snapshot.value);
  }

  const families = computed(() => mergeFamilies(snapshot.value));
  const domains = computed(() => mergeDomains(snapshot.value));
  const storageKey = TYPE_SCOPE_STORAGE_KEY;

  function layer(level: TypeScopeLevel): TypeScopeLayer {
    return level === "diagram" ? {} : snapshot.value[level];
  }

  /** Registers a domain at one of the editable layers (application by default). */
  function registerDomain(domain: LogicalDomain, at: TypeScopeLevel = "application"): TypeScopeOutcome {
    const result = registerDomainIn(snapshot.value, at, domain);
    if (!result.ok) {
      return { ok: false, diagnostic: result.diagnostic };
    }
    commit(result.scope);
    return { ok: true };
  }

  /** Renames a domain in place, keeping its family and parameters. */
  function renameDomain(name: string, nextName: string): TypeScopeOutcome {
    const levels = [...EDITABLE_LEVELS].reverse();
    for (const level of levels) {
      const domain = snapshot.value[level].domains?.[name];
      if (!domain) {
        continue;
      }
      const domains = { ...snapshot.value[level].domains };
      delete domains[name];
      return replaceLayer(level, { ...snapshot.value[level], domains: { ...domains, [nextName]: { ...domain, name: nextName } } });
    }
    return { ok: false, diagnostic: missingDomain(name) };
  }

  /** Removes a domain from whichever editable layer holds it. */
  function removeDomain(name: string): TypeScopeOutcome {
    for (const level of [...EDITABLE_LEVELS].reverse()) {
      const domains = snapshot.value[level].domains;
      if (!domains || !Object.prototype.hasOwnProperty.call(domains, name)) {
        continue;
      }
      const next = { ...domains };
      delete next[name];
      return replaceLayer(level, { ...snapshot.value[level], domains: next });
    }
    return { ok: false, diagnostic: missingDomain(name) };
  }

  /** Overrides one mapping item (family + dialect) of one layer. */
  function updateMapping(
    familyId: LogicalFamilyId,
    database: DatabaseType,
    mapping: TypeMapping,
    at: TypeScopeLevel = "application",
  ): TypeScopeOutcome {
    const result = updateMappingIn(snapshot.value, at, familyId, database, mapping);
    if (!result.ok) {
      return { ok: false, diagnostic: result.diagnostic };
    }
    commit(result.scope);
    return { ok: true };
  }

  /** Replaces one layer wholesale (the DSM imports a draft through this). */
  function setLayer(level: TypeScopeLevel, layer: TypeScopeLayer): TypeScopeOutcome {
    if (level === "diagram") {
      return { ok: false, diagnostic: missingDomain("diagram") };
    }
    commit(upsertScopeLayer(snapshot.value, level, layer));
    return { ok: true };
  }

  /** Drops every override, returning to the builtin families and no domains. */
  function resetToBuiltins(): void {
    commit(emptySnapshot());
  }

  /** The snapshot the resolver and the linter should read. */
  function getSnapshot(): TypeScopeSnapshot {
    return snapshot.value;
  }

  /**
   * Replaces one layer outright. `upsertScopeLayer` merges by key, which cannot
   * express a rename or a removal, so those two go through this instead.
   */
  function replaceLayer(level: TypeScopeLevel, layer: TypeScopeLayer): TypeScopeOutcome {
    const next: TypeScopeSnapshot = {
      application: snapshot.value.application,
      workspace: snapshot.value.workspace,
      diagram: {},
    };
    next[level] = layer;
    commit(next);
    return { ok: true };
  }

  return {
    snapshot,
    storageKey,
    families,
    domains,
    layer,
    getSnapshot,
    registerDomain,
    renameDomain,
    removeDomain,
    updateMapping,
    setLayer,
    resetToBuiltins,
  };
});

function missingDomain(name: string): DialectDiagnostic {
  return {
    severity: "error",
    code: "UNRESOLVED_TYPE",
    scope: {},
    message: `there is no domain named "${name}"`,
    fixable: false,
  };
}
