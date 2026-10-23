# drawDB Vue 3 SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vue 3 + TypeScript + Naive UI SDK for drawDB that supports both embedded component usage and a standalone application, with plugin system, metadata extensions, physical/logical view modes, and comprehensive tests.

**Architecture:** Three-layer monorepo: `@drawdb/core` (data models + SQL/DBML + commands), `@drawdb/vue-sdk` (Vue components + Pinia stores + plugins), and `drawdb-vue-app` (standalone app). React-specific code is replaced; pure logic from drawDB is migrated and wrapped in framework-agnostic TypeScript.

**Tech Stack:** Vue 3.4+, TypeScript 5.3+, Vite 5, pnpm workspaces, Pinia 2.1+, Naive UI 2.38+, Vitest, node-sql-parser, @dbml/core, @dagrejs/dagre, html-to-image, monaco-editor.

**Spec:** `docs/superpowers/specs/2026-10-23-drawdb-vue-sdk-design.md`

## Global Constraints

- **Vue 3.4+ only**; Vue 2 is not supported.
- **TypeScript strict mode** enabled in every package.
- **ESM output only** for SDK packages; CJS allowed only for `@drawdb/core`.
- **CSS Modules** for all SDK styles; no global CSS leakage.
- **Modern browsers only**: last 2 versions of Chrome, Firefox, Edge, Safari.
- **No real-time collaboration in v1**, but collaboration interface must be reserved.
- **All core utilities must have unit tests** before being used by SDK components.
- **No component file may exceed 300 lines**; split aggressively.
- **All undo/redo state changes go through CommandManager**.
- **Storage is adapter-based**: default IndexedDB adapter + optional controlled adapter.

## Review Focus

1. **Large diagram load (100+ tables):** Canvas must remain at 60fps during pan/zoom/drag; verify virtualization and shallow reactivity.
2. **Cross-browser SVG foreignObject:** Table HTML rendering inside SVG must work consistently in all target browsers.
3. **SQL dialect edge cases:** Import/export round-trip for all 7 databases must preserve constraints, indexes, and comments.
4. **Undo/redo consistency:** After any sequence of operations, undo must restore exact prior state including selection and viewport.
5. **Plugin isolation:** A misbehaving plugin must not corrupt core diagram state; extension points are read-only or go through stores.

---

## Task 1: Bootstrap Monorepo Infrastructure

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `packages/core/package.json`
- Create: `packages/sdk/package.json`
- Create: `packages/app/package.json`
- Create: `.github/workflows/ci.yml`
- Test: `scripts/verify-workspace.test.ts`

**Interfaces:**
- Produces: workspace structure with three packages, pnpm scripts (`dev`, `build`, `test`, `lint`), shared TypeScript config.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

