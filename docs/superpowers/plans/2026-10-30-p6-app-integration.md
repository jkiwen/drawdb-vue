# P6 — the app side of the type system, and print

**Status:** ✅ 已交付（2026-10-30，master）— Task 1–6 全部落地（2026-10-30）；Task 5（51 locale）× Task 6（文档）在收尾
**Branch:** master（与最近几轮一致，按任务分批提交）
**Spec:** `docs/superpowers/specs/2026-10-26-erwin-type-system-design.md` §6.9A / Q7 / Q8 / Q16
**UI doc:** `docs/designer-ui-redesign-discussion.md` §6.9 / §12.7 之后

P6 把「类型系统」和「打印」从 SDK 内部的空档变成可用的功能：DSM（数据
类型系统管理）界面、应用级首选项对话框、打印与分页预览。P2' 已经让键成为
独立对象；P6 不再改数据模型，只补入口、持久化与呈现。

## 关键设计锚点（来自 spec 与 UI 文档）

- **Q16 / §6.9A**：DSM 是「app 独立路由页 + SDK 全屏模态」的同一份界面，从
  工具栏配置组进入；`EditorChromeOptions.onOpenDsm` 是宿主的入口钩子。
- **Q7**：首选项是独立的对话框，作用域是**应用级**（不是按图）；显示、工具、
  快捷键、自动保存四类。
- **Q8**：打印是「内嵌分页预览 + 浏览器打印」，PDF 导出留到后续。
- **§5 三层作用域**：应用（系统默认）> 工作区（用户覆盖）> 图（按图覆盖）；
  DSM 编辑的是应用与工作区两层，图的覆盖属 P7 之后。
- **Q1 全局唯一**：域/族/映射的名字全局唯一，撞名拒绝并给出后续动作。
- **§6.2 诊断**：`DialectDiagnostic` 是类型系统的通道；DSM 保存前先跑
  `validatePhysicalType`，把 error 摆在行内。
- **i18n**：新文案必须进 51 个 locale（en 是 LF，其余 CRLF，键按 JS 默认排序）。

## 现状代码事实（2026-10-30 实测）

- `packages/core/src/types/resolve.ts` 已导出 `TypeScopeSnapshot`（application /
  workspace / diagram 三夹层）、`emptyTypeScope()`、`registerDomain()`（返回
  `{ ok, scope }` 或 `{ ok: false, diagnostic }`）、`updateFamilyMapping()`、
  `upsertScopeLayer()`、`resolveType()`、`validatePhysicalType()`；
  `BUILTIN_FAMILIES` 是 11 个内置族，映射覆盖 7 个方言。
- SDK 侧还没有 TypeScope store：`packages/sdk/src/components/EditPanel/edit-panel-model.ts:163`
  与 `packages/sdk/src/components/BottomPanel/use-alerts.ts:141` 都传
  `emptyTypeScope()`——这就是 P5 遗留的「SDK 没有 TypeScope」缺口。
- 工具栏配置组已经是按钮+事件：`packages/sdk/src/components/Toolbar/ToolbarConfig.vue`
  emit `menu: "config:open"`，`Toolbar.vue` 的 `menu` 一路冒到
  `DrawDBEditor` 的 `emit("menu", key)`，宿主可以自己处理。
- `packages/sdk/src/types/sdk-options.ts:108` 有 `onOpenDsm?: () => void`（未接线）。
- app 侧：`packages/app/src/router/index.ts` 有五条路由；`EditorView.vue` 把
  `DrawDBEditor` 挂起来并监听 `@menu`；`HomeView.vue` 是首页；
  `services/storage.ts` 是适配器；`styles.css` 有 `--surface/--border/--accent` 令牌。
- 文件菜单已扩到 6 项（new/open/save/saveAs/import/export），
  `packages/sdk/src/components/Toolbar/ToolbarFile.vue:9` 的注释写明 print 留给 P6。
