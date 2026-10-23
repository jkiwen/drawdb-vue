# drawDB Vue SDK — Phase 2: 功能对齐设计（v0.2.0）

- **日期**: 2026-10-23
- **状态**: 已评审通过（设计在会话中逐节确认）
- **前置**: `docs/superpowers/specs/2026-10-23-drawdb-vue-sdk-design.md`（v0.1.0 架构设计）、`docs/plan.md`（20 个任务，全部完成）
- **目标版本**: `@drawdb/core` / `@drawdb/vue-sdk` 0.1.0 → 0.2.0

---

## 1. 背景与目标

v0.1.0 交付了可用的 SDK 骨架：核心数据模型、命令模式、7 种方言的 SQL 导入导出、DBML、存储适配器、元数据与插件系统、画布/头部/侧边栏组件、物理与逻辑视图、i18n、独立应用、端到端与性能测试、打包流水线。

v0.1.0 的**编辑能力**只到原版 drawDB 的一半：画布能选中、拖动、缩放、删除表，但不能在画布上直接编辑字段、不能从字段拖出关系、不能排序字段、不能改表尺寸；侧边栏的视图/类型/枚举三个 Tab 只是列表；缺少 JSON 导入导出、SQL/DBML 预览、图片导出、自动布局、自动推断关系、小地图、图质量校验。

**本阶段目标**：把 `@drawdb/vue-sdk` 补齐到可以替代原 React 版 drawDB 的编辑体验，功能对等（feature parity）。

**成功标准**

1. 画布可完成原版的全部编辑动作：拖动、缩放、框选、连线建关系、字段排序、表内增删字段、右键菜单、双击编辑。
2. 侧边栏的视图/类型/枚举为完整编辑器，可配置连接、列、条件、字段与取值。
3. 图可 JSON 导入导出、SQL/DBML 可预览与复制下载、画布可导出 PNG、自动布局与关系推断可用、图质量问题可定位。
4. 现有 334 条测试保持通过；本阶段新增测试 ≥ 120 条；所有新组件 ≤ 300 行。
5. `@drawdb/core` 与 `@drawdb/vue-sdk` 0.2.0 可本地打包，产物可被独立应用消费。

---

## 2. 范围

### 2.1 本阶段做

| 领域 | 内容 |
|---|---|
| 画布编辑 | 拖拽建关系、字段拖拽排序、表/视图/备注/区域的缩放手柄、框选、右键菜单、双击进入编辑 |
| 侧边栏 | 视图完整编辑器（joins/columns/conditions）、自定义类型编辑器、枚举编辑器、自定义类型 Tab、SQL 头注释 Tab、问题 Tab |
| 导入导出 | 图 JSON 导入/导出（兼容旧版 `.ddb` 字段名）、SQL/DBML 预览弹窗（复制/下载）、图 JSON 导入弹窗 |
| 布局 | dagre 自动布局（可撤销）、按字段名自动推断关系（可批量确认） |
| 导出 | 画布导出 PNG（html-to-image） |
| 视图辅助 | 小地图（minimap）、全屏模式 |
| 质量 | 图质量校验（结构化 issues）与问题面板 |
| 应用 | `drawdb-vue-app` 的最小适配（图表列表的 JSON 导入导出、设置入口、模板） |

### 2.2 本阶段不做（明确排入后续）

- 真实 npm 发布与文档站（v0.1.0 已定：仅本地打包）
- 实时协作
- AI 导入（React `utils/importAiDiagram.js`）
- SQL diff 与迁移脚本生成（React `utils/migrations/diffToSQL.js`）
- DBML 代码编辑器（需再引入编辑器依赖；由 DBML 导入导出覆盖）
- 模板市场、落地页、登录与多用户
- 移动端触控手势（仅保留指针事件的基础兼容）

### 2.3 依赖策略

允许新增三个依赖，均为纯 JS/ESM、无构建脚本要求：

| 依赖 | 用途 | 版本 |
|---|---|---|
| `@dagrejs/dagre` | 自动布局（与 React 版同源） | `^3.1.1` |
| `html-to-image` | 画布导出 PNG | `^1.11.13` |
| `vue-draggable-plus` | 字段拖拽排序 | `^0.6.1` |

