# erwin 类型系统核心（P1–P4）实施计划

> **Status: ✅ 已完成（2026-10-28，分支 `erwin-type-system-core`）**——Task 1–7 全部落地，`pnpm typecheck` / `pnpm test`（828/828）/ `pnpm build` 全绿。提交：`5c42a03`（P1a）、`168a49d`（P1b）、`28b5ded`（P1c）、`e65dc84`（P2）、`d83d452`（P3）、`05bb133`（P4 导出器）、`a4aff15`（P4 sdk/app）、`7465c83`（P4 收尾），另 `4abebe2`（执行前提：CRLF 修复）。执行偏差见文末「执行偏差记录」。
>
> **来源**：`sdk-workspace/docs/superpowers/specs/2026-10-26-erwin-type-system-design.md`（spec，Q1–Q33 已裁决，D1–D27）。
> **范围**：spec §13 的 **P1 模型 → P2 解析器 → P3 lint → P4 导出接入**；P3/P4 可并行。
> **不在本期**：P2'（索引/约束双名对象化，仅做 P1 约定的「索引字段引用 名字→id」最小改动）、P5 SDK 视图、P6 App 作用域装配、P7 erwin 导入器、P8 DSL。
> **执行隔离**：按 using-git-worktrees 技能在执行时新建 worktree。
> **破坏性变更前提**（已裁决）：一图一库、不做历史数据兼容 / schema 迁移（spec §15）。

## 总体验收

- `pnpm typecheck`、`pnpm test`（`node --experimental-strip-types scripts/run-tests.mjs`）、`pnpm build` 全绿。
- 7 个方言导出器回归测试全部通过，导出 SQL 与改造前等价（同一输入图 → 同一 SQL，除 P4 明确修正的漂移点）。
- spec §12 测试策略表中 P1–P4 对应的 core 单测全部落地：
  `resolveType.test.ts`、`reconcile.test.ts`、`model-invariants.test.ts`（INV-1..INV-7 字段/实体/关系级）、`dialect-lint.test.ts`（12 个 code 各一例）、`type-families.test.ts`（77 条守卫）、`type-uniqueness.test.ts`、`domains.test.ts`、7 个方言导出回归。

## 关键设计锚点（写代码前必读）

- spec §2 不变式 1–7：类型即名称、视图即层、物理类型是存储数据、诊断不存储、单向下推、字段级强制一对一、元素级对应按语义。
- spec §3.0–3.6：`LogicalEntity`/`LogicalAttribute`/`PhysicalField`/`PhysicalSpec`/`FieldTypeSource`/`LogicalDomain`/`PhysicalDomainSpec`/`LogicalTypeFamily`/`TypeMapping`/`ParamSpec` 的字段定义逐字以 spec 为准。
- spec §3.5 INV-1..INV-7（本期实现范围；INV-8..INV-10 属 P2'）；§3.5.2 删除跨层原子语义。
- spec §3.3.1 全局唯一性：域名大小写不敏感、去首尾空白后全局唯一；撞名拒绝创建 + 提示。
- spec §4.1 参数优先级链：逻辑属性 params > 域 params > 族 defaultParams > 映射自带 params。
- spec §4.2 来源标记语义：`mapped` 重算 / `explicit` 不动 / `imported` 默认不动。
- spec §6.2 `DialectDiagnostic` 12 个 code 与 scope 形态；§6.3 能力等价判定复用 `TypeMetadata`；§6.4 三分支。
- spec §9.3 第一步范围 + §9.4 附带清理 1–5（其中第 5 条索引导出统一化**仅做字段引用 id 化**，其余属 P2'）。

## 现状代码事实（已核对）

