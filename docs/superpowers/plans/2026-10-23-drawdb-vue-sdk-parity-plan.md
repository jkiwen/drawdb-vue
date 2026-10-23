# drawDB Vue SDK — 功能对齐 React drawDB 实施计划（Phase 2）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `@drawdb/vue-sdk` 在画布编辑、侧边栏、导入导出、自动布局、质量校验六个方面对齐 React 版 drawDB，并把版本推进到 0.2.0。

**Architecture:** core 新增三个纯函数模块（`validation/` 结构化 issue、`layout/` dagre 布局与关系推断、`serialize/` 图 JSON 导入导出）并补齐命令；SDK 把画布拆成"图元 + 交互层"、把侧边栏补成完整编辑器、加入四个弹窗；core 只做数据变换，SDK 负责渲染、本地化与命令派发。

**Tech Stack:** Vue 3.5、TypeScript strict、Pinia 2、Naive UI 2.38、vue-i18n 11、node:test（`scripts/run-tests.mjs`）、`@dagrejs/dagre` 3.1.1、`html-to-image` 1.11.13、`vue-draggable-plus` 0.6.1。

**Spec:** `docs/superpowers/specs/2026-10-23-drawdb-vue-sdk-parity-design.md`（441 行，本计划逐节对应其 §4–§9）

---

## Global Constraints

以下约束对每个任务都生效（值与 spec 原文一致）：

1. **单文件上限 300 行**（spec §9.1）：`packages/sdk/src/**` 与 `packages/app/src/**` 下任何 `.ts`/`.vue` 文件不得超过 300 行；由 `scripts/verify-constraints.test.ts` 自动检查。
2. **所有编辑走 `CommandManager`**（spec §9.2）：每个新命令必须实现 `execute()` 与 `undo()`，undo 精确还原；命令不得依赖 `structuredClone`（不能克隆 Vue 代理），一律用 `packages/core/src/utils/clone.ts` 的 `deepClone`。
3. **core 不依赖 Vue / Naive UI**（spec §9.3）：`packages/core/src/**` 只允许纯函数与纯数据变换；core 不得 import `vue`、`pinia`、`naive-ui`。
4. **TypeScript strict**，收尾时 `pnpm run typecheck` 必须同时通过 core / sdk / app / example / e2e 五个项目。
5. **i18n 以英文为基准**（spec §9.5）：新增键必须写进 51 个语言文件；缺失的译文回填英文（沿用 `scripts/migrate-i18n.ts` 的既有策略）。
6. **依赖上限**（spec §9.6）：除 `@dagrejs/dagre`、`html-to-image`、`vue-draggable-plus` 外不得新增运行时依赖。
7. **core 返回结构化 issue，SDK 负责本地化**（spec §4.1）：core 的校验结果不得包含已翻译文案，只给稳定 `code` + 英文兜底 `message` + `params`。
8. **测试运行方式**：从 `sdk-workspace` 目录执行 `node --experimental-strip-types scripts/run-tests.mjs <filter>`；`<filter>` 是**前向斜杠归一后**路径的子串（例：`validation`、`Canvas/interactions`）。测试风格 `import { test } from "node:test"; import assert from "node:assert/strict";`。
9. **依赖安装**：`pnpm install --ignore-scripts`（沙箱禁止子进程 spawn，构建脚本必须跳过）。安装后必须 `pnpm rebuild vue-demi`，否则 `vue-demi` 仍指向 Vue 2 的构建。
10. **任务收尾三件事**：测试通过 + `pnpm run typecheck` 通过 + 用 `node scripts/plan-status.mjs --plan docs/superpowers/plans/2026-10-23-drawdb-vue-sdk-parity-plan.md --task N --commit <hash> --report docs/task-N-report.md` 标注本计划里该任务的状态（Task 21 完成该脚本的 `--plan` 选项）。
11. **提交信息格式**：`<type>(<scope>): <祈使句摘要>`，例 `feat(core): add the diagram validation`；每个任务一次功能提交 + 一次账本提交（账本提交只改 `progress.md` 与计划状态）。
12. **账本**：`sdk-workspace/progress.md` 每个任务追加一行 `- Task N: complete (commit \`<hash>\`; …)` 与 `  - Report: \`docs/task-N-report.md\``，并追加该任务的 Rulings 小节。

---

## Review Focus

以下五类是 spec 暗示、但没有任何任务的测试覆盖、最容易在真实使用中咬人的输入。每个都有对应的测试写进拥有该代码的任务里：

1. **空图 / 只有一张表且没有任何关系的图** → 校验必须返回 0 条 issue（不得把"没有主键"报到没有表的图上），自动布局不得抛错、不得改变这张表已有的坐标语义。
   → Task 21 `validation/validate.test.ts`（"returns no issue for an empty diagram"）+ Task 22 `layout/layout.test.ts`（"keeps the coordinates of a single table"）。
2. **字段重名的作用域** → 同一张表内两个同名字段必须报 `field.duplicate_name`；**不同表**的同名字段不得报错。
   → Task 21 `validation/validate.test.ts`（"reports a duplicate field name inside one table" 与 "does not report the same field name in two tables"）。
3. **JSON 往返后的 id** → `exportDiagramJson` → `importDiagramJson` 之后表与字段的 **id 可能被重新生成**，往返测试必须比较内容（表名/字段名/关系端点）而不是 id。
   → Task 23 `serialize/serialize.test.ts`（"round trips a diagram"）。
4. **连线终点落在空白处** → 拖拽连线在空白处释放必须**取消**，不得产生一条端点为空的关系，也不得进历史。
   → Task 25 `Canvas/interactions.test.ts`（"cancels the linking when the pointer is released on the canvas"）。
5. **撤销必须精确还原** → 自动布局、字段拖拽排序、批量建立关系三类操作 undo 之后，坐标 / 字段顺序 / 关系数量必须与操作前完全一致（不是"大致相同"）。
   → Task 24 `commands/commands.test.ts`（每个命令的 execute/undo 对称性）+ Task 22（`AutoArrangeCommand` 的还原）+ Task 26（`MoveFieldCommand` 的还原）。

---

## Task 21: core 图质量校验（validation）

**Status:** complete — commit `eac4bb3` · report: `docs/task-21-report.md`

**Files:**
- Create: `packages/core/src/validation/types.ts`
- Create: `packages/core/src/validation/rules.ts`
- Create: `packages/core/src/validation/validate.ts`
- Create: `packages/core/src/validation/index.ts`
- Test: `packages/core/src/validation/validate.test.ts`
- Modify: `packages/core/src/types/registry.ts`（新增 `defaultKind`）、`scripts/generate-type-registry.mjs`（生成 `defaultKind`）、`packages/core/src/index.ts`（导出 validation）
- Modify: `scripts/plan-status.mjs`（新增 `--plan <path>`）、`scripts/verify-plan.test.ts`（覆盖 `--plan`）

**Interfaces:**
- Consumes: `Diagram` / `Table` / `Field` / `Relationship` / `View` / `CustomType` / `Enum` / `Area` / `Note`（`packages/core/src/models/*`）；`getTypeMetadata(database, type)` 与 `DATABASE_TYPE_METADATA`（`packages/core/src/types/registry.ts`）；`isFunction`（`packages/core/src/export/shared.ts`）。
- Produces（后续任务依赖这些名字，签名不得变）:
  ```ts
  // packages/core/src/validation/types.ts
  export type IssueSeverity = "error" | "warning";
  export type DefaultKind = "numeric" | "boolean" | "date" | "text" | "none";
  export interface DiagramIssue {
    code: string;                 // 稳定标识，如 "table.no_primary_key"
    severity: IssueSeverity;
    message: string;              // 英文兜底文案
    params?: Record<string, string>;
    tableId?: string;
    fieldId?: string;
    relationshipId?: string;
    viewId?: string;
    typeId?: string;
    enumName?: string;
  }
  export interface ValidationOptions {
    database?: DatabaseType;      // 默认取 diagram.database
    severity?: IssueSeverity;     // 只返回不低于该级别
  }
  // packages/core/src/validation/validate.ts
  export function validateDiagram(diagram: Diagram, options?: ValidationOptions): DiagramIssue[];
  export function isDefaultValid(kind: DefaultKind | undefined, value: string | number | boolean): boolean;
  // packages/core/src/types/registry.ts（新增字段）
  export interface TypeMetadata { /* 既有字段 */ defaultKind?: DefaultKind; }
  ```

- [x] **Step 1: 给 `plan-status.mjs` 加 `--plan` 选项**

  `scripts/plan-status.mjs` 当前的 `PLAN` 常量硬编码为 `resolve("docs/plan.md")`。改为：CLI 接受 `--plan <path>`（相对 `sdk-workspace`），未给出时保持 `docs/plan.md`；`readState(planPath = PLAN)` 保持现有签名不变。

  在 `scripts/verify-plan.test.ts` 增加一条用例："accepts an alternative plan path" —— 断言 `readState(resolve("docs/superpowers/plans/2026-10-23-drawdb-vue-sdk-parity-plan.md"))` 能读到该文件（此文件在 Step 5 之后才存在，先用 `assert.doesNotThrow` 占位，Step 5 后改为断言任务数 ≥ 12）。

  Run: `node --experimental-strip-types scripts/run-tests.mjs verify-plan`
  Expected: PASS（现有 6 条用例仍然通过）