安装后需同步 `pnpm-workspace.yaml` 的 `onlyBuiltDependencies`（若出现 ignored-builds 警告）。

---

## 3. 架构总览

```
@drawdb/core  (框架无关，纯 TypeScript)
├── models/          已有：Table/Field/Relationship/View/Enum/CustomType/Area/Note/Diagram
├── commands/        已有 + 本阶段补全（字段/关系/集合/布局）
├── export/          已有：7 种方言 SQL
├── sql/import/      已有：7 种方言 SQL 导入
├── dbml/            已有：解析/导出/diff/reconcile
├── storage/         已有：memory + IndexedDB 适配器
├── metadata/ plugins/  已有
├── validation/      新增：图质量校验 → DiagramIssue[]
├── layout/          新增：dagre 自动布局 + 关系推断
└── serialize/       新增：图 JSON 导入导出

@drawdb/vue-sdk  (Vue 3 + Pinia + Naive UI)
├── components/Canvas/       画布：容器 + 图元 + 交互层 + 小地图
├── components/SidePanel/    侧边栏：7 个现有 Tab + 4 个新 Tab + 完整编辑器
├── components/Header/       菜单与工具栏（扩展菜单项）
├── components/Dialogs/      弹窗：SQL/DBML 预览、导入、图片导出、关系推断确认
├── composables/             画布交互、排序、图片导出、全屏
├── stores/                  diagram / ui / history / settings / save
└── i18n/                    51 个语言，新增问题与菜单文案

drawdb-vue-app  (独立应用)
└── 最小适配：图表列表的 JSON 导入导出、设置入口、模板
```

**依赖方向**：`sdk → core`（单向）。core 不引入任何 Vue/Naive UI 依赖，保留「框架无关纯逻辑」这一 v0.1.0 的核心约定。

---

## 4. core 详细设计

### 4.1 `core/src/validation/` — 图质量校验

端口自 React `utils/issues.js`（337 行）。**关键差异：React 返回已翻译的字符串；core 返回结构化 issue，由 SDK 负责本地化。**

```ts
// packages/core/src/validation/types.ts
export type IssueSeverity = "error" | "warning";

export interface DiagramIssue {
  code: string;                    // 稳定标识，如 "table.no_primary_key"
  severity: IssueSeverity;
  message: string;                 // 英文兜底文案
  params?: Record<string, string>; // 本地化参数
  tableId?: string;
  fieldId?: string;
  relationshipId?: string;
  viewId?: string;
  typeId?: string;
  enumName?: string;
}

export interface ValidationOptions {
  database?: DatabaseType;         // 默认取 diagram.database
  severity?: IssueSeverity;        // 过滤：只返回不低于该级别
}

export function validateDiagram(diagram: Diagram, options?: ValidationOptions): DiagramIssue[];
```

**规则清单**（全部来自 React `issues.js`，code 为本阶段新增的稳定标识）：

| 范围 | code |
|---|---|
| 表 | `table.no_name`、`table.duplicate_name`、`table.no_primary_key` |
| 字段 | `field.no_name`、`field.no_type`、`field.no_values`、`field.default_mismatch`、`field.not_null_is_null`、`field.duplicate_name`、`field.inherited_duplicate` |
| 索引/唯一约束 | `index.no_name`、`index.no_fields`、`index.duplicate_name`、`unique_constraint.no_fields`、`unique_constraint.duplicate_name` |
| 自定义类型 | `type.no_name`、`type.duplicate_name`、`type.no_fields`、`type_field.no_name`、`type_field.no_type`、`type_field.no_values`、`type_field.duplicate_name` |
| 枚举 | `enum.no_name`、`enum.duplicate_name`、`enum.no_values` |
| 视图 | `view.no_name`、`view.duplicate_name`、`view.name_clashes_table`、`view.no_base_table`、`join.no_table`、`join.no_condition`、`join.out_of_order`、`view_column.no_field`、`view_column.duplicate_name` |
| 关系 | `relationship.duplicate_name`、`relationship.missing_table`、`relationship.missing_field`、`relationship.circular` |

