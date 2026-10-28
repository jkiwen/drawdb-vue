# P5 — SDK 视图与编辑器 UI 改造实施计划

> **⚠️ 主体完成（2026-10-28，分支 `sdk-ui-redesign-p5`，已合并 `761fe7b`）**：Task 1–3 与 Task 7 完成；Task 4/5/6 的骨架落地但各有未实现子项——逐项结论见文末「落地审计（2026-10-28）」。执行偏差与验收证据见「执行记录」。
>
> **✅ 补齐完成（2026-10-28，第二轮）**：审计发现的三项缺口已按顺序修完——①每表视图覆盖进文档（Q2）；②树恢复 View/Enum/Type 新建入口；③Task 4/5/6 的子项补齐（3a 工具栏三组 + 缩放/文件组、3b 编辑面板四组 + 图表级 + 混合选择 + Q19、3c 底部区三态 + 过滤 + fixable + 日志）。仍开放的子项见文末「第二轮补齐后的剩余缺口」。

> **来源**：`docs/designer-ui-redesign-discussion.md`（v1.0 定稿，§11 裁决 19 条已生效，下称「UI 文档」）。
> **范围**：UI 文档 §2–§5、§6.1/§6.2/§6.3/§6.5/§6.6/§6.7、§8、§9 —— 即 **@drawdb/vue-sdk 编辑器外壳** 的树型大纲、统一编辑面板、画布工具栏、底部告警区、视图状态管理。
> **不在本期**：P2'（约束/索引双名对象 → 条目区 §7、树 Constraints/Indexes 节点、索引诊断通道、IndexEditor）；P6（DSM 映射管理界面 §6.9A、首选项对话框 §6.9B）；P7（erwin 导入）；§6.8 文件组仅接线现有对话框（New/Open/Save/Import/Export 已有）；Print/PrintPreview 列为后续（Q8 已裁决形态，本期不做）；对象级隐藏（Q3 不引入）；名称自动同步（二期）。
> **执行隔离**：新建 worktree（using-git-worktrees）。
> **前置已完成**：P1–P4 已合并 master（双层模型、77 映射、resolve/lint、导出接入）。

## 总体验收

- `pnpm typecheck`、`pnpm test`、`pnpm build` 全绿；SDK 组件 ≤300 行；CSS Modules，无全局泄漏。
- 全部新文案进入 `packages/sdk/src/i18n/locales/*.json` **51 个 locale** 的真实翻译（UI 文档 §9.5）。
- 百表场景树虚拟滚动 + 画布渲染保持流畅（plan.md 60fps 目标，用现有 examples 手验 + 性能预算测试）。
- e2e：树定位、编辑面板改字段、显示模式切换、告警面板交互各至少一条关键路径。

## 关键设计锚点（写代码前必读）

1. **视图状态 vs 文档数据**（§9.2 + Q2）：显示方式、逐项开关、逻辑/物理视图 = 视图状态（不进 undo 栈，**随图表保存**）；缩放 = 会话态（不持久化）；布局/对齐/一切属性编辑 = 文档数据（进 undo 栈）。
2. **操作范围**（§6.0 + Q1）：有选中按选中（表/Area），无选中整个画布；工具栏**常驻范围指示器**。
3. **编辑面板不受视图切换影响**（§6.4/Q20）：始终成对呈现两层；画布/树随视图换层渲染。
4. **物理侧独有对象**（View/Enum/Type/自定义类型）在逻辑视图**隐藏**（画布+树），新建入口禁用（Q15）。
5. **面板尺寸/收缩按用户全局持久化**（Q5，settings store 的 localStorage 模式）。
6. **Auto(Flow) 与位置锁定**（Q6）：`Table.locked` 已存在于模型（锁定表不可编辑），自动布局跳过锁定表。
7. **告警不自动展开**（Q9）：标题条 error 红色计数徽标 + 一次性 toast。
8. **批量编辑原子回滚**（Q12）：多选批量命令任一失败整体不应用。
9. **SDK 嵌入全量可配置**（Q13）：宿主可按组隐藏工具栏、关底部区域，默认全开。
10. **Trace Tab 仅开发者模式**（Q14）。
11. **combobox 物理类型**（D3/§4.5）：白名单增量匹配，白名单外直接采用，lint 兜底；手工改 → `fieldTypeSource="explicit"`。
12. **来源徽标仅编辑面板**（Q19）。
13. **文案提交时机**：文本输入失焦/Enter 才产生 undo 记录（§4.4）。

