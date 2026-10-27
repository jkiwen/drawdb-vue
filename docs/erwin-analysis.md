# erwin 式元模型 —— 现状勘察与分析（设计前置笔记）

> 本文件是 brainstorming 阶段的勘察记录，不是最终设计。**已被取代**：
> 最终设计见 [`docs/superpowers/specs/2026-10-26-erwin-type-system-design.md`](superpowers/specs/2026-10-26-erwin-type-system-design.md)。
>
> 本文件保留的价值：**现状勘察（G-1..G-10）与文件行号证据**，是设计文档的
> 事实依据；以及"待决策问题"的原始选项集，便于追溯决策过程。
>
> 状态：2026-10-26 起草 → 已被设计文档取代（同日）。
>
> **勘误（2026-10-26，依据 erwin 官方文档）**：本文件第 1 节把「逻辑/物理」理解为
> "同一份模型、两种描述精度"。erwin 官方的模型是**两个可分别编辑、可不对称**
> （Logical Only / Physical Only）的模型 —— 逻辑层与物理层是**两份可独立编辑的数据**。
> 设计文档 §3 已据此把模型升级为"双层并存"。本文件第 1 节与第 3 节的部分表述
> 因此过时，以设计文档 §0.2 与 §3 为准。
>
> **勘误（2026-10-27，用户第二轮裁决）**：erwin 的字段级非对称（Logical Only /
> Physical Only）**本项目不采用** —— 用户裁决「假定物理与逻辑保持一对一对应」，
> 删除任一侧同时删除另一侧。因此设计文档 §3.5.1 把"可不对称"收窄为
> "双层可分别编辑 + 字段级强制一对一"，非对称标记降级为**导入异常提示**。
> 详见设计文档 §3.5、§3.5.1、§3.5.2 与 §2 不变式 6。
>
> **勘误（2026-10-27，erwin 官方资料存档）**：官方 PDF 与 21 个帮助页已存档到
> [`docs/references/`](references/)；erwin 兼容层的详细映射见设计文档 §16。

---

## 1. 用户的意图（复述，待用户确认）

**概念域**：数据库设计，不是 C4 架构。逻辑/物理是数据库设计中的
「逻辑模型 ↔ 物理模型」这组概念。

**切换语义**：物理视图与逻辑视图的切换 = 改变**视图中数据结构描述的形态**。
同一份模型，两种描述精度，不是两份数据。

**来源**：erwin。其核心机制是——
1. 定义**逻辑实体**（表名、描述、字段的类型定义）→ 形成**数据结构描述的元定义**；
2. 通过**元定义 → 目标数据库元定义**的**映射**，实现多个数据结构之间的转换；
3. **不是**穷举「库 A 类型 ↔ 库 B 类型」的两两映射网格。

**阶段定位**：此前阶段 = React drawDB 的 Vue 化 SDK 转写（功能对齐）。
当前阶段 = **功能增强与逻辑重构**，允许打破「照搬 React 数据结构」的约束。

**类型定义至少两层**：
- 基础类型映射：长度、精度、初始化值（函数）。例：逻辑 `String` →
  Oracle `VARCHAR2(50)`、SQL Server `VARCHAR(50)`。
- 自定义类型映射：用户定义的**逻辑**类型 → 物理类型。例：逻辑类型「姓名(Name)」
  → Oracle `NVARCHAR2(100)`。逻辑/物理各自有类型名称与定义，**由映射管理联系**。
  用户可配置是否将类型定义**实际物化**到目标库成为自定义类型 —— 取决于数据特性
  与用户选择，因为并非所有数据库都支持类型定义。

---

## 2. 现状勘察（已核实，均有 file:line）

### 2.1 当前数据模型

`packages/core/src/models/diagram.ts:19-35`
```ts
export interface Diagram {
  database: DatabaseType;   // ← 全局单一方言
  tables: Table[];
  relationships: Relationship[];
  notes: Note[];
  subjectAreas: Area[];
  areas?: Area[];
  types: CustomType[];
  enums: Enum[];
  views: View[];
  metadata?: Metadata;
  ...
}
```