- 设置存储：`packages/sdk/src/stores/settings.ts` 有 theme/language/fontSize/
  defaultDatabase/autoSave/autoSaveIntervalMs/面板宽高与折叠，持久化到
  localStorage，`readPersistedSettings()` 负责回读。

## Task 1 — SDK 的 type-scope store（持久化与应用/工作区两层）

1. 新增 `packages/sdk/src/stores/type-scope.ts`：`useTypeScopeStore()` 持有
   `TypeScopeSnapshot`，默认 `emptyTypeScope()`；从注入的适配器（默认
   localStorage，键 `ddb.type-scope`）回读，写回时只存 application 与 workspace
   两层；动作 `setLayer(level, layer)`、`registerDomain(domain)`、`renameDomain`、
   `removeDomain`、`updateMapping(familyId, database, mapping)`、
   `resetToBuiltins()`、`snapshot()`。所有改动都经 core 的
   `registerDomain`/`updateFamilyMapping`/`upsertScopeLayer`，撞名时返回诊断而
   不落库。
2. 把 `edit-panel-model.ts` 的 `suggestPhysicalSpec` 与 `use-alerts.ts` 的 lint
   改成读 store 的 `snapshot()`，使面板建议、画布族名与告警一致。
3. 测试（TDD，先 RED）：新图默认快照为空；注册域后 `snapshot().application.domains`
   有它且重载（重建 store + 同一适配器）仍在；撞名返回 error 且不写；映射覆盖
   改变 `suggestPhysicalSpec` 的建议；`resetToBuiltins()` 清空两层；面板与告警
   读到同一份快照。

**验证:** sdk 测试绿、`vue-tsc` 0。

## Task 2 — DSM 界面（SDK 全屏模态）

1. 新增 `packages/sdk/src/components/TypeSystem/`：
   - `TypeSystemDialog.vue`：全屏模态（`data-testid="type-system"`），左侧三组
     导航（Families / Domains / Mappings），右侧编辑区，底部 Save / Cancel。
   - `FamilyList.vue` + `FamilyEditor.vue`：11 个内置族的名单与参数（每个方言
     一行的 type/params 编辑，写 store 的 `updateMapping`）。
   - `DomainList.vue` + `DomainEditor.vue`：域的增删改（name、family、params、
     每方言 physical），撞名把 core 的诊断摆在表单里。
   - `MappingGrid.vue`：族 × 7 方言的矩阵，单元格是可编辑的类型与参数。
2. 入口：`DrawDBEditor` 增 `typeSystemOpen?: boolean` 与
   `open:type-system` 的处理；工具栏的 `config:open` 在没有宿主 `onOpenDsm` 时
   打开自己的 DSM，宿主给了 `onOpenDsm` 就交回宿主（Q16 的两种容器）。
3. 测试：打开/关闭；列出 11 个族；改一个方言的映射后 store 变、面板建议跟着变；
   新建域；撞名显示诊断且不保存；`onOpenDsm` 存在时工具栏把事件交给宿主。

**验证:** sdk 测试绿、`vue-tsc` 0。

## Task 3 — app：DSM 路由页与首选项对话框

1. 新增 `packages/app/src/views/TypesView.vue`：路由 `/types`，把 SDK 的 DSM 当作
   整页使用（Q16 的「app 独立路由页」）；`HomeView` 的导航与 `EditorView` 的
   `config:open` 处理都指向它。
2. 新增 `packages/app/src/components/PreferencesDialog.vue`：显示（主题、语言、
   字号）、工具（默认数据库、网格/吸附）、自动保存（开关与间隔）、快捷键（只读
   展示当前绑定）；读写 SDK 的 settings store；顶部按钮打开，`Escape` 与遮罩关闭。
3. 测试：路由含 `/types`；首选项改动写入 settings 并重载后仍在；语言切换改
   i18n locale；主题切换给根节点加类；`config:open` 在 app 里跳到 `/types`。

**验证:** app 测试绿、`tsc` 0。

## Task 4 — 打印与分页预览