- [x] **Step 2: 写失败的测试 `packages/core/src/validation/validate.test.ts`**

  文件必须包含以下用例（断言 code 与 severity，消息用 `issue.code` 精确匹配）：

  ```ts
  test("returns no issue for an empty diagram", () => {
    assert.deepEqual(validateDiagram(createEmptyDiagram()), []);
  });
  test("reports a table without a name", () => {
    const diagram = createEmptyDiagram();
    diagram.tables.push({ id: "t1", name: "", x: 0, y: 0, fields: [] });
    assert.ok(validateDiagram(diagram).some((i) => i.code === "table.no_name"));
  });
  test("reports a duplicate table name", () => { /* 两张同名表 → "table.duplicate_name" */ });
  test("reports a table without a primary key", () => { /* 有表有字段但无主键 → "table.no_primary_key" */ });
  test("reports a field without a name", () => { /* → "field.no_name" */ });
  test("reports a field without a type", () => { /* → "field.no_type" */ });
  test("reports an enum field without values", () => { /* type 为 ENUM 且 values 为空 → "field.no_values" */ });
  test("reports a duplicate field name inside one table", () => { /* 同表两个 name 为 "id" → "field.duplicate_name" */ });
  test("does not report the same field name in two tables", () => { /* 两张表各有 name 为 "id" 的字段 → 无 "field.duplicate_name" */ });
  test("reports a default that does not match the type", () => { /* INTEGER 字段 default "abc" → "field.default_mismatch" */ });
  test("accepts a keyword default for a date field", () => { /* TIMESTAMP 字段 default "CURRENT_TIMESTAMP" → 无 issue */ });
  test("reports a relationship whose table is missing", () => { /* → "relationship.missing_table" */ });
  test("reports a relationship whose field is missing", () => { /* → "relationship.missing_field" */ });
  test("reports a duplicate relationship name", () => { /* → "relationship.duplicate_name" */ });
  test("reports a circular relationship once", () => { /* a→b→a → 恰好 1 条 "relationship.circular" */ });
  test("reports a view without a base table", () => { /* → "view.no_base_table" */ });
  test("reports a view whose name clashes with a table", () => { /* → "view.name_clashes_table" */ });
  test("reports a join without a table", () => { /* → "join.no_table" */ });
  test("reports an index without fields", () => { /* → "index.no_fields" */ });
  test("reports a unique constraint without fields", () => { /* → "unique_constraint.no_fields" */ });
  test("reports a custom type without fields", () => { /* → "type.no_fields" */ });
  test("reports an enum without values", () => { /* → "enum.no_values" */ });
  test("filters by severity", () => {
    /* diagram 同时有 error 与 warning；options.severity = "error" 时结果里没有 severity === "warning" */
  });
  test("never throws for a malformed diagram", () => {
    /* tables 不是数组 → 返回至少 1 条 severity === "error" 的 issue，不抛异常 */
  });
  ```

  另需按 spec §4.1 的规则表把剩余 code 补齐用例（`table.duplicate_name` 之外还有 `index.no_name`、`index.duplicate_name`、`unique_constraint.duplicate_name`、`type.no_name`、`type.duplicate_name`、`type_field.no_name`、`type_field.no_type`、`type_field.no_values`、`type_field.duplicate_name`、`enum.no_name`、`enum.duplicate_name`、`view.no_name`、`view.duplicate_name`、`join.no_condition`、`join.out_of_order`、`view_column.no_field`、`view_column.duplicate_name`、`field.not_null_is_null`、`field.inherited_duplicate`、`relationship.circular`），**文件内用例总数 ≥ 30**。

- [x] **Step 3: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs validation`
  Expected: FAIL —— `ERR_MODULE_NOT_FOUND: Cannot find module '.../packages/core/src/validation/index.ts'`

- [x] **Step 4: 实现校验模块**

  - `types.ts`：写入上面 Interfaces 块里的 `IssueSeverity`、`DefaultKind`、`DiagramIssue`、`ValidationOptions`（`DatabaseType` 从 `../models/diagram.ts` import type）。
  - `rules.ts`：每个规则一个导出函数，签名统一为 `(diagram: Diagram, database: DatabaseType) => DiagramIssue[]`，函数名用规则名（`checkTableNames`、`checkFieldNames`、`checkDefaultValues`、`checkRelationships`、`checkViews`、`checkTypes`、`checkEnums`、`checkIndices` …）。规则之间不互相调用，统一由 `validate.ts` 汇总。
  - `validate.ts`：`validateDiagram(diagram, options)` 依次调用所有规则函数，合并结果，按 `options.severity` 过滤，返回数组。**永不抛错**：把整个规则执行包在 `try/catch` 里，捕获后返回一条 `code: "validation.internal_error"`、`severity: "error"` 的 issue。
  - `isDefaultValid(kind, value)`：按 spec §4.1 的表格实现；`value` 为空字符串、`null`/`undefined`，或 `isFunction(String(value))` 为真时一律返回 `true`。
  - 消息用英文兜底句式，例：`Table "${name}" has no primary key.`、`Field "${field}" of table "${table}" has a default that is not valid for type "${type}".`；同时填 `params`（如 `{ table: name, field: field, type: type }`）供 SDK 本地化。

- [x] **Step 5: 给类型注册表加 `defaultKind`**

  `scripts/generate-type-registry.mjs` 在生成 `DATABASE_TYPE_METADATA` 时，为每个类型追加 `defaultKind`：类型名匹配 `^(INT|BIGINT|SMALLINT|TINYINT|MEDIUMINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|MONEY)$` → `numeric`；`^(BOOL|BOOLEAN)$` → `boolean`；`^(DATE|DATETIME|TIMESTAMP|TIMESTAMPTZ|SMALLDATETIME|DATETIME2|DATETIMEOFFSET)$` → `date`；该类型 `noDefault === true` → `none`；其余 → `text`。`TypeMetadata` 接口加 `defaultKind?: DefaultKind`（`DefaultKind` 从 `../validation/types.ts` import type —— 若产生循环依赖，则把 `DefaultKind` 定义在 `packages/core/src/types/registry.ts` 并由 validation 重新导出）。

  Run: `node scripts/generate-type-registry.mjs && node --experimental-strip-types scripts/run-tests.mjs validation`
  Expected: 全部 validation 用例 PASS

- [x] **Step 6: 导出并整体验证**

  `packages/core/src/index.ts` 增加 `export * from "./validation/index.ts";`（注意与 `./types/registry.ts` 的显式导出列表不冲突——`DefaultKind` 只从 validation 导出一次）。

  Run: `node --experimental-strip-types scripts/run-tests.mjs`（全量）与 `pnpm run typecheck`
  Expected: 全量用例数 ≥ 334 + 30 = 364 且 0 fail；typecheck 无错误

- [x] **Step 7: 提交**

  ```bash
  git add packages/core/src/validation packages/core/src/types/registry.ts packages/core/src/index.ts scripts/generate-type-registry.mjs scripts/plan-status.mjs scripts/verify-plan.test.ts
  git commit -m "feat(core): add the diagram validation"
  ```

---

## Task 22: core 自动布局与关系推断（layout）

**Files:**
- Create: `packages/core/src/layout/auto-arrange.ts`
- Create: `packages/core/src/layout/auto-relationships.ts`
- Create: `packages/core/src/layout/index.ts`
- Test: `packages/core/src/layout/layout.test.ts`
- Modify: `packages/core/package.json`（加 `@dagrejs/dagre`）、`packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Table` / `Relationship` / `Field`（models）、`createId`（`packages/core/src/utils/id.ts`）。
- Produces:
  ```ts
  // packages/core/src/layout/auto-arrange.ts
  export interface AutoArrangeOptions {
    nodeSep?: number;        // 默认 60
    rankSep?: number;        // 默认 110
    isolatedGap?: number;    // 默认 60
    direction?: "TB" | "LR"; // 默认 "TB"
  }
  export function autoArrange(
    tables: Table[],
    relationships: Relationship[],
    options?: AutoArrangeOptions,
  ): { x: number; y: number }[];   // 与入参等长、同序；locked 的表返回其原坐标
  // packages/core/src/layout/auto-relationships.ts
  export function inferRelationships(
    tables: Table[],
    existing: Relationship[],
  ): Relationship[];                // 候选；id = `infer_<startTable>_<startField>_<endTable>`，name = `fk_<startTable>_<startField>_<endTable>`
  ```

- [ ] **Step 1: 安装 dagre**

  Run: `pnpm --filter @drawdb/core add @dagrejs/dagre@3.1.1`
  Expected: 退出码 0（若报 `ERR_PNPM_IGNORED_BUILDS` 属正常，dagre 无构建步骤）

- [ ] **Step 2: 写失败的测试 `packages/core/src/layout/layout.test.ts`**

  必须包含：
  ```ts
  test("returns one coordinate per table, in the input order");
  test("moves the unlocked tables and leaves the locked ones", () => {
    /* 两张表，其中一张 locked: true → 该表返回原 x/y */
  });
  test("does not overlap two tables", () => {
    /* 两个表的包围盒不相交（宽 220，高按字段数算） */
  });
  test("places an isolated table apart from the others", () => {
    /* 一张有关系的表 + 一张孤立表 → 孤立表与另一张表的距离 ≥ isolatedGap */
  });
  test("honours the direction option", () => {
    /* direction "LR" 与 "TB" 产生不同的坐标 */
  });
  test("keeps the coordinates of a single table", () => {
    /* 只有一张表 → 返回该表的原坐标（Review Focus #1） */
  });
  test("returns the original coordinates for an empty list");
  test("does not modify the input tables");
  test("infers a relationship from a user_id field", () => {
    /* users 表主键 id；posts 表有 user_id → 候选 1 条，start=posts.user_id，end=users.id */
  });
  test("infers a relationship from a users_id field");
  test("skips a field pair that already has a relationship", () => {
    /* existing 里已有 posts.user_id → users.id → 候选 0 条 */
  });
  test("skips a self reference", () => {
    /* categories 表有 parent_id → 不产生 candidates */
  });
  test("marks the cardinality one_to_one when the child field is unique", () => {
    /* posts.user_id 且 unique: true → cardinality "one_to_one"，否则 "many_to_one" */
  });
  test("does not modify the input tables or relationships");
  ```

  断言基数用 `assert.equal(candidate.cardinality, "many_to_one")`（core 内部用小写下划线形式，与 `models/constants.ts` 的 `Cardinality` 一致）。

- [ ] **Step 3: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs layout`
  Expected: FAIL —— `ERR_MODULE_NOT_FOUND`（`packages/core/src/layout/index.ts`）

