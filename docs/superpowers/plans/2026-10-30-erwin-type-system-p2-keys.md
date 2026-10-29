# P2' — 键与约束对象化实施计划

**Status:** 执行中（2026-10-30）
**Spec:** [`docs/superpowers/specs/2026-10-26-erwin-type-system-design.md`](../specs/2026-10-26-erwin-type-system-design.md) §3.8.3（裁决 1/2/3/5/6/7）、§3.5（INV-8/9/10）、§7.1（条目区）、§8（诊断通道）
**前置:** P1–P4（双层模型、解析器、lint、导出接入）与 P5（编辑器 UI）均已合并

本轮把「键」从字段布尔位与表内数组升级为**独立双名对象**，并落地 schema 级命名校验。
六轮 UI 评审已经把键当对象展示（树的键节点、KeyCard、画布键行），模型必须跟上。

---

## 关键设计锚点

- **四类对象同形**：`PrimaryKey` / `UniqueKey` / `ForeignKey` / `Index` 都有 `id` + `logicalName` + `name` + `columns: IndexColumn[]`（FK 例外：列映射从 `Relationship` 取，只存 `relationshipId`）。
- **自动命名物化为数据**：`PK_` / `UK_` / `FK_` / `Idx_` + 表名（FK 为 `FK_` + 子表名 + `_` + 父表名），同一命名空间撞名追加 `_2`、`_3`……；**表改名不回溯**。
- **两个命名空间**：物理名 = schema 级全局唯一（INV-8，与索引共享）；逻辑名 = 同表内唯一。
- **FK 与 Relationship 一对一（INV-10）**：`Relationship` 回归纯结构（端点/列映射/基数/级联），`ForeignKey` 只存双名 + `relationshipId` + `comment`；`Relationship.name` 废弃，物理约束名以 `ForeignKey.name` 为准；建关系时自动建 FK，删关系级联删。
- **`field.primary` 废弃**：PK 成员关系由 `Table.primaryKey.columns` 表达；画布 PK 标记、导出内联 `PRIMARY KEY(...)` 都由 PK 对象推导。
- **唯一约束 vs 唯一索引不合并**（裁决 4）：`UniqueKey` → 内联 `CONSTRAINT ... UNIQUE`；`Index.unique` → 独立 `CREATE UNIQUE INDEX`。
- **撤销粒度是键，不是表**（裁决 3）：新增 `commands/key-commands.ts`，快照只含被改的那个键。
- **迁移不做历史兼容**：载入时把旧形状归一（`field.primary` → PK 对象、`uniqueConstraints` → `uniqueKeys`、`Index.fields` → `columns`），此后只写新结构。

## 现状代码事实（2026-10-30 实测）

- `packages/core/src/models/table.ts:8-30`：`Index { id?: FieldId; name; unique; fields: FieldId[] }`、`UniqueConstraint { id?: TableId; name; fields: FieldId[] }`、`Table { …, indices?: Index[]; uniqueConstraints?: UniqueConstraint[] }`。
- `packages/core/src/models/field.ts`：`PhysicalField.primary?: boolean`（`packages/core/src/models/physical.ts:37`）。
- `packages/core/src/commands/`：`table-commands.ts`（UpdateTableCommand）、`field-commands.ts`（Add/Remove/Update，Remove 走 `removeFieldAtomic`）、`relationship-commands.ts`（Add/Update/Remove）、`composite-command.ts`。没有键级别的命令。
- `packages/core/src/validation/rules.ts` 的 `checkIndices` 只查表内重名与列数；`validation/index.ts` 导出 `validateDiagram`/`lintDialect`。
- `packages/core/src/serialize/import.ts` 有 `normalizeFieldReferences()`（旧索引字段名 → id）；`serialize/types.ts` 的 `DiagramJson` 仍是旧形状。
- 导出器：`export/shared.ts` 的 `exportIndexes/exportUniqueConstraints`（按 id 查名）、7 个方言各自内联 PK（读 `field.primary`）。
- SDK：`components/EditPanel/{UniqueKeysPanel,ForeignKeysPanel,TableIndexes,TableConstraints}.vue`、`edit-panel-groups.ts` 的 `tableConstraints/tableIndexes`、`stores/edit-panel-actions.ts`（`TableBatchPatch`、`applyTableBatch`）、`components/Canvas/table-sections.ts`（`primarySection` 读 `field.primary`、`uniqueSection` 读 `uniqueConstraints`、`indexSection` 读 `indices`）、`components/Outline/outline-constraints.ts`。
- 测试：`packages/core/src/models/index.test.ts`（Diagram round trip）、`packages/sdk/src/components/EditPanel/edit-panel-keys.test.ts`（UK/FK/索引创建与排序）。