- `packages/core/src/models/field.ts`：`Field { id; name; type; default?; check?; primary?; unique?; nullable?; notNull?; unsigned?; increment?; comment?; size?; values?; metadata? }` —— `type`/`size`/`comment` 将按 spec §3.4 迁移/移除；`Field.logicName` 现状不存在（说明：SDK 侧如有逻辑名属性需核对该层，core 的 `Field` 无此字段）。
- `packages/core/src/models/table.ts`：`Table { id; name; x; y; width?; fields: Field[]; comment?; locked?; hidden?; collapsed?; details?; indices?; uniqueConstraints?; color?; inherits?; metadata? }`；`Index { id?; name; unique: boolean; fields: string[] }`（`fields` 是**名字数组**，本期改 id）；`UniqueConstraint { id?; name; fields: string[] }`。
- `packages/core/src/models/relationship.ts`：`Relationship { id; startTableId; startFieldId; endTableId; endFieldId; name?; cardinality?; updateConstraint?; deleteConstraint?; fields?: RelationshipFieldPair[] }`。
- `packages/core/src/types/registry.ts`：`DATABASE_TYPE_NAMES`（7 方言白名单）、`DATABASE_TYPE_METADATA`（`TypeMetadata { isSized?; hasPrecision?; hasQuotes?; canIncrement?; signed?; hasCheck?; noDefault?; defaultKind? }`）、`canonicalTypeName`、`getTypeMetadata`、`typeTakesSize`、`classifyTypeFamily`（旧 8 族，供画布着色，**保留**，与新的 11 个逻辑族并存于不同抽象层）、`TYPE_COLORS`。
- `packages/core/src/export/dialect-meta.ts`：`getTypeMetadata(database, type)` 已是注册表薄封装 —— P4 收敛入口。
- `packages/core/src/export/generic.ts:12-74` 手写 `genericMetadata`（与注册表重复）、`:101-116 parseDefault()`、`:118-127 parseType()` 读 `field.type`+`field.size` —— P4 清理点。
- `packages/core/src/export/shared.ts`：`parseDefault(field, database)` 读 `field.type`（`:75`）、`uniqueConstraintClause`（`:98-118`，UK 内联行为正确，保留）、`getFkColumnNames`（按 id 查名，正确）。
- `packages/core/src/validation/types.ts`：`DiagramIssue { code; severity: "error"|"warning"; message; params?; tableId?; fieldId?; relationshipId?; viewId?; typeId?; enumName? }` —— `DialectDiagnostic` 是**新通道**（spec §6.2 注：索引诊断走 DiagramIssue，类型诊断走 DialectDiagnostic），`IssueSeverity` 需扩展 `"info"` 供新通道使用（或新通道自带 `DialectSeverity`，不改动既有通道）。
- 直读 `field.type`/`field.size` 的既有点（P4 逐一迁移）：`export/mysql.ts:39-63,73-75`、`export/postgres.ts:216-252`、`export/mssql.ts:143-194`、`export/oraclesql.ts:109-132`、`export/sqlite.ts:79`、`export/generic.ts:137-173`、`export/shared.ts:75,101-114`；导入侧 `sql/import/{mysql,mariadb,mssql,oraclesql}.ts`；DBML 侧 `dbml/export.ts:53-54,136-140`、`dbml/parse.ts:119-147`、`dbml/reconcile.ts:207-269`；校验侧 `validation/rules.ts:173,301-348`。（行号以改造当日 `git grep` 实测为准。）

---

## Task 1 — 模型类型定义（P1a，纯类型，无行为）

新增文件，只含 interface/type 与文档注释，先从 spec 逐字誊抄：

- `packages/core/src/models/logical.ts`：`LogicalEntity`、`LogicalAttribute`（`logicalType: LogicalTypeRef`、`params?`、`fieldId?`、`logicalOnly?`、`keyRole?: "primary" | "alternate" | "foreign"`、`required?: boolean`、`values?: string[]`）、`LogicalTypeRef`（`{ family } | { domainId }` 互斥）。
- `packages/core/src/models/domain.ts`：`LogicalDomain`（含 `parentId?` 保留字段、注释注明本期不生效 Q13）、`PhysicalDomainSpec`。
- `packages/core/src/models/physical.ts`：`PhysicalSpec`、`PhysicalFlags`、`FieldTypeSource = "mapped" | "explicit" | "imported"`、`PhysicalField`。
- `packages/core/src/types/family.ts`：`ParamSpec`、`TypeParams`、`TypeMapping`、`LogicalFamilyId`、`LogicalTypeFamily`（`builtin: boolean`）。
- `packages/core/src/models/index.ts` 更新 barrel 导出。