- [ ] **Step 4: 实现 `auto-arrange.ts`**

  端口自 React `drawdb-app/src/utils/autoArrange.js`：用 `@dagrejs/dagre` 的 `graphlib.Graph` 建图，每个未 locked 的表是一个节点（宽 = `table.width ?? 220`，高 = 50 + 36 × 字段数），每条关系连一条边（`startTableId` → `endTableId`）；`graphlib.layout(graph, { nodeSep, rankSep, edgesep, rankdir, marginx, marginy })`；把 dagre 的坐标转回画布坐标（`x - width/2`，`y - height/2`）。**孤立的表**（无任何边）单独用 `isolatedGap` 排成一列。**locked 的表**不建节点，返回其原坐标。dagre 抛错时**捕获并返回全部原坐标**（spec §7：自动布局失败不改图）。

- [ ] **Step 5: 实现 `auto-relationships.ts`**

  端口自 React `drawdb-app/src/utils/autoRelationships.js`：候选字段名后缀为 `users_id` / `user_id` / `usersid` / `userid`（当目标表主键名不是 `id` 时也接受裸主键名，即字段名恰好等于目标表主键名）；跳过起止表相同的自引用；跳过 `existing` 中已有的**字段级**与**字段对级**关系；基数按子字段是否 `unique` 决定（unique → `one_to_one`，否则 `many_to_one`）；`updateConstraint`/`deleteConstraint` 置 `"No action"`。

- [ ] **Step 6: 导出并整体验证**

  `packages/core/src/index.ts` 增加 `export * from "./layout/index.ts";`

  Run: `node --experimental-strip-types scripts/run-tests.mjs`（全量）与 `pnpm run typecheck`
  Expected: 0 fail；typecheck 无错误

- [ ] **Step 7: 提交**

  ```bash
  git add packages/core/src/layout packages/core/package.json packages/core/src/index.ts pnpm-lock.yaml
  git commit -m "feat(core): add the automatic layout and the relationship inference"
  ```

---

## Task 23: core 图 JSON 导入导出（serialize）

**Files:**
- Create: `packages/core/src/serialize/types.ts`
- Create: `packages/core/src/serialize/export.ts`
- Create: `packages/core/src/serialize/import.ts`
- Create: `packages/core/src/serialize/index.ts`
- Test: `packages/core/src/serialize/serialize.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Diagram` 与各模型类型（models）、`DatabaseType`（`models/diagram.ts`）、`createEmptyDiagram`。
- Produces:
  ```ts
  // packages/core/src/serialize/types.ts
  export interface DiagramJson {
    id?: string; title?: string; database: DatabaseType; sqlHeader?: string;
    tables: Table[]; relationships: Relationship[]; notes: Note[];
    subjectAreas: Area[]; types: CustomType[]; enums: Enum[]; views: View[];
    metadata?: Metadata;
  }
  export class ImportError extends Error {
    readonly code: string;
    readonly diagnostics: { message: string; line?: number; column?: number }[];
  }
  // packages/core/src/serialize/export.ts
  export function exportDiagramJson(diagram: Diagram, options?: { pretty?: boolean }): string;
  // packages/core/src/serialize/import.ts
  export function importDiagramJson(
    source: string | unknown,
    options?: { database?: DatabaseType; allowDatabaseOverride?: boolean },
  ): Diagram;
  ```
  错误码：`json.parse_failed`、`json.invalid_shape`、`relationship.missing_table`、`relationship.missing_field`、`database.mismatch`。

- [ ] **Step 1: 写失败的测试 `packages/core/src/serialize/serialize.test.ts`**

  必须包含：
  ```ts
  test("round trips a diagram", () => {
    /* 导出再导入 → 比较表名/字段名/关系端点的内容，不比较 id（Review Focus #3） */
  });
  test("exports compact json by default");
  test("exports pretty json on request", () => { /* 含 "\n" */ });
  test("imports the legacy ddb field names", () => {
    /* { references: [...], areas: [...] } → relationships / subjectAreas */
  });
  test("throws an ImportError for invalid json", () => {
    /* assert.throws(() => importDiagramJson("{"), (e) => e.code === "json.parse_failed") */
  });
  test("throws an ImportError when the tables are missing", () => {
    /* → "json.invalid_shape" */
  });
  test("throws an ImportError when a relationship table is missing", () => {
    /* → "relationship.missing_table" */
  });
  test("throws an ImportError when a relationship field is missing", () => {
    /* → "relationship.missing_field" */
  });
  test("throws an ImportError when the database does not match", () => {
    /* options.database = "mysql"，文件 database = "postgres" → "database.mismatch" */
  });
  test("accepts a mismatching database when the override is allowed", () => {
    /* allowDatabaseOverride: true → 不抛错，database 取文件里的值 */
  });
  test("defaults the database to generic", () => { /* 文件缺 database → 导入结果 database === "generic" */ });
  test("defaults the missing collections to empty arrays", () => {
    /* 文件只有 tables → relationships/notes/subjectAreas/types/enums/views 均为 [] */
  });
  test("does not modify the imported source object");
  test("keeps the sql header and the title");
  test("reports the diagnostics of a parse failure", () => {
    /* 解析失败时 diagnostics.length ≥ 1 */
  });
  ```

- [ ] **Step 2: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs serialize`
  Expected: FAIL —— `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: 实现 `export.ts`**

  `exportDiagramJson(diagram, options)`：构造 `DiagramJson`（`subjectAreas` 取 `diagram.areas ?? diagram.subjectAreas`），`JSON.stringify(value, null, options?.pretty ? 2 : undefined)`。

- [ ] **Step 4: 实现 `import.ts`**

  `importDiagramJson(source, options)`：
  1. `typeof source === "string"` → `JSON.parse`，失败抛 `ImportError("json.parse_failed")`，`diagnostics` 填 `{ message: err.message }`。
  2. 形状校验：`tables` 必须是数组，否则 `ImportError("json.invalid_shape")`。
  3. 旧版字段名兼容：`references` → `relationships`，`areas` → `subjectAreas`。
  4. 缺省的集合补空数组；缺 `database` 视为 `generic`。
  5. 关系完整性：`startTableId`/`endTableId` 必须能在 `tables` 中找到，否则 `ImportError("relationship.missing_table")`；`startFieldId`/`endFieldId` 必须能在对应表里找到，否则 `ImportError("relationship.missing_field")`。
  6. 数据库不一致：`options.database` 与文件里的不同且 `allowDatabaseOverride !== true` → `ImportError("database.mismatch")`。
  7. 返回 `Diagram`（`createEmptyDiagram` 的字段齐全 + 导入内容）。

- [ ] **Step 5: 导出并整体验证**

  `packages/core/src/index.ts` 增加 `export * from "./serialize/index.ts";`

  Run: `node --experimental-strip-types scripts/run-tests.mjs`（全量）与 `pnpm run typecheck`
  Expected: 0 fail；typecheck 无错误

- [ ] **Step 6: 提交**

  ```bash
  git add packages/core/src/serialize packages/core/src/index.ts
  git commit -m "feat(core): add the diagram json import and export"
  ```

---

## Task 24: core 命令补全