**语义要点**

- `field.default_mismatch` 复用 core 已有的类型元数据（`types/registry.ts` 的 `DATABASE_TYPE_METADATA`），React 依赖 `dbToTypes[db][type].checkDefault`；core 的注册表目前只有 `isSized/hasPrecision/hasQuotes/canIncrement/signed/hasCheck/noDefault`，**本阶段需为它增加一项 `defaultKind?: "numeric" | "boolean" | "date" | "text" | "none"`**（由 `scripts/generate-type-registry.mjs` 从类型名推导：整型/浮点 → `numeric`，`BOOLEAN`/`BOOL` → `boolean`，`DATE`/`DATETIME`/`TIMESTAMP` 及其变体 → `date`，其余 → `text`；`noDefault: true` 的类型 → `none`），并在 core 实现唯一的判定函数：

  | kind | 合法 | 非法示例 |
  |---|---|---|
  | `numeric` | `Number(value)` 有限 | `abc` |
  | `boolean` | `true`/`false`/`0`/`1`/`'0'`/`'1'` | `yes`（非 0/1） |
  | `date` | `Date.parse(value)` 有限，或为关键字 `CURRENT_DATE`/`CURRENT_TIME`/`CURRENT_TIMESTAMP`/`NOW()` | `2024-13-45` |
  | `text` | 恒合法 | — |
  | `none` | 恒合法（该类型不允许默认值，忽略） | — |

  空字符串、函数形式的默认值（`isFunction`）与字面量 `null` 一律视为合法（沿用 React `checkDefault` 的前置判断）。
- `relationship.circular` 沿用 React 的 DFS 环检测（`checkCircularRelationships`），同样只报告一次。
- 校验**永不抛错**：任何输入异常都降级为一条 `error` 级别的 issue。

### 4.2 `core/src/layout/` — 自动布局与关系推断

```ts
// auto-arrange.ts
export interface AutoArrangeOptions {
  nodeSep?: number;      // 默认 60（与 React 一致）
  rankSep?: number;      // 默认 110
  isolatedGap?: number;  // 默认 60
  direction?: "TB" | "LR"; // 默认 "TB"
}
export function autoArrange(
  tables: Table[],
  relationships: Relationship[],
  options?: AutoArrangeOptions,
): { x: number; y: number }[];   // 与输入等长的坐标数组，locked 的表不移动

// auto-relationships.ts
export function inferRelationships(
  tables: Table[],
  existing: Relationship[],
): Relationship[];   // 候选关系（不修改入参）
```

- `autoArrange` 端口自 React `utils/autoArrange.js`：只移动未 locked 的表，用 dagre 的 `graphlib.layout` 布局，孤立表按 `isolatedGap` 排布，关系方向决定 rank。
- `inferRelationships` 端口自 React `utils/autoRelationships.js`：候选字段名 `users_id` / `user_id` / `usersid` / `userid`（主键名非 `id` 时也接受裸主键名），跳过已存在的字段级与字段对级关系，基数按子字段是否 unique 决定。

### 4.3 `core/src/serialize/` — 图 JSON 导入导出

```ts
export interface DiagramJson {
  id?: string;
  title?: string;
  database: DatabaseType;
  sqlHeader?: string;
  tables: Table[];
  relationships: Relationship[];
  notes: Note[];
  subjectAreas: Area[];      // 旧版 drawDB 字段名
  types: CustomType[];
  enums: Enum[];
  views: View[];
  metadata?: Metadata;
}

export function exportDiagramJson(diagram: Diagram, options?: { pretty?: boolean }): string;
export function importDiagramJson(
  source: string | unknown,
  options?: { database?: DatabaseType; allowDatabaseOverride?: boolean },
): Diagram;                 // 失败抛 ImportError
```

**导入规则**（端口自 React `components/EditorHeader/Modal/ImportDiagram.jsx`）