**测试**：`pnpm typecheck` 通过即可（纯类型文件）。新增 `types/family.test.ts`：编译期类型互斥（`LogicalTypeRef` 两形态不能同时出现，用 `// @ts-expect-error` 断言）。

---

## Task 2 — 内置族定义与 77 条映射（P1b）

- `packages/core/src/types/builtin-families.ts`：`BUILTIN_FAMILIES: readonly LogicalTypeFamily[]`，11 族（string/text/integer/decimal/boolean/date/datetime/binary/enum/json/uuid），参数与默认值按 spec §3.2 表；每族 `mappings` 穷举 7 方言。
- 映射取值**逐条人工核对官方文档**并在表内注释标注来源（R2）；`common`（未定义）族单独导出 `COMMON_FAMILY`，按字符串规则映射 + 留痕标记。
- 术语沿用：族 id 即 spec 清单的 11 个字符串；**不复用** `registry.ts` 的旧 `TypeFamily`（那是画布着色分类）。

**测试**（先写）：`packages/core/src/types/builtin-families.test.ts`
1. 守卫：恰好 11 个内置族；每族 `mappings` 恰好覆盖 7 个 `DatabaseType`（77 条齐全）。
2. 每族参数 spec 与 spec §3.2 表一致（如 `decimal` 默认 `precision=10, scale=2`）。
3. 每条映射的 `type` 出现在 `DATABASE_TYPE_NAMES[db]` 白名单中（交叉验证注册表）。
4. 族 id 全局唯一；不与 `COMMON_FAMILY.id` 冲突。

---

## Task 3 — Table/Field 双层化迁移（P1c，破坏性核心）

1. `packages/core/src/models/table.ts`：`Table` 增 `logical: LogicalEntity`（必填，INV-7）；`fields: Field[]` → `fields: PhysicalField[]`；`Index.fields: string[]` → `Index.fields: FieldId[]`（**名字→id，本期最小改动**，读取路径保留「按名字反查 id」兜底 + `index.unknown_field` 诊断，Q30）。
2. `packages/core/src/models/field.ts`：`Field` 删除，`PhysicalField` 迁入或 re-export；移除 `type`/`size`；`comment` 保留在物理层；`values` 保留（物理 enum 取值）。
3. `Diagram` 不变（域/族不进 Diagram —— 由 scope 快照装配，spec §5）。
4. 新增 `LogicalRelationship`（`packages/core/src/models/logical-relationship.ts`：角色名/基数/关系类型/`physicalPending?`），挂 `Diagram.logicalRelationships?: LogicalRelationship[]`，与 `Relationship` 靠 id 关联（INV-6）。
5. `createEmptyDiagram` 与 `models/index.ts` barrel 同步。

**测试**（先写）：`packages/core/src/models/model-invariants.test.ts`（放 `validation/` 或 `models/`，随实现定）
- INV-1..INV-7 各一例正反用例；INV-4 删物理字段 → 逻辑属性同时删除（`Map<fieldId, attribute>` O(1) 校验索引，spec §3.5 实现要点）。
- 新建表自动获得内嵌 `LogicalEntity`（INV-7 构造保障）。

**迁移扫尾（本 Task 内完成）**：跑 `pnpm typecheck`，逐点修复 `commands/`、`sql/import/`、`dbml/`、`serialize/`、`sdk/`、`app/`、`examples/` 的编译错误。SDK/app 侧只做**最小适配**让编译通过（如暂以 `fieldType.type` 代替 `field.type` 显示），真正的视图层改造属 P5。

---

## Task 4 — 解析器（P2）

新文件 `packages/core/src/types/resolve.ts`，签名逐字按 spec §4.4：