**Files:**
- Create: `packages/core/src/commands/field-commands.ts`
- Create: `packages/core/src/commands/relationship-commands.ts`
- Create: `packages/core/src/commands/table-commands.ts`
- Create: `packages/core/src/commands/collection-commands.ts`
- Create: `packages/core/src/commands/auto-arrange-command.ts`
- Create: `packages/core/src/commands/commands.test.ts`
- Delete: `packages/core/src/commands/{add-table,update-table,remove-table,add-relationship,update-field,add-field,remove-field}.ts`（迁入新文件）
- Modify: `packages/core/src/commands/index.ts`、`packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Command`（`packages/core/src/commands/command.ts`）、`deepClone`（`packages/core/src/utils/clone.ts`）、各模型类型。
- Produces（`packages/core/src/index.ts` 继续导出这些名字，SDK store 的 import 不变）：
  ```ts
  // field-commands.ts
  export class AddFieldCommand implements Command { constructor(diagram: Diagram, tableId: TableId, field: Field, index?: number); }
  export class UpdateFieldCommand implements Command { constructor(diagram: Diagram, tableId: TableId, fieldId: FieldId, updates: Partial<Omit<Field, "id">>); }
  export class RemoveFieldCommand implements Command { constructor(diagram: Diagram, tableId: TableId, fieldId: FieldId); }
  export class MoveFieldCommand implements Command { constructor(diagram: Diagram, tableId: TableId, fromIndex: number, toIndex: number); }
  // relationship-commands.ts
  export class AddRelationshipCommand implements Command { constructor(diagram: Diagram, relationship: Relationship, index?: number); }
  export class UpdateRelationshipCommand implements Command { constructor(diagram: Diagram, relationshipId: RelationshipId, updates: Partial<Omit<Relationship, "id">>); }
  export class RemoveRelationshipCommand implements Command { constructor(diagram: Diagram, relationshipId: RelationshipId); }
  export class AddRelationshipsCommand implements Command { constructor(diagram: Diagram, relationships: Relationship[]); }
  // table-commands.ts
  export class AddTableCommand implements Command { constructor(diagram: Diagram, table: Table | { table: Table; index?: number }); }
  export class UpdateTableCommand implements Command { constructor(diagram: Diagram, tableId: TableId, updates: Partial<Omit<Table, "id">>); }
  export class RemoveTableCommand implements Command { constructor(diagram: Diagram, tableId: TableId); }
  export class ResizeTableCommand implements Command { constructor(diagram: Diagram, tableId: TableId, width: number); }
  export class ToggleTableLockCommand implements Command { constructor(diagram: Diagram, tableId: TableId); }
  // collection-commands.ts
  export class AddEntityCommand implements Command { constructor(diagram: Diagram, collection: DiagramEntityCollection, entity: { id?: string | number; name?: string }); }
  export class UpdateEntityCommand implements Command { constructor(diagram: Diagram, collection: DiagramEntityCollection, target: string | number | undefined, updates: Record<string, unknown>); }
  export class RemoveEntityCommand implements Command { constructor(diagram: Diagram, collection: DiagramEntityCollection, target: string | number | undefined); }
  // auto-arrange-command.ts
  export class AutoArrangeCommand implements Command { constructor(diagram: Diagram, positions: { x: number; y: number }[], previous: { x: number; y: number }[]); }
  ```
  **不新增** `SetDiagramCommand`：图级属性（标题/数据库/SQL 头）由既有的 `UpdateDiagramCommand(diagram, updates: DiagramProperties)` 承担（spec §4.4 的 `SetDiagramCommand` 由此取代，实现时在 Task 32 的报告里记录该差异）。

- [ ] **Step 1: 写失败的测试 `packages/core/src/commands/commands.test.ts`**

  每条命令写两条对称用例（execute 与 undo）：
  ```ts
  test("MoveFieldCommand moves a field and undo restores the order");
  test("MoveFieldCommand does nothing when the indexes are equal");
  test("AddRelationshipsCommand adds every relationship and undo removes them");
  test("ResizeTableCommand changes the width and undo restores it");
  test("ToggleTableLockCommand flips the flag and undo restores it");
  test("UpdateEntityCommand updates a view and undo restores it");
  test("AutoArrangeCommand moves the tables and undo restores the previous coordinates");
  test("UpdateFieldCommand keeps the other fields untouched");
  test("RemoveFieldCommand removes the field and undo restores it");
  test("AddFieldCommand inserts at the given index and undo removes it");
  ```
  断言方式：直接 `new XCommand(diagram, …).execute()`，再检查 `diagram` 的内容；`undo()` 后检查与操作前 `deepClone` 的快照相等（用 `assert.deepEqual`）。

- [ ] **Step 2: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs commands`
  Expected: FAIL —— `ERR_MODULE_NOT_FOUND`（新命令文件不存在）

- [ ] **Step 3: 实现四个命令文件**

  - 把既有的 `add-table.ts` / `update-table.ts` / `remove-table.ts` / `add-relationship.ts` / `update-field.ts` / `add-field.ts` / `remove-field.ts` 的实现**原样迁入**新的四个文件（类名与行为不变），删除旧文件。
  - `UpdateTableCommand` 的 `structuredClone` **必须换成 `deepClone`**（`structuredClone` 不能克隆 Vue 代理，见 spec §4.4）。
  - `MoveFieldCommand`：execute 把 `fields[fromIndex]` 移到 `toIndex`（`splice` 后 `splice` 插入），undo 移回 `fromIndex`。
  - `AddRelationshipsCommand`：execute 把整批 `push` 进 `diagram.relationships`，undo 移除这批（按 id 过滤）。
  - `ResizeTableCommand`：execute 设 `table.width = width`，undo 还原旧值（表的高度由字段数推导，本命令不改高度）。
  - `ToggleTableLockCommand`：execute 翻转 `table.locked`，undo 翻回。
  - `UpdateEntityCommand`：在 `diagram[collection]` 里按 `id`（或 `name`，枚举按名）找到实体并合并 `updates`，undo 还原旧值快照。
  - `AutoArrangeCommand`：execute 把 `positions[i]` 写到第 i 张表，undo 把 `previous[i]` 写回。

- [ ] **Step 4: 更新导出**

  `packages/core/src/commands/index.ts` 改为导出四个新文件与 `auto-arrange-command.ts`；`packages/core/src/index.ts` 的 `export * from "./commands/index.ts";` 保持不变（名字集合不变，外部 import 不受影响）。

- [ ] **Step 5: 整体验证**

  Run: `node --experimental-strip-types scripts/run-tests.mjs`（全量）与 `pnpm run typecheck`
  Expected: 0 fail（既有 364 条 + 新增 ≥ 10 条）；typecheck 无错误

- [ ] **Step 6: 提交**

  ```bash
  git add packages/core/src/commands packages/core/src/index.ts
  git commit -m "feat(core): complete the command set"
  ```

---

## Task 25: sdk 画布拆分与交互层

**Files:**
- Create: `packages/sdk/src/components/Canvas/TableHeader.vue`
- Create: `packages/sdk/src/components/Canvas/TableField.vue`
- Create: `packages/sdk/src/components/Canvas/FieldHandle.vue`
- Create: `packages/sdk/src/components/Canvas/ResizeHandles.vue`
- Create: `packages/sdk/src/components/Canvas/ContextMenu.vue`
- Create: `packages/sdk/src/components/Canvas/Minimap.vue`
- Create: `packages/sdk/src/components/Canvas/interactions/use-linking.ts`
- Create: `packages/sdk/src/components/Canvas/interactions/use-selection-box.ts`
- Create: `packages/sdk/src/components/Canvas/interactions/use-resize.ts`
- Create: `packages/sdk/src/components/Canvas/interactions/use-context-menu.ts`
- Create: `packages/sdk/src/components/Canvas/interactions/interactions.test.ts`
- Create: `packages/sdk/src/composables/use-canvas-interactions.ts`
- Create: `packages/sdk/src/components/EditorLayout.vue`
- Create: `packages/sdk/src/components/EditorDialogs.vue`
- Create: `packages/sdk/src/components/use-editor-commands.ts`
- Create: `packages/sdk/src/components/use-editor-plugins.ts`
- Create: `scripts/verify-constraints.test.ts`
- Modify: `packages/sdk/src/components/Canvas/Canvas.vue`（重写，≤ 200 行）、`packages/sdk/src/components/Canvas/Table.vue`（重写，≤ 150 行）、`packages/sdk/src/components/Canvas/index.ts`、`packages/sdk/src/components/DrawDBEditor.vue`（拆分后 ≤ 250 行）、`packages/sdk/src/stores/ui.ts`、`packages/sdk/src/composables/index.ts`、`packages/sdk/src/components/index.ts`

**Interfaces:**
- Consumes: `useDiagramStore` / `useUIStore` / `useHistoryStore`（`packages/sdk/src/stores/*`）、`useViewport` / `useDrag` / `useCanvasEvents`（`packages/sdk/src/composables/*`）、core 的 `AddRelationshipCommand` / `MoveFieldCommand` / `ResizeTableCommand` / `ToggleTableLockCommand` / `Table` / `Relationship`。
- Produces:
  ```ts
  // packages/sdk/src/components/Canvas/interactions/use-linking.ts
  export interface LinkingState { sourceTableId: string | number; sourceFieldId: string | number; pointer: { x: number; y: number }; }
  export interface LinkingApi {
    linking: Ref<LinkingState | null>;
    start(tableId: string | number, fieldId: string | number, point: { x: number; y: number }): void;
    move(point: { x: number; y: number }): void;
    finish(target?: { tableId: string | number; fieldId?: string | number }): Relationship | null;
    cancel(): void;
  }
  export function useLinking(): LinkingApi;
  // packages/sdk/src/components/Canvas/interactions/use-selection-box.ts
  export interface SelectionBox { active: boolean; origin: { x: number; y: number }; current: { x: number; y: number }; }
  export function useSelectionBox(): { box: Ref<SelectionBox>; begin(point: {x:number;y:number}): void; move(point: {x:number;y:number}): void; end(): void; idsIn(rect: {x:number;y:number;width:number;height:number}, tables: Table[]): (string|number)[] };
  // packages/sdk/src/components/Canvas/interactions/use-resize.ts
  export function useResize(): { resizing: Ref<{ tableId: string|number; width: number; height: number } | null>; begin(tableId: string|number, width: number, height: number): void; move(dw: number, dh: number): void; end(): void; };
  // packages/sdk/src/components/Canvas/interactions/use-context-menu.ts
  export function useContextMenu(): { menu: Ref<{ x: number; y: number; target: { kind: "table"|"field"|"canvas"; tableId?: string|number; fieldId?: string|number } } | null>; open(x: number, y: number, target: …): void; close(): void; };
  // packages/sdk/src/composables/use-canvas-interactions.ts
  export function useCanvasInteractions(): { linking: LinkingApi; selectionBox: …; resize: …; contextMenu: … };
  ```
  `packages/sdk/src/stores/ui.ts` 新增状态：`linking`（`LinkingState | null`）、`resizing`、`selectionBox`、`contextMenu`（位置与目标）、`showMinimap`（布尔，默认 false）。

- [ ] **Step 1: 写约束检查脚本 `scripts/verify-constraints.test.ts`**

  脚本扫描 `packages/sdk/src` 与 `packages/app/src` 下所有 `.ts`/`.vue` 文件，行数 > 300 即失败，并输出违规文件列表。断言里至少包含三个用例："no sdk file is longer than 300 lines"、"no app file is longer than 300 lines"、"the check detects a file that is too long"（用临时目录构造一个 301 行的文件，测完删除）。

- [ ] **Step 2: 写失败的交互测试 `packages/sdk/src/components/Canvas/interactions/interactions.test.ts`**

  必须包含（≥ 18 条）：
  ```ts
  test("useLinking starts a link from a field handle");
  test("useLinking creates a relationship when the pointer is released on a field", () => {
    /* finish({ tableId: "t2", fieldId: "f2" }) → 返回一条 Relationship，start=源字段，end=目标字段 */
  });
  test("useLinking creates a relationship to the primary key of a table", () => {
    /* finish({ tableId: "t2" })（无 fieldId）→ endFieldId 取目标表第一个主键 */
  });
  test("useLinking cancels the linking when the pointer is released on the canvas", () => {
    /* finish() 无参数 → 返回 null，且不产生任何关系（Review Focus #4） */
  });
  test("useLinking marks the cardinality one_to_one for a unique source field");
  test("useLinking names the relationship fk_<table>_<field>_<table>");
  test("useLinking cancel clears the state");
  test("useSelectionBox collects the tables inside the rectangle");
  test("useSelectionBox returns no id for an empty rectangle");
  test("useResize keeps the minimum size", () => { /* 最小 120×60 */ });
  test("useResize reports the new width and height");
  test("useContextMenu opens at a point with a target");
  test("useContextMenu closes the menu");
  test("the canvas renders a field handle for every field", () => { /* 挂载 Canvas 组件断言 [data-testid^="field-handle-"] 数量 === 字段总数 */ });
  test("the canvas renders a resize handle for every table");
  test("dragging a field handle links the two tables", () => { /* 模拟 pointerdown/pointermove/pointerup → diagramStore.relationships.length === 1 */ });
  test("releasing the link on the canvas adds no relationship", () => { /* 同 Review Focus #4 */ });
  test("the minimap renders the tables", () => { /* [data-testid="minimap"] 内有 [data-testid^="minimap-table-"] */ });
  ```

  组件测试沿用既有模式：本地 `let pinia: Pinia`，`mountComponent(component, props)` 辅助函数用 `global: { plugins: [pinia] }` 挂载（**不要**再调用 `scripts/dom.mjs` 的 `installDom()`，DOM 由 `scripts/run-tests.mjs` 统一安装）。

- [ ] **Step 3: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs interactions`
  Expected: FAIL —— 模块不存在