describe('workspace bootstrap', () => {
  it('has three packages', () => {
    const packages = readdirSync('packages');
    expect(packages).toContain('core');
    expect(packages).toContain('sdk');
    expect(packages).toContain('app');
  });

  it('core package has correct name and exports', () => {
    const pkg = JSON.parse(readFileSync('packages/core/package.json', 'utf-8'));
    expect(pkg.name).toBe('@drawdb/core');
    expect(pkg.type).toBe('module');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run scripts/verify-workspace.test.ts`
Expected: FAIL with packages not found.

- [ ] **Step 3: Create monorepo root files**

Create `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` with exact package names and workspace globs.

- [ ] **Step 4: Create package skeletons**

Create `packages/core/package.json`, `packages/sdk/package.json`, `packages/app/package.json` with correct `name`, `type: "module"`, scripts, and devDependencies.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run scripts/verify-workspace.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: bootstrap drawdb-vue monorepo"
```

---

## Task 2: Define Core Data Models

**Files:**
- Create: `packages/core/src/models/diagram.ts`
- Create: `packages/core/src/models/table.ts`
- Create: `packages/core/src/models/field.ts`
- Create: `packages/core/src/models/relationship.ts`
- Create: `packages/core/src/models/area.ts`
- Create: `packages/core/src/models/note.ts`
- Create: `packages/core/src/models/view.ts`
- Create: `packages/core/src/models/enum.ts`
- Create: `packages/core/src/models/type.ts`
- Create: `packages/core/src/models/metadata.ts`
- Create: `packages/core/src/models/index.ts`
- Test: `packages/core/src/models/index.test.ts`

**Interfaces:**
- Produces: `Diagram`, `Table`, `Field`, `Relationship`, `Area`, `Note`, `View`, `Enum`, `CustomType`, `MetadataValue` interfaces and `createEmptyDiagram()` factory.
- Produces: `DatabaseType` union type (`'mysql' | 'postgres' | 'sqlite' | 'mariadb' | 'mssql' | 'oraclesql' | 'generic'`).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { createEmptyDiagram, DatabaseType } from './index';

describe('diagram model', () => {
  it('creates empty diagram with required fields', () => {
    const diagram = createEmptyDiagram({ database: 'mysql' });
    expect(diagram.database).toBe('mysql');
    expect(diagram.tables).toEqual([]);
    expect(diagram.relationships).toEqual([]);
    expect(diagram.metadata).toEqual({});
  });

  it('accepts metadata on table and field', () => {
    const diagram = createEmptyDiagram({ database: 'postgres' });
    diagram.tables.push({
      id: 't1',
      name: 'users',
      x: 0,
      y: 0,
      fields: [{
        id: 'f1',
        name: 'id',
        type: 'bigint',
        nullable: false,
        metadata: { owner: 'platform' }
      }],
      metadata: { domain: 'identity' }
    });
    expect(diagram.tables[0].metadata.domain).toBe('identity');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/core exec vitest run src/models/index.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement model files**

Implement all model interfaces and the `createEmptyDiagram` factory in `packages/core/src/models/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/core exec vitest run src/models/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/models
git commit -m "feat(core): add data models with metadata support"
```

---

## Task 3: Implement Command Pattern for Undo/Redo

**Files:**
- Create: `packages/core/src/commands/command.ts`
- Create: `packages/core/src/commands/command-manager.ts`
- Create: `packages/core/src/commands/add-table.ts`
- Create: `packages/core/src/commands/update-table.ts`
- Create: `packages/core/src/commands/remove-table.ts`
- Create: `packages/core/src/commands/add-relationship.ts`
- Create: `packages/core/src/commands/update-field.ts`
- Create: `packages/core/src/commands/index.ts`
- Test: `packages/core/src/commands/command-manager.test.ts`

**Interfaces:**
- Consumes: `Diagram`, `Table`, `Field`, `Relationship` from Task 2.
- Produces: `Command` interface, `CommandManager` class, concrete command classes with `execute/undo/redo/description`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { CommandManager } from './command-manager';
import { createEmptyDiagram } from '../models';
import { AddTableCommand } from './add-table';

describe('command manager', () => {
  it('executes and undoes add table', () => {
    const diagram = createEmptyDiagram({ database: 'mysql' });
    const manager = new CommandManager();
    const table = { id: 't1', name: 'users', x: 0, y: 0, fields: [], metadata: {} };
    const command = new AddTableCommand(diagram, table);

    manager.execute(command);
    expect(diagram.tables).toHaveLength(1);

    manager.undo();
    expect(diagram.tables).toHaveLength(0);

    manager.redo();
    expect(diagram.tables).toHaveLength(1);
  });

  it('clears redo stack on new execute', () => {
    const diagram = createEmptyDiagram({ database: 'mysql' });
    const manager = new CommandManager();
    manager.execute(new AddTableCommand(diagram, { id: 't1', name: 'a', x: 0, y: 0, fields: [], metadata: {} }));
    manager.undo();
    manager.execute(new AddTableCommand(diagram, { id: 't2', name: 'b', x: 0, y: 0, fields: [], metadata: {} }));
    expect(manager.canRedo).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/core exec vitest run src/commands/command-manager.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement command pattern**

Implement `Command` interface, `CommandManager`, and at least Add/Update/Remove Table commands. Update/Remove must preserve snapshot data for undo.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/core exec vitest run src/commands/command-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/commands
git commit -m "feat(core): implement command pattern for undo/redo"
```

---

## Task 4: Migrate SQL Export Utilities

**Files:**
- Create: `packages/core/src/sql/export/shared.ts`
- Create: `packages/core/src/sql/export/mysql.ts`
- Create: `packages/core/src/sql/export/postgres.ts`
- Create: `packages/core/src/sql/export/sqlite.ts`
- Create: `packages/core/src/sql/export/mariadb.ts`
- Create: `packages/core/src/sql/export/mssql.ts`
- Create: `packages/core/src/sql/export/oraclesql.ts`
- Create: `packages/core/src/sql/export/generic.ts`
- Create: `packages/core/src/sql/export/index.ts`
- Test: `packages/core/src/sql/export/index.test.ts`

**Interfaces:**
- Consumes: `Diagram`, `Table`, `Field` from Task 2.
- Produces: `exportSQL(diagram: Diagram, database: DatabaseType): string`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { exportSQL } from './index';
import { createEmptyDiagram } from '../../models';

describe('sql export', () => {
  it('exports mysql create table', () => {
    const diagram = createEmptyDiagram({ database: 'mysql' });
    diagram.tables.push({
      id: 't1',
      name: 'users',
      x: 0, y: 0,
      fields: [
        { id: 'f1', name: 'id', type: 'INT', nullable: false, primary: true, autoinc: true, metadata: {} }
      ],
      indexes: [],
      metadata: {}
    });
    const sql = exportSQL(diagram, 'mysql');
    expect(sql).toContain('CREATE TABLE `users`');
    expect(sql).toContain('`id` INT NOT NULL AUTO_INCREMENT');
    expect(sql).toContain('PRIMARY KEY (`id`)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/core exec vitest run src/sql/export/index.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Port export logic from drawDB**

Migrate `src/utils/exportSQL/*` logic into `packages/core/src/sql/export/`, converting to TypeScript and adding complete escaping beyond single quotes.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/core exec vitest run src/sql/export/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/sql/export
git commit -m "feat(core): migrate sql export for 7 dialects"
```

---

## Task 5: Migrate SQL Import Utilities

**Files:**
- Create: `packages/core/src/sql/import/parser.ts`
- Create: `packages/core/src/sql/import/mysql.ts`
- Create: `packages/core/src/sql/import/postgres.ts`
- Create: `packages/core/src/sql/import/sqlite.ts`
- Create: `packages/core/src/sql/import/index.ts`
- Test: `packages/core/src/sql/import/index.test.ts`

**Interfaces:**
- Consumes: `Diagram` from Task 2, `node-sql-parser` AST.
- Produces: `importSQL(sql: string, database: DatabaseType): Diagram`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { importSQL } from './index';

describe('sql import', () => {
  it('imports mysql create table', () => {
    const sql = `CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255));`;
    const diagram = importSQL(sql, 'mysql');
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0].name).toBe('users');
    expect(diagram.tables[0].fields).toHaveLength(2);
    expect(diagram.tables[0].fields[0].primary).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/core exec vitest run src/sql/import/index.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Port import logic from drawDB**

Migrate `src/utils/importSQL/*` logic into `packages/core/src/sql/import/`, add input validation and clear error messages.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/core exec vitest run src/sql/import/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/sql/import
git commit -m "feat(core): migrate sql import with validation"
```

---

## Task 6: Implement Storage Adapters

**Files:**
- Create: `packages/core/src/storage/storage-adapter.ts`
- Create: `packages/core/src/storage/memory-adapter.ts`
- Create: `packages/core/src/storage/indexeddb-adapter.ts`
- Create: `packages/core/src/storage/index.ts`
- Test: `packages/core/src/storage/indexeddb-adapter.test.ts`

**Interfaces:**
- Consumes: `Diagram` from Task 2.
- Produces: `StorageAdapter` interface, `MemoryStorageAdapter`, `IndexedDBStorageAdapter`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from './memory-adapter';
import { createEmptyDiagram } from '../models';

describe('memory storage adapter', () => {
  it('saves and loads diagram', async () => {
    const adapter = new MemoryStorageAdapter();
    const diagram = createEmptyDiagram({ database: 'mysql' });
    diagram.id = 'd1';
    await adapter.save(diagram);
    const loaded = await adapter.load('d1');
    expect(loaded?.id).toBe('d1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/core exec vitest run src/storage/memory-adapter.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement adapters**

Implement `StorageAdapter` interface, `MemoryStorageAdapter`, and `IndexedDBStorageAdapter` with Dexie-like promise API and error handling.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/core exec vitest run src/storage/indexeddb-adapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/storage
git commit -m "feat(core): add storage adapters"
```

---

## Task 7: Implement Metadata & Plugin Systems

**Files:**
- Create: `packages/core/src/metadata/metadata-schema.ts`
- Create: `packages/core/src/metadata/metadata-registry.ts`
- Create: `packages/core/src/plugins/plugin.ts`
- Create: `packages/core/src/plugins/plugin-manager.ts`
- Create: `packages/core/src/plugins/extension-points.ts`
- Create: `packages/core/src/plugins/index.ts`
- Test: `packages/core/src/plugins/plugin-manager.test.ts`

**Interfaces:**
- Consumes: `Diagram`, `Table`, `Field` from Task 2.
- Produces: `Plugin`, `PluginContext`, `MetadataSchema`, `MetadataProperty`, `PluginManager`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { PluginManager } from './plugin-manager';
import { createEmptyDiagram } from '../models';

describe('plugin manager', () => {
  it('activates and deactivates plugin', () => {
    const manager = new PluginManager();
    const plugin = {
      id: 'p1',
      name: 'Test Plugin',
      version: '1.0.0',
      activate: vi.fn(),
      deactivate: vi.fn()
    };
    manager.register(plugin);
    manager.activate('p1', { diagram: createEmptyDiagram({ database: 'mysql' }) } as any);
    expect(plugin.activate).toHaveBeenCalled();
    manager.deactivate('p1');
    expect(plugin.deactivate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/core exec vitest run src/plugins/plugin-manager.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement plugin and metadata systems**

Define plugin interfaces, extension points, and metadata schema validation. Plugin context exposes read-only stores and registration hooks.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/core exec vitest run src/plugins/plugin-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/plugins packages/core/src/metadata
git commit -m "feat(core): add plugin and metadata extension systems"
```

---

## Task 8: Migrate DBML Utilities

**Files:**
- Create: `packages/core/src/dbml/parse.ts`
- Create: `packages/core/src/dbml/export.ts`
- Create: `packages/core/src/dbml/diff.ts`
- Create: `packages/core/src/dbml/reconcile.ts`
- Create: `packages/core/src/dbml/index.ts`
- Test: `packages/core/src/dbml/index.test.ts`

**Interfaces:**
- Consumes: `Diagram` from Task 2.
- Produces: `parseDBML(source: string): Diagram`, `exportDBML(diagram: Diagram): string`, `diffDBML(a: Diagram, b: Diagram): DBMLDiff`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { parseDBML, exportDBML } from './index';

describe('dbml', () => {
  it('round-trips simple diagram', () => {
    const source = `Table users { id int [pk] name varchar }`;
    const diagram = parseDBML(source);
    expect(diagram.tables[0].name).toBe('users');
    const exported = exportDBML(diagram);
    expect(exported).toContain('Table users');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/core exec vitest run src/dbml/index.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Port DBML logic from drawDB**

Migrate `src/utils/dbml/*` logic into `packages/core/src/dbml/`, convert to TypeScript.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/core exec vitest run src/dbml/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/dbml
git commit -m "feat(core): migrate dbml utilities"
```

---

## Task 9: Build Pinia Stores

**Files:**
- Create: `packages/sdk/src/stores/diagram.ts`
- Create: `packages/sdk/src/stores/ui.ts`
- Create: `packages/sdk/src/stores/history.ts`
- Create: `packages/sdk/src/stores/settings.ts`
- Create: `packages/sdk/src/stores/save.ts`
- Create: `packages/sdk/src/stores/index.ts`
- Test: `packages/sdk/src/stores/diagram.test.ts`

**Interfaces:**
- Consumes: `Diagram`, `Table`, `Command`, `CommandManager`, `StorageAdapter` from core.
- Produces: `useDiagramStore`, `useUIStore`, `useHistoryStore`, `useSettingsStore`, `useSaveStore`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDiagramStore } from './diagram';

describe('diagram store', () => {
  it('adds table and emits change', () => {
    setActivePinia(createPinia());
    const store = useDiagramStore();
    store.addTable({ id: 't1', name: 'users', x: 0, y: 0, fields: [], metadata: {} });
    expect(store.diagram.tables).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/stores/diagram.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement Pinia stores**

Implement stores using Pinia setup stores. `historyStore` wraps `CommandManager`; `diagramStore` actions record commands through history.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/stores/diagram.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/stores
git commit -m "feat(sdk): add pinia stores"
```

---

## Task 10: Implement Canvas Composables

**Files:**
- Create: `packages/sdk/src/composables/use-canvas-events.ts`
- Create: `packages/sdk/src/composables/use-selection.ts`
- Create: `packages/sdk/src/composables/use-drag.ts`
- Create: `packages/sdk/src/composables/use-viewport.ts`
- Create: `packages/sdk/src/composables/use-hotkeys.ts`
- Create: `packages/sdk/src/composables/use-storage.ts`
- Create: `packages/sdk/src/composables/index.ts`
- Test: `packages/sdk/src/composables/use-selection.test.ts`

**Interfaces:**
- Consumes: `useDiagramStore`, `useUIStore`, `useHistoryStore` from Task 9.
- Produces: reactive composables for canvas events, selection, drag, viewport, hotkeys, storage.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useSelection } from './use-selection';

describe('useSelection', () => {
  it('selects and deselects elements', () => {
    const { selectedIds, select, deselect, clear } = useSelection();
    select('t1');
    expect(selectedIds.value).toContain('t1');
    deselect('t1');
    expect(selectedIds.value).not.toContain('t1');
    select('t1');
    select('t2');
    clear();
    expect(selectedIds.value).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/composables/use-selection.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement composables**

Implement canvas event handling with `requestAnimationFrame` throttling, selection state, drag logic, viewport tracking, hotkey registration, and storage adapter binding.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/composables/use-selection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/composables
git commit -m "feat(sdk): add canvas composables"
```

---

## Task 11: Build Canvas Components

**Files:**
- Create: `packages/sdk/src/components/Canvas/Canvas.vue`
- Create: `packages/sdk/src/components/Canvas/Table.vue`
- Create: `packages/sdk/src/components/Canvas/Relationship.vue`
- Create: `packages/sdk/src/components/Canvas/Area.vue`
- Create: `packages/sdk/src/components/Canvas/Note.vue`
- Create: `packages/sdk/src/components/Canvas/View.vue`
- Create: `packages/sdk/src/components/Canvas/index.ts`
- Test: `packages/sdk/src/components/Canvas/Canvas.test.ts`

**Interfaces:**
- Consumes: `useDiagramStore`, `useUIStore`, `useCanvasEvents`, `useSelection`, `useDrag`, `useViewport` from Tasks 9-10.
- Produces: `Canvas.vue` root component with SVG rendering, child node components.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Canvas from './Canvas.vue';

describe('Canvas', () => {
  it('renders svg element', () => {
    setActivePinia(createPinia());
    const wrapper = mount(Canvas);
    expect(wrapper.find('svg').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/components/Canvas/Canvas.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement Canvas components**

Implement SVG Canvas with virtualization (render only visible elements), `foreignObject` tables, relationship paths, areas, notes, views. Each component file must be < 300 lines.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/components/Canvas/Canvas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/components/Canvas
git commit -m "feat(sdk): add canvas components with virtualization"
```

---

## Task 12: Build Header Components

**Files:**
- Create: `packages/sdk/src/components/Header/Header.vue`
- Create: `packages/sdk/src/components/Header/MenuBar.vue`
- Create: `packages/sdk/src/components/Header/Toolbar.vue`
- Create: `packages/sdk/src/components/Header/UndoRedoButtons.vue`
- Create: `packages/sdk/src/components/Header/index.ts`
- Test: `packages/sdk/src/components/Header/Header.test.ts`

**Interfaces:**
- Consumes: `useHistoryStore`, `useDiagramStore`, `useSaveStore`, `useUIStore` from Task 9.
- Produces: `Header.vue` composed of MenuBar, Toolbar, UndoRedoButtons.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Header from './Header.vue';

describe('Header', () => {
  it('renders undo/redo buttons', () => {
    setActivePinia(createPinia());
    const wrapper = mount(Header);
    expect(wrapper.find('[data-testid="undo-btn"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="redo-btn"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/components/Header/Header.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement Header components**

Split header into focused components, replacing the original 2,509-line ControlPanel. Use Naive UI components.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/components/Header/Header.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/components/Header
git commit -m "feat(sdk): add header components"
```

---

## Task 13: Build SidePanel Components

**Files:**
- Create: `packages/sdk/src/components/SidePanel/SidePanel.vue`
- Create: `packages/sdk/src/components/SidePanel/TablesTab.vue`
- Create: `packages/sdk/src/components/SidePanel/RelationshipsTab.vue`
- Create: `packages/sdk/src/components/SidePanel/AreasTab.vue`
- Create: `packages/sdk/src/components/SidePanel/NotesTab.vue`
- Create: `packages/sdk/src/components/SidePanel/ViewsTab.vue`
- Create: `packages/sdk/src/components/SidePanel/TypesTab.vue`
- Create: `packages/sdk/src/components/SidePanel/EnumsTab.vue`
- Create: `packages/sdk/src/components/SidePanel/index.ts`
- Test: `packages/sdk/src/components/SidePanel/SidePanel.test.ts`

**Interfaces:**
- Consumes: `useDiagramStore`, `useUIStore`, `useHistoryStore` from Task 9.
- Produces: tabbed side panel components for editing diagram elements.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SidePanel from './SidePanel.vue';

describe('SidePanel', () => {
  it('renders tabs', () => {
    setActivePinia(createPinia());
    const wrapper = mount(SidePanel);
    expect(wrapper.find('[data-testid="tables-tab"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/components/SidePanel/SidePanel.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement SidePanel components**

Implement each tab as a focused component using Naive UI. All element edits go through history commands.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/components/SidePanel/SidePanel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/components/SidePanel
git commit -m "feat(sdk): add side panel components"
```

---

## Task 14: Implement DrawDBEditor Main Component

**Files:**
- Create: `packages/sdk/src/components/DrawDBEditor.vue`
- Create: `packages/sdk/src/components/index.ts`
- Create: `packages/sdk/src/types/sdk-options.ts`
- Create: `packages/sdk/src/index.ts`
- Test: `packages/sdk/src/components/DrawDBEditor.test.ts`

**Interfaces:**
- Consumes: All stores, Canvas, Header, SidePanel, plugin manager, storage adapter.
- Produces: `DrawDBEditor` component with `modelValue`/`initialValue` props and documented emits.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import DrawDBEditor from './DrawDBEditor.vue';

describe('DrawDBEditor', () => {
  it('renders canvas and side panel', () => {
    setActivePinia(createPinia());
    const wrapper = mount(DrawDBEditor);
    expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="side-panel"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/components/DrawDBEditor.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement DrawDBEditor**

Compose Header, Canvas, SidePanel. Implement prop handling, auto-save, controlled/uncontrolled modes, plugin loading, and event emission.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/components/DrawDBEditor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/components/DrawDBEditor.vue packages/sdk/src/index.ts packages/sdk/src/types
git commit -m "feat(sdk): add DrawDBEditor main component"
```

---

## Task 15: Implement Physical/Logical View Mode

**Files:**
- Modify: `packages/sdk/src/stores/ui.ts`
- Modify: `packages/sdk/src/components/Canvas/Table.vue`
- Modify: `packages/sdk/src/components/Canvas/Relationship.vue`
- Create: `packages/sdk/src/components/Canvas/LogicalTable.vue`
- Create: `packages/sdk/src/components/Canvas/LogicalRelationship.vue`
- Test: `packages/sdk/src/components/Canvas/view-mode.test.ts`

**Interfaces:**
- Consumes: `ViewMode` from core, `useUIStore`.
- Produces: conditional rendering based on `ui.viewMode` (`'physical' | 'logical'`).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Table from './Table.vue';
import { useUIStore } from '../../stores/ui';

describe('view mode', () => {
  it('hides field types in logical view', () => {
    setActivePinia(createPinia());
    const ui = useUIStore();
    ui.setViewMode('logical');
    const wrapper = mount(Table, { props: { table: { id: 't1', name: 'users', x: 0, y: 0, fields: [{ id: 'f1', name: 'id', type: 'INT', nullable: false, metadata: {} }], metadata: {} } } });
    expect(wrapper.find('[data-testid="field-type"]').exists()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/components/Canvas/view-mode.test.ts`
Expected: FAIL with module not found or assertion failure.

- [ ] **Step 3: Implement view mode switching**

Add `viewMode` to UI store, toggle action, and conditional rendering in Canvas components. Logical view uses simplified node/relationship components.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/components/Canvas/view-mode.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/components/Canvas packages/sdk/src/stores/ui.ts
git commit -m "feat(sdk): add physical/logical view mode"
```

---

## Task 16: Migrate i18n Locales

**Files:**
- Create: `packages/sdk/src/i18n/index.ts`
- Create: `packages/sdk/src/i18n/locales/en.json`
- Create: `packages/sdk/src/i18n/locales/zh-CN.json`
- Create: script: `scripts/migrate-i18n.ts`
- Test: `packages/sdk/src/i18n/index.test.ts`

**Interfaces:**
- Produces: `createI18n(locale)` function returning Vue I18n instance; 36 locale JSON files.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { createI18n } from './index';

describe('i18n', () => {
  it('loads english translations', async () => {
    const i18n = await createI18n('en');
    expect(i18n.global.t('table')).toBe('Table');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/i18n/index.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Migrate locales**

Write a script to convert drawDB's i18n JSON format to Vue I18n compatible format. Migrate at least `en` and `zh-CN` manually, script for the rest.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/i18n/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/i18n scripts/migrate-i18n.ts
git commit -m "feat(sdk): migrate i18n locales"
```

---

## Task 17: Build Standalone App

**Files:**
- Create: `packages/app/src/main.ts`
- Create: `packages/app/src/App.vue`
- Create: `packages/app/src/router/index.ts`
- Create: `packages/app/src/views/HomeView.vue`
- Create: `packages/app/src/views/EditorView.vue`
- Create: `packages/app/src/views/TemplateView.vue`
- Create: `packages/app/index.html`
- Create: `packages/app/vite.config.ts`
- Test: `packages/app/src/App.test.ts`

**Interfaces:**
- Consumes: `@drawdb/vue-sdk`.
- Produces: runnable standalone drawDB app with home, editor, and template routes.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import App from './App.vue';

describe('App', () => {
  it('renders router view', () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });
    expect(wrapper.find('router-view-stub').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter drawdb-vue-app exec vitest run src/App.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement app package**

Create Vite app entry, router, views. Import and use `DrawDBEditor` from `@drawdb/vue-sdk`. Configure local IndexedDB persistence.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter drawdb-vue-app exec vitest run src/App.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app
git commit -m "feat(app): add standalone drawdb-vue app"
```

---

## Task 18: End-to-End Testing & Performance Optimization

**Files:**
- Create: `e2e/smoke.spec.ts`
- Create: `e2e/performance.spec.ts`
- Create: `packages/sdk/src/composables/use-virtualization.ts`
- Modify: `packages/sdk/src/components/Canvas/Canvas.vue`
- Test: `packages/sdk/src/composables/use-virtualization.test.ts`

**Interfaces:**
- Consumes: Canvas components and stores.
- Produces: virtualized rendering verified by unit + e2e tests; Lighthouse/Playwright performance checks.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useVirtualization } from './use-virtualization';

describe('useVirtualization', () => {
  it('filters elements outside viewport', () => {
    const elements = ref([
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 5000, y: 5000, width: 100, height: 100 }
    ]);
    const viewport = ref({ x: 0, y: 0, width: 1000, height: 1000 });
    const { visibleElements } = useVirtualization(elements, viewport);
    expect(visibleElements.value.map(e => e.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/composables/use-virtualization.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement virtualization**

Implement `useVirtualization` composable and integrate into `Canvas.vue`. Add Playwright e2e tests for smoke and 100-table drag performance.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @drawdb/vue-sdk exec vitest run src/composables/use-virtualization.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/composables/use-virtualization.ts e2e
git commit -m "perf(sdk): add virtualization and performance tests"
```

---

## Task 19: Documentation & Packaging

**Files:**
- Create: `packages/core/README.md`
- Create: `packages/sdk/README.md`
- Create: `packages/app/README.md`
- Create: `README.md`
- Modify: `packages/core/package.json` build scripts
- Modify: `packages/sdk/package.json` build scripts

**Interfaces:**
- Produces: documented packages with correct build outputs, type declarations, and npm publish config.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';

describe('package artifacts', () => {
  it('sdk builds dts entry', () => {
    expect(existsSync('packages/sdk/dist/index.d.ts')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run scripts/verify-artifacts.test.ts`
Expected: FAIL with artifacts not built.

- [ ] **Step 3: Configure package builds**

Add `vite build` / `tsup` config to core and sdk packages to produce ESM + dts. Write README files with usage examples.

- [ ] **Step 4: Run build and verify**

Run: `pnpm build`
Expected: All packages build successfully.

Run: `pnpm exec vitest run scripts/verify-artifacts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md packages/*/README.md packages/*/package.json packages/*/vite.config.ts
git commit -m "docs: add readmes and package build configs"
```

---

## Task 20: Final Integration & Release

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `CHANGELOG.md`
- Create: `examples/vue-embed/README.md`
- Create: `examples/vue-embed/src/App.vue`

**Interfaces:**
- Consumes: all packages.
- Produces: CI/CD pipeline passing, example project, changelog, release tags.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('release readiness', () => {
  it('has changelog entry', () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf-8');
    expect(changelog).toContain('## 1.0.0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run scripts/verify-release.test.ts`
Expected: FAIL with CHANGELOG not found.

- [ ] **Step 3: Finalize CI/CD and examples**

Configure GitHub Actions for test/build/release. Create embedded example. Write CHANGELOG.

- [ ] **Step 4: Run full verification**

Run: `pnpm test` and `pnpm build`
Expected: All pass.

Run: `pnpm exec vitest run scripts/verify-release.test.ts`
Expected: PASS

- [ ] **Step 5: Commit and tag**

```bash
git add .
git commit -m "chore(release): prepare v1.0.0"
git tag v1.0.0
```

---

## Summary

| Phase | Tasks | Duration | Deliverable |
|-------|-------|----------|-------------|
| 0. Infra | 1 | 2 周 | Monorepo + CI |
| 1. Core | 2-8 | 4 周 | `@drawdb/core` |
| 2. SDK | 9-16 | 6 周 | `@drawdb/vue-sdk` |
| 3. App | 17 | 2 周 | `drawdb-vue-app` |
| 4. Optimize | 18 | 2 周 | 性能 + e2e |
| 5. Release | 19-20 | 1 周 | 文档 + 发布 |

**Total: 17 周（约 4 个月）**

*Next step: review this plan and choose execution approach (subagent-driven or native).*