- `TypeScopeSnapshot { application; workspace; diagram }`、`TypeScopeLayer { families?; domains? }`。
- `resolveType(attribute, database, scope): ResolutionResult`：按名定位唯一族/域（找不到 → `unmapped: true` 落 common）；参数合并按 §4.1 四级优先级链；物理形态取 `域.physical[D] ?? 族.mappings[D]`（跨作用域取值：图级 > 工作区级 > 应用级，第一个命中项，spec §5）。
- `validatePhysicalType(attribute, field, database, scope): DialectDiagnostic[]`：只比对不写回。
- `reconcilePhysicalTypes(table, database, scope): Table`：仅 `fieldTypeSource === "mapped"` 的字段重算并写回；`explicit`/`imported` 不动。
- `FamilyOverride` 类型（某族某方言项的覆盖值，spec §3.3.1 覆盖粒度）。
- 注册接口 `registerDomain()` / `updateFamilyMapping()` / `upsertScopeLayer()` 的 core 侧纯函数实现（操作 scope 对象，不含存储）。

**测试**（先写）：
- `packages/core/src/types/resolve.test.ts`：完整优先级链每级一例；域无该方言 physical → 回落族映射；族缺该方言 → common + `unmapped`；三层 scope 覆盖链各一例。
- `packages/core/src/types/reconcile.test.ts`：mapped 重算 / explicit 不动 / imported 不动 各一例。
- `packages/core/src/types/type-uniqueness.test.ts`（Q1）：同名域/族创建被拒（大小写不敏感、去空白）；覆盖只作用于某域/某族某方言项。
- `packages/core/src/types/domains.test.ts`（Q13）：`parentId` 字段存在、可往返，但解析**不**沿父链查找。

---

## Task 5 — 方言 lint（P3，可与 Task 6 并行）

新文件 `packages/core/src/validation/dialect-lint.ts`：

- `DialectSeverity = "error" | "warning" | "info"`；`DialectDiagnostic` 12 个 code 逐字按 spec §6.2（含 scope `{ tableId?; fieldId?; domainId?; relationshipId? }`、`message` i18n key + 参数、`suggestion?: PhysicalSpec`、`fixable: boolean`）。
- `lintDialect(diagram, database, scope): DialectDiagnostic[]`：遍历全部字段 + 域 + 逻辑关系。
- 能力等价判定（spec §6.3）：复用 `getTypeMetadata` 的 `isSized/hasPrecision/hasQuotes/canIncrement/signed/defaultKind`；同名不同义陷阱（Oracle `NUMBER` vs PG `NUMERIC`；MSSQL `DATETIME` vs MySQL `DATETIME`）→ `TYPE_CAPABILITY_MISMATCH`（warning）。
- 非对称 code（`LOGICAL_ONLY`/`PHYSICAL_ONLY`/`LOGICAL_PHYSICAL_DIVERGED`/`RELATIONSHIP_NOT_IMPLEMENTED`）只提示（info/warning），永不阻断（spec §6.2 注）。
- `NAME_CONFLICT`：域名/族名撞名时报（供 P6 设置界面用；core 只产出诊断）。
- 方言切换三分支的判定函数（spec §6.4）：输入新旧方言，输出每字段的硬冲突/软冲突/无冲突分类与建议。

**测试**（先写）：`packages/core/src/validation/dialect-lint.test.ts` —— 12 个 code 各至少一例（含两个同名不同义陷阱、非对称提示、`RELATIONSHIP_NOT_IMPLEMENTED` 含 `physicalPending` 豁免、`NAME_CONFLICT`）；`fixable` 标记与 `suggestion` 内容断言。

---

## Task 6 — 导出器接入（P4，可与 Task 5 并行）

1. **收敛 genericMetadata**（spec §9.4-1）：`export/generic.ts:12-74` 删除手写表，改用 `export/dialect-meta.ts` 的 `getTypeMetadata("generic", type)`；泛型方言缺项补入 `types/registry.ts`（注册表为唯一真相）。
2. **`parseType`/`parseDefault` 改读物理规格**（§9.4-2/3）：所有方言导出器从 `field.type`/`field.size` 改读 `field.fieldType.type` + `field.fieldType.length/precision/scale`；`parseDefault` 的加引号判断改由 `getTypeMetadata(database, field.fieldType.type)` 驱动。
3. **索引列引用 id 化**：7 个导出器的 `CREATE INDEX` 生成从按名字 quote 改为按 id 查 `table.fields`（复用 `getFkColumnNames` 的查找模式）；`export/shared.ts:101-114` 的 `uniqueConstraintClause` 同样改 id 查名（UK 内联行为本身保留，Q28）。
4. **`diagram.types` 导出**（§9.4-4）：本期保持现状（仅 Postgres 导出），不扩展 —— 物化/inline+留痕属后续；在导出预览侧留 TODO 注释指向 spec §8。
5. **导入侧与 DBML 侧**（Task 3 已修编译，本 Task 补语义）：`sql/import/*` 导入时构造 `PhysicalField`，`fieldType` 从解析的类型名/长度物化，`fieldTypeSource` 置 `"mapped"`（SQL 导入是生成语义）；DBML 侧同。
6. 逻辑名导出为 SQL 注释（spec Q7）：每个方言导出器在字段定义前加 `-- <逻辑属性名>` 注释行（复用 `exportFieldComment` 模式）；「列名用逻辑名」可选开关本期不做（属 SDK 设置）。