- [ ] **Step 4: 实现四个交互 composable**

  - `use-linking.ts`：状态机按 spec §5.1 的五步实现（`pointerdown` 在字段手柄 → `start`；`pointermove` → `move`；`pointerup` → `finish(target)`；`Escape`/`pointercancel` → `cancel`）。`finish` 返回的 `Relationship` 由调用方（Canvas）通过 `AddRelationshipCommand` 落库；`finish` 内部**不**修改图。
  - `use-selection-box.ts`：`begin/move/end` 维护矩形；`idsIn(rect, tables)` 返回矩形内的表 id（矩形与表包围盒相交即算）。
  - `use-resize.ts`：`begin/move/end`，宽度最小 120、高度最小 60。
  - `use-context-menu.ts`：`open(x, y, target)` / `close()`。

- [ ] **Step 5: 实现 `use-canvas-interactions.ts` 并扩展 UI store**

  `use-canvas-interactions.ts` 聚合四个 composable，并把 `linking` / `resizing` / `selectionBox` / `contextMenu` 同步到 UI store（store 是唯一真相源，composable 只是行为层）。

- [ ] **Step 6: 拆分画布组件**

  - `TableHeader.vue`：表名 + 注释 + 颜色条，props `{ table: Table; selected?: boolean }`。
  - `TableField.vue`：字段行（名称、类型、主键/非空标记），props `{ table: Table; field: Field; selected?: boolean }`。
  - `FieldHandle.vue`：字段行右缘的连线锚点，`data-testid="field-handle-<tableId>-<fieldId>"`，`pointerdown` 触发 `useLinking().start`。
  - `ResizeHandles.vue`：右下角 12×12 手柄，`data-testid="resize-handle-<tableId>"`。
  - `ContextMenu.vue`：Naive UI `NDropdown`，三种目标（表 / 字段 / 空白），命令复用 store 动作。
  - `Minimap.vue`：`data-testid="minimap"`，内部按比例绘制每张表的小矩形 `data-testid="minimap-table-<id>"`。
  - `Table.vue` 重写为容器（≤ 150 行），组合 `TableHeader` + `TableField` 列表 + `FieldHandle` + `ResizeHandles`。
  - `Canvas.vue` 重写为渲染层 + 事件委派（≤ 200 行）：保留既有 `data-testid="canvas"` 与 `data-testid="canvas-content"`，保留虚拟化（`useVirtualization`），加入连线预览线、框选矩形、右键菜单、minimap 的挂载点。

- [ ] **Step 7: 拆分 `DrawDBEditor.vue`**

  - `EditorLayout.vue`：Naive UI Provider + Header + SidePanel + Canvas 的布局。
  - `EditorDialogs.vue`：弹窗宿主（Task 28 填充内容，本任务先留空壳组件）。
  - `use-editor-commands.ts`：菜单 key → store 动作的映射（从现有 `onMenu` 抽出）。
  - `use-editor-plugins.ts`：插件装配（从现有 `activatePlugins` 抽出）。
  - `DrawDBEditor.vue` 只保留 props/emits 与装配，≤ 250 行；**对外行为不变**（既有 `DrawDBEditor.test.ts` 的 16 条用例必须继续通过）。

- [ ] **Step 8: 运行约束检查与全量测试**

  Run: `node --experimental-strip-types scripts/run-tests.mjs`（全量）、`node --experimental-strip-types scripts/verify-constraints.test.ts`、`pnpm run typecheck`
  Expected: 0 fail；约束检查通过（无 > 300 行的文件）；typecheck 无错误

- [ ] **Step 9: 提交**

  ```bash
  git add packages/sdk/src scripts/verify-constraints.test.ts
  git commit -m "feat(sdk): split the canvas and add the interaction layer"
  ```

---

## Task 26: sdk 表格内编辑与字段排序

**Files:**
- Create: `packages/sdk/src/composables/use-sortable.ts`
- Create: `packages/sdk/src/composables/use-sortable.test.ts`
- Create: `packages/sdk/src/components/Canvas/table-editing.test.ts`
- Modify: `packages/sdk/src/components/Canvas/Table.vue`、`TableField.vue`、`FieldHandle.vue`、`ResizeHandles.vue`
- Modify: `packages/sdk/src/stores/diagram.ts`（新增 `moveField` / `resizeTable` / `toggleTableLock` / `updateSqlHeader`）
- Modify: `packages/sdk/package.json`（加 `vue-draggable-plus`）

**Interfaces:**
- Consumes: core 的 `MoveFieldCommand` / `ResizeTableCommand` / `ToggleTableLockCommand`（Task 24）、`useDiagramStore`。
- Produces:
  ```ts
  // packages/sdk/src/composables/use-sortable.ts
  export interface SortableOptions { handle?: string; animation?: number; ghostClass?: string; }
  export function useSortable(options?: SortableOptions): {
    sortableOptions: ComputedRef<Record<string, unknown>>;
    onSort(tableId: TableId, fromIndex: number, toIndex: number): void;
  };
  // packages/sdk/src/stores/diagram.ts 新增
  function moveField(tableId: TableId, fromIndex: number, toIndex: number): void;
  function resizeTable(tableId: TableId, width: number): void;
  function toggleTableLock(tableId: TableId): void;
  function updateSqlHeader(sqlHeader: string): void;
  ```

- [ ] **Step 1: 安装 `vue-draggable-plus`**

  Run: `pnpm --filter @drawdb/vue-sdk add vue-draggable-plus@0.6.1`
  Expected: 退出码 0

- [ ] **Step 2: 写失败的测试**

  `packages/sdk/src/composables/use-sortable.test.ts`：
  ```ts
  test("useSortable returns the options of vue-draggable-plus");
  test("onSort records a MoveFieldCommand in the history");
  test("onSort does nothing when the index does not change");
  test("undo restores the previous field order", () => { /* Review Focus #5 */ });
  ```

  `packages/sdk/src/components/Canvas/table-editing.test.ts`（≥ 14 条）：
  ```ts
  test("renaming a table on the canvas updates the diagram");
  test("renaming a field on the canvas updates the diagram");
  test("the name of a table is edited in place", () => { /* 双击表头出现 input */ });
  test("the type of a field is edited in place");
  test("the primary key flag of a field is toggled");
  test("a field can be added from the canvas");
  test("a field can be removed from the canvas");
  test("the fields can be reordered by dragging", () => { /* 触发 change → MoveFieldCommand */ });
  test("the table can be resized from the handle", () => { /* → ResizeTableCommand，宽度被更新 */ });
  test("the table can be locked from the canvas", () => { /* → ToggleTableLockCommand */ });
  test("the comment of a table is edited on the canvas");
  test("the color of a table is changed on the canvas");
  test("the index of a table is edited on the canvas", () => { /* 索引名与字段列表 */ });
  test("the unique constraints of a table are edited on the canvas");
  test("every canvas edit can be undone", () => { /* history.canUndo → undo → 还原 */ });
  ```