`packages/core/src/models/table.ts:19-37` — `Table` 含 `fields`、`comment`、
`indices`、`uniqueConstraints`、`color`、`inherits`。

`packages/core/src/models/field.ts:5-21` — `Field`：
```ts
export interface Field {
  id; name;
  type: string;          // ← 方言字面量，如 "VARCHAR2" / "JSONB" / "BFILE"
  default?: string|number|boolean;   // 初始化值（可为函数）
  check?: string;
  primary?; unique?; nullable?; notNull?; unsigned?; increment?;
  comment?: string;       // ← 字段描述，SDK 从不读取（死数据）
  size?: string|number;   // ← 长度/精度
  values?: string[];      // ← ENUM/SET 的取值
  metadata?: Metadata;
}
```

`packages/core/src/models/relationship.ts:9-21` — `Relationship` 以
`startTableId/startFieldId/endTableId/endFieldId` 锚定**字段**；`cardinality?: string`；
`fields?: RelationshipFieldPair[]` 支撑复合外键。

### 2.2 关键差距

| # | 现状 | 位置 | 与 erwin 模式的差距 |
|---|---|---|---|
| G-1 | `database` 是**图的全局属性** | `models/diagram.ts:22` | 一图只能一种方言，**无法「一份元定义 → 多目标库」** |
| G-2 | 字段类型直接存**方言字面量** | `models/field.ts:8` | **无中间抽象类型层** |
| G-3 | 7 个导出器各写各的 | `export/{mysql,postgres,sqlite,mariadb,mssql,oraclesql,generic}.ts` | 正是「两两映射网格」：类型/约束/自增/注释逻辑在 7 处重复 |
| G-4 | 导出器**直读方言类型名** | `export/generic.ts:118-127` `parseType()` | 无法从抽象类型推导目标类型 |
| G-5 | **只有 Postgres 导出自定义类型** | `export/postgres.ts:191-194` `CREATE TYPE` | 其余 6 个方言的 `diagram.types` 被**静默忽略**（grep `diagram.types` 仅命中 postgres） |
| G-6 | `CustomType` 是**结构化复合类型**（`fields: TypeField[]`） | `models/type.ts:13-19` | 用户要的「姓名(Name) → nvarchar2(100)」是**标量别名**，此概念**完全不存在** |
| G-7 | 已有抽象层雏形：`TypeFamily`（8 族） | `types/registry.ts:663-671` | **仅用于画布配色**（`typeColor()` :758），未参与类型映射 —— 是天然的抽象层种子 |
| G-8 | `Field.comment` 已定义 | `models/field.ts:17` | SDK **0 处读取**（死数据）—— 正是「字段描述」该承载的位置 |
| G-9 | 字段描述可存**函数** | `models/field.ts:9` `default` | `export/generic.ts:97-98` `isFunction()` 已支持 —— 「初始化值(函数)」已有雏形 |
| G-10 | 类型能力元数据已建模 | `types/registry.ts:252-261` `TypeMetadata` | `isSized/hasPrecision/hasQuotes/canIncrement/signed/hasCheck/noDefault/defaultKind` —— **正是映射决策所需的元数据**，但只被单方言查表使用 |

### 2.3 自定义类型的现状

- `CustomType`（`models/type.ts`）：命名 + `fields: TypeField[]` → 结构化复合类型。
- `Enum`（`models/enum.ts`）：命名 + `values: string[]`。
- 导出：**仅 Postgres**（`export/postgres.ts:182-194`），产出
  `CREATE TYPE ... AS ENUM (...)` 与 `CREATE TYPE ... AS (...)`。
- 其余方言：`diagram.types` / `diagram.enums` **不被导出**（grep 证实）。
- 这正是用户所说「**不是所有数据库都支持类型定义**」的现状体现 ——
  但当前是**静默丢弃**（无警告、无替代策略），不是**显式的物化策略**。

