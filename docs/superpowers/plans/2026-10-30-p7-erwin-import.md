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

## 执行偏差记录（2026-10-30，真实样本之后）

计划的第一版按 spec §16.7 的结构示意（`EntryName`/`tableName`/`Attributes`/`Fields`）实现，
拿到真实文件（`fixtures/erwin/DEVSV_MessageCenter.xml`，ERWin 7.3.1822，1.39 MB，22 实体）
之后按真实 schema 重写了读取层：

1. **读取方式改为流式切片**：`scanElements(source, names, onElement)` 一次线性扫描，
   只把 Entity/Domain/Key_Group/Relationship 的切片解析成节点，内存跟着一个元素走。
   用户明确要求「不建议进行全文扫描」，且大型设计超过 500 张表；`samples.test.ts`
   用一个 600 实体的合成文档钉住这一条（单次读取 < 4s）。
2. **元素名与层级按真实文件**：属性在 `<Entity>/<Attribute_Groups>/<Attribute>` 下，
   键在 `<Entity>/<Key_Group_Groups>/<Key_Group>` 下，键的列不是属性 id 而是
   `<Key_Group_Member>` 对象（其 `<Attribute_Ref>` 指属性、`<Key_Group_Sort_Order>` 指方向）。
   取值一律用元素名而不是位置，命名空间前缀（`EMX:`）在扫描时剥掉。
3. **键的映射**：PK → `table.primaryKey`；AK/IE（erwin 的唯一索引）→ `table.uniqueKeys`；
   IF1/IF2（erwin 为外键加的索引）→ `table.indices`（`unique` 取 `Is_Unique`）；
   其它类型（如 IE 以外的新码）记 `unsupported` 并进报告。
4. **不再枚举未知元素**：流式读取看不到「所有元素名」，所以 `unknown-element` 只在显式
   跳过点出现；其余跳过一律是 `asymmetric`（属性缺物理类型、键成员解析不到、实体无属性、
   关系端点缺失）。这一点改变了 Q18 的「逐项列出」语气：报告仍然逐项列，
   但依据是「我读了什么、哪里对不上」而不是「文件里还有什么」。
5. **样本断言**：`erwin-import.test.ts` 的最后一例直接读真实文件——版本 `7.3.1822`、
   22 实体、139 列、≥19 张表带 PK、15 条关系、至少一张表带索引；文件不存在时该例跳过
   （CI 里没有样本也能跑）。

### 追加偏差（2026-10-30，评审裁决：自定义逻辑类型属于图）

评审指出 erwin 的 `INT-4` 这类**基于基础逻辑类型定义的自定义逻辑类型**在文件里是存在的，属于**图级别**，导入时必须读进来，不能只出现在报告里。据此补上一步：

- `Diagram` 增 `domains?: LogicalDomain[]`（随图序列化，`serialize/types.ts` / `export.ts` / `import.ts` 三处携带）。
- erwin 的 `Domain` 元素里，`Built_In_Id` 为 1..6 或名字为 `<root>`/`<default>`/`String`/`Number`/`Datetime`/`Blob` 的是 erwin 自带的类别，不重复登记；其余（含 `Built_In_Id` 为 0 或缺失）是**模型自己声明的**自定义逻辑类型，读成 `LogicalDomain`：`family` 由其逻辑类型名推得、`params` 由 `Logical_Data_Type` 拆解、`physical` 记在导入时的目标方言下（来自 `Physical_Data_Type`）、`parentId` 保留（Q13，不继承）。
- 用 `Parent_Domain_Ref` 指向这些域的属性，`logicalType` 写成 `{ domainId }`，于是逻辑视图显示域的名字、物理视图显示域在目标方言下的类型。
- 新增 `packages/core/src/types/diagram-scope.ts` 的 `diagramScopeOf()` / `scopeWithDiagram()`：把 `diagram.domains` 铺进作用域的 diagram 层（图 > 工作区 > 应用，最内层优先）。面板的 `suggestPhysicalSpec` 与底部告警的 `lintDialect` 都改走它，否则导入图里的域对编辑面板「不存在」。
- `resolve.ts` 的 `findDomain` 现在同时认两种键：注册表按名字键控（Q1 全局唯一按名），导入的 diagram 层按 **id** 键控（属性引用的是 id，改名不破引用）。
- 真实样本复核：20 个自定义逻辑类型随图、130 个属性指向它们、6 个 erwin 自带类别不重复登记；`消息通道ID` → 域 `_ID` → `VARCHAR2(32)`（oraclesql，无诊断）。