1. 字符串先 `JSON.parse`；解析失败 → `ImportError`（code `json.parse_failed`）。
2. 形状校验（手写，不引入 `jsonschema`）：必须有 `tables` 数组；`relationships`/`notes`/`subjectAreas`/`types`/`enums`/`views` 缺省为空数组；缺 `database` 视为 `generic`。
3. 兼容旧版 `.ddb`：`references` → `relationships`、`areas` → `subjectAreas`。
4. 关系完整性：每条关系的 `startTableId`/`endTableId` 必须存在，`startFieldId`/`endFieldId` 必须存在于对应表；否则 `ImportError`（code `relationship.missing_table` / `relationship.missing_field`）。
5. 数据库不一致：默认抛 `ImportError`（code `database.mismatch`），`allowDatabaseOverride: true` 时以导入文件为准。

**错误模型**（core 内统一）

```ts
export class ImportError extends Error {
  readonly code: string;
  readonly diagnostics: { message: string; line?: number; column?: number }[];
}
```

SQL 与 DBML 的现有错误类型（`SQLImportError`、`DBMLParseError`）保持不变，SDK 统一捕获后转成同一个 `error` 事件与错误弹窗。

### 4.4 `core/src/commands/` — 命令补全

新增四个文件（而不是每个命令一个文件，避免命令数爆炸）：

| 文件 | 命令 |
|---|---|
| `field-commands.ts` | `AddFieldCommand`、`RemoveFieldCommand`、`MoveFieldCommand`、`UpdateFieldCommand`（迁入） |
| `relationship-commands.ts` | `UpdateRelationshipCommand`、`RemoveRelationshipCommand`、`AddRelationshipsCommand`（批量） |
| `table-commands.ts` | `ResizeTableCommand`、`ToggleTableLockCommand` |
| `collection-commands.ts` | `AddEntityCommand` / `UpdateEntityCommand` / `RemoveEntityCommand`（view/type/enum/area/note 共用，泛型到 `id` + 集合名） |

另加 `SetDiagramCommand`（标题/数据库/SQL 头）、`AutoArrangeCommand`（记录前后坐标，undo 还原）。

**约束**：所有命令实现 `execute/undo`，且 undo 能精确还原；命令不接受 reactive 代理（沿用 `utils/clone.ts` 的 `deepClone`，因为 `structuredClone` 不能克隆 Vue 代理）。

---

## 5. sdk 详细设计

### 5.1 画布：容器 + 图元 + 交互层

当前 `Canvas.vue`（321 行）与 `DrawDBEditor.vue`（484 行）超出 300 行约束，且要承载新交互，本阶段必须拆分。

`DrawDBEditor.vue` 的拆分为：`EditorLayout.vue`（布局与 Provider）、`EditorDialogs.vue`（弹窗宿主）、`use-editor-commands.ts`（菜单动作 → store 命令的映射）、`use-editor-plugins.ts`（插件装配），`DrawDBEditor.vue` 只保留 props/emits 与装配，控制在 250 行内。

```
components/Canvas/
├── Canvas.vue              容器：分层渲染 + 事件委派（≤ 200 行）
├── Table.vue               表容器（≤ 150 行）
├── TableHeader.vue         表头：名称、注释、颜色条
├── TableField.vue          字段行：名称、类型、主键/非空标记
├── FieldHandle.vue         字段行右缘的连线锚点
├── ResizeHandles.vue       右下角缩放手柄
├── Relationship.vue / LogicalRelationship.vue / Area.vue / Note.vue / View.vue / LogicalTable.vue
├── ContextMenu.vue         右键菜单（Naive UI NDropdown）
├── Minimap.vue             小地图
├── index.ts
└── interactions/
    ├── use-linking.ts      拖拽建关系的状态机
    ├── use-selection-box.ts 框选
    ├── use-resize.ts       缩放手柄
    └── use-context-menu.ts 右键菜单
```

**连线状态机**（`use-linking`）

1. `pointerdown` 在 `FieldHandle` 上 → `linking = { sourceFieldId, sourceTableId, pointer }`。
2. `pointermove` → 更新预览线端点（画一条虚线到光标）。
3. `pointerup`：
   - 落在目标**字段**上 → `AddRelationshipCommand`，`startFieldId` = 源字段，`endFieldId` = 目标字段；基数：源字段 unique → `one_to_one`，否则 `many_to_one`。
   - 落在目标**表体**上 → 目标表的主键字段（多主键时取第一个；无主键则报错并 toast）。
   - 落在空白 → 取消。
