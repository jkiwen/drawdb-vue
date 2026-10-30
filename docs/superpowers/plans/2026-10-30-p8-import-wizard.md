# P8 — the import wizard, the merge and the audit

**Status:** 未开始（2026-10-30）
**设计稿：** [`docs/import-and-merge-design.md`](../import-and-merge-design.md)（裁决 Q1/Q2/Q3 已写入 §10）

## 目标

把「解析一段文本然后替换整张图」改成一条可校验、可决策、可回溯的流水线：

- 四个入口（菜单 / 工具栏 / 拖拽 / 宿主 API）都进同一个向导；
- 解析 → 结构 → 语义 → 合并预检四级门禁，阻断项必须处理；
- 用户决定导入到**新图**还是**当前图追加合并**，冲突**逐项裁决**（无默认）、表**可按需勾选**、域**确认才注册**；
- 一次导入 = 一条可撤销的历史 + 一份 `ImportSession` 审计（随图序列化、可导出、可对照）。

## 关键设计锚点

- **三个纯函数一个写入口**：`buildImportSource` / `planImport` / `applyImport`；只有 `applyImport` 写文档，写一次历史（`ImportCommand`，描述如 `Import erwin XML (append 12 tables)`）。
- **合并时全部 id 重建**：一次 `remapDiagram(source, idMap)` 覆盖 `IndexColumn.fieldId`、`UniqueKey.columns`、`Relationship.startFieldId/endFieldId/fields[]`、`ForeignKey.relationshipId`、`LogicalAttribute.fieldId`、`View.baseTableId`。
- **宽松但不静默**（延续 P7）：修复模式下阻断项转 `ImportSkip` 并写图的 `invalidMarkers`，图仍可打开。
- **Q1**：冲突不预选、未决策则不能继续；批量动作是显式按钮。
- **Q2**：②/④ 均可按表勾选；未选表的列/键不导入，跨向未选表的关系记 `info` 跳过。
- **Q3**：域随图进入 `Diagram.domains`（图级自定义逻辑类型，见 P7 裁决）；若还要把它们注册进 SDK 的 `type-scope` application 层，则在报告里逐个勾选、默认不勾。同名域之间的冲突另按 2026-10-30 裁决由用户逐项选（见文末「追加裁决」）。
- **大图**：`applyImport` 只做一次整份快照（`before/after`），不为每个对象单独建命令；>500 表时用分块进度（P8c）。

## 现状代码事实

- `packages/sdk/src/components/Dialogs/ImportDialog.vue`：`apply()` 手工分派 `importSQL(src, database)` / `importErwinXml(src, {database})` / `parseDBML(src, {database})` / `JSON.parse`；`confirmImport()` → `diagram.setImportedDiagram(parsed)`。
- `packages/sdk/src/stores/diagram.ts:84-93` 的 `setDiagram()` 会**逐键删除再 assign 并 `history.clear()`** —— 替换不可撤销，这正是要改掉的。
- `packages/sdk/src/composables/editor-menu.ts:71-79` 只有 `file:import-sql` / `file:import-json` / `file:import-erwin`；`packages/sdk/src/components/Toolbar/ToolbarFile.vue:23` 的 `file:import` **没有 case**（按钮是死的）；`Header/types.ts:30-32` 没有 DBML 导入项。
- 导入器签名：`importSQL(sql, database, options)`；`parseDBML(source, { database, title })`；`importDiagramJson(source, options)`（JSON 坏时抛 `ImportError("json.parse_failed")`）；`importErwinXml(source, options) → { diagram, report }`。
- 校验入口：`packages/core/src/validation/index.ts` 导出 `validateDiagram`（`DiagramIssue[]`，`ValidationOptions.severity` 是等级下限）、`lintDialect`（12 个 `DialectDiagnostic`）、`isDefaultValid`、`resolveDefaultKind`；`packages/core/src/models/invariants.ts` 有 `validateTableInvariants` / `validateRelationshipInvariants`；`packages/core/src/validation/key-rules.ts` 有 `checkKeys`。
- 位置工具：`packages/sdk/src/utils/placement.ts` 的 `centreOfViewport` / `placeAt` / `cascadeShift`；视口测量走 `composables/canvas-viewport.ts` 的 `measureViewport()`。
- 类型作用域：`packages/sdk/src/stores/type-scope.ts` 的 `registerDomain(domain, at = "application")`（按名字键控）、`replaceLayer`、`getSnapshot`。
- 序列化：`packages/core/src/serialize/{types,export,import}.ts` 三处需携带 `Diagram.imports`。

## 任务（TDD：先写失败测试，再实现）

### Task 1 — 来源读取
`packages/core/src/import/types.ts`（`ImportFormat`、`ImportSource`、`ImportIssue`、`ImportSkip`、严重度）与 `source.ts`（`buildImportSource(raw, options) → ImportSource`）。
测试 `import/source.test.ts`：四种格式各自成功；解析错误被收成 `{level:"error", code}` 而不是抛出；计数正确；erwin 的 `report` 原样带出。

### Task 2 — 验证门禁
`packages/core/src/import/validate.ts`：`validateImport(source) → ImportIssue[]`，合并结构不变量、`checkKeys`、`validateDiagram`、`lintDialect`；`blockingIssues(issues)`；`repairMode(issues) → ImportSkip[]`。
测试：坏索引列报 `index.unknown_field` 且算阻断；无主键只算 warning；方言不可表达算 warning；修复模式把阻断项转 skip。