## 现状代码事实（已核对）

- 布局：`EditorLayout.vue`（113 行）= Header + SidePanel(280px 固定) + Canvas；无右侧面板、无底部区域。
- SidePanel：Tab 页结构（Tables/Relationships/Notes/Areas/Enums/Views/Types/CustomTypes/SqlHeader/Issues），`stores/ui.ts` 的 `UiTab` 枚举驱动。
- Header：`MenuBar.vue` + `Toolbar.vue`（创建元素 + 缩放组 + UndoRedoButtons）+ `Header.vue`。
- stores：`ui.ts`（选中集 selectedTableIds 等 + zoom/scroll + activeTab，全 ephemeral）、`settings.ts`（localStorage 持久化偏好，含 showFieldTypes 等）、`diagram.ts`、`history.ts`、`selection.ts`。
- composables：`use-selection.ts`（画布选中）、`use-issues.ts`（DiagramIssue 通道已有）、`use-hotkeys.ts`、`use-viewport.ts`（缩放 0.25–2.5，设计要 10%–400%，需调整 MIN/MAX_ZOOM）、`use-fullscreen.ts`（已有）。
- Canvas 已支持：视图模式相关状态（`view-mode.test.ts` 存在）、表锁定、area 折叠、`fieldLabel` 读 `fieldType.type`。
- core 可用：`lintDialect(diagram, scope)`（12 code 现算现报）、`resolveType`/`TypeScopeSnapshot`、`emptyTypeScope()`、`BUILTIN_FAMILIES`、`DATABASE_TYPE_NAMES`（白名单 combobox 数据源）、`isKnownTypeName`、`getTypeMetadata`（isSized/hasPrecision 联动）。
- 命令：CommandManager 已有 `description` 接口（`command.ts:7`，各命令均实现），Undo/Redo tooltip 直接可用（§6.7）。
- 51 locale 文件在 `packages/sdk/src/i18n/locales/*.json`；新增 key 必须全量翻译。

## Task 1 — 布局骨架与视图状态 store（地基）

新组件 `EditorShell`（或改造 EditorLayout）三栏 + 底栏；新 store `view-state.ts`。