4. `Escape` 或 `pointercancel` → 取消。
5. 关系名沿用导入器的格式 `fk_<startTable>_<startField>_<endTable>`。

**字段排序**：表内字段列表用 `vue-draggable-plus` 包裹，`v-model` 不直接绑数据，而是在 `change` 事件里发 `MoveFieldCommand(tableId, fromIndex, toIndex)`，undo 还原顺序。

**缩放手柄**：`ResizeHandles.vue` 右下角 12×12 手柄，`pointerdown` 起 `resizing` 状态，`pointermove` 计算新宽高（最小 120×60），`pointerup` 发 `ResizeTableCommand`。

**右键菜单**：`Canvas.vue` 的 `contextmenu` 事件按命中对象分三种菜单（表 / 字段 / 空白），用 `NDropdown` 渲染，命令复用现有 store 动作。

### 5.2 侧边栏：完整编辑器

| Tab | 状态 | 目标 |
|---|---|---|
| Tables | 已可用 | 补：字段拖拽排序、颜色与注释、索引与唯一约束编辑 |
| Relationships | 已可用 | 补：起止字段选择、基数、on update/delete 动作 |
| Notes / Areas | 可用 | 补：颜色、尺寸、锁定 |
| **Views** | 列表桩 | **完整编辑器**：基础表、joins（表 + on 条件）、columns（表/字段/别名）、conditions（连接符/表/字段/运算符/值） |
| **Types** | 列表桩 | **完整编辑器**：类型名、注释、字段列表（名称/类型/默认值） |
| **Enums** | 列表桩 | **完整编辑器**：枚举名、取值列表（可增删改） |
| **Custom Types**（新） | — | 自定义类型（`customTypes` prop）的新增/编辑 |
| **SQL Header**（新） | — | 图级 SQL 头注释编辑 |
| **Issues**（新） | — | 质量问题列表：按级别分组，点击定位并选中对应表/字段 |

所有编辑都通过 `CommandManager`（既有约束），进入历史可撤销。

### 5.3 弹窗

| 弹窗 | 能力 |
|---|---|
| `SqlPreviewDialog.vue` | 切换 SQL / DBML；复制到剪贴板；下载为文件 |
| `ImportDialog.vue` | 粘贴或选择文件：SQL / DBML / JSON；显示解析错误与诊断（行/列）；导入前提示将覆盖当前图 |
| `ImageExportDialog.vue` | 导出 PNG：选择缩放倍数与背景色；导出中禁用画布交互 |
| `AutoRelationshipsDialog.vue` | 列出推断出的候选关系，勾选后批量建立 |

### 5.4 组合式与 store

- `composables/use-sortable.ts`：封装 `vue-draggable-plus` 的列表排序，提供 `sortableOptions` 与 `onSort` 回调。
- `composables/use-image-export.ts`：`exportPng(element, options)`；导出前给根节点加 `data-exporting` 属性隐藏交互层，导出后还原；失败抛 `ImageExportError`。
- `composables/use-fullscreen.ts`：`isFullscreen` / `toggleFullscreen()`（基于 `requestFullscreen`）。
- `composables/use-canvas-interactions.ts`：聚合 linking / selection-box / resize / context-menu 四个交互状态，供 `Canvas.vue` 使用。
- `stores/ui.ts` 新增：`contextMenu`（位置与目标）、`linking`、`resizing`、`selectionBox`、`isFullscreen`、`showMinimap` 的实际渲染开关。
- `stores/diagram.ts` 新增：本阶段新增命令的入口方法（`moveField`、`resizeTable`、`updateRelationship`、`removeRelationship`、`addView`/`updateView`/`removeView`、类型与枚举的增改删、`setSqlHeader`、`autoArrange`、`applyRelationships`）。

### 5.5 菜单与 i18n