---

## Task 1 — 模型与命名规则（core）

1. 新增 `packages/core/src/models/keys.ts`：`IndexType`、`IndexColumn { fieldId; order?; expression? }`、`Index`、`PrimaryKey`、`UniqueKey`、`ForeignKey`、`KeyKind = "primary"|"unique"|"foreign"|"index"`、`keyColumns(key)` 辅助。
2. `models/table.ts`：`Table` 增 `primaryKey?: PrimaryKey`、`uniqueKeys?: UniqueKey[]`、`foreignKeys?: ForeignKey[]`；`Index` 改 `columns: IndexColumn[]`（另存 `fields?: FieldId[]` 的**只读**兼容字段，载入时归一后丢弃）。
3. 新增 `packages/core/src/models/key-names.ts`：`nextKeyName(table, kind, parent?, taken)`（前缀 + 表名、撞名 `_2`、大小写不敏感比较）、`keyPrefix(kind)`。
4. 测试 `models/key-names.test.ts`（新建、撞名加序号、表名含空格/大写、FK 用两端表名）与 `models/keys.test.ts`（形态、`keyColumns` 顺序、`IndexColumn.order` 缺省）。

**验证:** `tsc --noEmit -p packages/core/tsconfig.json` 0 错；`run-tests.mjs core` 绿。

## Task 2 — 归一与序列化（core）

1. 新增 `packages/core/src/models/key-migration.ts`：`normalizeTableKeys(table)`（`field.primary` → PK 对象并清位；`uniqueConstraints` → `uniqueKeys`；`Index.fields` → `columns`；缺 `id` 的补 `createId()`），幂等；返回新 Table，不改入参。
2. `serialize/import.ts` 载入后对每张表调用；`serialize/export.ts` 与 `serialize/types.ts` 只写新结构。
3. `createTable` 不建默认 PK（保持现状）；`addTable` 命令载入时归一。
4. 测试 `models/key-migration.test.ts`（旧形状三种、幂等、含未知字段引用的索引保留原样）与 `serialize/keys-roundtrip.test.ts`（PK/UK/FK/索引往返、`columns` 顺序与 `order` 保留）。

**验证:** core 测试绿；`vue-tsc` 暂不要求（SDK 在 Task 6 跟进）。

## Task 3 — 键的命令（core）

1. 新增 `packages/core/src/commands/key-commands.ts`：`AddKeyCommand` / `UpdateKeyCommand` / `RemoveKeyCommand`（泛化 PK/UK/FK/Index，构造参数 `{ tableId, kind, key, index? }`），撤销快照只含被改的键与表上的数组本身。
2. `relationship-commands.ts`：`AddRelationshipCommand` 同步创建 `ForeignKey`（`nextKeyName` 命名、`relationshipId`、`comment` 空），`RemoveRelationshipCommand` 级联删除；`UpdateRelationshipCommand` 不碰名字（`Relationship.name` 废弃，改名走 FK 命令）。
3. `commands/index.ts` 导出新文件。
4. 测试 `commands/key-commands.test.ts`（增删改的 undo 快照、删键后其它键不变）与 `commands/relationship-fk.test.ts`（建关系生成 FK、命名撞名加序号、删关系级联删、undo 恢复两者）。

**验证:** core 测试绿。

## Task 4 — 校验补强（core）

1. 新增 `packages/core/src/validation/key-rules.ts`，实现 spec 裁决 6 的 11 条：`index.unknown_field`、`index.duplicate_schema_name`、`constraint.duplicate_schema_name`、`constraint.duplicate_logical_name`、`constraint.no_columns`、`constraint.fk_without_relationship`、`constraint.relationship_without_fk`、`table.multiple_primary_keys`、`index.duplicate_columns`、`index.unique_constraint_conflict`、`index.no_supporting_relationship`、`index.relationship_without_index`。
2. `validation/index.ts` 的 `validateDiagram` 汇总新规则；`validation/types.ts` 的 `DiagramIssue.code` 联合类型扩展。
3. 测试 `validation/key-rules.test.ts`（每条 code 至少一例正例与一例反例，级别正确）。

**验证:** core 测试绿；SDK 告警面板能显示新 code（无需改代码，走 DiagramIssue 通道）。

## Task 5 — 导出器与导入器（core）