- [ ] **Step 3: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs table-editing`
  Expected: FAIL —— `use-sortable.ts` 与 store 方法不存在

- [ ] **Step 4: 实现 `use-sortable.ts` 与 store 方法**

  `useSortable` 返回 `sortableOptions`（`{ handle: ".field-drag-handle", animation: 150, ghostClass: "is-sorting" }`）与 `onSort(tableId, fromIndex, toIndex)`：调用 `useDiagramStore().moveField`（内部 `history.execute(new MoveFieldCommand(...))`）。**不要**把 `v-model` 直接绑到 `table.fields`，只在 `change` 事件里发命令（spec §5.1）。

- [ ] **Step 5: 实现画布内编辑**

  在 `TableHeader.vue` / `TableField.vue` 内实现双击进入编辑（`contenteditable` 或 Naive UI `NInput`），`change` 时提交到 store；`Table.vue` 用 `vue-draggable-plus` 的 `VueDraggable` 包裹字段列表，元素 key 用 `field.id`；`ResizeHandles.vue` 的 `pointerdown/move/up` 序列发 `ResizeTableCommand`；`FieldHandle.vue` 增加锁定态的表不允许连线（直接忽略 `pointerdown`）。

- [ ] **Step 6: 整体验证**

  Run: `node --experimental-strip-types scripts/run-tests.mjs`（全量）、`node --experimental-strip-types scripts/verify-constraints.test.ts`、`pnpm run typecheck`
  Expected: 0 fail；约束检查通过；typecheck 无错误

- [ ] **Step 7: 提交**

  ```bash
  git add packages/sdk/src packages/sdk/package.json pnpm-lock.yaml
  git commit -m "feat(sdk): edit the tables inline and sort the fields"
  ```

---

## Task 27: sdk 侧边栏完整编辑器

**Files:**
- Rewrite: `packages/sdk/src/components/SidePanel/ViewsTab.vue`
- Rewrite: `packages/sdk/src/components/SidePanel/TypesTab.vue`
- Rewrite: `packages/sdk/src/components/SidePanel/EnumsTab.vue`
- Create: `packages/sdk/src/components/SidePanel/CustomTypesTab.vue`
- Create: `packages/sdk/src/components/SidePanel/SqlHeaderTab.vue`
- Create: `packages/sdk/src/components/SidePanel/side-panel-editors.test.ts`
- Modify: `packages/sdk/src/components/SidePanel/SidePanel.vue`（新增两个 Tab）、`packages/sdk/src/components/SidePanel/index.ts`、`packages/sdk/src/stores/diagram.ts`（视图/类型/枚举的增改删）、`packages/sdk/src/stores/ui.ts`（`UiTab` 联合类型新增 `"customTypes"` 与 `"sqlHeader"`）

**Interfaces:**
- Consumes: core 的 `UpdateEntityCommand` / `AddEntityCommand` / `RemoveEntityCommand`（Task 24）、`View` / `CustomType` / `Enum` 模型、`useDiagramStore`。
- Produces:
  ```ts
  // packages/sdk/src/stores/diagram.ts 新增
  function addView(view: View): void;
  function updateView(id: ViewId, updates: Partial<Omit<View, "id">>): void;
  function removeView(id: ViewId): void;
  function addType(type: CustomType): void;
  function updateType(id: CustomTypeId, updates: Partial<Omit<CustomType, "id">>): void;
  function removeType(id: CustomTypeId): void;
  function addEnum(entry: Enum): void;
  function updateEnum(name: string, updates: Partial<Omit<Enum, "name">>): void;
  function removeEnum(name: string): void;
  ```

- [ ] **Step 1: 写失败的测试 `packages/sdk/src/components/SidePanel/side-panel-editors.test.ts`**

  必须包含（≥ 20 条）：
  ```ts
  test("the views tab lists the views");
  test("the base table of a view can be selected", () => { /* NSelect → diagramStore.updateView */ });
  test("a join can be added to a view");
  test("the columns of a view can be edited", () => { /* 表/字段/别名 */ });
  test("the conditions of a view can be edited", () => { /* 连接符/表/字段/运算符/值 */ });
  test("a view can be removed");
  test("the types tab lists the custom types");
  test("a field can be added to a custom type");
  test("the values of a custom type field can be edited");
  test("a custom type can be removed");
  test("the enums tab lists the enums");
  test("a value can be added to an enum");
  test("a value can be removed from an enum");
  test("an enum can be removed");
  test("the custom types tab lists the custom types of the prop");
  test("the sql header tab edits the sql header of the diagram");
  test("every side panel edit can be undone");
  test("the side panel keeps the existing table editors", () => { /* 既有 13 条用例仍通过 */ });
  test("the new tabs appear in the tab bar", () => { /* [data-testid="customtypes-tab"] 与 [data-testid="sqlheader-tab"] */ });
  test("switching tabs keeps the selection");
  ```

- [ ] **Step 2: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs side-panel-editors`
  Expected: FAIL —— 断言缺失（`views-tab` 的编辑器不存在）

- [ ] **Step 3: 扩展 store**

  按 Interfaces 块实现 9 个 store 方法（全部走 `CommandManager`），并给 `UiTab` 联合类型加 `"customTypes"` 与 `"sqlHeader"`。

- [ ] **Step 4: 重写三个编辑器 Tab**

  - `ViewsTab.vue`：`data-testid="views-tab"`；每个视图一块，包含基础表下拉、joins（表 + on 条件）、columns（表/字段/别名）、conditions（连接符/表/字段/运算符/值），下拉项来自 `diagramStore.tables` 与其字段。
  - `TypesTab.vue`：`data-testid="types-tab"`；类型名、注释、字段列表（名称/类型/默认值）。
  - `EnumsTab.vue`：`data-testid="enums-tab"`；枚举名 + 取值列表（可增删改）。
  - `CustomTypesTab.vue`：`data-testid="customtypes-tab"`；来自 `DrawDBEditor` 的 `customTypes` prop 的新增/编辑（`props.customTypes` 通过 store 或 provide 传入）。
  - `SqlHeaderTab.vue`：`data-testid="sqlheader-tab"`；多行文本框 → `diagramStore.updateSqlHeader`。

- [ ] **Step 5: 整体验证**

  Run: `node --experimental-strip-types scripts/run-tests.mjs`（全量）、`node --experimental-strip-types scripts/verify-constraints.test.ts`、`pnpm run typecheck`
  Expected: 0 fail；约束检查通过；typecheck 无错误

- [ ] **Step 6: 提交**

  ```bash
  git add packages/sdk/src
  git commit -m "feat(sdk): complete the side panel editors"
  ```

---

## Task 28: sdk 弹窗与导入导出

**Files:**
- Create: `packages/sdk/src/components/Dialogs/SqlPreviewDialog.vue`
- Create: `packages/sdk/src/components/Dialogs/ImportDialog.vue`
- Create: `packages/sdk/src/components/Dialogs/AutoRelationshipsDialog.vue`
- Create: `packages/sdk/src/components/Dialogs/dialogs.test.ts`
- Create: `packages/sdk/src/components/Dialogs/index.ts`
- Modify: `packages/sdk/src/components/EditorDialogs.vue`（装配三个弹窗）、`packages/sdk/src/components/use-editor-commands.ts`（菜单接线）、`packages/sdk/src/components/Header/types.ts`（菜单项）、`packages/sdk/src/i18n/locales/*.json`（新键）

**Interfaces:**
- Consumes: core 的 `exportSQL` / `exportDBML` / `importSQL` / `parseDBML` / `importDiagramJson` / `exportDiagramJson` / `inferRelationships`（Task 22、23）、`useDiagramStore`。
- Produces:
  ```ts
  // packages/sdk/src/components/Dialogs/index.ts
  export { default as SqlPreviewDialog } from "./SqlPreviewDialog.vue";
  export { default as ImportDialog } from "./ImportDialog.vue";
  export { default as AutoRelationshipsDialog } from "./AutoRelationshipsDialog.vue";
  export { default as ImageExportDialog } from "./ImageExportDialog.vue";  // Task 29 创建
  ```
  `EditorDialogs.vue` 的 props：`{ sqlPreviewOpen: boolean; importOpen: boolean; autoRelationshipsOpen: boolean; imageExportOpen: boolean }`，emits：`update:sqlPreviewOpen`、`update:importOpen`、`update:autoRelationshipsOpen`、`update:imageExportOpen`。
  菜单新 key：`file:import-json`、`file:export-json`、`file:export-png`、`file:auto-layout`、`file:auto-relationships`、`file:validate`。

- [ ] **Step 1: 写失败的测试 `packages/sdk/src/components/Dialogs/dialogs.test.ts`**

  必须包含（≥ 10 条）：
  ```ts
  test("the sql preview shows the generated sql", () => { /* 打开后 [data-testid="sql-preview-content"] 含 "CREATE TABLE" */ });
  test("the sql preview can switch to dbml", () => { /* 点击切换后含 "Table " */ });
  test("the sql preview copies the sql to the clipboard", () => { /* stub navigator.clipboard.writeText */ });
  test("the import dialog parses a sql script", () => { /* 粘贴 SQL → 确认后 diagram 出现新表 */ });
  test("the import dialog reports a parse error", () => { /* 非法 SQL → [data-testid="import-error"] 可见，图不变 */ });
  test("the import dialog imports a dbml script");
  test("the import dialog imports a json diagram", () => { /* → diagramStore.setDiagram */ });
  test("the import dialog warns before it replaces the diagram");
  test("the auto relationships dialog lists the candidates");
  test("the auto relationships dialog creates the selected relationships", () => { /* 勾选后确认 → diagramStore.relationships.length 增加 */ });
  test("the auto relationships dialog shows an empty state", () => { /* 无候选 → [data-testid="auto-relationships-empty"] */ });
  test("the menu opens the import dialog", () => { /* 触发 "file:import-json" → 弹窗出现 */ });
  ```