**测试**（先写/扩展）：
- 7 个方言 `*.test.ts` 回归：构造含双层的图，断言导出 SQL 含预期物理类型与参数（`VARCHAR2(100)`、`DECIMAL(10,2)` 等）。
- 索引 id 引用：改名字段后导出仍正确；引用失效字段 → 导出跳过该索引且 lint 侧有诊断（诊断在 Task 5 通道，导出器本身只跳过 + 注释留痕）。
- `generic.ts` 收敛后：泛型导出输出与改造前快照一致（先用现状输出建快照测试，再重构）。

---

## Task 7 — 总验收与文档

1. `pnpm typecheck && pnpm test && pnpm build` 全绿。
2. 更新 `sdk-workspace/docs/progress.md`（决策台账）：记录本期裁决摘要（双层模型、来源标记、77 映射、12 诊断码、索引进 id 化）。
3. spec §10 提到的顺手项：`docs/spec.md:431,437,438` 视图描述重写（P0-1/2/3）、`AGENTS.md:39,187` 的 `progress.md` 路径修正（P2）。
4. 术语审计 P1 项的代码侧确认：新增类型相关文案 key 清单移交 P5（本期无 UI，不产生 locale 工作）。
5. 在本文件各 Task 标注完成状态。

## 风险备忘（执行时对照 spec §14）

- R1/R18：Task 3 完成后**立刻** `pnpm typecheck` 全量暴露，不逐文件碰运气。
- R2：77 条映射人工核对官方文档，表内注释来源。
- R3：新 code 默认低 severity，误报降级不删除。
- R10：平行数组孤儿 → INV 测试 + Map 索引校验。
- 序列化格式：本期模型变更**不做**旧数据迁移（已裁决）；`serialize/` 只保证新结构往返。

## 执行偏差记录（2026-10-28 执行后补录）

- **Task 6 第 5 项**：导入侧 ieldTypeSource 由计划原文的 "mapped" 改为 "imported"——SQL/DBML 导入携带的是外部权威物理定义，置 mapped 会在映射编辑时被 econcilePhysicalTypes 重算覆盖（与 spec Q8 语义一致）。后续文档/计划引用以 "imported" 为准。
- **Task 2**：内置族默认值不放 defaultParams，而是写进各映射行（spec §4.1：族默认优先级高于映射自带，放 defaultParams 会让作用域映射覆盖永远无法生效）；守卫测试相应改为断言 defaultParams === undefined 且映射行含默认值。
- **Task 6 第 1 项**：收敛 genericMetadata 前先在 	ypes/registry.ts 手工补齐 generic 方言差异项（白名单 +INTEGER/+DOUBLE PRECISION、TEXT 改 isSized:false/hasCheck:true、REAL 加 hasPrecision:true），并新增 xport/generic.snapshot.test.ts 快照钉住迁移前后输出字节一致。
- **执行方式**：Task 3 的 core 编译扫尾与 packages/app + packages/sdk 的夹具/UI 迁移由 Agent Teams 队友（core-sweep / app-sweep）完成，Lead 复验后提交；Task 5/6 按计划在队友工作期间并行推进。
- **环境**：pnpm build 中 drawdb-vue-app 需要 NODE_OPTIONS=--max-old-space-size=8192（默认堆 exit 134）；Windows 杀软会短暂锁 esbuild 临时文件，重试即可。