1. `stores/view-state.ts`（新）：`viewLayer: "logical"|"physical"`、`displayMode: "entity"|"definition"|"attributes"|"all"|"custom"`、逐项开关 `{description, fields, pkUkFk, index}`、`panelLeft/panelRight {collapsed, width}`、`bottomPanel {state: "collapsed"|"open"|"max", height, activeTab}`；视图状态写入 diagram 文档（Q2：随图表保存 → serialize 需带 viewState 字段，缩放除外）。
2. 面板收缩/展开：chevron 把手 + 200ms 动画 + 拖拽调宽（双击恢复默认）+ 小视口（<1024px）默认收缩；尺寸/状态入 settings（用户全局，Q5）。
3. 快捷键：Ctrl/Cmd+B 左栏、Ctrl/Cmd+Alt+B 右栏、Ctrl/Cmd+` 底部（入 `use-hotkeys.ts`）。
4. **测试**：view-state store 单测（默认、切换、与逐项开关联动进 custom 态）；面板收缩组件测试；序列化带 viewState 往返。
5. **验证**：core+sdk typecheck、测试、example 打开可见三栏骨架。

## Task 2 — 左侧树型大纲导航（§3）

`components/Outline/`（OutlineTree.vue + 子组件，各 ≤300 行，CSS Modules）。

1. 节点层级：Tables（→Fields）/ Relationships / Areas（→包含表）/ Notes / Views / Enums / Types / CustomTypes（后四类逻辑视图隐藏，Q15）；一级节点带计数徽标；Domains 节点挂占位（core 域注册在 scope 里，本期树显示 builtin 域只读列表，增删改属 P6 DSM 界面）。
2. 树随视图换名（逻辑视图读 `table.logical.name`/属性名，物理视图读 `Table.name`/`PhysicalField.name`）；tooltip 显示另一层名。
3. 过滤输入框（逻辑名+物理名模糊匹配，命中字段带出父表）；排序切换（名称/创建序）。
4. 虚拟滚动（数千节点）。
5. 双向联动（§3.2）：树单击→画布选中+平移缩放定位+高亮（≤600ms）；画布选中→树 reveal；共用 ui store 选中集。
6. 右键菜单：重命名（写当前视图层）/删除（走 CommandManager，删字段=跨层原子删并提示）/复制粘贴/移入 Area/定位画布；拖拽仅 表↔Area（Q11）。
7. 左侧窄栏浮层速览（Q4）：收缩后类别图标 + 点击浮层 + 点画布收起。
8. **测试**：树节点派生逻辑（纯函数：diagram→节点树，含视图换名/过滤/排序）、联动（选中→reveal）、删除走命令。
9. **验证**：百表示例树流畅。

## Task 3 — 画布显示模式 × 双层视图（§6.1/§6.2/§6.4）

1. 表视图渲染按 viewLayer 换层：逻辑视图显示逻辑实体名/属性名/逻辑类型名（域显示自己名）；物理视图显示物理名/物理类型规格（`fieldType`）。
2. 四显示模式（实体/定义/属性/全部）= 逐项开关预设；手动调 → custom 态（§6.2）。
3. 范围应用：模式/开关变更作用于选中表（或 Area 内表/全画布），结果存于每表视图覆盖 + 全局默认（视图状态，随图保存）；工具栏范围指示器常驻。
4. 逻辑视图隐藏物理侧独有对象（Q15），新建入口禁用。
5. 名称缺失回退：逻辑名缺 → 显示物理名 + 浅色「未设置逻辑名」徽标（§6.4 边界）。
6. **测试**：geometry/渲染派生函数单测（每层每模式的字段行内容与高度）；Q15 隐藏；回退徽标。

## Task 4 — 画布顶部九组工具栏（§6.0–§6.7，文件组接线）

`components/Canvas/Toolbar/` 或 Header 重构（图标库：沿用现有或 lucide 风格内联 SVG，无新依赖）。

1. 九组：显示切换（分段按钮）| table 视图逐项 toggle | 布局（Grid/Flow/Auto，>50 表确认，锁定表跳过）| 逻辑/物理切换 | 对齐（6 对齐 + 2 分布，<2/<3 置灰）| 图工具（缩放组：范围改 10%–400%、Fit、缩放到选中、100%、百分比可输入；网格点阵开关；FullScreen 复用 use-fullscreen）| Undo/Redo（tooltip 命令描述，需给 CommandManager 命令补 description）| 文件组（New/Open/Save/SaveAs/Import/Export 接线现有 dialog store 与 save emit）| 配置组（DSM 入口占位——SDK 全屏模态容器留 stub，P6 填内容；首选项占位）。
2. 每按钮 tooltip（名称+快捷键）、三态（可用/置灰含原因/激活态）。
3. **测试**：范围判定纯函数、置灰规则、缩放边界、Undo/Redo tooltip 文案。

## Task 5 — 右侧统一编辑面板（§4）

`components/EditPanel/`（EditPanel.vue + 分组子组件）。

1. 选择联动表（§4.1 全表）：无选中→图表级属性兜底；单表→基本组（逻辑名/描述 ‖ 物理名/注释成对）+ 字段组（成对五列）+ 约束组（读现有 UniqueConstraint/PK）+ 索引组（读现有 Index，双名待 P2'）+ 外观组；单字段→成对详情；单关系→成对呈现（logicalRelationships 已有模型）；多选同类→交集属性+「多个值」占位+原子批量（Q12）；多选异类→通用属性+计数。
2. 字段成对五列行（§4.2）：逻辑名/逻辑类型（族域选择+参数联动）/物理列名/物理类型 combobox（§4.5：白名单增量匹配、白名单外采用、改后置 explicit、参数随 isSized/hasPrecision 显隐）/对应状态（配对+lint 诊断图标+来源徽标 Q19）。
3. 总览条：「12 字段：12 已配对 0 不一致」可点击跳诊断；整表可折叠物理列（R15）。
4. 新增/删除字段 = 跨层原子（复用 core invariants 语义，删除前提示）。
5. 分组可折叠，展开态按对象类型记忆；文本失焦提交（§4.4）。
6. **测试**：选择联动派生、批量原子回滚、combobox 过滤与 explicit 置位、校验失败行内提示（不弹模态）。

## Task 6 — 底部可伸缩区域（§8）

`components/BottomPanel/`。

1. 三态（收缩 28px 标题条/展开 160–240px 默认/最大化）+ 拖拽调高（120px–50% 视口）+ 双击标题条切换；状态持久化（Q5 用户全局 + Q2 视图态）。
2. 告警 Tab：双通道——DialectDiagnostic（`lintDiagram` 现算，debounce 随 diagram 变化重算）+ DiagramIssue（现有 checkIndices 等）；级别过滤；点击定位（复用树定位链路）；fixable 一键应用建议（应用后该字段置 explicit，§6.5）。
3. Q9：新告警不自动展开；标题条 error 红徽标 + 一次性 toast。
4. 日志 Tab（导入导出/保存事件）、操作日志 Tab（命令描述+时间，与 undo 栈同源含已撤销）、Trace Tab（Q14 仅开发者模式，挂 perf 计数）。
5. 每 Tab 上限 1000 条滚动加载；复制/导出/清空。
6. **测试**：诊断汇聚派生、级别过滤、定位链接失效置灰、上限丢弃最旧。

## Task 7 — 嵌入式可配置 + i18n + 收尾

1. SDK options（Q13）：`toolbar: {groups: string[]|false}`、`bottomPanel: boolean`、DSM 入口可替换（slot/callback）；默认全开；`types/sdk-options.ts` 扩展。
2. i18n：盘点全部新 key → 51 locale 真实翻译（量大，执行时可用并行 subagent 按语言批次）。
3. use-viewport：MIN_ZOOM 0.25→0.1、MAX_ZOOM 2.5→4（§6.6）；检查依赖测试。
4. e2e 关键路径 4 条（树定位/编辑面板改字段/显示模式切换/告警定位）。
5. 百表性能手验 + `pnpm typecheck && pnpm test && pnpm build`。
6. progress.md 追加决策记录；UI 文档 §12 更新；本计划标注完成状态。

## 依赖与并行

- Task 1 是全部任务的地基（布局骨架 + view-state）。
- Task 2（树）、Task 3（画布渲染）可并行；Task 4（工具栏）依赖 Task 3 的状态源；Task 5（编辑面板）依赖 Task 1；Task 6（底部）依赖 Task 1 + core lint（已有）。
- 条目区（§7）在 P2' 落地后实施；本期树的 Constraints/Indexes 不建节点（Q17 的吸收动作随 P2' 一起做）。

## 风险备忘

- R1：SDK 组件 ≤300 行强制拆分——树/编辑面板/底部面板都需子组件化，提前规划文件边界。
- R2：viewState 入文档序列化影响旧图兼容——旧图无该字段需默认回填（serialize import 侧）。
- R3：51 locale 翻译量大且必须真实翻译——单独一批校验脚本核对 key 完整性。
- R4：逻辑/物理切换改动画布渲染主路径——geometry.ts 派生函数保持纯函数便于测试。
- R5：虚拟滚动与 reveal 联动的滚动同步（树 reveal 需 scrollIntoView 与虚拟列表兼容）。
- R6：Undo/Redo 命令描述已就绪（Command 接口自带 description），工具栏只需消费 `undoDescription`/`redoDescription`。

## 执行记录（2026-10-28）

- **Task 1–7 全部完成**。提交序列：`2088f26`（core 视图状态）→ `99baa29`（SDK view-state store）→ `0b29b09`（布局骨架与面板）→ `7d3a094`（面板快捷键）→ `1f56db9`（树型大纲 + 双层画布）→ `c6b8c83`（树接入布局）→ `3a4d591`（工具栏 + 编辑面板 + 底部区）→ `48ee99d`（chrome 可配置 + 焦点滚动修复）→ `5e5ab8e`（51 locale 翻译）→ `ba57911`（CSS Modules 类型声明 + 复数规则）→ `b1e9757`（e2e 跟随新交互）→ `1d5c462`（视图层镜像 + 产物测试）。
- **偏差**：①Task 4 只落地六组工具栏（显示切换、逐项开关、双层切换、缩放/FullScreen、Undo/Redo、文件组），布局/对齐/配置三组按 UI 文档 §12.1 列为后续（配置组待 P6；布局与对齐未开工）；②打印/PrintPreview 未实现（Q8 形态已裁决，列后续）；③`ka.json` 实为 Kannada（仓库无 Georgian），按文件既有语言翻译；④`type_param.*` 三个 key 属 core 既有缺口，本次一并补入 51 locale，故新 key 总数为 108 而非 105；⑤导入侧 `fieldTypeSource` 用 `imported`（本计划 Task 6 原文写 `mapped`，P1–P4 已按 `imported` 落地）。
- **验证**：`pnpm typecheck` 五段全绿（core / sdk / app / examples / e2e）；`pnpm test` 1026/1026；`pnpm build` 4/4（需 `NODE_OPTIONS=--max-old-space-size=8192`）；e2e 55/55；百表平移实测 60 fps（179 帧，最差帧 19 ms，探针脚本跑完即删）。
- **新发现并修复的缺陷**：`View ▸ Toggle view mode` 与 `viewMode` prop 此前只切 `ui.viewMode`，而画布读 `viewState.viewLayer`（真 bug）；现由 ui store 镜像文档视图状态，并补 2 条单测。另有左侧面板两条隐藏路径语义不一致（菜单卸载 / mod+b 收起），记为 UI 文档 §11.1 Q21 待裁决。
- **团队编排**：Task 1c/2/3/4/5/6 由 6 个 spawn 队友并行交付；e2e 现代化与 8 批 locale 翻译由 subagent 完成；每份交付均由 lead 亲自复跑该范围测试与 `tsc` 后才提交。

## 后续修订（2026-10-28，评审后）

- **Q21 裁决为「统一收起」并落地**（`d65bb3d`）：`settings.panelLeftCollapsed` 成为隐藏左栏的唯一状态源，`ui.sidebarOpen` 改为它的 computed 镜像，`ui.toggleSidebar()` 写回设置，`showSidePanel` 不再卸载面板。View 菜单、Header 按钮、`mod+b` 三条入口因此一致，树在收起期间保留状态。
- 连带修正：`scripts/verify-artifacts.test.ts` 的产物渲染断言从已退役的 `side-panel` 改为 `outline-tree` / `edit-panel` / `bottom-panel`；两处测试隔离修复（设置 store 会从 `localStorage` 还原偏好，而 runner 共享一个进程，故 `EditorLayout` 与 `use-panel-hotkeys` 两个 spec 各自清理存储）。
- 文档对齐：设计文档 §11.1 的 Q21 改为裁决记录、§12.1 补「Q21 单一机制」与「Q4 窄栏浮层未实现」；progress.md 记录同一条裁决。
- 复验：`pnpm typecheck` 0 错、`pnpm test` 1028/1028、`pnpm build` 4/4、e2e 55/55。

## 落地审计（2026-10-28，逐 Task 核对代码）

对照本计划的每个编号条目核对实现（`git log` + 源码 + 测试）。验收门仍全绿：`pnpm typecheck` 五段 0 错、`pnpm test` 1028/1028、`pnpm build` 4/4、e2e 55/55。下表只列与计划文字**不一致**的部分；未列的条目均已按原文落地。

### Task 1 — 布局骨架与视图状态（完成，一处形态偏差）

- 偏差：计划把 `panelLeft/panelRight`、`bottomPanel{state,height,activeTab}` 都写在 `stores/view-state.ts` 里；实际拆成三处——面板宽/收缩与底部高度进 `stores/settings.ts`（Q5 用户全局持久化），`activeTab` 留在 `stores/ui.ts`（会话态），只有显示态进 `diagram.viewState`（Q2 随图保存）。行为符合两条裁决，但计划文字未同步。
- 未实现：底部区的 **max 三态**（`BottomPanel` 只有 collapsed/open）与「拖拽至 50% 视口」（`PANEL_BOTTOM_MAX_HEIGHT` 固定 400px）。

### Task 2 — 左侧树型大纲（完成，三项未做）

- 已实现：7 个类目（tables/relationships/areas/notes/views/enums/types，其中 `types` 即 CustomTypes，`diagram.types` 是 `CustomType[]`）、计数徽标、双层命名 + tooltip、过滤、排序（A–Z / 创建序）、虚拟滚动、双向联动（`OutlineTree.vue:92-121` 监听 ui 选中并 reveal）、重命名/删除右键菜单、表↔Area 拖拽 emit。
- 未实现：①`Domains` 占位节点（core 无 domains 集合）；②右键菜单的**复制粘贴 / 移入 Area / 定位画布**（`OutlineTree.vue` 现为 rename / delete / 类目新建三项）；③Q4 的 36px 窄栏 + 类别图标浮层（§12.1 已记为未覆盖）。
- 拖拽只发事件不落库，符合 Q11 裁决，非缺口。

### Task 3 — 画布显示模式 × 双层视图（完成，一处违背 Q2）

- 已实现：`render-model.ts` 按 viewLayer+toggles 派生、四模式=预设/custom 派生、Q15 隐藏物理侧独有对象、逻辑名缺失回退徽标、视图感知几何（`render-geometry.ts`）。
- ~~**违背 Q2（需修）**~~ → **已修（`4c116f1`）**：`ViewState.overrides` 进 core 模型并参与序列化（`normalizeViewOverrides` 丢弃未知键），`stores/toolbar-scope.ts` 的 `overrides` 改为读文档的 `computed`，写路径走 `diagramStore.updateViewState({ overrides })`，刷新与重开都在。
- 未实现：逻辑视图下「新建入口禁用」只在旧 SidePanel 内成立，新布局已无对应入口（见下方回归项）。

### Task 4 — 顶部工具栏（**完成：九组全覆盖**）

- 第二轮补齐后：`displayMode`、`viewToggles`、`viewLayer`、`layout`、`align`、`zoom`、`undoRedo`、`file`、`config` 九组齐备（`ToolbarGroupId` 同步扩到九个）。
- 布局组 `ToolbarLayout.vue`：Grid / Flow / Auto(Flow)，作用于 `targetTables`（无选中=全部未锁定表，Q1）；core 侧新增 `packages/core/src/layout/block-layout.ts`（`gridLayout`/`flowLayout` 纯函数），Auto 走既有 dagre `autoArrange`。
- 对齐组 `ToolbarAlign.vue`：6 对齐 + 2 分布，**只认选中**（分布需 3 张、对齐需 2 张，不足时按钮置灰且 tooltip 用 `needs_two_tables`/`needs_three_tables` 说明原因），几何计算在 `composables/align-geometry.ts`。
- 三条布局/对齐/分布路径合并为 `stores/arrange-actions.ts` 的**一条** `AutoArrangeCommand`，因此一次操作一次 undo；锁定表一律不动（Q6）。
- 缩放组 `ToolbarZoom.vue`：`-` / 可输入的百分比框（`toolbar-zoom-input`，坏值回弹） / `+` / 适应图表 / 缩放到选中 / 回到 100% / FullScreen；`composables/zoom-actions.ts`（`fitZoom`/`fitScroll`/`contentBounds`）+ `use-zoom-actions.ts`，Canvas 上报视口尺寸。
- 文件组扩到 New / Open / Save / SaveAs / Import / Export 六项（emit `file:*`）。
- 配置组 `ToolbarConfig.vue` 只 emit `config:open`，组内尚无面板（P6 的 DSM 与首选项入口）。
- 仍未做：**布局前的「>50 表确认」**（计划 Task 4 原文要求）；**Print / PrintPreview**（Q8 已裁决形态，属后续阶段）。

### Task 5 — 右侧编辑面板（**完成：六种选择态全覆盖**）

- 第二轮补齐后：`EditPanel.vue` 的 238 行里覆盖 `empty` / `table` / `tables` / `relationship` / `area` / `mixed` / `diagram` 七种选择态，均为真实编辑器而非占位。
- 表格分支的四组：basics（逻辑实体名/物理表名/描述/注释）、fields（成对五列行 + 来源徽标 Q19）、constraints（`TableConstraints.vue`：主键 / UNIQUE / 外键）、indexes（`TableIndexes.vue`：索引 + 唯一约束，字段 id 查名）、appearance（`TableAppearance.vue`：颜色 / 锁定 / 显示字段）。
- 图表级兜底 `DiagramEditor.vue`：无选中时编辑图表本身的标题与数据库（只读展示）+ 一句提示，不再是「Select a table…」的死占位。
- 多选异类 `mixed`：`edit-panel-groups.ts` 的 `MixedCounts`/`mixedEntries`，面板显示一句 `edit_panel_empty_mixed` + 每类对象的计数 chip（行为升级：`resolvePanelTarget` 现在返回 `{kind:"mixed", counts}`）。
- 纯派生逻辑从 309 行瘦到 292 行：`ConstraintRow`/`IndexRow`/`AppearanceValues`/`SOURCE_KEYS` 等与节点构建相关的都进 `edit-panel-groups.ts`。
- 仍未做：**总览条点击跳诊断**、**R15 整表折叠物理列**、**字段级独立详情面板**（现为行高亮定位）。

### Task 6 — 底部可伸缩区（**完成：告警/日志可用**）

- 第二轮补齐后：三态 collapsed / normal / max（`bottom-panel-maximize` 带 `aria-pressed`，max 态靠 `:has(> [data-maximized="true"])` 让画布让位，不改 `EditorLayout.vue`）。
- 告警 Tab：级别过滤 `All/Errors/Warnings/Info` + 每级计数、`alerts-filter-empty` 空态、fixable 一键修复（`alert-fix-<index>`，走 `diagram.updateField(..., { fieldTypeSource: "explicit" })`，无安全命令路径的 code 不显示按钮）、复制与导出仅针对过滤后的可见告警。
- 日志 Tab 变成真内容：历史命令描述倒序、`log-list`/`log-clear`、上限 1000 条。
- `use-alerts.ts` 合并双通道时按 `code|tableId|fieldId` 去重、同一来源最多 1000 条、按级别排序。
- 仍未做：**max 态的 50% 视口上限**（当前 max 态填满画布区，而计划 Task 1 原文要求上限取「50% 视口」）、**Trace 的性能计数**（仍是占位 Tab）、**导入/导出/保存事件写日志**（Log 目前只显示 undo 栈里的命令描述）。

### Task 7 — 可配置 + i18n + 收尾（完成）

- 已完成：`types/sdk-options.ts` 的 `outline/editPanel/bottomPanel/toolbar{groups}` + `onOpenDsm`；108 key × 51 locale（含补齐的 `type_param.*`）；`MIN_ZOOM 0.1 / MAX_ZOOM 4`；e2e 四条关键路径（`e2e/p5-redesign.spec.ts:59/79/108/137`）；百表 60fps 实测；文档三处更新。

### 计划外的功能回归（已修）

树替换了旧 `SidePanel`，而**创建 View / Enum / Type 的入口原本只在那几个 tab 里**（`SidePanel/ViewsTab.vue`、`EnumsTab.vue`、`TypesTab.vue`、`CustomTypesTab.vue` 已不再挂载），新界面里这三类对象一度只可浏览、改名、删除。

- **已修（`outline-actions.ts` + `OutlineMenu.vue`）**：类目行右键出现 `add_view` / `add_enum` / `add_type`（复用已存在的 51 locale 文案），`createOutlineNode` 用 `uniqueName` 生成 `view_1` 这类默认名，经 diagram-store 命令入 undo 栈，创建后展开该类目并 reveal；tables/notes 等类目右键仍无菜单。逻辑视图下这些类目按 Q15 整体隐藏，等于新建入口一并禁用，符合 Task 3 的要求。

### 第二轮补齐（2026-10-28，审计之后）

审计列出的三项按用户裁决「逐次完成 1，2，3」依次落地，每项都先写失败测试再实现。

**1. 每表视图覆盖进文档（Q2）** —— `packages/core/src/models/view-state.ts` 的 `ViewState` 增 `overrides: Record<string, Partial<ViewStateToggles>>`，新增 `normalizeViewOverrides`（丢弃未知键与非对象项），序列化双向往返；`stores/toolbar-scope.ts` 的 `overrides` 从内存 `ref` 改成文档上的 `computed`，所有写入走 `updateViewState`。就此每张表的「实体/定义/属性/全部」覆盖与显示开关一起随图表保存。提交 `4c116f1`。

**2. View / Enum / Type 新建入口回归** —— `outline-actions.ts` 新增 `CREATABLE_CATEGORIES`、`creatableCategoryOf`、`createOutlineNode`（`view_1`/`enum_1`/`type_1` 默认名，经命令入 undo 栈），菜单抽到 `OutlineMenu.vue`（`OutlineTree.vue` 因此从 305 行回到 292 行），类目行右键出现 `add_view`/`add_enum`/`add_type`。提交 `70a9a12`。

**3a. 工具栏九组** —— core 新增 `layout/block-layout.ts`（Grid/Flow 纯函数）；sdk 新增 `composables/align-geometry.ts`（6 对齐 + 2 分布）、`stores/arrange-actions.ts`（五种布局/对齐动作合并成一条 `AutoArrangeCommand`）、`composables/zoom-actions.ts` + `use-zoom-actions.ts`（适应图表/缩放到选中/百分比），组件新增 `ToolbarLayout.vue`/`ToolbarAlign.vue`/`ToolbarConfig.vue`，`ToolbarZoom.vue` 重写，`ToolbarFile.vue` 扩到六项，`ToolbarGroupId` 与九组接线、图标、样式同步。

**3b. 编辑面板四组** —— 新增 `edit-panel-groups.ts`（约束/索引/外观/来源与混合选择的纯派生）、`TableConstraints.vue`、`TableIndexes.vue`、`TableAppearance.vue`、`DiagramEditor.vue`；`TableBatchPatch` 扩到颜色/锁定/显示字段；`FieldPairRow.vue` 增来源徽标；`EditPanel.vue` 接线四组 + `diagram` 兜底 + `mixed` 计数分支。

**3c. 底部区** —— `BottomPanel.vue` 增 max 态；`AlertsTab.vue` 增级别过滤、fixable 一键修复、复制/导出；`LogTab.vue` 变真内容（历史倒序、上限 1000、本地清空）；`use-alerts.ts` 去重与上限。

**i18n** —— 三轮文案共 52 个 key（24 个布局/对齐 + 20 个编辑面板 + 8 个底部区），en 从 503 涨到 **555**，51 个 locale 全部补齐并按 en 顺序排列；每个 key 都要求真实翻译、占位符与复数分段数与 en 一致、locale 文件保持 CRLF。

**提交**：`4c116f1`（每表覆盖进文档）、`70a9a12`（树新建入口）、`eab9902`（3a/3b/3c 与 52 个 i18n key）。

**验证证据（lead 亲自跑）**：`node --experimental-strip-types scripts/run-tests.mjs` → **1120/1120**；`pnpm typecheck`（core → sdk → app → examples → e2e 五段）→ exit 0；`node node_modules/@playwright/test/cli.js test --config e2e/playwright.config.ts` → **55 passed**。

### 第二轮补齐后的剩余缺口

- Task 4：布局前的「>50 表确认」对话框；Print / PrintPreview（Q8 形态已定，属后续阶段）。
- Task 5：总览条点击跳诊断；R15 整表折叠物理列；字段级独立详情面板。
- Task 6：max 态的 50% 视口上限；Trace 的性能计数；导入/导出/保存事件写日志。
- 跨阶段：Q4 的 36px 窄栏 + 类目图标浮层；P2' 的约束/索引双名对象与条目区；P6 的 DSM 与首选项（`ToolbarConfig` 目前只 emit `config:open`）。