- [ ] **Step 2: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs dialogs`
  Expected: FAIL —— 弹窗组件不存在

- [ ] **Step 3: 实现三个弹窗**

  - `SqlPreviewDialog.vue`：`data-testid="sql-preview-dialog"`；NButtonGroup 切换 SQL/DBML；`data-testid="sql-preview-content"` 显示内容；复制按钮调用 `navigator.clipboard.writeText`；下载按钮用 `Blob` + `URL.createObjectURL`。
  - `ImportDialog.vue`：`data-testid="import-dialog"`；格式下拉（SQL / DBML / JSON）；文本域 + 文件选择；解析错误显示在 `data-testid="import-error"`（含 `diagnostics` 的行/列）；确认导入前先弹二次确认（`data-testid="import-confirm"`）；成功后 `emit("imported", diagram)`。
  - `AutoRelationshipsDialog.vue`：`data-testid="auto-relationships-dialog"`；用 `inferRelationships` 列出候选（勾选框 + 表格名/字段名/基数）；确认后 `diagramStore.applyRelationships(selected)`（该 store 方法在 Step 4 补齐）。

- [ ] **Step 4: 补齐 store 方法与菜单接线**

  `stores/diagram.ts` 新增：
  ```ts
  function applyRelationships(relationships: Relationship[]): void;   // 走 AddRelationshipsCommand
  function autoArrange(): void;                                        // 走 AutoArrangeCommand（内部调 core 的 autoArrange）
  function setImportedDiagram(next: Diagram): void;                    // setDiagram 的别名（导入视作整体替换，不进历史）
  ```
  `Header/types.ts` 新增菜单项（file 组：导入 JSON / 导出 JSON / 导出 PNG；edit 组：自动布局 / 推断关系；view 组：质量校验），并在 `use-editor-commands.ts` 里接上对应动作。

- [ ] **Step 5: i18n 新键**

  新增键（英文为基准，其余 50 个语言文件用英文回填）：
  `file.importJson`、`file.exportJson`、`file.exportPng`、`file.autoLayout`、`file.autoRelationships`、`file.validate`、`dialog.sqlPreview`、`dialog.import`、`dialog.imageExport`、`dialog.autoRelationships`、`import.error`、`import.confirm`、`import.success`、`export.copied`、`export.download`、`autoRelationships.empty`、`autoRelationships.apply`、`layout.failed`。

  Run: `node scripts/migrate-i18n.ts`（迁移脚本会把缺失的键回填为英文），随后检查 `packages/sdk/src/i18n/locales/zh-CN.json` 等 51 个文件都含新键。

- [ ] **Step 6: 整体验证**

  Run: `node --experimental-strip-types scripts/run-tests.mjs`（全量）、`node --experimental-strip-types scripts/verify-constraints.test.ts`、`pnpm run typecheck`
  Expected: 0 fail；约束检查通过；typecheck 无错误

- [ ] **Step 7: 提交**

  ```bash
  git add packages/sdk/src
  git commit -m "feat(sdk): add the preview, import and relationship dialogs"
  ```

---

## Task 29: sdk 全屏与图片导出

**Files:**
- Create: `packages/sdk/src/composables/use-image-export.ts`
- Create: `packages/sdk/src/composables/use-fullscreen.ts`
- Create: `packages/sdk/src/composables/image-export.test.ts`
- Create: `packages/sdk/src/components/Dialogs/ImageExportDialog.vue`
- Modify: `packages/sdk/src/components/Dialogs/index.ts`、`packages/sdk/src/components/EditorDialogs.vue`、`packages/sdk/src/stores/ui.ts`（`isFullscreen`）、`packages/sdk/src/components/Header/types.ts`、`packages/sdk/src/i18n/locales/*.json`

**Interfaces:**
- Consumes: `html-to-image`（新依赖）、core 的 `Diagram`。
- Produces:
  ```ts
  // packages/sdk/src/composables/use-image-export.ts
  export class ImageExportError extends Error { readonly cause?: unknown; }
  export interface ImageExportOptions { pixelRatio?: number; backgroundColor?: string; }
  export function exportPng(element: HTMLElement, options?: ImageExportOptions): Promise<string>; // 返回 data URL；失败抛 ImageExportError
  // packages/sdk/src/composables/use-fullscreen.ts
  export function useFullscreen(target?: Ref<HTMLElement | null>): { isFullscreen: Ref<boolean>; toggle(): Promise<void>; };
  ```

- [ ] **Step 1: 安装 `html-to-image`**

  Run: `pnpm --filter @drawdb/vue-sdk add html-to-image@1.11.13`
  Expected: 退出码 0

- [ ] **Step 2: 写失败的测试 `packages/sdk/src/composables/image-export.test.ts`**

  必须包含（≥ 8 条）：
  ```ts
  test("exportPng adds the exporting marker while it runs");   // 导出期间元素有 data-exporting 属性
  test("exportPng removes the exporting marker afterwards");
  test("exportPng restores the marker when it fails");           // 失败也必须还原（spec §7）
  test("exportPng throws an ImageExportError when the capture fails");
  test("useFullscreen reports the current state");
  test("useFullscreen toggles the state");
  test("the image export dialog offers the scale and the background colour");
  test("the image export dialog exports the canvas", () => { /* stub exportPng 被调用 */ });
  ```

- [ ] **Step 3: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs image-export`
  Expected: FAIL —— 模块不存在

- [ ] **Step 4: 实现两个 composable**

  - `exportPng(element, options)`：`element.setAttribute("data-exporting", "true")` → 调用 `html-to-image` 的 `toPng(element, { pixelRatio, backgroundColor })` → `finally` 里 `element.removeAttribute("data-exporting")`；失败抛 `ImageExportError`。
  - `useFullscreen(target)`：`isFullscreen` 由 `document.fullscreenElement` 驱动；`toggle()` 调用 `requestFullscreen` / `exitFullscreen`，被拒绝时把 `isFullscreen` 保持 false。

- [ ] **Step 5: 实现 `ImageExportDialog.vue` 并接线**

  `data-testid="image-export-dialog"`；缩放倍数下拉（1×/2×/3×）、背景色选择、导出按钮；导出期间禁用画布交互（`data-exporting` 属性的 CSS 已在 `styles.css` 隐藏交互层）。

- [ ] **Step 6: 整体验证**

  Run: `node --experimental-strip-types scripts/run-tests.mjs`（全量）、`node --experimental-strip-types scripts/verify-constraints.test.ts`、`pnpm run typecheck`
  Expected: 0 fail；约束检查通过；typecheck 无错误

- [ ] **Step 7: 提交**

  ```bash
  git add packages/sdk/src packages/sdk/package.json pnpm-lock.yaml
  git commit -m "feat(sdk): add the fullscreen mode and the image export"
  ```

---

## Task 30: sdk 质量问题面板

**Files:**
- Create: `packages/sdk/src/components/SidePanel/IssuesTab.vue`
- Create: `packages/sdk/src/composables/use-issues.ts`
- Create: `packages/sdk/src/composables/use-issues.test.ts`
- Create: `packages/sdk/src/components/SidePanel/issues.test.ts`
- Modify: `packages/sdk/src/components/SidePanel/SidePanel.vue`（新增 Issues Tab）、`packages/sdk/src/components/SidePanel/index.ts`、`packages/sdk/src/stores/ui.ts`（`activeTab` 加 `"issues"`）、`packages/sdk/src/i18n/locales/*.json`

**Interfaces:**
- Consumes: core 的 `validateDiagram`（Task 21）与 `DiagramIssue`、`useDiagramStore`（`revision`）、`useUIStore`。
- Produces:
  ```ts
  // packages/sdk/src/composables/use-issues.ts
  export interface LocalizedIssue extends DiagramIssue { label: string; }
  export function useIssues(): { issues: ComputedRef<LocalizedIssue[]>; errors: ComputedRef<LocalizedIssue[]>; warnings: ComputedRef<LocalizedIssue[]>; refresh(): void; };
  // packages/sdk/src/stores/ui.ts
  function focusIssue(issue: DiagramIssue): void;   // 选中对应表/字段并把画布滚动到该对象
  ```

- [ ] **Step 1: 写失败的测试**

  `packages/sdk/src/composables/use-issues.test.ts`：
  ```ts
  test("useIssues returns no issue for a valid diagram");
  test("useIssues groups the issues by severity");
  test("useIssues localizes the message with the locale of the sdk", () => { /* 中文 locale 下 message 为中文 */ });
  test("useIssues recomputes when the diagram changes", () => { /* revision 增加 → issues 变化 */ });
  ```

  `packages/sdk/src/components/SidePanel/issues.test.ts`（≥ 10 条）：
  ```ts
  test("the issues tab lists the issues");
  test("the issues are grouped by severity", () => { /* [data-testid="issues-errors"] 与 [data-testid="issues-warnings"] */ });
  test("clicking an issue selects the table");
  test("clicking an issue selects the field");
  test("clicking an issue scrolls the canvas to the object", () => { /* ui.scrollX/scrollY 变化 */ });
  test("the issues tab shows an empty state for a valid diagram");
  test("the issues tab is reachable from the tab bar", () => { /* [data-testid="issues-tab"] */ });
  test("the issue message is localized", () => { /* 中文 locale */ });
  ```