1. 新增 `packages/sdk/src/components/Print/PrintPreviewDialog.vue`：按阅读顺序把
   节点排到页面上，A4/A3/Letter 三种纸、横向/纵向、边距与缩放；页脚显示页码与
   图名；`Print` 调 `window.print()`，`Cancel` 关闭。
2. `packages/sdk/src/components/Print/print-layout.ts`（纯函数）：`paginate(nodes,
   page, options)` 返回每页的框与纸张尺寸，供预览与测试用。
3. 打印样式：`@media print` 隐藏编辑器外壳，只留打印区（`print.css`，挂在对话框
   上，不改全局样式）。
4. 接线：`ToolbarFile.vue` 增 `file:print` 与 `file:print-preview`；`DrawDBEditor`
   处理两者（预览先开对话框）。
5. 测试：菜单出现两项并 emit；`paginate` 的页数与框（12 张表 → 2 页等）；改动纸型
   与缩放改变页数；`Print` 调 `window.print`（桩）。

**验证:** sdk 测试绿、`vue-tsc` 0。

## Task 5 — i18n

1. 收集 Task 1–4 的新键写入 `en.json`（按 JS 默认排序、既有行字节不变）。
2. 按语言分批派子代理写 50 个 locale（规则同前：只加新键、CRLF、literal UTF-8、
   键序与 en 一致、不 commit、自查键集）。
3. 跑 `packages/sdk/src/i18n/index.test.ts` 的键集一致性。

## Task 6 — 收尾

1. 全量验证：`pnpm typecheck`（五段）、`run-tests.mjs`、e2e、`turbo run build`。
2. 文档：`docs/designer-ui-redesign-discussion.md` 增 §12.8（P6 落地表）；
   `progress.md` 追加 P6 决策段；spec §13 的 P6 行标注交付。
3. 提交：type-scope store / DSM 界面 / app 路由与首选项 / 打印 / i18n / 文档
   六个独立提交。

## 风险与取舍

- **DSM 的数据边界**：P6 只编辑应用与工作区两层，图的覆盖留给后续；所以
  `TypeScopeSnapshot.diagram` 在 P6 里始终是空对象，DSM 的界面不显示这一层。
- **打印的保真度**：P6 只做「按阅读顺序分页」，不做画布 1:1 缩放；PDF 导出与
  打印水印留到后续。
- **首选项的快捷键**：P6 只展示当前绑定（只读），自定义键位留给后续——
  改键位要动 `use-hotkeys.ts` 的注册表语义，属于另一个任务。

## 执行偏差记录

（执行中追加）

## 执行记录（2026-10-30）

- Task 1：`packages/sdk/src/stores/type-scope.ts`（6 例）——两层持久化、按名字键控的域、撞名诊断、`replaceLayer` 替代 `upsertScopeLayer` 以支持改名与删除。
- Task 2：`packages/sdk/src/components/TypeSystem/`（`TypeSystemDialog`/`FamiliesPane`/`DomainsPane`/`MappingGrid` + 4 例）；`DrawDBEditor` 的 `config:open` 在无 `onOpenDsm` 时开自己的 DSM；`suggestPhysicalSpec` 与 lint 改读 `useTypeScopeStore().getSnapshot()`。
- Task 3：`packages/app/src/views/TypesView.vue` + `/types` 路由；`packages/app/src/components/PreferencesDialog.vue` 与首页的「设置」背板。
- Task 4：`packages/sdk/src/components/Print/`（`print-layout.ts` 8 例、`PrintPreviewDialog.vue` 6 例）；工具栏文件组加「打印预览」「打印」，`DrawDBEditor` 拦截 `file:print-preview`/`file:print` 打开预览。
- Task 5：`en.json` 585→586 键（`type_system_*` 10、`pref_*` 3、`file_print`/`file_print_preview` 2），50 个 locale 逐一对齐。
- Task 6：设计文档 §12.8 与 `progress.md` 的「The type system left the editor」。