1. 7 个导出器：PK 从 `table.primaryKey.columns` 推导顺序；UK `CONSTRAINT <name> UNIQUE (...)`；FK 名取 `table.foreignKeys[].name`（`ALTER TABLE ... ADD CONSTRAINT`）；索引用 `columns` 顺序、`order` 生成 `ASC/DESC`、`where` 生成 `WHERE`、`unique` 生成 `CREATE UNIQUE INDEX`。
2. `export/shared.ts`：`exportIndexes`/`exportUniqueConstraints` 改写；删掉按 `field.primary` 找 PK 的辅助。
3. 导入器：`sql/import/*`（7 方言）与 `dbml/*` 落到新结构（UK → `uniqueKeys`；DBML 的 unique index → `indices`，不回填 UK；报告里记「UK 降级为唯一索引」）。
4. 测试：`export/*.test.ts` 更新与新增（PK/UK/FK 名字与列序、DESC、部分索引、`CREATE UNIQUE INDEX`）；`sql/import/*.test.ts`（内联 UNIQUE → UK，独立 CREATE UNIQUE INDEX → 唯一索引）；`dbml/roundtrip.test.ts`（降级规则）。

**验证:** core 测试绿。

## Task 6 — SDK 编辑面板（keys 接新结构）

1. `edit-panel-groups.ts`：`tableConstraints`/`tableIndexes` 读新对象（PK 对象、`uniqueKeys`、`foreignKeys`、`indices`），补 `logicalName`/`name` 成对字段与 `columns` 列序、`order`、`comment`。
2. `stores/edit-panel-actions.ts`：所有键写操作改走 `key-commands`（键级 undo）；保留 `applyTableBatch` 只服务表级属性。
3. `TableConstraints.vue` / `UniqueKeysPanel.vue` / `ForeignKeysPanel.vue` / `TableIndexes.vue`：KeyCard 双名（逻辑名 + 物理名两行）、列方向切换、`comment` 输入、删除走 `RemoveKeyCommand`；FK 显示 `relationshipId` 指向的关系名并能跳转。
4. i18n：新增文案键（logical name / physical name / direction / comment / key kind），先入 `en.json`。
5. 测试：更新 `edit-panel-keys.test.ts`、`edit-panel-constraints.test.ts`、`edit-panel-groups-view.test.ts`；新增「改名只改一侧名字」「加列后可调方向」「删键只撤销该键」。

**验证:** `vue-tsc -p packages/sdk` 0 错；sdk 测试绿。

## Task 7 — 画布与树接新结构

1. `components/Canvas/table-sections.ts`：`primarySection` 读 `table.primaryKey`、`uniqueSection` 读 `uniqueKeys`、`foreignSection` 读 `foreignKeys`（名字取 FK.name）、`indexSection` 读 `indices`（`labels` 用 `name`），`indexes` 开关真正生效（去掉 `render-model.ts:31` 的 TODO）。
2. `components/Outline/outline-constraints.ts`：键节点从新对象生成（PK/UK/FK/INDEX 四组，标签 `PK <name>` 等），点击 `select` 仍定位到表 + 面板分组。
3. `components/Canvas/TableHeader.vue` 等读 `field.primary` 的地方改由 PK 成员关系推导（`render-model.ts` 的 `showKeyMarks`）。
4. 测试：`table-sections.test.ts`、`outline-constraints` 相关测试改写；新增「INDEX 开关打开时画布出现索引行」。

**验证:** sdk 测试绿、`vue-tsc` 0。

## Task 8 — 收尾

1. 51 locale 全部补齐本轮新增文案（子代理按语言分批，规则同前：只加新键、既有值字节不变、CRLF、sort）。
2. 文档：`docs/designer-ui-redesign-discussion.md` §7.1 从「仍属 P2'」改为「已落地（P2'）」；`progress.md` 追加 P2' 决策段与验证证据；spec §13 的分期表标注 P2' 完成。
3. 全量验证：`pnpm typecheck`（五段）、`run-tests.mjs`（core+sdk+app）、e2e、`turbo run build`。
4. 提交：模型与归一 / 命令 / 校验 / 导出导入 / 面板 / 画布与树 / i18n 与文档（7 个独立 commit，便于二分）。

---

## 执行偏差记录

（执行中追加）
- Task 6 的 FK 卡片仍以 `relationship.name` 作为约束名（`table.foreignKeys[]` 已由载入器与关系命令生成，但面板还没写它）；`comment` 字段的输入框尚未加到卡片；这两项留给 Task 7/8 之前补。
- Task 6 的双名输入用两个新键 `edit_panel_key_logical_name` / `edit_panel_key_physical_name`；`KeyCard` 的标题只显示物理名，逻辑名在卡体内。