- [ ] **Step 2: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs issues`
  Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `use-issues.ts` 与 `IssuesTab.vue`**

  `useIssues` 是 `computed`：`validateDiagram(diagramStore.diagram)` 的结果按 `severity` 分组；每条 issue 的 `label` 用 `t(\`issues.${code}\`, issue.params)` 渲染，缺失键回退到 `issue.message`（英文兜底）。`IssuesTab.vue` 渲染错误组与警告组，点击某条调用 `ui.focusIssue(issue)`（选中表/字段 + 居中画布）。

- [ ] **Step 4: i18n 新键**

  为 30 余个 `code` 各加一个键（`issues.table.no_name` 等），英文为基准，其余语言回填英文。

- [ ] **Step 5: 整体验证**

  Run: `node --experimental-strip-types scripts/run-tests.mjs`（全量）、`node --experimental-strip-types scripts/verify-constraints.test.ts`、`pnpm run typecheck`
  Expected: 0 fail；约束检查通过；typecheck 无错误

- [ ] **Step 6: 提交**

  ```bash
  git add packages/sdk/src
  git commit -m "feat(sdk): add the quality issues panel"
  ```

---

## Task 31: app 最小适配

**Files:**
- Create: `packages/app/src/services/diagram-io.ts`
- Create: `packages/app/src/services/diagram-io.test.ts`
- Modify: `packages/app/src/views/HomeView.vue`（导入 / 导出 JSON 按钮）、`packages/app/src/views/EditorView.vue`（自动布局与质量校验入口）、`packages/app/src/App.test.ts`

**Interfaces:**
- Consumes: `@drawdb/core` 的 `exportDiagramJson` / `importDiagramJson` / `autoArrange` / `validateDiagram`、`@drawdb/vue-sdk` 的 `DrawDBEditor`。
- Produces:
  ```ts
  // packages/app/src/services/diagram-io.ts
  export function downloadDiagramJson(diagram: Diagram, filename?: string): void;
  export function readDiagramJsonFile(file: File): Promise<Diagram>;   // 失败抛 ImportError
  ```

- [ ] **Step 1: 写失败的测试 `packages/app/src/services/diagram-io.test.ts`**

  ```ts
  test("downloadDiagramJson creates a json download", () => { /* stub URL.createObjectURL 与 a.click */ });
  test("readDiagramJsonFile parses the file", () => { /* new File([json], "a.json") */ });
  test("readDiagramJsonFile rejects an invalid file", () => { /* 非法 JSON → 抛 ImportError */ });
  ```

- [ ] **Step 2: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs diagram-io`
  Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现服务与视图适配**

  - `diagram-io.ts`：`downloadDiagramJson` 用 `exportDiagramJson(diagram, { pretty: true })` 生成文本，`Blob` + `URL.createObjectURL` 触发下载；`readDiagramJsonFile` 用 `file.text()` + `importDiagramJson`。
  - `HomeView.vue`：每张图加「导出 JSON」按钮；顶部加「导入 JSON」按钮（隐藏的 file input）。
  - `EditorView.vue`：工具条加「自动布局」「质量校验」按钮——自动布局调用 SDK 暴露的 `autoArrange()`（`defineExpose` 里新增 `autoArrange` 与 `validate`），质量校验打开 Issues Tab（通过 SDK 暴露的 `openIssuesTab()`）。

- [ ] **Step 4: 扩展 SDK 的公开方法**

  `DrawDBEditor.vue` 的 `defineExpose` 增加 `autoArrange(): void`、`validate(): DiagramIssue[]`、`openIssuesTab(): void`。

- [ ] **Step 5: 整体验证**

  Run: `node --experimental-strip-types scripts/run-tests.mjs`（全量）、`node --experimental-strip-types scripts/verify-constraints.test.ts`、`pnpm run typecheck`
  Expected: 0 fail；约束检查通过；typecheck 无错误

- [ ] **Step 6: 提交**

  ```bash
  git add packages/app/src packages/sdk/src
  git commit -m "feat(app): adapt the standalone app to the new sdk features"
  ```

---

## Task 32: 文档、版本 0.2.0 与发布前验证

**Files:**
- Modify: `package.json`、`packages/core/package.json`、`packages/sdk/package.json`、`packages/app/package.json`（版本 → 0.2.0）
- Modify: `CHANGELOG.md`（新增 `## 0.2.0`）
- Modify: `sdk-workspace/README.md`、`packages/core/README.md`、`packages/sdk/README.md`、`packages/app/README.md`
- Create: `docs/task-32-report.md`
- Modify: `progress.md`

**Interfaces:**
- Consumes: 全部前序任务的产出。
- Produces: 版本 0.2.0 的发布候选（本地打包，不发布到 npm——沿用 v0.1.0 的既定策略）。

- [ ] **Step 1: 写发布前验证测试 `scripts/verify-release.test.ts` 的新用例**

  增加两条："the packages are at version 0.2.0"（四个 package.json + 根 package.json 的 `version` 字段）与 "the changelog documents 0.2.0"（`CHANGELOG.md` 含 `## 0.2.0` 且列出六项新能力）。

- [ ] **Step 2: 运行测试确认失败**

  Run: `node --experimental-strip-types scripts/run-tests.mjs verify-release`
  Expected: FAIL —— 版本仍是 0.1.0

- [ ] **Step 3: 升版本并写 CHANGELOG**

  四个 `package.json` 与根 `package.json` 的 `version` 改为 `0.2.0`；`CHANGELOG.md` 新增：

  ```markdown
  ## 0.2.0
  - 图质量校验（结构化 issue，SDK 本地化）
  - 自动布局（dagre）与关系推断
  - 图 JSON 导入导出（兼容旧版 .ddb）
  - 画布内编辑：拖拽建关系、字段排序、缩放、锁定
  - 侧边栏完整编辑器：视图 / 类型 / 枚举 / 自定义类型 / SQL 头
  - 弹窗：SQL 预览、导入、图片导出、推断关系
  - 小地图、全屏、Issues 面板
  ```

- [ ] **Step 4: 更新 README**

  `sdk-workspace/README.md` 增加「Phase 2 新增能力」小节与新的 API 示例（`validateDiagram`、`autoArrange`、`inferRelationships`、`exportDiagramJson`/`importDiagramJson`）；三个包的 README 同步各自的新增 API。

- [ ] **Step 5: 发布前验证**

  Run:
  ```bash
  pnpm run typecheck
  pnpm run build:packages
  node --experimental-strip-types scripts/run-tests.mjs
  pnpm run pack:packages
  ```
  Expected: typecheck 无错误；build 成功；测试 0 fail 且总数 ≥ 464（334 + 130）；`pack:packages` 产出 `.release/drawdb-core-0.2.0.tgz` 与 `.release/drawdb-vue-sdk-0.2.0.tgz`。

- [ ] **Step 6: 写报告与账本**

  `docs/task-32-report.md` 记录本阶段的范围、每个任务的提交、验证结果、与 spec 的差异（特别是 `SetDiagramCommand` 被 `UpdateDiagramCommand` 取代、minimap 落在 Task 25 而非 Task 29）。`progress.md` 追加 Task 21–32 的条目与 Rulings。

- [ ] **Step 7: 标注计划状态并提交**

  ```bash
  node scripts/plan-status.mjs --plan docs/superpowers/plans/2026-10-23-drawdb-vue-sdk-parity-plan.md --task 32 --commit <hash> --report docs/task-32-report.md
  git add -A
  git commit -m "docs: release the version 0.2.0"
  ```

---

## 自查（self-review）

**1. Spec 覆盖**

| spec 章节 | 对应任务 |
|---|---|
| §4.1 校验 | Task 21 |
| §4.2 布局与推断 | Task 22 |
| §4.3 JSON 导入导出 | Task 23 |
| §4.4 命令补全 | Task 24 |
| §5.1 画布拆分与交互层 | Task 25、26 |
| §5.2 侧边栏完整编辑器 | Task 27、30 |
| §5.3 弹窗 | Task 28、29 |
| §5.4 组合式与 store | Task 25、26、27、28、29、30 |
| §5.5 菜单与 i18n | Task 26、27、28、29、30 |
| §5.6 独立应用最小适配 | Task 31 |
| §6 数据流与状态 | Task 24、27、28、30（校验不入历史、导入整体替换） |
| §7 错误处理 | Task 22、23、25、28、29、30 |
| §8 测试策略 | 每个任务各自的 Step 2；合计新增 ≥ 130 条 |
| §9 质量门槛 | Task 21 Step 1（约束脚本）、Task 25 Step 8、全程 typecheck |
| §10 风险 | Task 22（dagre 失败回退）、Task 29（导出失败还原标记）、Task 21（校验不抛错） |

**2. Review Focus 覆盖** — 5 条全部有测试落点（Task 21×2、Task 22、Task 23、Task 25×2、Task 24/22/26）。

**3. 类型一致性** — `DiagramIssue` 只在 Task 21 定义，后续直接引用；`AutoArrangeOptions` / `inferRelationships` 只在 Task 22 定义；`ImportError` 只在 Task 23 定义；store 方法名在 Task 26/27/28 定义后被 Task 31 使用（`moveField`/`resizeTable`/`toggleTableLock`/`updateSqlHeader`/`addView`/`updateView`/`removeView`/`addType`/`updateType`/`removeType`/`addEnum`/`updateEnum`/`removeEnum`/`applyRelationships`/`autoArrange`/`setImportedDiagram`）。

**4. 已知差异（实现时在报告里记录）** — spec §4.4 的 `SetDiagramCommand` 不新增，改用既有的 `UpdateDiagramCommand`；spec §11 把小地图列在 Task 25，本计划照此执行（Task 29 只做全屏与图片导出）。

**5. 比例** — 计划 12 个任务、约 100 个步骤，spec 441 行；计划不复制实现代码，只固定签名、测试名与断言。