- `Header/types.ts` 的菜单新增：导入、导出（SQL/DBML/JSON/PNG）、自动布局、推断关系、质量校验、小地图、全屏。
- i18n：51 个语言文件新增对应的键（英文为基准，其余语言按现有迁移脚本的「缺失则回填英文」策略处理）；`scripts/migrate-i18n.ts` 增加 `EXTRA_KEYS` 之外的增量同步流程。

### 5.6 独立应用（最小适配）

- 图表列表页：增加「导入 JSON」「导出 JSON」按钮。
- 设置页：增加「自动布局」「质量校验」入口。
- 模板页：沿用现有两个内置模板，不新增模板库。

---

## 6. 数据流与状态

- **单一真相源**：`stores/diagram.ts` 的 `diagram`（`reactive(createEmptyDiagram())`）。所有编辑 → Command → CommandManager → 变更 `revision` → 触发 `update:modelValue` / `change` 事件与自动保存。
- **撤销/重做**：沿用 v0.1.0 的 `CommandManager`；新增命令必须实现 `undo`。
- **校验**：不进入历史。`validateDiagram(diagram)` 是纯函数，Issues Tab 在 `revision` 变化时重新计算（computed）。
- **导入**：解析在 core 完成，成功后由 SDK 一次性 `setDiagram`（不产生历史条目，导入视作整体替换；可在后续阶段为导入增加「撤销导入」）。
- **受控模式**：沿用 v0.1.0 的 `modelValue` / `initialValue` 语义与「忽略回声」处理。

---

## 7. 错误处理

| 场景 | 行为 |
|---|---|
| SQL/DBML/JSON 导入失败 | 捕获 → 错误弹窗展示 `message` + `diagnostics`（行/列）→ `emit("error")`；当前图不变 |
| 关系端点缺失 | 导入时拒绝（`ImportError`），运行期由校验报 issue |
| 图片导出失败 | 捕获 → toast；`data-exporting` 属性必须已还原 |
| 自动布局失败（dagre 抛错） | 捕获 → 返回原坐标 + toast；不改图 |
| 关系推断无候选 | 空列表提示，不弹错误 |
| 插件抛错 | 沿用 v0.1.0：计入 `activateAll` 的 `failed`，`emit("error")` |
| 校验 | 永不抛错 |

---

## 8. 测试策略

沿用 v0.1.0 的 `node:test` + `scripts/run-tests.mjs`（单进程、无子进程、路径过滤前向斜杠归一）。

| 层次 | 方式 | 数量目标 |
|---|---|---|
| core validation | 纯函数单测：每条规则至少 1 例 + 边界（空图、环、重复名） | ≥ 30 |
| core layout | 布局不重叠、locked 表不动、推断候选与跳过已有关系 | ≥ 12 |
| core serialize | 导出→导入往返、旧 `.ddb` 字段名、非法 JSON、关系缺失、库不匹配 | ≥ 14 |
| core commands | 每个新命令的 execute/undo 对称性 | ≥ 20 |
| sdk 画布交互 | pointer 事件序列 → 断言命令入历史与 undo 还原 | ≥ 18 |
| sdk 侧边栏 | 挂载 + `data-testid` 断言（视图/类型/枚举编辑器） | ≥ 20 |
| sdk 弹窗 | 预览/导入/图片导出的成功与失败分支 | ≥ 10 |
| sdk 组件拆分 | 行数约束（≤ 300）与拆分后的渲染断言 | ≥ 6 |

**总计新增 ≥ 130 条**（下限 120）。现有 334 条必须持续通过。

**E2E**：`e2e/` 下的 Playwright 用例继续在 CI 运行（沙箱内无法启动浏览器），新增「画布连线」「字段排序」「自动布局」三条用例。

---

## 9. 约束与质量门槛

1. **无组件文件超过 300 行**（v0.1.0 计划既有约束，本阶段首次真正执行）→ 增加一条自动检查脚本 `scripts/verify-constraints.test.ts`。
2. 所有编辑走 `CommandManager`，undo 精确还原。
3. core 不依赖 Vue/Naive UI；新增 core 模块均为纯函数或纯数据变换。
4. TypeScript strict；`pnpm run typecheck` 覆盖 core/sdk/app/example/e2e。
5. i18n 键齐全（英文为基准，缺失回填英文）。
6. 不引入除 §2.3 三个依赖之外的新运行时依赖。
7. 每个任务结束时：测试通过 + 类型检查通过 + 计划里的任务状态被标注（`scripts/plan-status.mjs`）。

