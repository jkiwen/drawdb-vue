# P7 — the erwin importer

**Status:** ✅ 已交付（2026-10-30，master）— Task 1–6 全部落地；报告目前只到对话框内的计数与列表，告警归档留作后续

## 目标

读 erwin 的 XML Standard File（ERWin 7 为基准），把它变成一个 diagram，并且
**宽松但不静默**：读不懂的部分留在原位、标为无效、写进导入报告
（spec §16.4 Q15/Q18）。

## 任务

1. **XML 读取器** — `packages/core/src/erwin/xml.ts`：无依赖的宽容解析器，
   元素/属性/文本/CDATA/注释，实体解码，标签不配对时按名字收栈，
   名字归一化（忽略大小写与 `_`/`-`）。8 例测试。
2. **erwin 文档模型** — `packages/core/src/erwin/erwin-model.ts`：
   `readErwinDocument(root)` 把文件读成实体/属性/字段/域/关系的普通结构，
   版本从根元素 `Version` 读（读不到记 `unknown`），未知元素与读不懂的值
   进 `skipped`（`unknown-element` / `unparsable` / `unsupported` / `asymmetric`）。
3. **映射到 diagram** — `packages/core/src/erwin/erwin-import.ts`：
   `importErwinXml(source, { database, title })` → `{ diagram, report }`。
   表名取物理名、逻辑实体取 `EntryName`、物理类型标 `fieldTypeSource: "imported"`、
   PK 由 `primaryKey` 属性合成、关系由 `Relationship` 合成、最后跑
   `normalizeDiagramKeys` 派生子表 `foreignKeys`。`diagram.invalidMarkers` 存标记。
4. **报告** — `ErwinImportReport`：版本、实体/属性/字段/域/关系计数、
   `skipped` 列表（路径 + 元素名 + 原因）、`markers`、`notes`（域未挂到图上、
   类型落到 `common` 等）。
5. **界面入口** — `ImportDialog` 增 `format: "erwin"`（读文件、显示报告、再确认替换），
   文件菜单增 `import-erwin`（`file:import-erwin` → `openDialog("import", { format: "erwin" })`）。
6. **收尾** — 文档（设计文档 §12.9、progress.md）、全量门禁、提交。

## 关键设计锚点

- **基准 ERWin 7**，只读 XML Standard File；Repository Format、二进制 `.erwin`、
  宏展开、回写 erwin 都不做（spec §16.1）。
- **宽松 ≠ 静默**：每一次无效都在报告里列明（对象类型、元素名、原因、原文）。
- **无效不等于不可用**：被标记的内容不参与导出，但图仍然可以打开与编辑。
- **类型来源**：erwin 的 `FieldType` 是事实，标 `imported`（Q8），不冒充映射结果。
- **版本差异**（Q17 暂定）：元素名别名表 + 属性名归一化 + 宽松降级；版本号只记录，
  不据此分支。

## 现状代码事实

- `Diagram.invalidMarkers?: InvalidMarker[]`（`packages/core/src/models/invalid-marker.ts`），
  序列化在 `serialize/types.ts` / `export.ts` / `import.ts` 三处携带。
- 逻辑/物理配对沿用 P2' 的形状：`Table.logical`、`PhysicalField.fieldType`、
  `PrimaryKey { id, logicalName, name, columns }`、`Relationship.fields[]`。
- `createEmptyDiagram()` 不接受方言参数——方言在导入后覆盖 `database`。
- 测试走 `node --experimental-strip-types scripts/run-tests.mjs`；`.vue` 单测必须走仓库
  runner（直接 `node --test` 没有 SFC loader）。

## 执行偏差记录

- 计划里「导入报告模态摘要 + 告警归档」目前只做到模态里的计数与列表；
  告警归档（Q18 的第三个通道）留给后续。
- 域（Domain）只读进报告、不挂到图上：SDK 的 type-scope store 才是域的宿主，
  importer 不越层写它。