### Task 3 — 合并计划
`packages/core/src/import/plan.ts`：`planImport(source, target, decisions) → ImportPlan`，含目标判定（空图/非空/只读）、冲突探测（表/列/键/关系/便笺区域）、表勾选过滤、域勾选、域冲突（`domainConflicts()` 的 `DomainConflict`）与用户裁决（`DomainDecision`）、`status: "ready" | "blocked"`（Q1：有未决策冲突即 blocked）。
测试：空图推荐 current；非空图列出冲突且 `blocked`；逐项决策后 `ready`；未勾选的表不进 `adds`，跨向关系记 info。

### Task 4 — 合并执行与重映射
`packages/core/src/import/apply.ts`：`remapDiagram(source, idMap)`、`applyImport(target, plan) → { diagram, session }`（不改入参，返回新文档）。
测试：追加 12 表后现有对象 id 不变、导入侧 id 全变；键/索引/关系/`foreignKeys` 的引用全部指向新 id；PK 冲突时保留现有主键并记 warning。

### Task 5 — 历史与审计
`packages/core/src/commands/import-command.ts`（`ImportCommand(diagram, before, after, label)`）；`packages/core/src/import/audit.ts`（`buildImportSession(...)`）；`Diagram.imports?: ImportSession[]` + 序列化三处往返。
测试：undo 精确回到导入前；`imports` 往返；旧档缺省为空数组。

### Task 6 — 向导 ①②（来源与报告）
`packages/sdk/src/components/Import/ImportWizard.vue` + `ImportSourceStep.vue` + `ImportReportStep.vue` + `import.module.css`。
测试：四格式入口；报告按级别筛选、计数、导出；域勾选默认不勾并影响 `plan`；同名域有冲突且未裁决时 `status === "blocked"`，补齐 `DomainDecision` 后变 `ready` 且 `mergeDiagramDomains()` 的 `undecided` 为空。

### Task 7 — 向导 ③④⑤（目标、冲突、执行）
`ImportTargetStep.vue`（空/非空/只读三种盘点 + 新图/当前图/替换三选）、`ImportConflictStep.vue`（无默认、未决策禁用下一步、表勾选）、`ImportApplyStep.vue`（执行、结果、`import-result-focus` 选中并居中、`import-result-audit`）；`packages/sdk/src/stores/import-session.ts`（Pinia store 承接向导状态）。
测试：非空图默认追加且提示未保存修改；未决策时 `import-next` 禁用；执行后 `history.canUndo` 为真且 undo 回到导入前；结果页聚焦新表。

### Task 8 — 入口接线、i18n 与收尾
- `editor-menu.ts` 合并为 `file:import`（无格式）+ 保留四种带格式的键；`Header/types.ts` 增 **Import DBML**；`DrawDBEditor.vue` 的 `onMenu` 打开向导；画布 `drop` 监听（`.sql/.dbml/.json/.xml`）；SDK options 增 `onImport?: (request) => boolean`（宿主接管）。
- `Dialogs/ImportDialog.vue` 退役（向导取代），迁移其测试。
- i18n：`import_*` 新键写入 en，按既有流程落到 51 个 locale。
- 文档：设计稿 §10 裁决记录、`progress.md`、`docs/designer-ui-redesign-discussion.md` §12.10。
- 门禁：五个 typecheck 程序、`run-tests.mjs`、e2e、`turbo run build`。

## 风险与取舍

1. **`ImportCommand` 的整份快照**：>500 表时一次深拷贝约 10–20 MB，P8b 先接受；P8c 再评估增量 patch。
2. **e2e 影响**：现有 `dialogs.test.ts` 的导入用例全部要迁到向导；`storage.spec.ts` 的 JSON 导入也要改路径。
3. **300 行守卫**：向导必然拆成 4 个步骤组件 + `import.module.css`；`DrawDBEditor.vue` 已接近上限，入口接线优先放进 `composables/`。
4. **不弱化断言**：迁移测试时保留原有用例的语义（如"导入后图里有 1 张表"），只是换入口。

## 追加裁决（2026-10-30）：域名冲突由用户裁决，没有优先级规则

评审裁定：两个图各自定义了同名域时，**不冲突的部分直接合并，冲突的部分交用户在向导里逐项裁决**（`DomainDecision{name, kind, database?, side}`），不存在「图内优先」或「导入优先」的规则。`packages/core/src/import/domains.ts` 已按此实现：

- `domainConflicts(mine, theirs)` 列出族 / 参数 / 同方言规格三类冲突；
- `mergeDiagramDomains(mine, theirs, decisions = [])` 只合「一致或仅一侧有」的部分，每条未裁决的冲突进 `undecided`；`undecided` 非空时**不得**应用合并；
- `idMap` 把导入侧域 id 重指到合并后的域，`notes` 记录自动补入的方言。

Task 3 要把 `undecided` 原样带进向导的决策步（未清空则下一步禁用），Task 4 的 apply 消费 `idMap` 与 `decisions`，并在报告里带上 `DomainMergeNote` 与最终的裁决记录。
执行偏差记录

（执行期填写）