---

## 10. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 沙箱无法启动浏览器 | 图片导出、小地图等无法真机验证 | 单测用桩（断言调用与失败分支）；真实验证放 CI 的 Playwright |
| 沙箱 esbuild spawn 受限 | 新依赖若有构建步骤会失败 | 三个依赖均为纯 JS；安装用 `pnpm install --ignore-scripts` |
| 组件数量激增、维护成本上升 | 交付复杂 | 交互拆成 `interactions/` 下的纯逻辑 composable；组件只做渲染与事件转发 |
| 画布性能退化（新增交互层与字段拖拽） | 100+ 表卡顿 | 保持虚拟化（`use-virtualization`）；连线预览不触发重排；节流沿用 `use-canvas-events` |
| 自动布局改变用户手工布局 | 误操作 | 自动布局是可撤销命令，且提供确认 |
| i18n 51 语言同步成本 | 质量不齐 | 缺失回退英文；仅新增键，不改既有译文 |

---

## 11. 任务分解

| # | 任务 | 依赖 | 产出 |
|---|---|---|---|
| 21 | core 图质量校验（validation） | — | `core/src/validation/*` + 测试 |
| 22 | core 自动布局与关系推断（layout） | — | `core/src/layout/*` + 测试 |
| 23 | core 图 JSON 导入导出（serialize） | — | `core/src/serialize/*` + 测试 |
| 24 | core 命令补全 | 21–23 | `core/src/commands/*` + 测试 |
| 25 | sdk 画布拆分与交互层 | 24 | Canvas 组件重构 + interactions + 小地图 |
| 26 | sdk 表格内编辑与字段排序 | 25 | Table/TableField/FieldHandle/ResizeHandles + 排序 |
| 27 | sdk 侧边栏完整编辑器 | 24 | 视图/类型/枚举编辑器 + 4 个新 Tab |
| 28 | sdk 弹窗与导入导出 | 22,23 | 4 个弹窗 + 菜单接线 |
| 29 | sdk 全屏与图片导出 | 25,28 | 全屏 + PNG 导出 |
| 30 | sdk 质量问题面板 | 21,27 | Issues Tab + 定位跳转 |
| 31 | app 最小适配 | 25–30 | 图表列表导入导出 + 设置入口 |
| 32 | 文档、版本 0.2.0 与发布前验证 | 全部 | 报告、CHANGELOG、打包验证 |

详细的逐步实施计划见 `docs/plan-phase2.md`（由 writing-plans 产出）。

---

## 附录 A：与 React 版的行为对照

| 能力 | React 版位置 | 本阶段落点 |
|---|---|---|
| 拖拽建关系 | `EditorCanvas/Canvas.jsx` + `Table.jsx` | `use-linking` + `FieldHandle` |
| 字段排序 | `@dnd-kit/sortable` | `vue-draggable-plus` + `MoveFieldCommand` |
| 缩放手柄 | `EditorCanvas/ResizeHandles.jsx` | `Canvas/ResizeHandles.vue` |
| 右侧菜单 | `ControlPanel.jsx` 的菜单系统 | `Canvas/ContextMenu.vue` + `Header/types.ts` |
| 自动布局 | `utils/autoArrange.js` | `core/src/layout/auto-arrange.ts` |
| 关系推断 | `utils/autoRelationships.js` | `core/src/layout/auto-relationships.ts` |
| 图校验 | `utils/issues.js` | `core/src/validation/` |
| JSON 导入 | `EditorHeader/Modal/ImportDiagram.jsx` | `core/src/serialize/` + `ImportDialog.vue` |
| 数据导出 | `utils/exportSavedData.js` | `core/src/serialize/`（单图） |
| 小地图 | 设置项 `showMinimap` | `Canvas/Minimap.vue` |
| 图片导出 | `utils/exportAs/` | `composables/use-image-export.ts` |