### 2.4 类型注册表

`packages/core/src/types/registry.ts`（763 行，脚本生成）：
- `DATABASE_TYPE_NAMES: Record<DatabaseType, readonly string[]>` — 各方言类型名白名单。
- `DATABASE_TYPE_METADATA: Record<DatabaseType, Record<string, TypeMetadata>>` — 各方言能力表。
- `TYPE_AFFINITY` — 未知类型的方言内降级表。
- `classifyTypeFamily(type, metadata): TypeFamily` — 8 族分类，**跨方言的抽象能力已存在**。

**注意**：`export/generic.ts:12-74` 又维护了一份**手写的** `genericMetadata`
—— 与注册表的 `generic` 条目**重复**，是一处既存漂移点。

---

## 3. 待决策的核心结构问题

### 3.1 权威源（用户未直接回答，用其回答推断）

用户描述的机制是「元定义 → 目标元定义的映射」，且提到「用户可配置是否将类型定义
实际物化到目标库」——这意味着**逻辑层是权威源**（方案 A）：若逻辑层只是投影，
「映射」与「物化配置」都无处安放。

但需向用户确认，因为这决定了全部下游形态。

### 3.2 类型定义的三层（初步归纳，待确认）

```
① 逻辑标量类型（抽象）        逻辑 String / Integer / Decimal(p,s) / Date / Boolean
   ↓  基础类型映射（默认，可覆盖）              ← 用户点 1
② 物理标量类型（方言）
   e.g. Oracle VARCHAR2(50) / SQLServer VARCHAR(50)

③ 逻辑自定义类型（命名，业务化）  逻辑 "Name"（姓名）
   ↓  自定义类型映射 + 物化策略（可配置）      ← 用户点 2
④ 物理落地形态
   方式 1: 展开为物理标量 (nvarchar2(100)) —— 不产生 UDT
   方式 2: 物化为数据库原生类型 (CREATE TYPE / DOMAIN) —— 仅部分方言支持
```

**关键区分**（现状缺失）：
- **标量别名**（用户点 2）：一个逻辑名字 → 一个物理标量类型。物化与否是**可选**的。
- **结构化类型**（现状 `CustomType`）：一个逻辑名字 → 一组字段。
  物化**几乎必需**（否则语义丢失）。
- **枚举**（现状 `Enum`）：逻辑名字 → 一组取值。物化可选（部分方言可内联为 CHECK）。

三者需要**不同的物化能力探测与降级策略**。

### 3.3 覆盖逻辑（用户明确点出「覆盖」是难点）

需要区分的覆盖维度：
1. **字段级覆盖**：某字段不用默认映射，用另一个。例：逻辑 String 默认 → VARCHAR2(50)，
   但本字段 → VARCHAR2(200)。
2. **类型级覆盖**：逻辑 String 在 Oracle 下的默认映射被用户改写（影响所有 String 字段）。
3. **目标级覆盖**：同一逻辑类型在不同目标库有不同映射（这是 erwin 的核心，不是「覆盖」而是
   「多目标并列」）。
4. **表/库级覆盖**：某张表整体用另一套。

**这四种优先级需要明确定义，否则会互相打架。**

---

## 4. 与既有工作的关系

- `sdk-workspace/docs/plan.md` 20 个任务已全部 complete（React→Vue SDK 转写完成）。
- 本次属于**新阶段**（功能增强与逻辑重构），应作为新的任务序列，与既有 20 任务并列。
- `sdk-workspace/progress.md` 是决策台账（注意：`AGENTS.md:39,187` 的路径引用有误，
  文件实际在 workspace 根，不在 `docs/`）。
- 上一轮审计发现的 31 项术语/文档不一致（含 7 项 P0 规范与实现矛盾）是**并行的债务**，
  本次重构会顺带修正其中一部分 —— 需在设计里明确哪些纳入、哪些另立。
