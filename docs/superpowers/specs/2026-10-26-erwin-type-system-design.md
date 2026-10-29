# erwin 式元模型类型系统 —— 设计文档

> 状态：2026-10-26 起草。D1–D4 已由用户裁决（2026-10-26）；**2026-10-26 依据 erwin 官方文档做了结构性修正**（双层模型 + Domain 模型 + erwin 兼容层）；**2026-10-27 用户第二轮裁决并入**（字段级一对一、Q13/Q14/Q15 结论、ERWin 7 导入基准、宽松导入模式）；**2026-10-27 用户第三轮裁决并入**（Q16 暂不做、Q17 暂定、Q18 标记无效 + 报告、Q19 保留 `parentId`、Q20 视图分物理/逻辑 + 编辑面板显示全部信息）；**2026-10-27 Q1 裁决**（域/族/映射定义**全局唯一**，§3.3.1）；**2026-10-27 第四轮并入**（元素级逻辑/物理审计 §3.7：Q21–Q26、D20–D22；索引维护审计 §3.8：Q27–Q31、D23–D25）；**2026-10-27 第五轮并入**（用户裁决 §3.8：裁决 1 Index 双名+自动命名、裁决 2 PK/UK/FK 独立双名结构+`field.primary` 废弃、裁决 5 表格下方分割线条目区 UI；追加裁决：FK 亦为独立 `ForeignKey` 对象；新增 Q32–Q33、D26–D27、INV-9/INV-10）。**§11 已无未决项**（Q17 为用户指定的暂定项）。待整体评审。
>
> 前置笔记：[`docs/erwin-analysis.md`](../../erwin-analysis.md)（现状勘察，已被本设计取代）。
> 外部参考资料：[`docs/references/`](../../../references/README.md)（erwin 官方文档存档，含来源页名与已知缺口）。
> 配套计划文档将在本设计评审通过后由 `writing-plans` 生成。

---

## 0. 术语与文档约定

### 0.1 本项目术语

| 术语 | 定义 | 英文 | erwin 对应 |
|---|---|---|---|
| 逻辑族 | 封闭集合中的基础抽象类型，各自带参数规范与默认方言映射 | Logical Type Family | DSM 的默认逻辑数据类型 |
| 逻辑域（Domain） | 用户或系统定义的、带名字的逻辑类型，引用一个族并可覆写其方言映射 | Logical Domain | **Domain（逻辑）** |
| 物理域 | 一个逻辑域在某目标方言下的落地形态（物理类型名 + 参数 + 可选 schema） | Physical Domain | **Domain（物理）** |
| DSL 描述 | 元模型自身的序列化表示，作为导出器与生成器之间的中间格式 | DSL Document | XML Standard Files（目标形态） |
| 物理规格 | 某个目标方言下可落地的类型描述（类型名 + 长度/精度 + 字符集语义等） | Physical Spec | 物理数据类型 |
| 方言映射 | 逻辑类型 → 某方言物理规格的映射规则 | Dialect Mapping | **DSM Mapping 页**（From 数据库 → To 数据库） |
| 数据类型标准（DSM） | 成组的逻辑类型定义 + 映射规则，作为可应用、可覆盖的配置单元 | Data Standards Management | **DSM Option** |
| 物理覆盖 | 字段级对物理规格的显式改写，优先级最高 | Physical Override | 物理模式下对列数据类型的直接编辑 |
| 类型解析 | 由逻辑类型 + 参数 + 覆盖得出一个物理规格的过程 | Type Resolution | DSM 分配物理类型 |
| 方言 lint | 针对某目标方言的合法性校验，产出诊断列表 | Dialect Lint | erwin 的模型验证报告 |

> **术语对齐说明**：erwin 官方把"一组逻辑数据类型 + 其跨库映射"叫 **DSM（Data Standards
> Management）**。本项目此前称其为"元定义"，为避免与 erwin 用户（用户本人正在用 erwin）
> 沟通时产生歧义，本文档统一改用 **DSM / 数据类型标准**。

### 0.2 消歧声明

本项目中的「物理视图 / 逻辑视图」是**数据建模**语义，**不是** C4/4+1 架构语义。

> - 逻辑视图 = 数据结构的**逻辑模型**（实体、关系、类型名称与业务含义）。
> - 物理视图 = 数据结构的**物理模型**（表、字段、物理类型规格、约束实现）。

erwin 官方的定义与本项目一致（来源：`references/erwin/html/The_Logical_Model.html`、
`The_Physical_Model.html`）：

- erwin 逻辑模型 = "represents all of the logical business requirements of an organization"；
  物理模型 = "captures the exact design of the physical database, including column
  datatypes and constraints, index assignments, denormalized tables, physical storage
  assignments"。
- erwin 的逻辑/物理模型是**同一个模型的两层**，可用 Standard toolbar 上的
  Logical/Physical 下拉切换，Model Explorer 与图上的对象随之切换。

**但有一处关键差异**：erwin 的逻辑模型与物理模型是**两个可分别编辑**的模型
（`Logical Only` / `Physical Only` 标记），**不是一个数据的两种显示精度**。
本设计因此把模型从"单层 + 显示模式"升级为"**双层并存**"（§3）。

**本项目对 erwin 的三处有意偏离**：

1. **字段级**：erwin 允许逻辑属性与物理列不对称存在，而本项目**强制一对一对应**
   （用户裁决 2026-10-27）。详见 §3.5.1「与 erwin 的差异（有意偏离）」。
2. **逻辑键组**：erwin 的 Key Group 是独立对象（带 Definition、PK/FK/AK/IE 类型），
   本项目**不设独立对象**，改用挂在逻辑属性上的键语义位 + 物理索引上的定义文本。
   详见 §3.7.5。
3. **实体/表**：erwin 的逻辑模型与物理模型是两个平行模型，本项目把逻辑实体
   **内嵌**在物理表内（`Table.logical`），避免"孤儿实体"。详见 §3.7.5。

> 元素级的完整对照与裁决见 **§3.7「其他元素的逻辑/物理对应」**。
> **索引（Index）作为数据库管理对象的完整生命周期、缺口清单与裁决见 §3.8**
> （2026-10-27 用户从数据库管理角度补充：现状缺失索引的维护能力）。

> 另一处 erwin 能力（Domain Parent 父域继承）本期**不实现**，
> 但 DSL Schema 保留该字段以备后续（用户裁决 2026-10-27，§11 Q13）。

---

## 1. 目标与非目标

### 1.1 目标

1. 引入**逻辑类型层**，使逻辑元定义独立于任何方言字面量。
2. 把模型升级为**逻辑层 + 物理层双层并存**（erwin 式）：逻辑层描述业务意图，
   物理层描述落地实现，两层**可分别编辑**；字段级强制一对一对应（§3.5.1）。
3. 用**单一映射机制**（DSM）替代当前 7 个方言导出器中重复的类型处理逻辑（消除两两映射网格）。
4. 支持**用户自定义逻辑域（Domain）**，并支持自定义已有族的方言映射。
5. 支持**三级作用域**的映射配置：应用级 / 工作区级 / 图级。
6. 提供**方言 lint**，持续校验元定义对某目标方言的合法性。
7. 让物理层的修改成为**一等公民**（用户可改，且用户的选择被保留）。
8. 提供 **erwin 数据导入**（第一版）：读入 erwin 导出的 XML Standard Files，
   同时还原逻辑层与物理层。
9. 提供**统一的字段编辑面板**：同一屏内呈现逻辑属性与物理字段的全部信息，
   让"物理 ↔ 逻辑"的对应维护成为一次连贯操作（§7.0、§7.4）。

### 1.2 非目标（本期明确不做）

| 不做 | 理由 |
|---|---|
| 一图多库 | 存储与逻辑复杂度显著增加；本期采用一图一库，多库需求通过完善映射模板 + 转换到新图满足 |
| 跨方言应用的元定义同步 / 多来源模型同步 | erwin 有 Model Sources 机制（`references/erwin/html/Model_Sources.html`），本期不实现；列为二期 |
| 历史数据兼容 / schema 版本迁移 | 项目处于 alpha 之前，无真实用户数据；alpha/beta 阶段 schema 变更是可承担的软件迭代成本 |
| 逻辑/物理名称的自动同步 | 二期议题（见 §7.3）。erwin 有 NSM 的 "Physical to Logical" 开关与 `%AttName` 宏可作参考 |
| 结构化复合类型（UDT）的完整物化 | 本期只支持**标量域**的物化策略；结构化类型沿用现状 |
| 模型比对 / 合并 / 冲突自动裁决 | erwin 有 Type Resolution Wizard 机制（`CC_Type_Resolution_Wizard`），本期不实现；列为二期议题 |
| erwin 逆向工程（从数据库读模型） | 本期只做正向导入（erwin 文件 → 本项目） |

---

## 2. 核心不变式

1. **不变式 1（类型即名称）**：逻辑侧只有**类型名称**（族名或域名），
   不出现任何方言字面量。方言字面量只存在于物理侧。
2. **不变式 2（视图即层）**：逻辑视图显示**逻辑层**（逻辑名 + 逻辑类型名）；
   物理视图显示**物理层**（物理名 + 物理类型规格）。
   域显示自己的名字（`UnicodeString`），不显示其族（`string`）。
   （**编辑面板不在此不变式约束内** —— 编辑面板显示两层全部信息，§7.0。）
3. **不变式 3（物理类型是数据，不是推导物）**：物理类型**存储在字段上**
   （`Field.fieldType`），因为它是用户资产、可能来自 erwin 导入、必须能被检查。
   映射用于**生成与校验**物理类型，但不强制重写用户已定的值 ——
   是否自动重算由 `Field.fieldTypeSource` 决定（§3.4）。
4. **不变式 4（诊断不存储）**：lint 诊断是派生数据，随时现算现报。
   被保留的是**用户做出的选择**（物理覆盖 / 显式物理类型）。
5. **不变式 5（单向下推）**：映射、参数、覆盖只从逻辑层向物理层单向推导。
   物理层的编辑产出**物理层的显式值**，不回写逻辑层。
6. **不变式 6（双层可分别编辑，字段级一对一）**：逻辑层与物理层是**两份可分别编辑的
   数据**（各自独立编辑、独立命名、独立渲染），这是 erwin 模式的核心。
   但在**字段级**，逻辑属性与物理字段**强制一对一对应**（用户裁决 2026-10-27）——
   删除任一侧必然同时删除另一侧，不允许"只逻辑无物理"或"只物理无逻辑"的常态状态。
   erwin 的 `Logical Only` / `Physical Only` 在本项目中降级为**导入/异常数据的诊断提示**，
   而非合法的建模状态（§3.5.1、§3.5.2）。
   > **注意：不变式 6 约束的是字段级**。元素级（键组、关系、字段约束、类型）的
   > 对应规则各不相同 —— 多数**不强制一对一**。完整规则见 **§3.7.4**。
7. **不变式 7（元素级对应按语义，不按数量）**：每个元素类的逻辑侧只承载
   **业务决定的部分**，物理侧承载**数据库决定的部分**；是否强制一一对应，
   取决于该类元素是否需要显式的对应关系来维护一致性（§3.7.4）。
   反例：字段级约束（`notNull`/`check`/`default`）在物理层是**具体实现**，
   逻辑层只需一条"是否必填"的业务语义，不做逐项孪生。

---

## 3. 数据模型（双层）

### 3.0 双层结构总览

erwin 官方对照表（`references/erwin/html/Comparison_of_Logical_and_Physical_Model_Objects.html`）：

| 逻辑对象 | 物理对象 | 本项目对应 |
|---|---|---|
| Entity | Table | `Table.logical`（逻辑实体，**内嵌**）+ `Table`（物理表）—— 内嵌式一对一，§3.7.4 |
| Attribute | Column | `LogicalAttribute[]` + `PhysicalField[]`（靠 id 关联，**强制一对一**，§3.5.1） |
| Domain (Logical) | Domain (Physical) | `LogicalDomain` + 各方言 `PhysicalDomainSpec` |
| Key Group | Index | **不设独立逻辑对象**：键语义位挂逻辑属性（`keyRole`），定义文本挂物理索引（§3.7.4、§3.7.5） |
| Relationship | Relationship | `LogicalRelationship`（角色名/基数/关系类型）+ `Relationship`（物理 FK）—— **强制一对一**，逻辑多对多/子类型允许 `physicalPending`（§3.7.4） |
| View / View Relationship | 不适用 | 沿用现状 `Diagram.views`（**物理侧独有**，与 erwin 一致） |
| 字段级约束 | 不适用（物理实现） | 物理侧 `PhysicalField.notNull/unique/check/default`；逻辑侧仅"是否必填"一条业务语义（§3.7.4） |
| 自定义类型（UDT） | 不适用（物理实现） | 物理侧 `CustomType`；逻辑侧不承载 |
| 枚举 | 物理原生枚举 | 逻辑侧"业务取值域"（属性级 `values`）→ 物理侧 `Enum`，一对多、不强制（§3.7.4） |
| 物理索引 | Index | 物理侧 `Table.indices`：`Index`（**双名** `logicalName`/`name` + 自动命名、`columns` 按字段 id、`unique`、`type`、`where`、`include`、`comment`、`supportsRelationshipId`）—— 索引**是物理层对象**，但需要完整维护（§3.8） |
| 物理键约束 | PrimaryKey / UniqueKey / ForeignKey | `Table.primaryKey` / `Table.uniqueKeys` / `Table.foreignKeys` —— 三类均为**独立双名具名对象**（`field.primary` 废弃，`UniqueConstraint` 被 `UniqueKey` 取代；`ForeignKey` 经 `relationshipId` 关联 `Relationship`，INV-10 一对一）（§3.8.3 裁决 2，D27） |

> **完整的元素级对照、现状代码承载情况与裁决依据见 §3.7**（本表为摘要）。
> **索引（Index）的完整生命周期、缺口清单与裁决见 §3.8**。

> **为何平行数组而非嵌套**：用户裁决 Q11 —— 采用 `attributes[]` 与 `Fields[]` 平行、
> 靠 id 关联的结构（更贴近 erwin 文件结构，导入映射更直接）。
> erwin 内部用嵌套子集合（`Entity.Collect(oEntity,"Attribute")`），但那只是文件序列化形式；
> 我们的 id 关联让"逻辑属性 ↔ 物理列"的对应关系**显式可查**，且允许不对应。
> 代价是需要一致性不变量（§3.5）。

```ts
// ── 逻辑层（业务语义） ─────────────────────────────────────────
export interface LogicalEntity {
  /** 稳定 id（对应 erwin EntryId） */
  id: string;
  /** 逻辑名（对应 erwin EntryName），逻辑视图显示 */
  name: string;
  /** 逻辑描述（对应 erwin EntryDesc） */
  description?: string;
  /** 逻辑属性；与物理字段靠 attribute.fieldId 关联（一对一，见 §3.5） */
  attributes: LogicalAttribute[];
  /**
   * 仅存在于逻辑层（erwin: Logical Only）。
   * 字段级强制一对一后，正常建模路径不会出现该状态 —— 它只用于
   * 标记 erwin 导入源数据的不对称情况（§3.5.1、§3.5.2）。
   */
  logicalOnly?: boolean;
}

export interface LogicalAttribute {
  id: string;
  /** 逻辑名（对应 erwin attributeName），逻辑视图显示 */
  name: string;
  /** 逻辑描述（对应 erwin arributeDesc） */
  description?: string;
  /** 逻辑类型：族 或 域（二选一，见 §3.1） */
  logicalType: LogicalTypeRef;
  /** 字段级逻辑参数覆盖（如 length） */
  params?: TypeParams;
  /**
   * 关联的物理字段 id。
   * 字段级强制一对一（§3.5）：正常数据中必填且必存在；导入源数据不对称时
   * 允许为空，此时 logicalOnly 为 true。
   */
  fieldId?: string;
  /** 仅存在于逻辑层（导入异常标记，见上） */
  logicalOnly?: boolean;
}

// ── 物理层（落地实现） ─────────────────────────────────────────
export interface PhysicalField {
  id: string;
  /** 物理列名（对应 erwin fieldName），导出 SQL 用它 */
  name: string;
  /** 物理类型规格（存储值，非推导物，见不变式 3） */
  fieldType: PhysicalSpec;
  /** 该物理类型的来源，决定映射变化时是否自动重算 */
  fieldTypeSource: FieldTypeSource;
  /** 物理层描述（对应 erwin Field.Comment） */
  comment?: string;
  /**
   * 仅存在于物理层（erwin: Physical Only）。
   * 字段级强制一对一后，正常建模路径不会出现该状态 —— 只用于标记
   * erwin 导入源数据的不对称情况（§3.5.1、§3.5.2）。
   */
  physicalOnly?: boolean;
}
```

### 3.1 逻辑类型引用

```ts
export type LogicalTypeRef =
  | { family: LogicalFamilyId }     // 使用族，如 "string"
  | { domainId: string };            // 使用逻辑域，如 "UnicodeString"
```

两种形态**互斥**（二选一），不同时出现。域内部持有自己的族引用，
因此解析时总能拿到族。

> 用户裁决 Q1 的**最终形态**：原为 `typeId`，因与"SQL View"等概念混淆，
> 且 erwin 官方称 Domain，本设计改名为 `domainId`。

### 3.2 逻辑族

```ts
export interface ParamSpec {
  key: "length" | "precision" | "scale";
  label: string;          // i18n key
  default?: number;
  min?: number;
  max?: number;
}

export interface TypeMapping {
  /** 目标方言的物理类型名，如 "VARCHAR2" */
  type: string;
  /** 该映射默认的参数，如 { length: 50 } */
  params?: Partial<TypeParams>;
  /** 物理侧的附加语义，如 unicode / unsigned */
  flags?: PhysicalFlags;
}

export interface LogicalTypeFamily {
  id: LogicalFamilyId;         // "string" | "decimal" | ...
  label: string;               // i18n key
  params: ParamSpec[];         // 该族接受的参数规范
  defaultParams?: TypeParams;  // 族级默认参数
  /** 各方言的默认映射 */
  mappings: Record<DatabaseType, TypeMapping>;
  builtin: boolean;
}
```

**映射完整性规则（D1，已裁决）**：

| 族类别 | `mappings` 完整性 | 缺失方言的行为 |
|---|---|---|
| **内置族**（11 个） | **穷举**：每个方言一条，缺失即视为数据缺陷 | 报明确错误，提示补全；**不**静默回落 common |
| **用户自定义族** | 允许留空 | 该方言留空 → 走 common 规则（按字符串映射）+ 导出留痕 + lint 诊断 |

理由：内置族穷举保证任何内置类型在任何方言都有确定映射；新方言引入时会出现
明确的"待补全"清单，而不是运行期静默降级。用户自定义族允许留空，是因为用户
本就可能只为少数方言定义映射。

**内置族清单（11 个）**：

| 族 | 参数 | 默认参数 | 说明 |
|---|---|---|---|
| `string` | length | length=50 | 可变长字符串 |
| `text` | — | — | 长文本 |
| `integer` | — | — | 整数（含自增语义） |
| `decimal` | precision, scale | precision=10, scale=2 | 定点数 |
| `boolean` | — | — | 布尔 |
| `date` | — | — | 日期 |
| `datetime` | — | — | 日期时间 |
| `binary` | length | length=255 | 二进制 |
| `enum` | — | — | 取值受限；能否原生枚举由目标方言决定 |
| `json` | — | — | JSON 文档 |
| `uuid` | — | — | 全局唯一标识 |

> `other` 族被取消。未知/未解析类型落入独立的 `common`（未定义）族，
> 按字符串规则映射，并在导出时**留痕**（SQL 注释 + lint 诊断），不再静默降级为 `BLOB`。

### 3.3 逻辑域（Domain）

erwin 官方的 Domain 机制（`references/erwin/html/Data_Types_and_Data_Type_Standards.html`）
不是单向别名，而是**逻辑类型 + 物理类型 + 可选父域 + 可继承属性**的完整对象：

> Domain 持有可继承属性与不可继承属性；**逻辑 edit mode 下有 Logical Data Type，
> 物理 edit mode 下有 Physical Data Type（可带 Schema / Anchored to Type /
> Distinct Type）**；Domain 也支持 Logical Only / Physical Only。

因此本项目把原"具名逻辑类型"升级为**逻辑域**：

```ts
export interface LogicalDomain {
  id: string;
  /** 域名，如 "UnicodeString"、"姓名"；逻辑视图显示 */
  name: string;
  /** 所属族：参数规范来源 + 语义标签 */
  family: LogicalFamilyId;
  /** 覆写族默认参数 */
  params?: TypeParams;
  /** 各方言的物理形态；未列出的方言回落到族的映射 */
  physical?: Partial<Record<DatabaseType, PhysicalDomainSpec>>;
  /** 父域（erwin: Domain Parent）。
   *  本期**不实现**继承语义（Q13），字段保留仅为 DSL Schema 冗余与未来兼容。 */
  parentId?: string;
  /** 域的说明 */
  comment?: string;
  builtin?: boolean;
}

export interface PhysicalDomainSpec {
  /** 物理类型名，如 "NVARCHAR2" */
  type: string;
  /** 物理参数覆盖，如 { length: 100 } */
  params?: TypeParams;
  /** 该方言下的 schema（erwin 物理域支持 Schema） */
  schema?: string;
  /** 物化到目标库成为原生类型 */
  materialized?: boolean;
}
```

- 域**引用族**而非复制参数规范 → 参数合法性与默认值只有一处真相。
- 域在逻辑视图显示 `name`；族仅用于取参数规范与语义标签。
- 域可**不声明** `physical`，此时完全使用族映射。
- **父域继承（Q13，已裁决：本期不实现）**：`parentId` 字段保留在模型与 DSL Schema 中
  （冗余存储，为将来实现留出空间），但**本期解析器不沿父域链查找**，
  也不做深度限制。设置界面本期不暴露该字段的编辑入口。
  若将来实现，语义为：父域的 `params` 与 `physical` 作为子域的**底层**参与
  参数优先级链（§4.1），继承链深度限制在 3 层以避免不可调试的链式覆盖。

**枚举的归属（D2，已裁决）**：
- `enum` 是**族**，取值列表留在逻辑属性级 `LogicalAttribute.values`。
- 域层本期**只支持标量别名**（如"姓名" → `NVARCHAR2(100)`），
  **不支持枚举复用**（"定义一个枚举类型并在多张表复用"列为独立议题）。
- `enum` 进入基础层的意义在于：**族决定"目标方言能否用原生枚举"**，
  即 `enum` 族到某方言的映射是原生 `ENUM` 还是回落为字符串 + CHECK 约束。

### 3.3.1 全局唯一性（Q1，已裁决）

用户裁决：「**保持全局唯一，特别是映射定义**」。

**域与映射定义是全局唯一对象，不是分层可覆盖的同名条目。** 三级作用域
（§5）管的是**同一对象的取值来源**，不是**同名对象的并存**。

| 层面 | 是否允许同名并存 | 说明 |
|---|---|---|
| **逻辑域（Domain）** | ❌ 不允许 | 全局唯一键 = `name`（大小写不敏感、去除首尾空白后比较）。一个"姓名"域在整个工作区只有一个定义。 |
| **族（Family）** | ❌ 不允许 | 族 id 全局唯一；用户自定义族不得与内置族同名。 |
| **映射定义**（域→某方言的物理形态、族→某方言的映射） | ❌ 不允许 | 映射是**挂在唯一对象上的属性**（`LogicalDomain.physical[db]`、`family.mappings[db]`），不是独立命名实体，因此天然唯一。 |

**因此取消"同名不同定义"的裁决问题**：跨作用域出现同名域时，不再是"就近覆盖"
或"报冲突"，而是**一个对象**。

**跨作用域的语义变为：值的来源优先级，不是定义的优先级。**

| 对象 | 作用域的作用 |
|---|---|
| 逻辑域 | **定义只在创建它的作用域存在**（应用级创建 → 全局可见且只读；工作区级创建 → 仅本工作区可见；图级创建 → 仅本图可见）。同名域在别处出现时，视为**同一个域**，读取其参数与映射时按优先级链取（§5） |
| 族的方言映射 | 应用级定义 = 系统默认；工作区级/图级可**覆盖某一方言的映射值**（覆写 `family.mappings[db]` 的某一项，而非新增同名映射条目） |
| 域的物理形态 | 同上：`LogicalDomain.physical[db]` 的某一方言项可被工作区级/图级覆盖 |

**覆盖的粒度**：覆盖**只作用于一个明确的目标**（某域 / 某族的某个方言项），
**不允许"整层替换"**。因此不存在"同名两条记录哪条赢"的歧义 —— 只有
"这个域的这个方言的映射，当前取哪一层的值"。

**命名冲突的处理**：创建域/族时若名称已被占用 → **拒绝创建并提示**
"该名称已被使用（定义于 X 作用域）"，提供"跳转到已有定义"或
"在工作区/图作用域覆盖其某一方言映射"两个后续动作（§6 的
`DialectDiagnostic` 增 `NAME_CONFLICT` 提示码）。

**唯一性的作用域边界**：全局唯一指**同一工作区内唯一**（应用级 + 工作区级 + 该工作区的所有图）。
不同工作区之间天然隔离（工作区级存储本地，见 §5），不构成冲突。
未来若接入云端账号体系，跨工作区的唯一性策略需重新评估（列为二期）。

**带来的收益**：
- 映射定义全局唯一 → **不会出现"这个字段到底用了哪条映射"的歧义**，lint 与解析器无需处理同名歧义分支。
- 域可被多张表、多个图复用（"姓名"域在 20 张表里用同一个定义），这正是 erwin Domain 的价值。
- 解析器的查找路径从"按名逐层搜索"简化为"按名定位唯一对象 → 取值按优先级链"。

### 3.4 物理规格与来源标记

```ts
export interface PhysicalSpec {
  type: string;                    // 物理类型名，如 "NVARCHAR2"
  length?: number;
  precision?: number;
  scale?: number;
  flags?: PhysicalFlags;           // unicode / unsigned / autoincrement ...
  /** true 表示该物理类型在目标库是原生用户自定义类型（物化产物） */
  materialized?: boolean;
}

export type PhysicalFlags = {
  unicode?: boolean;
  unsigned?: boolean;
  autoincrement?: boolean;
};

/**
 * 物理类型的来源，决定映射变化时是否自动重算（用户裁决 Q8）。
 * - mapped   ：由 DSM 映射生成 → 映射/参数变化时自动重算
 * - explicit ：用户手工设定 → 映射变化时不动
 * - imported ：从 erwin 导入的既有物理定义 → 默认不动，可批量转为 mapped
 */
export type FieldTypeSource = "mapped" | "explicit" | "imported";
```

**物理字段**（物理层，取代现状 `Field` 的物理部分）：

```ts
export interface PhysicalField {
  id: string;
  /** 物理列名，导出 SQL 用它 */
  name: string;
  /** 物理类型规格（存储值，非推导物 —— 不变式 3） */
  fieldType: PhysicalSpec;
  /** 来源标记 */
  fieldTypeSource: FieldTypeSource;
  /** 物理层描述（对应 erwin Field.Comment） */
  comment?: string;
  /** 仅存在于物理层 */
  physicalOnly?: boolean;
  // —— 约束与默认值（物理层属性，沿用现状语义） ——
  default?: string | number | boolean;   // 初始化值，可为函数
  check?: string;
  primary?: boolean;
  unique?: boolean;
  nullable?: boolean;
  notNull?: boolean;
  unsigned?: boolean;
  increment?: boolean;
  values?: string[];                      // enum 取值
  metadata?: Metadata;
}
```

**表（双层容器）**：

```ts
export interface Table {
  id: string;
  /** 物理表名，导出 SQL 用它 */
  name: string;
  /** 物理表注释（erwin: table comment） */
  comment?: string;
  /** 逻辑层（实体） */
  logical: LogicalEntity;
  /** 物理层（字段） */
  fields: PhysicalField[];
  // —— 布局与索引（物理层，沿用现状） ——
  x: number;
  y: number;
  width?: number;
  indices?: Index[];
  uniqueConstraints?: UniqueConstraint[];
  color?: string;
  inherits?: string[];
  locked?: boolean;
  hidden?: boolean;
  collapsed?: boolean;
  details?: { x?: number; y?: number; width?: number; height?: number };
  metadata?: Metadata;
}
```

**要点**：

- 现状 `Field.type`（方言字面量）与 `Field.size` **移除**：
  `type` → `fieldType.type` + `fieldType.length/precision/scale`；
  `size` → 并入逻辑参数 `params` 与物理规格。
- 现状 `Field.comment`（描述）迁到 `PhysicalField.comment`，且
  **逻辑侧另有 `LogicalAttribute.description`** —— 两者是不同层的不同信息，
  这正是 erwin 区分 `EntryDesc` 与 `comment` 的做法。
- 现状 `Field.logicName` **不再是字段属性**，而是逻辑层的 `LogicalAttribute.name`。
  逻辑视图显示逻辑属性名，物理视图显示物理列名。
- 物理类型**是存储的数据**（不变式 3），因此：
  - 用户手改后 `fieldTypeSource` 置 `explicit`，映射再变也不动它；
  - erwin 导入的物理类型置 `imported`，默认不动，可批量转 `mapped` 以启用自动重算。

### 3.5 一致性不变量（平行数组的配套约束）

平行数组换来的显式对应关系，必须由不变量守住，否则会产生孤儿数据。

> **前提（用户裁决 2026-10-27）**：本项目**假定逻辑属性与物理字段保持一对一对应**。
> 这是一个**有意的简化**，与 erwin 允许不对称的 `Logical Only` / `Physical Only` 不同 ——
> 详见 §3.5.1「与 erwin 的差异」。

| 编号 | 不变量 | 违反时的处理 |
|---|---|---|
| INV-1 | `LogicalAttribute.fieldId` 若存在，必须指向同一 `Table.fields` 中存在的字段 | 导入时丢弃该引用并报 lint；保存前拒绝 |
| INV-2 | 同一 `Table` 内 `LogicalAttribute.id` 唯一；`PhysicalField.id` 唯一 | 导入时去重（保留首次）并报 lint |
| INV-3 | 同一 `Table` 内 `LogicalAttribute.name` 唯一；`PhysicalField.name` 唯一 | 报 lint，不自动改名 |
| INV-4 | 每个 `PhysicalField` **必须**有且仅有一个对应的 `LogicalAttribute`；每个 `LogicalAttribute` 同样**必须**有且仅有一个对应的 `PhysicalField` | 缺失或多余 → 视为数据缺陷，报 lint 并在保存前拒绝（见 §3.5.2 同步规则） |
| INV-5 | 物理字段与逻辑属性成对时，**物理层类型与逻辑层类型可以不一致**（用户显式改过） | 合法，由 lint 报 `TYPE_CAPABILITY_MISMATCH` 之类提示，不阻断 |
| INV-6 | 每个**逻辑关系**必须有且仅有一个对应的**物理关系**（FK 实现）；逻辑多对多/子类型关系可显式声明 `physicalPending` 而暂无物理实现 | 逻辑关系无物理实现且未声明 `physicalPending` → 报 lint `RELATIONSHIP_NOT_IMPLEMENTED`（§3.7.4） |
| INV-7 | 每个**物理表**必须有且仅有一个**逻辑实体**（`Table.logical` 内嵌，一对一） | 缺失 → 视为数据缺陷，报 lint；导入时补建并保留物理名 |
| INV-8 | 每个**物理索引**引用的字段 id 必须存在于其所属表中；索引名在整个图内唯一（schema 级命名空间） | 引用失效 → 报 lint `index.unknown_field`；重名 → 报 lint `index.duplicate_schema_name`（§3.8.3 裁决 6） |
| INV-9 | 每个表**至多一个 PK**；PK/UK 的 `columns` 引用必须存在；PK/UK/FK/索引的**物理名**共享 schema 级全局命名空间、**逻辑名**在同表内唯一 | 多 PK → `table.multiple_primary_keys`；列引用失效 → `constraint.no_columns`；物理名撞名 → `constraint.duplicate_schema_name`；逻辑名撞名 → `constraint.duplicate_logical_name`（§3.8.3 裁决 6） |
| INV-10 | `Relationship` ↔ `ForeignKey` **强制一对一**（用户追加裁决 2026-10-27：FK 独立成对象）：每条关系有且仅有一个配套 FK 对象（挂在子表），创建关系时自动创建、删除关系时级联删除 | FK 指向不存在的关系 → `constraint.fk_without_relationship`；关系无配套 FK → `constraint.relationship_without_fk`（自动创建兜底，仍报诊断）（§3.8.3 裁决 2/6） |

> **INV-1..INV-5 约束的是字段级**；INV-6（关系）与 INV-7（实体/表）是元素级的补充，
> INV-8（索引）是数据库管理对象的补充，
> 完整的元素级对应规则见 **§3.7.4**，索引规则见 **§3.8**。其余元素类
> （键组、字段约束、类型）**不强制一对一**，
> 因为它们的对应关系是"可选子集"或"一对多"，不需要不变量守护。

**INV-4 的实现要点**：一对一对应意味着 `LogicalAttribute.fieldId` 实际是**冗余存储** ——
按 id 关联的好处是"对应关系显式可查"（便于 erwin 导入时的双向映射与差异比对），
代价是需要不变量守住。实现上可用 `Map<fieldId, attribute>` 建立索引做 O(1) 校验，
导入与渲染时都按此索引操作，不做线性扫描。

#### 3.5.1 与 erwin 的差异（有意偏离）

| 维度 | erwin | 本项目 |
|---|---|---|
| 对应关系 | 允许 `Logical Only`（只有逻辑）/ `Physical Only`（只有物理） | **强制一对一**（用户裁决 2026-10-27） |
| 未对应对象的 UI | 各自独立显示并带标记 | 不存在"未对应"状态 |
| 导入遇到无对应 | 保留为单边对象 | 报 lint（`LOGICAL_ONLY` / `PHYSICAL_ONLY` 诊断在此**降级为"异常提示"**，仍保留 code 以便 erwin 导入时说明情况） |

**为什么偏离**：erwin 的非对称能力服务于"逻辑建模与物理建模解耦、分阶段推进"的
大型组织场景；本项目的定位是**可用的 erwin 编辑器**，用户心智是"一张表 = 一组字段"，
一对一对应更符合直觉，也省掉一整套"半物理化对象"的边界 UI 与渲染分支。

**不变的 erwin 借鉴**：逻辑层与物理层仍是**两份可分别编辑的数据**（§0.2、§3.0），
而不是同一份数据的两种显示精度 —— 这是 erwin 模式的核心，本次完整继承。

**代价与后续**：若将来需要支持"先做逻辑设计、暂不物理化"的场景，
需要放宽 INV-4，并引入"字段是否已物理化"的显式状态位。本期不做（§11 Q16）。

#### 3.5.2 同步规则（一对一前提下的删除语义）

- 在物理视图重命名物理列 → **只改物理层**（`PhysicalField.name`），逻辑属性名不动。
- 在逻辑视图重命名逻辑属性 → **只改逻辑层**（`LogicalAttribute.name`），物理列名不动。
- **删除物理字段 → 同时删除对应的逻辑属性**（用户裁决 2026-10-27：物理与逻辑保持一对一）。
  删除是一个**跨层的原子操作**，UI 需明确提示"将同时删除逻辑属性"。
- **删除逻辑属性 → 同时删除对应的物理字段**（对称）。
  这与 erwin 的"删一边留另一边"不同，是一对一下的必然结果。
- 因此 §6.2 中的 `LOGICAL_ONLY` / `PHYSICAL_ONLY` 在**正常运行路径下不会出现**，
  只在 **erwin 导入**（源数据可能不对称）或**历史/异常数据**中出现 —— 它们的语义
  变为"数据异常提示"，而非"合法的建模状态"。

**中间态 vs 数据缺陷**（实现要点，Q20 引入编辑面板后必须区分）：
- 编辑会话中"刚新增、还没填完"的一对字段是**暂态**，允许存在、可保存为草稿；
  保存时 INV-4 只**提示**，不阻断。
- **erwin 导入产物**的不对称是**缺陷**：按 §16.5（Q18）在对应位置标记为无效
  （`InvalidMarker`），并在导入报告中列出。
- 区分依据是"该对是否由本次编辑会话创建"与来源标记（`fieldTypeSource`），
  不是靠字段自身状态。

### 3.6 逻辑名与物理名

- 逻辑名 = `LogicalAttribute.name`；物理名 = `PhysicalField.name`。
- 二者**不做自动同步**（§7.3 列为二期议题）。
  erwin 有 NSM 的 "Physical to Logical" 开关与 `%AttName` 等宏可作参考实现依据
  （`references/erwin/html/name_mapping_conventions_using_macros.html`）。

### 3.7 其他元素的逻辑/物理对应（元素级审计，2026-10-27）

> **本节起因**：用户审计指出（2026-10-27）——
> 「不单是字段存在物理/逻辑问题，**其他元素也存在，例如实体/表，PK/UK/FK 中的字段，type**」。
> 复核结论：§3.5 的 INV-4 一对一不变量与 §3.6 的同步规则**只覆盖字段层**，
> 而 erwin 的逻辑/物理划分是**贯穿全部模型对象**的。本节把这件事补齐。
>
> **本节的定位**：先给出**事实与差距**（erwin 官方怎么说、现状代码怎么承载），
> 再给出**本项目的裁决**。凡涉及"是否新增逻辑侧对象"的决策，均已在
> §11 登记为 Q21–Q26。

#### 3.7.1 erwin 官方的元素级对照

来源：`references/erwin/html/Comparison_of_Logical_and_Physical_Model_Objects.html`
（该页的对照表原文已核对，见本节表格右列）。

| 逻辑对象 | 物理对象 | erwin 官方对照表原文要点 |
|---|---|---|
| Entity | Table | 逻辑分 *Dependent entity* / *Independent entity*；物理分 *Parent table*（FK 属于子表 PK）/ *Child table*（FK 不属于子表 PK） |
| Attribute | Column | 逻辑数据类型（text/number/datetime/blob）↔ 物理数据类型（char(18)/int/varchar） |
| Domain (Logical) | Domain (Physical) | 一一对应，两侧各有独立定义 |
| **Key Group** | **Index** | 逻辑侧 PK / FK / AK / IE 四种；物理侧为 *PK（模型内）+ PK Index（schema 内）* / *FK（模型内）+ FK Index（schema 内）* / *唯一非主索引* / *非唯一索引* |
| **Relationship** | **Relationship（用 FK 实现）** | 逻辑侧含 Identifying / Non-Identifying / Subtype / Many-to-many / Referential Integrity / Cardinality；物理侧为 *FK 属于子表 PK（线上方）* / *FK 不属于子表 PK（线下方）* / Denormalized tables / Associative table / 触发器 / 基数记号 *Zero, One or More…* |
| View / View Relationship | **不适用** | 官方明确：View 只在物理侧存在 |
| Pre-/Post-script | 不适用 | 仅物理侧 |

补充事实（已核对来源页）：

- `Enter_a_key_group_definition.html`：Key Group 的 **Definition 文本在逻辑/物理模型中
  会迁移到物理侧成为 index comment** —— 即逻辑键组带有一段业务定义，落地为索引注释。
- `The_Logical_Model.html`：逻辑模型 = "all of the logical business requirements of an
  organization"；三级成熟度 ERD → Key Based Model → Fully Attributed Model。
- `The_Physical_Model.html`：物理模型 = "exact design of the physical database, including
  column datatypes and constraints, index assignments, denormalized tables, physical storage
  assignments"。
- `Entities.html` / `Tables.html`：逻辑与物理两侧**都是"独立/依赖"二分**，
  依赖性由所处关系类型决定 —— 逻辑侧 Independent/Dependent Entity 与物理侧
  Independent/Child Table 是**同一语义的两层表述**。
- `Comparison_of_Logical_and_Physical_Models.html`：多对多关系与子类型关系
  **只能在逻辑侧创建**（物理侧只能查看），需在物理侧解析为关联表/具体化实现；
  View 与 View Relationship **只能在物理侧创建**。

#### 3.7.2 现状代码的承载情况（实测）

| 现状对象 | 代码位置 | 现状归属 | 现状缺口 |
|---|---|---|---|
| 表 | `core/src/models/table.ts:19-37` `Table { id; name; x; y; width?; fields: Field[]; comment?; locked?; hidden?; collapsed?; details?; indices?; uniqueConstraints?; color?; inherits?; metadata? }` | 物理侧（`Table.logical` 承载逻辑实体） | 表级约束无逻辑侧对象；无 Independent/Dependent 区分 |
| 字段 | `core/src/models/field.ts:5-21` `Field { id; name; type; default?; check?; primary?; unique?; nullable?; notNull?; unsigned?; increment?; comment?; size?; values?; metadata? }` | 物理侧 | 字段级约束（`notNull`/`unique`/`check`/`default`）无逻辑侧 |
| 索引/唯一约束 | `core/src/models/table.ts:6-17` `Index { id?; name; unique: boolean; fields: string[] }` / `UniqueConstraint { id?; name; fields: string[] }` | 物理侧 | **无逻辑键组**；且 `fields: string[]` 存的是**字段名不是 id**（`export/shared.ts:112-114` 直接当列名 quote；`dbml/export.ts:136-140` 同） |
| 关系 | `core/src/models/relationship.ts:9-21` `Relationship { id; startTableId; startFieldId; endTableId; endFieldId; name?; cardinality?; updateConstraint?; deleteConstraint?; fields?: RelationshipFieldPair[] }` | 物理侧 | **无逻辑关系**（角色名/基数语义在逻辑侧缺失）；复合 FK 用 id 引用（`export/shared.ts:31-37`），与索引的"按名字"不一致 |
| SQL View | `core/src/models/view.ts` `View { id; name; x; y; width?; baseTableId?; joins?; columns?; conditions?; comment?; materialized?; locked?; hidden?; color?; metadata? }` | 物理侧 | 与 erwin 一致（View 不适用逻辑侧）—— **这是现状唯一正确的对齐项** |
| 自定义类型（UDT） | `core/src/models/type.ts:13-19` `CustomType { id?; name; fields: TypeField[]; comment?; metadata? }` | 物理侧 | 逻辑侧无对应（逻辑侧只有 `LogicalDomain`） |
| 枚举 | `core/src/models/enum.ts:5-9` `Enum { id?; name; values: string[]; metadata? }` | 物理侧 | 逻辑侧无"业务取值域" |
| 备注/区域 | `core/src/models/note.ts`、`area.ts` | 物理侧（画布装饰） | 与 erwin 一致（无逻辑侧） |

导出器与校验器对上述物理字段的直读点（迁移时必须逐一改到新结构）：
`export/mysql.ts:39-63,73-75`、`export/postgres.ts:216-252`、`export/mssql.ts:143-194`、
`export/oraclesql.ts:109-132`、`export/sqlite.ts:79`、`export/generic.ts:137-173`、
`export/shared.ts:101-114`（唯一约束按名字 quote）、`export/shared.ts:31-37`（FK 按 id 查名）；
导入侧 `sql/import/{mysql,mariadb,mssql,oraclesql}.ts`；
DBML 侧 `dbml/export.ts:53-54,136-140`、`dbml/parse.ts:119-147`、
`dbml/reconcile.ts:207-269`、`dbml/diff.ts:11-23`；
校验侧 `validation/rules.ts:173`（notNull/nullable 冲突）、`:301-348`（索引与唯一约束字段名存在性）。

#### 3.7.3 差距总结

现状设计把双层拆分**只做在"字段的类型"这一件事上**（逻辑域/物理规格），
其余成对元素**整体归入物理层**。按 erwin 官方对照表，现状缺三类逻辑侧承载：

1. **逻辑键组（Key Group）** —— 现状 PK/UK 只有物理形态（`field.primary` 布尔 +
   `Table.indices` / `Table.uniqueConstraints`），没有"业务上的主键/候选键"这一层对象，
   也就没有 erwin 所说的 Key Group **Definition**（业务定义，落地为索引注释）。
2. **逻辑关系** —— 现状 `Relationship` 是纯物理对象（引用 tableId/fieldId），
   逻辑侧的关系语义（角色名、基数、识别/非识别、多对多/子类型）无处安放。
3. **逻辑层的约束与取值域** —— `notNull`/`unique`/`check`/`default`/枚举取值都只在物理层，
   逻辑层只有"名称 + 类型"。

另外两处**现状与 erwin 一致、不需要改**：SQL View（物理侧独有）、备注/区域（装饰物）。

#### 3.7.4 本项目的裁决

> **总原则**：不追求"每个物理字段都有一个逻辑孪生"。
> 双层的意义在于**业务语义与落地实现分离**，因此每一类元素先问一个问题：
> **"这个元素的哪些部分是业务决定（逻辑）、哪些部分是数据库决定（物理）？"**
> 只有被业务决定的部分才需要逻辑侧承载；纯实现细节保持物理侧单层。

| 元素类 | 逻辑侧承载 | 物理侧承载 | 对应规则 |
|---|---|---|---|
| **实体/表** | `Table.logical`（`LogicalEntity`，含 name/description） | `Table`（name/comment/布局） | **内嵌式一对一**（逻辑实体是物理表的一部分，不是平行数组）→ 不产生孤儿问题 |
| **属性/字段** | `LogicalAttribute[]` | `PhysicalField[]` | **平行数组 + id 关联 + 强制一对一**（§3.5，Q11/§3.5.1） |
| **键组（PK/UK/AK/FK 索引）** | **不新增独立逻辑对象**；逻辑侧只保留"该键的业务含义"作为**逻辑属性上的 `keyRole` 语义位**（可选，`primary`/`alternate`/`foreign`），其余（索引名、是否唯一、物理顺序、包含列）留在物理侧 | `Table.primaryKey` / `Table.uniqueKeys` / `Table.indices` / `Relationship`（2026-10-27 用户裁决 2：四类均为**双名对象**，见 §3.8.3） | **逻辑语义位 ↔ 物理约束/索引**，一对一**可选**（允许逻辑侧未标键组 → 物理侧无对应约束） |

> **2026-10-27 用户裁决更新（§3.8.3 裁决 2）**：PK/UK/FK 在**物理侧**升级为独立的
> 双名约束对象（`PrimaryKey` / `UniqueKey` / `ForeignKey`——FK 依用户追加裁决独立成对象；
> `field.primary` 废弃、`UniqueConstraint` 被 `UniqueKey` 取代）。
> 逻辑侧**仍无**独立 Key Group 对象——
> 键的业务语义 = `keyRole` + 约束对象的 `logicalName`/`comment`（协调说明见 §3.8.4）。
| **关系** | **逻辑关系对象**（`LogicalRelationship`）：角色名、基数、关系类型（识别/非识别）、是否多对多 | `Relationship`（现状物理 FK 结构） | **一对一（强制）** —— 逻辑侧无物理 FK 视为缺陷；但**逻辑多对多/子类型关系允许无物理实现**（erwin 语义：这类关系在物理侧被解析为关联表/具体化），此时物理侧缺失是**合法**的（标 `physicalPending`） |
| **字段级约束** | **不新增逻辑对象**；逻辑侧仅有"是否必填"这一条业务语义（`LogicalAttribute.required?`），其余（check 表达式、default 值表达式、索引/唯一实现）留物理侧 | `PhysicalField.notNull/unique/check/default/increment/unsigned` | **不一对一** —— 逻辑侧为**可选子集**，缺失即"未声明" |
| **类型（Domain / UDT / Enum）** | `LogicalDomain`（类型）+ **逻辑枚举**（业务取值域，落在逻辑属性上的 `values`） | `PhysicalSpec` / `CustomType`（UDT）/ `Enum`（物理原生枚举） | 域：**一对一**；UDT：**逻辑侧不承载**（erwin 逻辑侧无 UDT 对应）；枚举：逻辑取值域 → 物理原生枚举是**一对多的实现选择**，不强制 |

> **"逻辑键组不新增独立对象"的依据**：erwin 的 Key Group 在逻辑侧带 Definition
> （业务定义，落地为索引注释），而本项目的一对一不变量（§3.5）已在**字段级**落地
> 逻辑↔物理的对应。再为键组引入第三个平行数组（逻辑键组 ↔ 物理索引 ↔ 字段集合），
> 会引入**三层对应关系**，其一致性成本远大于收益 —— 而收益（键组业务定义）
> 可以用一个字符串字段承载。**这是有意偏离 erwin**，记入 §3.7.5。

#### 3.7.5 与 erwin 的差异（本节新增的偏离项）

| 维度 | erwin | 本项目 | 理由 |
|---|---|---|---|
| 逻辑键组对象 | Key Group 是**独立对象**（带 Definition、PK/FK/AK/IE 类型） | **逻辑侧不设独立对象**；键的**业务语义位**挂在逻辑属性上（`keyRole`），**Definition 文本**挂在物理约束/索引上（映射 erwin 的"definition migrates to the physical side as an index comment"）。**物理侧**的 PK/UK/FK 是独立双名对象（2026-10-27 用户裁决 2，§3.8.3）——与 erwin 的 Key Group→Index 迁移方向一致，只是对象落在物理侧 | 避免三层对应；与 §3.5 字段级一对一的简化取向一致 |
| 逻辑关系的"多对多/子类型" | 逻辑侧可建，物理侧解析解决 | 逻辑侧允许存在且**物理实现可缺省**（`physicalPending`） | erwin 语义（`Comparison_of_Logical_and_Physical_Models.html`："many-to-many relationships and subtype relationships in the logical model only"） |
| 实体/表的双层结构 | 逻辑模型与物理模型是**两个平行的模型** | 逻辑实体**内嵌**在物理表内（`Table.logical`） | 一张物理表必有一个逻辑实体，避免"孤儿实体" |
| 字段级非对称 | 允许 Logical Only / Physical Only | 强制一对一（§3.5.1），非对称降级为导入异常 | 用户裁决 2026-10-27 |
| View | 物理侧独有 | 物理侧独有（与 erwin 一致） | — |

#### 3.7.6 对既有章节的影响

| 章节 | 需要修改的地方 |
|---|---|
| §0.2 消歧声明 | 「本项目对 erwin 的一处有意偏离」→ **三处**（字段级一对一、逻辑键组无独立对象、实体/表内嵌式） |
| §2 不变式 6 | 补充：不变式 6 约束的是**字段级**；**元素级**的对应规则见 §3.7.4（多数为"不强制"） |
| §3.0 双层结构总览 | 对照表右列需按 §3.7.4 重写（"沿用现状 `Table.indices`" 的说法已不准确） |
| §3.5 不变量 | INV-4 明确限定为"字段级"；新增 **INV-6（逻辑关系 ↔ 物理 FK 一对一）**、**INV-7（实体/表内嵌一对一）** |
| §6.2 诊断模型 | `LOGICAL_ONLY`/`PHYSICAL_ONLY` 的 scope 需限定为字段级；新增 `RELATIONSHIP_NOT_IMPLEMENTED`（逻辑关系无物理实现且非 `physicalPending` 声明） |
| §7.0/§7.4 视图与编辑面板 | 编辑面板的"成对呈现"目前只覆盖字段；**逻辑关系**也需要成对呈现 |
| §12 测试 | 新增元素级不变量与逻辑关系用例 |
| §13 分期 | P1 的模型改造范围扩大（新增 `LogicalRelationship`） |
| §16.1 概念对照表 | 补 Key Group / Relationship 两行的本项目对应 |

### 3.8 索引（Index）的维护（2026-10-27 追加）

> **本节起因**：用户从**数据库管理**角度指出（2026-10-27）——
> 「还缺失关键元素索引（index）的维护」。§3.7 解决了"索引在逻辑/物理哪一侧"，
> 但没有回答"索引本身作为数据库管理对象是否被完整建模"。
> 本节把索引从**数据模型**到**UI**到**导入导出**的全链路现状与缺口列清楚。

#### 3.8.1 现状：索引的模型与全链路

**模型**（`packages/core/src/models/table.ts:6-17`）：

```ts
export interface Index {
  id?: FieldId;          // ← 类型是 FieldId，但语义是"索引的 id"（复用同一别名）
  name: string;
  unique: boolean;       // ← 唯一索引与非唯一索引共用这一个布尔位
  fields: string[];      // ← 存的是字段【名字】，不是字段 id
}

export interface UniqueConstraint {
  id?: TableId;          // ← 类型是 TableId，同样是别名复用
  name: string;
  fields: string[];      // ← 同样是字段【名字】
}
```

**全链路现状**：

| 环节 | 位置 | 现状 |
|---|---|---|
| 模型 | `core/src/models/table.ts:6-17,32-33` | `Index` / `UniqueConstraint` 两个扁平结构，挂 `Table.indices?` / `Table.uniqueConstraints?` |
| 画布 UI | `sdk/src/components/Canvas/TableDetails.vue:41-63,80-158` | 两个区块（Indices / Unique Constraints），每行**两个文本框**（名称 + 逗号分隔字段列表），`Add Index` / `Add Unique` 按钮，**无删除按钮、无 unique 开关** |
| 画布几何 | `sdk/src/components/Canvas/table-details-geometry.ts:22` | 行数 = `indices.length + uniqueConstraints.length` |
| 增删改 | 走 `diagram.updateTable(id, { indices })` | `sdk/src/stores/diagram.ts:127` → `UpdateTableCommand`（`core/src/commands/table-commands.ts:54-88`）→ **整表级撤销**（一次索引编辑 = 一条命令） |
| 校验 | `core/src/validation/rules.ts:301-381` `checkIndices` | 5 条规则：索引无名(`index.no_name`)、索引无字段(`index.no_fields`)、**同表内**索引重名(`index.duplicate_name`)、唯一约束无字段(`unique_constraint.no_fields`)、唯一约束重名(`unique_constraint.duplicate_name`)。**不检查字段是否存在、不跨表查重** |
| SQL 导出 | `core/src/export/{mysql,mariadb,postgres,mssql,oraclesql,sqlite,generic}.ts` | 统一形态 `CREATE [UNIQUE] INDEX <name> ON <table> (<fields>)`。**无 PK 索引、无 FK 索引、无 WHERE 子句、无 INCLUDE、无类型/排序/操作符类** |
| DBML 导出 | `core/src/dbml/export.ts:134-147` | `indexes { (col) [name: 'x'] [unique] }`，唯一约束也降级成 index |
| DBML 导入 | `core/src/dbml/parse.ts:137-154` | `pk` 的 index 会被**抽走变成字段的 `primary` 标记**，其余进 `indices` |
| DBML 合并 | `core/src/dbml/reconcile.ts:204-237` | 按名字匹配旧条目 |
| DBML diff | `core/src/dbml/diff.ts:11-12` | `indices` / `uniqueConstraints` 列为可 diff 键 |
| SQL 导入 | `core/src/sql/import/{mysql,mariadb,mssql,postgres,oraclesql,sqlite}.ts` | 从 `CREATE INDEX` 读 name/unique/columns；唯一约束单独收进 `uniqueConstraints` |

#### 3.8.2 缺口清单（按数据库管理视角）

**A. 模型表达力不足**

1. **字段引用用名字而不是 id** —— `Index.fields: string[]` 存的是字段名。
   后果：(a) 字段改名后索引**静默失效**（导出成 `ON t (old_name)` → SQL 错误，
   而 `checkIndices` 不报错，因为它从不检查字段是否存在）；
   (b) 与 `RelationshipFieldPair` 用 id 的做法**不一致**；
   (c) 索引**无法表达列序之外的语义**（如函数索引、表达式索引、包含列）。
2. **PK 与唯一索引混在同一结构里** —— `Index.unique: boolean` 同时承担
   "唯一索引"与"逻辑主键的物理索引"两种含义。现状 PK 是**字段级布尔**（`field.primary`）
   单独表达（导出为内联 `PRIMARY KEY(...)`），**没有**与 erwin 的
   "PK（模型内）+ PK Index（schema 内）"对应的独立索引对象。
3. **FK 索引不归任何人管** —— `Relationship` 有 FK 语义但**不携带索引**；
   `Table.indices` 里的索引**不知道自己是 FK 支撑索引**。因此无法回答
   "这个关系有没有索引支撑"（数据库管理里的核心问题：外键无索引 → 写入放大）。
4. **缺索引类型** —— 没有 `BTREE`/`HASH`/`GIST`/`BRIN` 等类型位，
   没有**部分索引**（`WHERE`）、没有**包含列**（`INCLUDE`）、没有**排序方向**
   （`ASC`/`DESC`）、没有**函数/表达式索引**、没有**唯一性谓词**。
5. **索引注释缺失** —— erwin 的 Key Group **Definition 会迁移为物理侧的索引注释**
   （`Enter_a_key_group_definition.html`），本项目的 `Index` **没有 comment 字段**，
   业务上"为什么建这个索引"无处安放。
6. **索引与唯一约束是两个平行数组** —— `Table.indices` 与 `Table.uniqueConstraints`
   在语义上高度重叠（唯一索引 ≈ 唯一约束），但导出路径不同（一条 `CREATE INDEX`，
   一条内联 `CONSTRAINT ... UNIQUE`）、DBML 侧又被合并成同一块
   （`dbml/export.ts:134-147`）→ **往返不对称**（DBML 导出会把唯一约束变成 index，
   再导入就落到 `indices` 而不是 `uniqueConstraints`）。

**B. UI 表达力不足**

7. **字段编辑是逗号分隔的自由文本** —— `TableDetails.vue:96-106,136-146` 用
   `NInput` 存 `"email, created_at"` 这样的字符串，靠 `readFields()`（:34-39）
   按逗号切分并 trim。后果：(a) 字段名**本身含逗号**就无法表达；
   (b) **拼错字段名不会被发现**（切分后的字符串不会与表的真实字段名比对）；
   (c) 无法表达列序以外的任何索引语义；
   (d) 每次编辑都会重写整个 `fields` 数组，无法只改其中一列。
8. **没有删除入口** —— `TableDetails.vue` 只有 `Add Index` / `Add Unique`，
   **没有任何删除按钮**。索引一旦加错，只能整表清空重来（而整表清空也没有 UI）。
   这是最直接的一条"缺失维护"。
9. **没有索引列表视图** —— SidePanel 的 tabs 里**没有索引页**
   （grep `SidePanel/*.vue` 对 index/constraint 零命中）。索引只在
   **画布上表格展开 details 后**才可见；表格一多，索引就不可管理。
10. **`unique` 布尔位在 UI 上不可编辑** —— `TableDetails.vue:87-106` 的索引行只有
    名称与字段两个输入框，`Index.unique` **无法在 UI 上切换**
    （只能通过导入或改 JSON 产生）。加唯一索引的唯一途径是 SQL/DBML 导入。
11. **索引不是一等公民** —— 没有 index 的独立 id 生命周期（新增时 `id` 为 `undefined`，
    `TableDetails.vue:56` 新增时 `{ name: "", unique: false, fields: [] }` **不带 id**，
    靠 `index.id ?? indexPosition` 当 key（`TableDetails.vue:84`）→ 位置变化即 key 变化，
    Vue 可能错位复用 DOM）。
12. **无 i18n** —— `TableDetails.vue` 里 `"Color"`、`"Indices"`、`"Unique Constraints"`、
    `"Add Index"`、`"Add Unique"`、`"Index name"`、`"Fields, comma separated"`
    **全部硬编码英文**，与 AGENTS.md §6 的 i18n 要求不符
    （现状 `packages/sdk/src/i18n/locales/` 51 个 locale 文件里也没有这些 key）。
13. **撤销粒度过粗** —— 索引的每次编辑都走 `updateTable`，在
    `UpdateTableCommand`（`core/src/commands/table-commands.ts:54-88`）里
    **深克隆整张表**作为撤销快照。索引多时撤销栈体积与撤销次数线性增长，
    且一次撤销会把**表名、颜色、位置等无关改动一起回滚**。
14. **锁定判定分散在两处** —— `TableDetails.vue:27` 用 `locked` 计算属性
    隐藏"加索引"按钮（`table-details.test.ts:161-165` 断言锁定表**看不到**
    `table-add-index-users`，行为正确），但真正的锁定判定在
    `core/src/commands/table-commands.ts` 的 `isLocked`（`diagram.ts:119-125`）——
    UI 与模型**各判一次**，将来若锁定规则变化（例如"按列锁定"），
    两处需同步改，否则出现"按钮可点但命令被拒"的错觉。

**C. 校验与往返**

15. **字段不存在不报错** —— `checkIndices`（`validation/rules.ts:301-381`）
    只查名称与字段**数量**，不查字段**是否存在**。用户把索引指向一个不存在的列，
    校验器全绿，导出器产出**非法 SQL**。
16. **重名索引跨表不校验** —— 只查"同一张表内"重名（`rules.ts:331-345`），
    不查**整个 schema 内**重名 —— 而 SQL 中索引名是 **schema 级全局命名空间**
    （Postgres/MySQL/SQLite 皆然），导出后必然冲突。
17. **唯一约束与唯一索引不互相校验** —— 同一组字段既有唯一约束又有唯一索引，
    或两者冲突，现状无诊断。
18. **DBML 往返不对称**（见缺口 6）—— DBML 导出把唯一约束降级为 index，
    再导入落到 `indices`，与原始结构不一致。

#### 3.8.3 裁决（索引的建模与维护方案）

**总原则**：索引是**物理层对象**（数据库管理的产物），但它**服务于业务查询**，
因此它需要 (a) 足够的表达力覆盖主流方言的关键能力，(b) 可维护的生命周期
（增删改查 + 撤销 + 校验），(c) 与既有"字段级双层"改造**解耦**，不把索引拖进
P1 的双层重构里。

**裁决 1 —— 模型：`Index` 升级为自洽结构（含用户裁决：双名 + 自动命名，2026-10-27）**

```ts
export interface Index {
  id: string;                 // 稳定 id（一等公民，UI key 与撤销锚点）
  /** 逻辑名（业务含义）。自动命名 = "Idx_" + 表逻辑名；用户可修改 */
  logicalName: string;
  /** 物理名（schema 级命名空间，需全局唯一校验）。自动命名 = "Idx_" + 物理表名；用户可修改 */
  name: string;
  /** 覆盖的列：按字段 id 引用，顺序即索引列序 */
  columns: IndexColumn[];
  /** 唯一索引 */
  unique: boolean;
  /** 索引类型（方言相关，缺省 = 数据库默认） */
  type?: IndexType;           // "btree" | "hash" | "gist" | "gin" | "brin" | "fulltext" | "spatial"
  /** 部分索引的条件（仅支持部分索引的方言） */
  where?: string;
  /** 包含列（INCLUDE） */
  include?: string[];         // 字段 id
  /** 索引注释（承载 erwin 的 Key Group Definition，见 §3.7.4） */
  comment?: string;
  /** 该索引支撑的逻辑关系（FK 索引）：指向 Relationship.id */
  supportsRelationshipId?: string;
}

export interface IndexColumn {
  fieldId: string;            // ← 改用 id，修复缺口 A1
  order?: "asc" | "desc";     // 排序方向
  /** 函数/表达式索引的表达式（非列索引时使用） */
  expression?: string;
}
```

**双名与自动命名规则**（用户裁决 2026-10-27，同样适用于裁决 2 的 PK/UK/FK）：

1. 每个索引/约束对象都有**两个名字**：`logicalName`（业务含义）与 `name`
   （物理名，进 SQL）。与全文档的"双层并存"一致 —— 逻辑视图显示 `logicalName`，
   物理视图显示 `name`，编辑面板成对呈现（Q20）。
2. **自动命名发生在创建时，物化为数据**：
   - 索引逻辑名 = `Idx_` + **表逻辑名**；物理名 = `Idx_` + **物理表名**；
   - 同一命名空间内撞名时追加序号：`_2`、`_3`……
3. 两个名字**用户均可修改**；表改名后**不回溯**改既有索引/约束名
   （自动命名只发生在创建时，避免用户已改过的名字被静默覆盖）。
4. 命名空间：物理名 = **schema 级全局唯一**（INV-8）；逻辑名 = **同表内唯一**
   （与逻辑属性同名空间，erwin Key Group 名也在 entity 内唯一）。

**与现状的迁移**：`Index.fields: string[]` → `columns: IndexColumn[]`。
迁移期**保留 `fields` 字段的读取**（按名字反查 fieldId，查不到则报诊断），
写入只用新结构。

**裁决 2 —— PK / UK / FK 独立建类 Index 结构（用户裁决 2026-10-27）**

> 用户裁决：「PK, UK, FK 独立建类似 Index 的结构，支持逻辑名称，支持自动命名」。
> 这取代本节初稿的"PK 保持字段级布尔"方案。

四类对象统一为**双名约束/索引对象**（`id` + `logicalName` + `name` + 列引用 + `comment`），
自动命名规则同裁决 1（前缀分别为 `PK_` / `UK_` / `FK_` / `Idx_`）：

```ts
/** 主键约束：每表至多一个 */
export interface PrimaryKey {
  id: string;
  logicalName: string;        // 默认 "PK_" + 表逻辑名
  name: string;               // 默认 "PK_" + 物理表名
  columns: IndexColumn[];
  /** 关联的 PK 索引对象（承载索引专属属性：类型/包含列等）；PK 本身是约束，索引是访问路径 */
  indexId?: string;
  comment?: string;
}

/** 唯一键约束（取代现状 UniqueConstraint） */
export interface UniqueKey {
  id: string;
  logicalName: string;        // 默认 "UK_" + 表逻辑名（撞名加序号）
  name: string;               // 默认 "UK_" + 物理表名
  columns: IndexColumn[];
  comment?: string;
}
```

```ts
/** 外键约束：独立具名对象（用户追加裁决 2026-10-27：「FK也处理为独立对象」） */
export interface ForeignKey {
  id: string;
  logicalName: string;        // 默认 "FK_" + 子表逻辑名 + "_" + 父表逻辑名
  name: string;               // 默认 "FK_" + 子表名 + "_" + 父表名（物理约束名，进 SQL）
  /** 实现该约束的关系：端点、列映射、基数、级联规则都从 Relationship 取，
      FK 对象不重复存列映射，避免两份数据需同步 */
  relationshipId: string;
  comment?: string;
}
```

**FK 与 Relationship 的分工**（FK 独立成对象后）：

- `Relationship` = **结构/语义**：两端表与字段、列映射、基数、级联规则；
  是画布连线与 INV-6（逻辑关系 ↔ 物理关系一对一）的锚点，保持现状结构。
- `ForeignKey` = **具名约束对象**：双名 + `comment`，挂在**子表**上
  （`Table.foreignKeys`），是条目区里的 FK 条目、导出器约束名的来源。
- 二者**强制一对一**（INV-10）：创建关系时自动创建配套 FK 对象（自动命名），
  删除关系时级联删除 FK 对象；`Relationship.name`（现状的物理约束名）**废弃**，
  物理约束名以 `ForeignKey.name` 为唯一来源。

**Table 的模型变更**：

```ts
export interface Table {
  // ……
  primaryKey?: PrimaryKey;            // 新增；取代 field.primary 布尔位
  uniqueKeys?: UniqueKey[];           // 取代 uniqueConstraints: UniqueConstraint[]
  foreignKeys?: ForeignKey[];         // 新增；本表作为子表持有的 FK 约束
  indices?: Index[];                  // 裁决 1 的新结构
}
```

- **`field.primary` 废弃**：PK 成员关系由 `Table.primaryKey.columns` 表达；
  导出器内联 `PRIMARY KEY(...)`、画布字段行的 PK 标记，都改由 PK 对象成员关系推导。
  （破坏性变更，与"不做历史数据兼容"的既定裁决一致。）
- **唯一约束 vs 唯一索引**仍分离（裁决 4 不变）：`UniqueKey` 走内联
  `CONSTRAINT ... UNIQUE`；`Index.unique = true` 走独立 `CREATE UNIQUE INDEX`。
- **FK 条目显示在子表一侧**（`endTableId` 指向的表），与 erwin"FK 属子表"一致。

**裁决 3 —— 撤销粒度：索引有独立的命令**

新增 `core/src/commands/index-commands.ts`：
`AddIndexCommand` / `UpdateIndexCommand` / `RemoveIndexCommand`，
撤销快照只含**被改的那个索引**（而不是整表）。`UpdateTableCommand` 继续服务
表级属性（名称、颜色、位置）。

**裁决 4 —— DBML 往返对称**

DBML 的 `indexes { }` 块**承载唯一索引与非唯一索引**（现状已如此）。
唯一约束（UK）在 DBML 侧**无法与唯一索引区分**（DBML 语法本身如此），
因此定一条明确规则：
- DBML **导出**：唯一约束 → 以 `unique` index 导出（现状行为），并在导入报告里
  记录"UK 被降级为唯一索引"；
- DBML **导入**：带 `unique` 的 index → 落到 `Table.indices`（现状行为），
  **不**回填 `uniqueConstraints`（避免制造与原结构不同的数据）；
- 唯一约束的**权威来源是 SQL 导入**（`sql/import/*` 能区分内联
  `CONSTRAINT ... UNIQUE` 与独立 `CREATE UNIQUE INDEX`）。
这条规则要写进 §9 导出器重构与 §16 兼容层。

**裁决 5 —— UI：索引与约束有独立的维护界面（含用户裁决：表格下方条目区，2026-10-27）**

> 用户裁决：「UI 显示上可以显示在 Table 表格下方增加分割线追加显示，图标+名称的方式，
> 可以切换是否显示，通过点击条目可定位编辑器，可在 UI 中直接维护名称」。
> 该呈现方式同时适用于裁决 2 的 PK/UK/FK 与本裁决的索引。

三层 UI，全部纳入：

1. **画布内联 · 表格下方条目区（用户裁决的呈现形态）**：
   - Table 表格下方加一条**分割线**，其下按条目列出该表的 PK / UK / FK / 索引，
     每条 = **图标 + 名称**（图标区分 PK 🔑 / UK / FK / IDX 四类）；
   - 逻辑视图显示 `logicalName`，物理视图显示物理 `name`（与三区划分一致，§7.0）；
   - **可切换是否显示**（表级开关，与 details 折叠并列，默认随 details 展开状态）；
   - **点击条目定位到对应编辑器**（索引 → 索引编辑器；PK/UK → 约束编辑器；
     FK → 关系编辑器）；
   - **名称可在 UI 中直接维护**（就地编辑；改的是当前视图对应的那一个名字，
     另一个名字在编辑面板成对修改，Q20）。
   - 现状 `TableDetails.vue` 的两个文本框区块由此条目区取代；
     条目区的编辑弹层改为**多列编辑器**（每列一个下拉、可排序、可删列、
     唯一开关、删除整条），不再用逗号分隔自由文本。文案全部走 i18n（补 51 个 locale）。
2. **SidePanel 新增 "Indices" 页** —— 按表分组的索引与约束列表（表 → 条目 → 列），
   支持增删改、显示唯一性/类型/FK 支撑标记。这是**可管理性**的关键
   （解决缺口 B9：表格一多，画布内联就不够了）。画布条目区点击定位的目标之一就是此页。
3. **表格详情里的摘要** —— 条目区折叠时显示
   "1 PK / 2 UK / 1 FK / 3 indices" 的计数摘要。

**裁决 6 —— 校验补强**

在 `checkIndices` 基础上新增（`core/src/validation/rules.ts`）：

| 新 code | 级别 | 条件 |
|---|---|---|
| `index.unknown_field` | error | 索引引用的字段 id 在表中不存在 |
| `index.duplicate_schema_name` | error | 索引名在整个图内重复（schema 级命名空间） |
| `constraint.duplicate_schema_name` | error | PK/UK/FK 的**物理约束名**与任何索引名/约束名在整个图内重复（约束与索引**共享 schema 级物理命名空间**——2026-10-27 用户裁决 2 后约束也是具名对象） |
| `constraint.duplicate_logical_name` | warning | PK/UK/FK/索引的**逻辑名**在同一表内重复（逻辑名命名空间 = 同表内唯一） |
| `constraint.no_columns` | error | PK/UK 的 `columns` 为空，或引用的字段 id 在表中不存在 |
| `constraint.fk_without_relationship` | error | `ForeignKey.relationshipId` 指向不存在的关系（INV-10） |
| `constraint.relationship_without_fk` | info | 某 `Relationship` 没有配套 `ForeignKey` 对象（创建关系时应自动创建；漏建时自动补建并报此诊断）（INV-10） |
| `table.multiple_primary_keys` | error | 同一表出现多于一个 PK 对象（INV-9） |
| `index.duplicate_columns` | warning | 同一张表内两个索引的列集合完全相同 |
| `index.unique_constraint_conflict` | warning | 唯一约束（UniqueKey）与唯一索引覆盖同一组列 |
| `index.no_supporting_relationship` | info | `supportsRelationshipId` 指向不存在的关系 |
| `index.relationship_without_index` | info | 某关系没有索引支撑（**数据库管理视角的典型问题**：外键无索引 → 写入放大） |

**裁决 7 —— 分期：索引不拖进 P1**

索引改造（P1 的双层重构）**与索引维护**是两条独立的线：

- **P1（双层模型）** 只做一件事：把 `Table.indices` / `Table.uniqueConstraints`
  的**字段引用从名字改成 id**（否则双层改造会把这个缺陷放大），
  并在 `PhysicalField` 上引入 `keyRole`（§3.7.4）。
- **新增 P2'（索引与约束维护）**：模型升级（索引双名 + PK/UK/FK 双名对象化，
  `field.primary` 废弃、`UniqueConstraint` → `UniqueKey`）+ 撤销命令 +
  校验补强 + 三层 UI（表格下方条目区 / SidePanel Indices 页 / 折叠摘要）+ i18n。
  它**不依赖**双层改造，可与 P1 并行。
- 索引的 `comment` 字段承载 erwin 的 Key Group Definition，**与 §3.7.4 的
  "逻辑键组不新增独立对象"一致** —— 定义文本落在物理索引上，与 erwin 的
  迁移方向相同。

#### 3.8.4 与 §3.7 的关系

- §3.7.4 裁决"键组不新增独立逻辑对象"**不变**；本节是它的**物理侧落地**：
  索引的**业务语义**（键角色、定义文本）在物理索引上以 `comment` + 关系标记承载，
  **不**再新增第三个平行数组。
- **2026-10-27 用户裁决 2 后的协调说明**：PK/UK/FK 升级为**双名约束对象**
  （裁决 2；FK 依用户追加裁决独立为 `ForeignKey` 对象），这与"键组不新增独立
  **逻辑**对象"不冲突——约束对象是**物理侧对象**（进 SQL、占 schema 命名空间），
  其 `logicalName` 只是它的业务称呼；逻辑侧的键语义仍由逻辑属性上的
  `keyRole`（§3.7.4）承载，**逻辑层没有独立的 Key Group 对象**。形态从
  "字段布尔位 + 无名约束"变为"独立具名对象"，但层次划分不变。
- FK 独立成对象后，`Relationship` 回归**纯结构角色**（端点/列映射/基数/级联），
  仍是 INV-6 的锚点；`ForeignKey` 承载名字与注释，二者强制一对一（INV-10）。
  FK 的列映射**不重复存**在 FK 对象上，统一从 Relationship 取，避免双簿记。
- §3.7.4 裁决"关系与物理 FK 一对一"**扩展为**：关系与**其索引支撑**也是
  一对多的（一个关系可以有多条支撑索引：单列索引 + 复合索引首列），
  靠 `supportsRelationshipId` 标记归属。

#### 3.8.5 裁决结果（Q27–Q33；完整表述见 §11）

> 本节只给出与索引直接相关的结论，**问题原文与完整裁决说明见 §11**。
>
> **用户回复记录（2026-10-27）**：对本节七条裁决——裁决 1（Index 增加逻辑名，
> 自动命名 `Idx_`+表名，双名均可改）、裁决 2（PK/UK/FK 独立建类 Index 结构，
> 表格下方分割线条目区呈现）、裁决 5（三层 UI，条目区呈现同裁决 2）
> **按用户修订执行**；裁决 3（索引级撤销命令）、裁决 4（DBML 往返对称）**同意**。
> **追加裁决（同日）**：「FK也处理为独立对象」—— FK 不并入 `Relationship`，
> 独立为 `ForeignKey` 双名对象（INV-10，见裁决 2）。

| # | 问题 | 结论 |
|---|---|---|
| Q27 | 索引改造是否纳入本设计文档的 P1，还是独立成 P2'？ | ✅ **独立 P2'**（与双层改造解耦，可并行）—— D24 |
| Q28 | 唯一约束（UK）与唯一索引（UNIQUE INDEX）是否合并为一个结构？ | ✅ **不合并** —— UK 内联导出、唯一索引独立 `CREATE`（现状行为正确）；DBML 侧明确降级规则（裁决 4）—— D25 |
| Q29 | FK 索引是否自动生成？ | ✅ 提供**可选动作**（新增关系时"一并创建 FK 索引"），不强制；并报 `index.relationship_without_index` |
| Q30 | 索引字段引用从名字改 id 的迁移是否破坏现有数据？ | ✅ 直接改（本项目**不做历史数据兼容** —— 已裁决"一图一库、不做 schema 迁移"）；读取路径保留名字反查兜底 |
| Q31 | SidePanel 是否新增独立 "Indices" 页？ | ✅ **新增**（解决"表格一多就不可管理"）；与画布内联共用 `IndexEditor.vue` |
| Q32 | 索引的命名规则？ | ✅ **用户裁决**：双名 + 自动命名（`Idx_`+表逻辑名 / `Idx_`+物理表名），均可改 —— D26 |
| Q33 | PK/UK/FK 是否独立成具名对象？ | ✅ **用户裁决**：独立双名结构（`PrimaryKey`/`UniqueKey`/**`ForeignKey`**——FK 依追加裁决独立成对象），表格下方条目区呈现 —— D27 |

---

## 4. 类型解析（生成 + 校验）

> **语义变更（不变式 3 的直接后果）**：解析器不再是"唯一真相"，
> 它做的是**生成物理类型**与**校验物理类型**两件事。
> 物理类型已经存在字段上（`fieldType`），解析器据来源标记决定
> "是覆盖它"还是"只是比对它"。

### 4.1 生成：映射 → 物理类型

```
输入：逻辑属性（LogicalAttribute）+ 目标方言 D
  ├─ 逻辑类型引用  → 按名定位**唯一**的族或域（Q1，§3.3.1）
  │                 （域经 family 引用；父域继承本期不实现，Q13）
  ├─ 逻辑属性 params ┐
  ├─ 域 params       │ 参数优先级：属性 > 域 > 族默认 > 映射自带
  └─ 族默认 params   ┘
  ↓
目标方言 D：
  1. 取物理形态：域.physical[D]  ??  族.mappings[D]
     （同名对象全局唯一，查找不产生歧义）
  2. 合并参数（映射自带 params 为最底层）
  3. 输出 PhysicalSpec（这是**建议值**，不是必然值）
```

**参数优先级链**（高 → 低）：
1. 逻辑属性显式 `params`
2. 域 `params`
3. 族 `defaultParams`
4. 映射自带 `params`

> **物理形态的跨作用域取值**（Q1）：`域.physical[D]` 与 `族.mappings[D]`
> 在三级作用域中各有取值，取值按 `图级 > 工作区级 > 应用级` 链上**第一个命中项**
> （§5）。覆盖只作用于**某个域 / 某个族的某个方言项**，
> 因此解析器不需要处理"同名两条定义谁赢"的分支。

### 4.2 校验：已存物理类型 vs 映射建议

| `fieldTypeSource` | 映射/参数变化时 | lint 行为 |
|---|---|---|
| `mapped` | **自动重算**并写回 `fieldType` | 正常校验 |
| `explicit` | **不动**（用户的选择优先） | 报 `TYPE_CAPABILITY_MISMATCH` 等提示，不阻断 |
| `imported` | **默认不动**（保留 erwin 的既有物理定义） | 同上；用户可批量转为 `mapped` 以启用自动重算 |

> 这一条直接对应 erwin 的官方行为：换目标数据库时 erwin **提示用户确认转换**
> 而不是静默替换（`references/erwin/html/Data_Types_and_Data_Type_Standards.html`）。

### 4.3 映射缺失

若目标方言无映射：
- 族的 `mappings` 缺该方言 → 落入 `common` 族规则（按字符串映射）+ lint 诊断。
- 域未声明该方言 → 回落到**族映射**（不报错）。
  （父域继承本期不实现，故无"回落到父域"这一步，Q13。）

### 4.4 SDK 接口形态（解析器式）

```ts
export interface TypeScopeSnapshot {
  application: TypeScopeLayer;   // 应用级
  workspace: TypeScopeLayer;     // 工作区级
  diagram: TypeScopeLayer;       // 图级
}

export interface TypeScopeLayer {
  families?: Record<LogicalFamilyId, FamilyOverride>;
  domains?: Record<string, LogicalDomain>;
}

export function resolveType(
  attribute: LogicalAttribute,
  database: DatabaseType,
  scope: TypeScopeSnapshot,
): ResolutionResult;

/** 校验已存的物理类型，不写回 */
export function validatePhysicalType(
  attribute: LogicalAttribute,
  field: PhysicalField,
  database: DatabaseType,
  scope: TypeScopeSnapshot,
): DialectDiagnostic[];

/** 按来源标记重算并写回（仅 mapped 来源会被重算） */
export function reconcilePhysicalTypes(
  table: Table,
  database: DatabaseType,
  scope: TypeScopeSnapshot,
): Table;
```

- SDK **只暴露解析器**，不拥有存储、不决定哪一层归谁。
- App 负责把三层数据装配成 `scope` 快照传入。
- SDK 另暴露注册接口供 App 实现"自定义覆盖"功能：
  `registerDomain()` / `updateFamilyMapping()` / `upsertScopeLayer()`。

**解析结果**：

```ts
export interface ResolutionResult {
  /** 建议的物理规格（由映射生成） */
  suggested?: PhysicalSpec;
  /** 字段实际存储的物理规格（可能与 suggested 不同） */
  current?: PhysicalSpec;
  /** 逻辑视图显示名 */
  logicalName: string;
  family: LogicalFamilyId;
  unmapped: boolean;           // true 表示落入 common
  /** 是否命中字段级显式物理类型（fieldTypeSource === "explicit"） */
  isExplicit: boolean;
  diagnostics: DialectDiagnostic[];
}
```

---

## 5. 三级作用域

| 层级 | 含义 | 存储落点 | 定义者 |
|---|---|---|---|
| 应用级 | 系统级默认模板，跨用户共享 | `packages/app` 内置常量（可被"恢复默认"） | 系统预置 + 用户全局配置 |
| 工作区级 | 单工作区/单用户的个性化覆盖，默认继承应用级 | 本地存储区（随现有存储适配器），由 App 装配 | 用户 |
| 图级 | 仅本图生效 | `Diagram` 自身 | 用户 |

**继承链**：`图级 > 工作区级 > 应用级`，逐层覆盖。
查一个映射时沿链自上而下找第一个命中项。

> **作用域管的是"值的来源"，不是"同名对象的并存"**（Q1，§3.3.1）：
> 域与映射定义**全局唯一**（同一工作区内），三级作用域只决定
> "这个唯一对象的这个方言项，当前取哪一层的值"。覆盖粒度是
> **某个明确目标**（某域 / 某族的某个方言项），不允许整层替换。

**依赖方向**（符合 `AGENTS.md` §3）：
- `core` 提供族/映射模型与纯解析函数。
- `sdk` 提供解析器接口、lint、类型编辑 UI，接收只读 scope 快照。
- `app` 装配三层存储、提供设置界面、调用 SDK 注册接口。

**Web 的应用级 vs 工作区级**：
- 应用级 = 跨用户共享的系统预置（`packages/app` 内置）。
- 工作区级 = 单用户本地配置，随现有 IndexedDB 存储适配器；当前项目无后端账号体系，
  故工作区级**默认落在本地**，存储适配器可替换以支持将来的云端同步。

---

## 6. 方言 lint

### 6.1 定位

**常态化合法性校验**，非一次性事件。

- **随时可跑**：不限于方言切换时；物理视图手工改类型后立即生效。
- **输入**：一个目标方言 + 一份元定义。
- **输出**：一组诊断。

### 6.2 诊断模型

```ts
export type DialectSeverity = "error" | "warning" | "info";

export interface DialectDiagnostic {
  severity: DialectSeverity;
  code:
    | "TYPE_NOT_IN_DIALECT"        // 物理类型名在该方言不存在
    | "TYPE_CAPABILITY_MISMATCH"   // 同名但能力不等价
    | "PARAM_OUT_OF_RANGE"         // 长度/精度超出方言允许
    | "MAPPING_MISSING"            // 该逻辑类型在目标方言无映射
    | "UNRESOLVED_TYPE"            // 落入 common 族
    | "SIZE_EXCEEDS_MAX"           // 超出方言上限
    | "MATERIALIZATION_UNSUPPORTED" // 目标方言不支持物化自定义类型
    | "LOGICAL_ONLY"               // 逻辑属性没有对应物理字段（字段级）
    | "PHYSICAL_ONLY"              // 物理字段没有对应逻辑属性（字段级）
    | "LOGICAL_PHYSICAL_DIVERGED"  // 逻辑类型与物理类型语义不一致
    | "RELATIONSHIP_NOT_IMPLEMENTED" // 逻辑关系无物理 FK 实现且未声明 physicalPending（§3.7.4）
    | "NAME_CONFLICT";             // 域/族名已被占用（Q1：全局唯一，见 §3.3.1）
  scope: {
    tableId?: TableId;
    fieldId?: FieldId;
    domainId?: string;
    relationshipId?: string;      // 逻辑关系（§3.7.4）
  };
  message: string;                 // i18n key + 参数
  suggestion?: PhysicalSpec;       // 建议的替代物理规格
  fixable: boolean;                // 能否一键应用建议
}
```

> **索引诊断不在本通道**：`DialectDiagnostic`（本节）针对**类型系统**，
> 12 个 code 全部与方言相关。**索引诊断**（`index.unknown_field` 等 6 个 code，
> §3.8.3 裁决 6）与方言无关，走 `core/src/validation/rules.ts` 的
> `checkIndices` → `DiagramIssue` 通道（现状已有
> `index.no_name` / `index.no_fields` / `index.duplicate_name` /
> `unique_constraint.no_fields` / `unique_constraint.duplicate_name`）。

> `LOGICAL_ONLY` / `PHYSICAL_ONLY` 两个 code 的语义已随不变式 6 变更：
> 字段级强制一对一（§3.5.1），因此它们**不再是合法的建模状态**，
> 而是"数据异常或 erwin 源数据不对称"的**提示**。
> **这两个 code 只针对字段级** —— 元素级的非对称是合法的（如逻辑多对多关系
> 暂无物理实现，§3.7.4），因此由 `RELATIONSHIP_NOT_IMPLEMENTED` 单独表达。
> `LOGICAL_PHYSICAL_DIVERGED` 同样是合法状态（用户显式改过物理类型），
> 只提示不阻断（§4.2）。
> 三个 code 全部为 `info`/`warning`，**永不阻断**。

### 6.3 "存在"的判定方式

不能只查类型名白名单（`DATABASE_TYPE_NAMES`），必须查**能力等价**：
对照 `TypeMetadata` 的 `isSized / hasPrecision / hasQuotes / canIncrement / signed /
defaultKind` 判断。

**同名不同义的已知陷阱**（归入 `TYPE_CAPABILITY_MISMATCH`，软冲突）：
- Oracle `NUMBER` vs PostgreSQL `NUMERIC`
- SQL Server `DATETIME`（毫秒舍入）vs MySQL `DATETIME`（保留秒）

### 6.4 方言切换的三分支

| 情形 | 判定 | 处理 |
|---|---|---|
| 源方言的物理类型在目标方言**不存在** | 硬冲突（error） | **要求**用户做目标方言映射修正，不静默替换 |
| 目标方言**存在**但与模板不一致 | 软冲突（warning） | 给出**建议**，不强制覆盖 |
| 选择权 | — | 完全交给用户 |

> 对应 erwin 的官方行为：切换目标数据库时 erwin **提示用户确认转换**，
> 由用户决定是否应用（`references/erwin/html/Data_Types_and_Data_Type_Standards.html`）。

### 6.5 记录

保留的是**用户的选择**，不是诊断快照：
- 用户采纳建议 → 写入 `PhysicalField.fieldType` 并置 `fieldTypeSource = "explicit"`
  （事实，存储）。
- 用户选择"改映射到目标方言的其他类型" → 写入 scope 层的族/域映射（事实，存储）。
- 用户忽略诊断 → 不存储（lint 下次仍会报，符合 lint 语义）。

**方言切换检查报告**是**导出物**而非模型状态：包含检查了哪些字段、每字段的判定、
建议的替代类型、用户是否采纳。可在切换时生成可读报告供用户查看。

---

## 7. 视图与物化

### 7.0 三区划分（Q20，已裁决 2026-10-27）

用户裁决：**视图界面分物理和逻辑；编辑界面显示全部物理 + 逻辑信息进行编辑**，
以方便"物理 ↔ 逻辑"的对应维护。这是本项目对 erwin 的**界面层借鉴**。

| 区域 | 目标 | 形态 |
|---|---|---|
| **画布视图** | 快速浏览 | 两个模式：**逻辑视图**（显逻辑层）/ **物理视图**（显物理层），沿用现有 `viewMode` 切换 |
| **编辑面板** | 精确编辑 | **单一编辑面板**，同时呈现逻辑属性与物理字段的**全部**信息（成对展示），并显式标出对应关系 |
| **映射管理界面** | 批量治理 | 域/族/方言映射、作用域三层、lint 诊断清单 |

**为什么编辑面板不拆成两个**：字段级强制一对一（§3.5.1）意味着每个字段永远有一个
逻辑侧和物理侧；拆成两个界面等于让用户来回切换去比对同一对数据。合并为一个面板后，
"改物理类型 → 看逻辑类型是否仍匹配"、"改逻辑名 → 看物理列名要不要跟着改"
都在同一屏完成，**对应关系本身就是编辑对象**。

> 与 erwin 的差异：erwin 的逻辑层与物理层是**两个独立的模型编辑界面**
> （Model Editor / Model Explorer），靠 Model Sources 联动。本项目把两层放在
> **同一个编辑面板**内成对呈现 —— 因为我们的字段级是一对一，不存在 erwin 那种
> "两边对象集合不同、需要跨界面比对"的场景。详见 §3.5.1。

### 7.1 逻辑视图

- 显示**逻辑层**：逻辑实体名 + 逻辑属性名 + **逻辑类型名** + 逻辑参数
  （如 `UnicodeString(20)`）。
- 关系显示基数标记（沿用现状 `LogicalRelationship`）。
- 逻辑视图**不显示**物理类型名；逻辑视图的"编辑类型"操作作用于逻辑侧
  （选族 / 选域 / 设参数）。
- 字段级强制一对一（§3.5.1）后，正常数据中不会出现"只有逻辑、没有物理"的属性。
  若导入的 erwin 源数据存在这种不对称（`logicalOnly`），该属性在逻辑视图中**照常显示**，
  并带一个标记提示"源数据缺少物理字段"—— 这是**异常提示**，不是可用的建模状态。

> 与 erwin 一致：逻辑侧显示选项里有 "Display Attribute Data Type" 与
> "Display Attribute Domain"（`references/erwin/html/Set_Entity_Display_Preferences.html`），
> 即逻辑视图显示的是**逻辑数据类型**，物理侧对应 "Display Column Datatype"。

### 7.2 物理视图

- 显示**物理层**：物理表名 + 物理列名 + **物理类型规格**（如 `NVARCHAR2(20)`）+ 约束标记。
- 物理视图的类型编辑**直接写物理层**（`PhysicalField.fieldType`），
  并把 `fieldTypeSource` 置 `explicit`，不回写逻辑层（不变式 5）。
- 同样地，正常数据中不会出现"只有物理、没有逻辑"的列。若导入源数据存在这种
  不对称（`physicalOnly`），该列在物理视图中**照常显示**，并带标记提示
  "源数据缺少逻辑属性"—— **异常提示**，不是可用的建模状态。

#### 7.2.1 物理类型名编辑控件（D3，已裁决）

物理类型名使用**可输入的下拉（combobox）**：

| 行为 | 规则 |
|---|---|
| 下拉列表 | 来自该目标方言的类型白名单（`DATABASE_TYPE_NAMES`） |
| 匹配方式 | **增量匹配**（输入前缀/子串即过滤候选） |
| 用户输入的名字**不在**白名单 | **直接采用用户输入**，不阻止、不报错 |
| 校验 | 由 lint 事后校验（`TYPE_NOT_IN_DIALECT` 等），不拦截编辑 |

设计意图：白名单覆盖绝大多数场景并提供增量匹配的速度；同时不封锁白名单外的
合法类型（部分方言允许用户自定义/扩展类型名），错误输入由 lint 兜底，
符合"lint 是常态化校验、编辑不被阻断"的原则。

字段参数（长度/精度/scale）随 combobox 一并编辑，与当前方言的类型能力
（`TypeMetadata.isSized / hasPrecision`）联动显示或隐藏对应输入框。

### 7.3 逻辑名 / 物理名同步

本期**不做**自动同步。理由：自动同步会破坏"逻辑名与物理名可以不同"这一 erwin 语义，
且同步规则（大小写转换、截断到标识符长度、非法字符替换）本身需要单独设计。
列为二期议题。erwin 的 NSM 提供 "Physical to Logical" 开关与 `%AttName` 等宏，
可作为二期实现的参考依据。

### 7.4 编辑面板的字段布局（Q20 的具体化）

编辑面板里，一个逻辑属性与其物理字段**成对呈现**（一行一对），每行含：

| 列 | 内容 | 写向 |
|---|---|---|
| 逻辑名 | `LogicalAttribute.name` + `description` | 逻辑层 |
| 逻辑类型 | 族/域选择 + 逻辑参数（长度/精度/scale） | 逻辑层 |
| 物理列名 | `PhysicalField.name` | 物理层 |
| 物理类型 | 物理类型规格（combobox，§7.2.1）+ 物理参数 | 物理层 |
| 对应状态 | 配对标记 + 诊断图标（lint 结果） | — |

**对应关系本身就是编辑对象**：面板顶部给一个总览条
（如「本表 12 个字段：12 对已配对，0 处类型不一致，1 处待处理」），
点击可跳到具体诊断（§6）。这让"物理 ↔ 逻辑"的维护变成一次连贯操作，
而不是在两个界面之间来回比对。

**新增字段的语义**：面板中新增一个字段 = **同时新增逻辑属性与物理字段**
（一对一，§3.5.2），用户随后分别填两侧的内容；不允许只加一侧。
若用户只填了一侧，另一侧留空是**允许的中间状态**（尚未填写 ≠ 数据缺陷），
但保存时由 INV-4 校验（§3.5）报"未配对"。

> **中间态与数据缺陷的区分**（实现要点）：编辑会话中的"刚新增未填完"是**暂态**，
> 应当允许存在并能被保存为草稿；而**导入来源**的不对称是**缺陷**。
> 二者的区分依据是 `fieldTypeSource` 与"该对是否由本次编辑会话创建"，
> 不是靠字段本身。实现上，INV-4 的"保存前拒绝"只对**导入产物**与**已提交的图**生效，
> 编辑会话内的暂态不触发阻断，仅在 UI 上提示。

---

## 8. 物化策略（域是否落地为目标库的自定义类型）

用户可为逻辑域选择物化策略：

| 策略 | 含义 | 适用 |
|---|---|---|
| `inline` | 展开为物理标量，不产生 UDT | 默认；目标方言不支持类型定义时唯一可选 |
| `materialize` | 在目标库创建原生类型（`CREATE TYPE` / `DOMAIN`） | 目标方言支持且用户需要 |

- 目标方言**不支持**类型定义时，`materialize` 不可用 → lint 报
  `MATERIALIZATION_UNSUPPORTED`，**自动回落 `inline`**（不阻断）。
- 现状仅 Postgres 导出 `CREATE TYPE`（`export/postgres.ts:191-194`），其余六方言静默丢弃
  `diagram.types` —— 新体系要求：**要么物化，要么 inline 展开 + 留痕**，禁止静默丢弃。

> erwin 侧对应的官方概念是 **Domain 的 Physical Data Type + Schema**：
> 逻辑域可声明物理形态与所在 schema，导入/导出时分别携带
> （`references/erwin/html/Data_Types_and_Data_Type_Standards.html`）。

---

## 9. 导出器重构

### 9.1 现状问题

7 个导出器各自直读方言类型名（`export/generic.ts:118-127` `parseType()`），
类型/约束/自增/注释逻辑在 7 处重复 —— 这正是 erwin 模式要消除的"两两映射网格"。

分发点在 `packages/core/src/export/index.ts:30-57`：
`exportSQL(diagram)` → `schemaSQL(diagram)` 按 `diagram.database` switch 到
7 个 `toXxx(diagram)`，未知方言抛
`SQL export for database "${diagram.database}" is not yet implemented.`。

### 9.2 目标架构：导出器拆成两部分（D4，已裁决）

```
┌─────────────────────┐        ┌──────────────────────┐      ┌──────────────┐
│  元数据（定义）导出器 │        │   方言生成器           │      │  数据库脚本   │
│  Metadata Exporter   │───────▶│  Dialect Generator    │─────▶│  .sql 输出    │
│                      │  DSL   │                       │      │              │
│  Diagram + 作用域     │ 描述  │  DSL + 方言配置        │      │              │
└─────────────────────┘        └──────────────────────┘      └──────────────┘
```

#### 第一部分：元数据（定义）导出器

**职责**：把元模型导出为 **DSL 描述** —— 我们自己的元定义序列化格式。

- 输入：`Diagram` + 生效的作用域快照（族/域/映射覆盖）。
- 输出：**DSL 文档**（结构化、可读、可 diff、可再导入）。
- 它**不产出 SQL**，不感知任何方言语法。
- 价值：
  - 元模型的**交换格式**与**中间表示**（IR）—— 元数据与生成解耦。
  - 用户可以"导出逻辑定义"给别的工具/同事，与具体数据库解耦。
  - 未来新增方言只需写生成器配置，不必再写导出器。

DSL 描述至少包含：

| DSL 段 | 内容 |
|---|---|
| 逻辑层 | 逻辑实体（id/名称/描述）、逻辑属性（id/名称/描述/逻辑类型/参数/关联物理字段 id） |
| 物理层 | 物理表（名称/注释）、物理字段（id/名称/物理类型规格/来源标记/描述/约束） |
| 类型体系 | 族定义与各方言映射、域定义（逻辑类型 + 各方言物理形态 + 参数 + `parentId` 冗余字段；父域继承本期不生效，Q13） |
| 关系 | 关系与复合外键 |
| 集合项 | notes / views / enums / areas |
| 作用域 | 应用级 / 工作区级 / 图级 的分层信息 |

> **与 erwin XML 的关系**：DSL 是我们的内部交换格式；
> erwin 的 **XML Standard Files** 是**外部交换格式**。
> 两者之间由 §16 的适配层转换，不混为一谈。

#### 第二部分：方言生成器（配置化）

**职责**：消费 **DSL 描述 + 方言配置**，生成数据库脚本。

- 输入：DSL 文档 + 目标方言配置。
- 输出：该方言的 SQL 脚本。
- 生成器**不判定逻辑类型**——物理类型已由解析器写入字段（DSL 携带它），
  生成器只负责按方言语法渲染。
- 方言配置化内容：标识符引用符、约束子句语法、自增子句、默认值引号策略、
  注释语法、类型名大小写约定、类型映射覆写。

### 9.3 分期范围（D4，已裁决）

| 阶段 | 范围 | 理由 |
|---|---|---|
| **第一步（本期）** | 导出器**只接入物理层类型**：类型名与参数改读 `PhysicalField.fieldType`，导出器不再自行判定类型与拼长度 | 这是本次重构的核心目标，有直接用户可见价值（物理类型 → 正确方言 SQL） |
| **第二步（另立任务）** | 抽出方言 SQL 适配层（约束/自增/注释/引号），消除 7 处重复 | 纯内部重构，需独立验证与独立回归 |
| **第三步（后续演进）** | 落地"元数据导出器 → DSL"与"DSL → 方言生成器"的完整拆分 | 依赖前两步完成 |

### 9.4 第一步的附带清理

1. `export/generic.ts:12-74` 的手写 `genericMetadata` 与
   `types/registry.ts` 的注册表重复 → **收敛到注册表一处**（`export/dialect-meta.ts:16-21`
   已是注册表的薄封装，是收敛的天然入口）。
2. `export/generic.ts:101-116` `parseDefault()` 依赖类型元数据决定是否加引号
   → 改由物理规格携带的物理能力信息驱动。
3. `export/generic.ts:118-127` `parseType()` 读取 `field.type` + `field.size`
   → 改读 `PhysicalField.fieldType`。
4. 七个方言导出器中**仅 Postgres** 导出 `diagram.types`（`export/postgres.ts:191-194`），
   其余六方言静默丢弃 → 新体系要求"要么物化、要么 inline + 留痕"（§8）。
5. **索引导出统一化**（§3.8.3）：现状 7 个方言导出器各自手写
   `CREATE [UNIQUE] INDEX ... ON ... (...)`（`export/mysql.ts:63-72`、
   `postgres.ts:252-259`、`mssql.ts:183-192`、`oraclesql.ts:131-142`、
   `sqlite.ts:103-110`、`generic.ts:173-180`），且**都不支持索引类型、
   部分索引、包含列、排序方向**。新体系要求：
   - 索引渲染下沉到**方言生成器**的配置化能力位（每个方言声明支持哪些索引特性），
     不支持的特性**降级并在导出预览里提示**，不静默丢弃（R21）；
   - 索引的**列引用改为字段 id**（§3.8.3 裁决 1），生成器按 id 查物理列名；
   - 唯一约束（UK）与唯一索引**保持分离**：UK 走内联 `CONSTRAINT ... UNIQUE`
     （现状 `export/shared.ts:98-118` 的 `uniqueConstraintClause` 行为正确，保留），
     唯一索引走独立 `CREATE UNIQUE INDEX`；
   - DBML 侧的唯一约束**降级为唯一索引**，且该形态差异在 `dbml/diff.ts`
     中**显式忽略**（D25、R20）。

---

## 10. 与既有工作的关系

- 既有 20 个任务（React→Vue SDK 转写）已完成，本次属**新阶段**（功能增强与逻辑重构），
  作为新的任务序列并列，不修改既有任务状态。
- `sdk-workspace/progress.md` 是决策台账（注意 `AGENTS.md:39,187` 路径引用有误，
  文件实际在 workspace 根）。
- 上一轮术语审计的 31 项不一致中，与本次重构直接相关且纳入本期的：
  - **P0-1/2/3**：`docs/spec.md:431,437,438` 对两种视图的描述与实现矛盾 → 随新实现重写。
  - **P0-5**：`docs/plan.md:936` "ViewMode from core" 错误 → 本设计保持 ViewMode 在 SDK 层
    （与 `packages/sdk/src/types/sdk-options.ts:16` 一致）。
  - **P0-6**：`Field.comment` 死数据 → 新模型中物理描述在 `PhysicalField.comment`、
    逻辑描述在 `LogicalAttribute.description`，两者都需接入渲染与导出。
  - **P1**：`entity` / `table` 双重词汇 → 新模型用 erwin 官方词汇
    「逻辑实体 / 逻辑属性」与「物理表 / 物理字段」；`entity` 在集合项语境（notes/views/enums）保留。
  - **P1**：Header 菜单硬编码英文无 i18n → 新增类型相关 UI 时必须补齐 51 个 locale。
  - **P2**：`docs/progress.md` 路径错误 → 顺手修正 `AGENTS.md`。
  - 其余（无架构图、locale 英文拷贝、superpowers plan 未对账等）不纳入本期，另立债务清单。
- **索引（Index）的维护缺口**（用户 2026-10-27 从数据库管理角度提出）单列为 **P2'**，
  与双层改造 P1 并行，不并入 P1 —— 详见 §3.8。

---

## 11. 决策问题汇总（Q1–Q33）

| # | 问题 | 状态 |
|---|---|---|
| Q1 | 逻辑域的**命名冲突**处理：同名字符串在应用级/工作区级/图级同时出现时如何裁决？ | ✅ 已裁决：**保持全局唯一，特别是映射定义**（用户裁决 2026-10-27）。域/族/映射定义在同一工作区内唯一；作用域只决定"值的来源"，不产生同名并存。见 §3.3.1 |
| Q2 | `enum` 的归属 | ✅ 已裁决（D2：族 + 属性级取值） |
| Q3 | 物理视图的"编辑类型"交互 | ✅ 已裁决（D3：可输入下拉 + 增量匹配） |
| Q4 | 导出器重构范围 | ✅ 已裁决（D4：两步走 + 拆成元数据导出器 / 方言生成器两部分） |
| Q5 | 应用级配置是否允许用户修改 | ✅ 已裁决：**允许修改但存本地**，并提供"恢复默认"逃生口 |
| Q6 | DSL 描述的具体形态；是否需要"DSL → 图"的反向导入 | ✅ 已裁决：**JSON**，且**做反向导入** |
| Q7 | 逻辑名在导出物中的体现 | ✅ 已裁决：**只作 SQL 注释**，另提供"列名用逻辑名"的可选开关 |
| Q8 | 物理类型是推导物还是存储数据 | ✅ 已裁决：**存储数据** + `fieldTypeSource` 三态 |
| Q9 | 逻辑层与物理层的关系 | ✅ 已裁决：**双层并存**（同一文件两张模型） |
| Q10 | 本期范围 | ✅ 已裁决：**骨架 + 类型系统 + 映射界面 + erwin 导入器第一版** |
| Q11 | 逻辑属性与物理字段的数据结构 | ✅ 已裁决：**平行数组 + id 关联** |
| Q12 | erwin 导入目标格式 | ✅ 已裁决：**XML Standard Files** 变体（可回导入 erwin 的那种）；二进制 `.erwin` 不支持 |
| Q13 | 域的**父域继承**是否本期实现 | ✅ 已裁决：**不实现**；模型与 DSL Schema 保留 `parentId` 字段作冗余，设置界面不暴露（2026-10-27） |
| Q14 | `Logical Only` / `Physical Only` 是否本期提供 UI 入口 | ✅ 已裁决：**提供**（2026-10-27，用户原话「不提供无法实现用户测试」）。注意语义已变：字段级强制一对一（§3.5.1），故该 UI 是**导入数据的异常标记入口**与**预留的建模开关** |
| Q15 | erwin 导入时**未知元素的处理策略** | ✅ 已裁决：**宽松模式** —— 不支持就提示不支持（跳过 + 报告），不严格报错（2026-10-27） |
| Q16 | 是否支持"暂不物理化"（只有逻辑定义的字段） | ✅ 已裁决：**暂不做**（用户裁决 2026-10-27）。若将来需要，需放宽 INV-4 并引入"字段是否已物理化"状态位 |
| Q17 | **erwin 多版本 Schema 的差异化处理策略** | 🔶 **暂定**（用户裁决 2026-10-27）—— 基准 ERWin 7；**具体识别与降级策略留到做该项时再讨论**（§16.6 现为候选方案，非定稿） |
| Q18 | 宽松导入中"跳过"的对象如何处置 | ✅ 已裁决：**对应位置标记为无效，并在导入报告中给出**（2026-10-27）。见 §16.5 |
| Q19 | 域的 `parentId` 在 DSL 往返中是否保留（本期不生效但字段存在） | ✅ 已裁决：**保留**（2026-10-27）—— DSL 是交换格式，字段存在即应往返 |
| Q20 | 逻辑/物理视图下双层数据的编辑入口形态 | ✅ 已裁决：**视图界面分物理与逻辑；编辑界面显示全部物理 + 逻辑信息**（2026-10-27）。见 §7.0、§7.4 |
| Q21 | **逻辑/物理的划分是否只适用于字段？** | ✅ 已裁决：**不是** —— 适用于全部模型对象（实体/表、键组、关系、类型、字段约束），但**对应规则按元素类不同**（§3.7.4）。用户审计 2026-10-27 |
| Q22 | 逻辑侧是否需要**独立的键组（Key Group）对象**？ | ✅ 已裁决：**不新增**（D21）—— 键角色挂逻辑属性 `keyRole`，Definition 挂 `Index.comment`；避免三层对应 |
| Q23 | 逻辑侧是否需要**独立的关系对象**？ | ✅ 已裁决：**新增 `LogicalRelationship`**（D22）—— 角色名/基数/关系类型；与物理 FK 强制一对一，多对多/子类型可 `physicalPending` |
| Q24 | 字段级约束（notNull/unique/check/default）是否需要逻辑孪生？ | ✅ 已裁决：**不需要**（D20）—— 逻辑侧只保留"是否必填"一条业务语义 |
| Q25 | SQL View / 备注 / 区域是否需要逻辑侧？ | ✅ 已裁决：**不需要**（与 erwin 一致，物理侧独有） |
| Q26 | 逻辑枚举（业务取值域）与物理原生枚举的关系？ | ✅ 已裁决：**一对多、不强制**（D20）—— 逻辑取值域在属性级，物理原生枚举是实现选择 |
| Q27 | 索引改造纳入 P1 还是独立成 P2'？ | ✅ 已裁决：**独立 P2'，与 P1 并行**（D24）。§3.8.3 |
| Q28 | 唯一约束（UK）与唯一索引（UNIQUE INDEX）是否合并？ | ✅ 已裁决：**不合并** —— UK 内联导出、唯一索引独立 CREATE（现状行为正确）；DBML 侧按 D25 降级 |
| Q29 | FK 索引是否自动生成？ | ✅ 已裁决：**提供可选动作**（新增关系时"一并创建 FK 索引"），不强制；同时报 `index.relationship_without_index` 诊断 |
| Q30 | 索引字段引用从名字改 id 是否破坏现有数据？ | ✅ 已裁决：**直接改**（"一图一库、不做 schema 迁移"已裁决）；读取路径保留按名字反查 id 的兜底 + 诊断 |
| Q31 | SidePanel 是否新增独立 "Indices" 页？ | ✅ 已裁决：**新增**（解决"表格一多，画布内联就不够"的问题）；与画布内联共用 `IndexEditor.vue` |
| Q32 | 索引的命名规则？ | ✅ **用户裁决（2026-10-27）**：Index 增 `logicalName`；自动命名 = 逻辑名 `Idx_`+表逻辑名、物理名 `Idx_`+物理表名；**双名用户均可改**；撞名加序号；表改名不回溯（D26）。§3.8.3 裁决 1 |
| Q33 | PK/UK/FK 是否独立成具名对象？如何呈现？ | ✅ **用户裁决（2026-10-27）**：独立建**类 Index 的双名结构**（`PrimaryKey`/`UniqueKey`/**`ForeignKey`**——FK 依追加裁决独立成对象，不并入 `Relationship`），支持逻辑名 + 自动命名；UI = **表格下方分割线条目区**（图标+名称、可切换显示、点击定位编辑器、就地改名）（D27）。§3.8.3 裁决 2/5 |

> Q12 的依据：erwin 的 XML 有三个变体，只有 **XML Standard Files**
> （不展开宏与名字）是"可用于再导入 erwin Data Modeler"的格式；
> XML Repository Format 展开宏与物理名，**不能**用 erwin 打开
> （`references/erwin/html/Save_a_Model_in_XML_Format_XML_Export.html`）。

---

## 12. 测试策略

遵循 `AGENTS.md` §6：核心工具必须有单测；测试通过仓库自带 runner
`node --experimental-strip-types scripts/run-tests.mjs`（**不是** vitest）。

| 层 | 覆盖对象 | 形式 |
|---|---|---|
| `core` 单元测试 | `resolveType` 的完整优先级链（属性 > 域 > 族 > 映射） | `resolveType.test.ts`（node:test + node:assert/strict） |
| `core` 单元测试 | 来源标记语义：`mapped` 重算 / `explicit` 不动 / `imported` 默认不动 | `reconcile.test.ts` |
| `core` 单元测试 | 一致性不变量 INV-1..INV-9 各一例；**字段级一对一**（删物理字段 → 逻辑属性同时被删）；**实体/表内嵌一对一**（INV-7）；**逻辑关系 ↔ 物理 FK 一对一**（INV-6，含 `physicalPending` 豁免）；**索引引用有效性**（INV-8）；**约束对象完整性**（INV-9：至多一个 PK、列引用存在、双名各自命名空间唯一） | `model-invariants.test.ts` |
| `core` 单元测试 | lint 诊断：**12 个 `DialectDiagnostic` code**（含同名不同义两个陷阱、非对称两个 code、关系未实现、名称冲突）各至少一例 | `dialect-lint.test.ts` |
| `core` 单元测试 | **索引/约束诊断**：12 个新 `DiagramIssue` code（`index.*` 6 个 + `constraint.no_columns` / `constraint.duplicate_schema_name` / `constraint.duplicate_logical_name` / `constraint.fk_without_relationship` / `constraint.relationship_without_fk` / `table.multiple_primary_keys`）各至少一例 | 扩展 `validation/validate.test.ts` |
| `core` 单元测试 | **索引模型**：列按 id 引用；索引改名/删列后不产生孤儿；`supportsRelationshipId` 指向不存在的关系时报诊断；索引名全图唯一 | `index-model.test.ts`（§3.8.3） |
| `core` 单元测试 | **双名与自动命名**（D26/D27）：创建时 `logicalName`/`name` 按规则物化；撞名追加 `_2`/`_3`；表改名**不回溯**改既有约束名；双名各自独立可改 | `constraint-naming.test.ts` |
| `core` 单元测试 | **PK/UK/FK 对象化**（D27）：`Table.primaryKey`/`uniqueKeys`/`foreignKeys` 增删改；`field.primary` 废弃后导出器内联 `PRIMARY KEY` 与画布 PK 标记改读 PK 对象（7 方言导出回归）；`Relationship` ↔ `ForeignKey` 强制一对一（创建关系自动建 FK、删关系级联删 FK，INV-10）；FK 默认名 `FK_子表_父表` | `key-constraints.test.ts` |
| `core` 单元测试 | **索引撤销粒度**：`AddIndexCommand`/`UpdateIndexCommand`/`RemoveIndexCommand` 各自独立撤销，**不**回滚表的其他属性 | `index-commands.test.ts`（§3.8.3 裁决 3） |
| `core` 单元测试 | **DBML 往返对称**：UK → 唯一索引 → 再导入落在 `indices`（不伪造成 `uniqueConstraints`），diff 不报形态差异 | `dbml/index-roundtrip.test.ts`（§3.8.3 裁决 4） |
| `core` 单元测试 | 内置族映射完整性：11 族 × 7 方言 = 77 条齐全（守卫测试） | `type-families.test.ts` |
| `core` 单元测试 | **全局唯一性（Q1）**：同名域/族创建被拒；覆盖只作用于某域/某族某方言项；同名不会出现两条定义 | `type-uniqueness.test.ts` |
| `core` 单元测试 | 域的 `parentId` **保留但不影响解析**（Q13：字段存在、解析不沿父链） | `domains.test.ts` |
| `core` 单元测试 | 7 个方言导出器的类型渲染回归（改类型逻辑后仍产出正确 SQL） | 扩展现有 7 个 `*.test.ts` |
| `core` 单元测试 | erwin XML 导入：样本文件 → 双层模型；**宽松模式**（未知元素**标记为无效 + 入报告**，Q18） | `erwin-import.test.ts` |
| `core` 单元测试 | 无效标记：`InvalidMarker` 的序列化、不参与 SQL 导出、报告条目与标记一一对应 | `erwin-import.test.ts` |
| `core` 单元测试 | 多版本归一化：别名表命中、缺失字段留空 + 标记、结构差异降级 | `erwin-versions.test.ts`（Q17 策略暂定，实现时再定细节） |
| `core` 单元测试 | DSL 导出器：DSL 文档结构正确、可往返（含 `parentId` 往返保留，Q19） | `dsl-export.test.ts`（第二步） |
| `sdk` 组件测试 | 物理视图 combobox：增量匹配、输入白名单外名字被接受 | `PhysicalTypeEditor.test.ts`（@vue/test-utils + jsdom） |
| `sdk` 组件测试 | 逻辑视图显示逻辑类型名、物理视图显示物理规格 | 扩展 `view-mode.test.ts` |
| `sdk` 组件测试 | 双层编辑：改物理名不动逻辑名；**删物理字段同时删逻辑属性** | `dual-layer-editing.test.ts` |
| `sdk` 组件测试 | `Logical Only` / `Physical Only` 的 UI 入口可用（Q14） | `dual-layer-editing.test.ts` |
| `sdk` 组件测试 | **统一编辑面板**：同一行同时呈现逻辑名/逻辑类型与物理列名/物理类型（Q20、§7.4） | `dual-layer-editing.test.ts` |
| `sdk` 组件测试 | 编辑面板新增字段 = 同时新增两侧；未填完的暂态可保存（INV-4 只提示不阻断） | `dual-layer-editing.test.ts` |
| `sdk` 组件测试 | **索引编辑器**：多列下拉选择（不是逗号分隔自由文本）、增删列、唯一开关、**删除整条索引**（现状无删除入口）、锁定表只读 | `index-editor.test.ts`（§3.8.3 裁决 5） |
| `sdk` 组件测试 | **表格下方条目区**（D27）：分割线 + 图标+名称条目（PK/UK/FK/IDX 四类图标区分）；逻辑视图显 `logicalName`、物理视图显物理 `name`；显示/隐藏切换；点击条目定位对应编辑器；名称就地编辑 | `constraint-strip.test.ts`（§3.8.3 裁决 2/5） |
| `sdk` 组件测试 | **SidePanel Indices 页**：按表分组展示、增删改索引、与画布内联编辑同一份数据 | `index-panel.test.ts` |
| `sdk` 组件测试 | **索引文案全部走 i18n**（现状硬编码英文），51 个 locale 都有对应 key | 扩展 `i18n/index.test.ts` |
| `e2e` | 逻辑视图改类型 → 切物理视图 → 导出 SQL 含预期物理类型 | `e2e/` 新增 spec |
| `e2e` | 方言切换触发 lint，软冲突给建议、硬冲突阻断 | `e2e/` 新增 spec |
| `e2e` | 导入 erwin XML → 双层模型就位 → 导出 SQL 正确 | `e2e/` 新增 spec（需样本文件） |
| `e2e` | 侧栏新增索引 → 画布可见 → 导出 SQL 含 `CREATE INDEX`；删除索引 → 导出不再含 | `e2e/` 新增 spec |

**测试数据**：不引入 JSON 快照（无历史兼容考量），改用**工厂函数**构造图与字段，
便于批量生成"11 族 × 7 方言"的矩阵用例。

**erwin 导入的测试样本问题**：没有真实 erwin 文件时，导入器测试只能用**手写的最小 XML**
（按官方帮助页推断的元素名构造）—— 这只能验证解析器逻辑，**不能验证元素名正确**。
用户将在开发期提供 erwin 导出的 Schema 示例文档（§16.4），必须补一份真实样本。

---

## 13. 分阶段实施建议

| 阶段 | 内容 | 可交付价值 |
|---|---|---|
| **P1 · 模型** | `core` 新增族/域/物理规格模型；`Table` 拆双层（`logical` + `fields`）；`Field` → `PhysicalField`（`fieldType` + `fieldTypeSource`）；族定义与 77 条内置映射 | 逻辑层独立于方言；物理层成为可存储的资产 |
| **P2 · 解析器** | `resolveType` / `validatePhysicalType` / `reconcilePhysicalTypes` + 作用域快照 + 三层查找；`core` 单测 | 解析逻辑可验证 |
| **P3 · lint** | 诊断模型、12 个 `DialectDiagnostic` code、能力等价判定、非对称提示；`core` 单测 | 持续校验 |
| **P4 · 导出接入** | 7 个导出器改读 `PhysicalField.fieldType`；收敛 `genericMetadata` 漂移点 | **核心用户可见价值**：导出正确 |
| **P5 · SDK 接入** | 逻辑视图显示逻辑属性与逻辑类型名；物理视图 combobox 直写物理层；**统一字段编辑面板**（成对呈现逻辑+物理全部信息，Q20）；双层编辑语义；i18n 补齐 51 个 locale | 两层真正分工 |
| **P6 · App 接入** | 三级作用域装配（应用级常量 / 工作区级本地存储 / 图级）、**全局唯一性校验**（Q1：同名拒绝创建）、设置界面、自定义族/域与映射编辑 | 用户可配置 |
| **P7 · erwin 导入器** | 以 **ERWin 7 Schema 为基准**解析 XML Standard Files → 双层模型 + 域定义 + 导入报告；**宽松模式**（不支持就**标记为无效 + 报告**，Q15+Q18）；多版本归一化（策略暂定，Q17） | 存量数据可迁移 |
| **P8 · DSL**（后续） | 元数据导出器产出 DSL 文档；方言生成器消费 DSL | 元数据与生成解耦 |
| **P2' · 索引与约束维护**（并行线，§3.8）**— 已交付 2026-10-30（模型/命名/命令/校验/导出/面板/画布与树；旧属性删除见计划 Task 8）** | `Index` 模型升级（双名 + 自动命名、`columns: IndexColumn[]` 按 id 引用、类型/部分/包含列/注释/FK 支撑标记）；**PK/UK/FK 双名对象化**（`PrimaryKey`/`UniqueKey`/`ForeignKey` 独立对象、`field.primary` 废弃、INV-10 一对一）；索引级撤销命令；12 条新校验；**表格下方条目区** + SidePanel "Indices" 页 + 折叠态摘要；i18n 补齐 | **数据库管理视角的完整性**：索引与约束可增删改查、可命名、可校验、可导出正确的 DDL |

依赖关系：P1 → P2 → {P3, P4}；P5 依赖 P1+P2；P6 依赖 P5；P7 依赖 P1（可与 P5 并行）。
P3 与 P4 可并行。P8 依赖 P4 完成。
**P2' 与 P1 并行**，只共享一处约定：索引的字段引用在 P1 前后**都必须是 id**
（P1 只把"名字"改成"id"，P2' 负责在此基础上加列序/类型等表达力）。

> **P7 的第一个任务是取得真实 erwin 样本**（用户将在开发期提供 erwin 导出的 Schema
> 示例文档）。在拿到样本之前，导入器的元素名只能依据官方帮助页推断，
> 不得声称导入器可用（R11）。

---

## 14. 风险与缓解

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | `Field.type` / `Field.size` 移除 + `Table` 双层化是**破坏性变更**，波及所有导出器、画布渲染、测试 | 高 | 一图一库 + 无历史数据兼容（已裁决）→ 可一次性重写；但需在 P1 完成后**立刻**跑 `pnpm typecheck` 暴露全部受影响点，逐点迁移而非逐个文件"碰到才改" |
| R2 | 77 条内置映射的正确性无法靠测试穷举验证（需对照真实方言文档） | 高 | 映射表**逐条人工核对官方文档**并标注来源；守卫测试只保证"齐全"，不保证"正确"；正确性靠 review |
| R3 | lint 误报导致用户对诊断失去信任 | 中 | "能力等价"判定优先复用既有 `TypeMetadata`；新增 code 默认 `info`，误报率高的规则降级而非删除；非对称（`LOGICAL_ONLY`/`PHYSICAL_ONLY`）只作提示不报警 |
| R4 | 三级作用域 + 解析器的组合语义复杂，边界情况多 | 中 | 作用域查找规则写死在单一函数内，配表驱动单测；三层合并逻辑不散落 |
| R5 | 物理视图 combobox 输入白名单外名字 → 导出非法 SQL | 中 | lint 兜底 + 导出前若存在 error 级诊断则提示（不阻断，与用户"最终以用户修改结果为准"的取向一致，但需在 UI 明确提示） |
| R6 | 物化策略（`materialize`）在多数方言无原生支持，容易做成半成品 | 中 | 本期 `materialize` 仅 Postgres 可用；其余方言 UI 置灰并说明原因，不做伪实现 |
| R7 | 逻辑名与物理名不自动同步，用户困惑 | 低 | 逻辑视图与物理视图分别标注"逻辑名 / 物理名"，编辑时明确显示影响范围 |
| R8 | 新增 51 个 locale 文案工作量 | 低 | 类型相关文案先集中在少数 key（族名 11 + 域 + 诊断 code 12 + 索引相关文案），不按方言×类型展开 |
| R9 | **双层模型让画布渲染复杂度上升**：现状一个 `Table.vue` 渲染一张表，现在要按当前视图渲染逻辑层或物理层 | 中 | 复用现有 `Table.vue`（物理）与 `LogicalTable.vue`（逻辑）两套组件，只把数据源从"同一份 Field 换渲染方式"改为"两套层各自渲染"；组件文件数不增加 |
| R10 | **平行数组产生孤儿数据**（逻辑属性指向已删字段等） | 中 | §3.5 的 INV-1..INV-9 不变量 + 专门的 `model-invariants.test.ts`；保存前校验、导入时清理并报告 |
| R11 | **erwin XML 元素名靠推断**（无 XSD、无真实样本） | 高 | P7 的**第一个任务必须是"拿到一份真实 erwin 导出的 XML Standard Files 做逆向"**；在此之前不得声称导入器可用。元素名以 erwin 帮助页与 API Reference 为准并标注来源页名 |
| R12 | 物理类型存为数据后，映射变更不会自动生效，用户以为"改了映射没用" | 中 | UI 明示每个字段的来源标记（mapped/explicit/imported），并提供"批量转为 mapped 以启用自动重算"的入口 |
| R13 | **erwin 各版本 Schema 定义不同**，基准 ERWin 7 之外的版本可能解析不全 | 中 | §16.6 的"识别 → 映射 → 宽松降级"三段式（**策略暂定，Q17**，实现时再定）；版本差异归一化层隔离在导入器内部；无法归一的走宽松模式（**标记无效 + 报告**），不抛错 |
| R14 | 宽松导入**静默丢失数据**，用户以为导入完整 | 高 | Q18 裁决：跳过内容**不是丢弃，而是在对应位置标记为无效**（`InvalidMarker`），图数据中保留占位；导入报告逐项列出（对象类型/元素名/原因/建议）；导入完成界面必须展示报告摘要，不允许"静默成功" |
| R15 | **统一编辑面板**信息密度过高（一行同时呈现逻辑 + 物理两侧），比现状更拥挤 | 中 | 面板按"成对一行"组织并支持**折叠显示物理列**（默认展开，用户可整表折叠）；物理列窄、逻辑列宽；对应状态用图标 + tooltip 而非文字；沿用现状 SidePanel 的折叠模式 |
| R16 | 编辑面板新增字段时"两侧同时新增"与 INV-4 的"必须配对"在**暂态**下冲突 | 中 | §3.5.2 已区分**编辑暂态**（允许未填完，可存草稿，INV-4 只提示）与**导入缺陷**（标记无效 + 报告）；INV-4 的"保存前拒绝"只作用于导入产物与已提交图，不阻断编辑会话 |
| R17 | **全局唯一性（Q1）与"图级自定义"冲突**：图级创建域时，若同名域已存在于工作区级/应用级，用户期望"本图另建一个" | 中 | 语义明确为**同一个域**（§3.3.1）：图级创建同名域 → 拒绝创建并提示"该名称已被使用（定义于 X 作用域）"，提供两个后续动作：跳转到已有定义 / 在图级覆盖其某一方言映射。若将来确需"本图另立同名"，需引入显式的"域实例"概念（本期不做） |
| R18 | **索引字段引用改 id 是破坏性变更**：所有导出器/导入器/DBML/校验都按字段名读写索引 | 高 | 与 R1 同批处理（"一图一库、不做 schema 迁移"已裁决）；P1 完成后立刻跑 `pnpm typecheck` 暴露全部受影响点；读取路径保留"按名字反查 id"的兜底 + 诊断 |
| R19 | **索引 UI 三层化**（画布内联 + SidePanel 页 + 折叠摘要）工作量与信息密度都上升 | 中 | 画布内联与 SidePanel 页共用同一个编辑组件（`IndexEditor.vue`），只换容器；折叠摘要只显示计数，不展开内容；SidePanel 页按表分组折叠 |
| R20 | **DBML 往返不对称**（UK 降级为唯一索引）导致 diff 噪音 | 低 | 明确规则（§3.8.3 裁决 4）：DBML 侧以唯一索引为权威形态，SQL 导入才是 UK 的权威来源；DBML diff 对"UK→唯一索引"这一形态差异**显式忽略**（`dbml/diff.ts` 白名单） |
| R21 | **索引类型/部分索引/包含列**的方言支持差异大，容易做出"生成了但数据库不认"的 SQL | 中 | 每个方言声明支持的索引特性集合（复用 `TypeMetadata` 的 `hasCheck` 那种能力位模式）；不支持的特性在导出时降级并在导出预览里提示，**不静默丢弃** |

---

## 15. 决策记录（Decisions）

| # | 决策 | 依据 |
|---|---|---|
| D1 | 内置族映射穷举；自定义族允许留空走 common | 用户裁决 2026-10-26 |
| D2 | `enum` 为族、取值在属性级；域只做标量别名 | 用户裁决 2026-10-26 |
| D3 | 物理类型名用可输入下拉（增量匹配），白名单外输入直接采用 | 用户裁决 2026-10-26 |
| D4 | 两步走：先接物理层类型；导出器终态拆为"元数据导出器（DSL）+ 方言生成器（配置化）" | 用户裁决 2026-10-26 |
| D5 | 模型升级为**逻辑层 + 物理层双层并存**，可分别编辑；**字段级强制一对一**（有意偏离 erwin 的非对称机制） | erwin 官方模型 + 用户裁决 Q9 2026-10-26 + 用户裁决 2026-10-27 |
| D6 | **物理类型是存储数据**，带 `fieldTypeSource` 三态标记 | 用户裁决 Q8 2026-10-26 |
| D7 | 逻辑属性与物理字段**平行数组 + id 关联** | 用户裁决 Q11 2026-10-26 |
| D8 | 术语改用 erwin 官方词汇：**DSM（数据类型标准）**、**Domain（域）**；`typeId` → `domainId` | 与 erwin 对齐（用户正在使用 erwin） |
| D9 | erwin 导入目标格式 = **XML Standard Files**；不支持二进制 `.erwin` | erwin 官方导出格式说明 |
| D10 | **字段级强制一对一**：删除物理字段同时删除逻辑属性（对称）；erwin 的 `Logical Only`/`Physical Only` 降级为异常提示 | 用户裁决 2026-10-27 |
| D11 | erwin 导入以 **ERWin 7 Schema 为基准**；**宽松模式**（不支持就提示不支持，跳过 + 报告）；多版本差异化处理 | 用户裁决 2026-10-27 |
| D12 | 域的**父域继承本期不实现**，模型与 DSL Schema 保留 `parentId` 作冗余，设置界面不暴露 | 用户裁决 Q13 2026-10-27 |
| D13 | `Logical Only` / `Physical Only` 的 UI 入口**本期提供** | 用户裁决 Q14 2026-10-27 |
| D14 | 本项目**借鉴** erwin 而非照抄；实现以"处理导入问题时决定导入逻辑"为原则 | 用户裁决 2026-10-27 |
| D15 | 宽松导入的跳过内容**在对应位置标记为无效**（`InvalidMarker`），不丢弃；导入报告逐项给出 | 用户裁决 Q18 2026-10-27 |
| D16 | **视图界面分物理与逻辑；编辑界面显示全部物理 + 逻辑信息**（成对呈现），便于维护物理↔逻辑对应 | 用户裁决 Q20 2026-10-27 |
| D17 | 域的 `parentId` 在 DSL 往返中**保留**（字段存在即应往返，尽管本期不生效） | 用户裁决 Q19 2026-10-27 |
| D18 | erwin 多版本 Schema 差异化策略**暂定**，实现 P7 时再具体讨论（基准 ERWin 7） | 用户裁决 Q17 2026-10-27 |
| D19 | **域/族/映射定义全局唯一**（同一工作区内）；三级作用域只决定"值的来源"，不产生同名并存；覆盖粒度限定为"某域 / 某族的某个方言项" | 用户裁决 Q1 2026-10-27（「保持全局唯一，特别是映射定义」） |
| D20 | **元素级双层对应按语义不按数量**：字段级强制一对一；实体/表内嵌式一对一；逻辑关系强制一对一（多对多/子类型可 `physicalPending`）；键组/字段约束/类型**不强制** | §3.7.4 裁决（2026-10-27 元素级审计） |
| D21 | **逻辑键组不新增独立对象**：键的业务语义位挂逻辑属性（`keyRole`），Key Group 的 Definition 文本挂**物理索引的 `comment`**（与 erwin 的迁移方向一致） | §3.7.4/§3.7.5（2026-10-27） |
| D22 | **新增 `LogicalRelationship`**（角色名、基数、关系类型），与物理 FK 强制一对一；逻辑多对多/子类型允许物理实现缺省 | §3.7.4（2026-10-27） |
| D23 | **索引是物理层对象，但需要完整维护**：模型升级（双名 + 列按 id 引用 + 类型/部分/包含列/注释/FK 支撑标记）、索引级撤销命令、12 条新校验、三层 UI（表格下方条目区 + SidePanel Indices 页 + 折叠摘要） | §3.8 裁决（2026-10-27 用户指出"缺失索引维护"；双名与条目区为用户裁决 1/2/5） |
| D24 | **索引维护独立成 P2'，与双层改造 P1 并行**，不拖进 P1 | §3.8.3 裁决 7 |
| D25 | **DBML 侧唯一约束降级为唯一索引**（DBML 语法本身不区分），SQL 导入才是 UK 的权威来源；diff 显式忽略该形态差异 | §3.8.3 裁决 4（避免往返不对称） |
| D26 | **Index 双名 + 自动命名**：`logicalName`（默认 `Idx_`+表逻辑名）与 `name`（默认 `Idx_`+物理表名）并存，**用户均可修改**；自动命名只在创建时发生、撞名加序号、表改名不回溯（用户裁决 2026-10-27） | §3.8.3 裁决 1 |
| D27 | **PK/UK/FK 独立建类 Index 的双名结构**：`PrimaryKey`/`UniqueKey`（取代 `UniqueConstraint`）/`ForeignKey`（FK 依用户追加裁决独立成对象，经 `relationshipId` 关联 `Relationship`，二者强制一对一 INV-10；`Relationship.name` 废弃）；**`field.primary` 废弃**，PK 成员关系由 `Table.primaryKey.columns` 表达；UI = 表格下方分割线条目区（图标+名称、可切换、点击定位、就地改名）（用户裁决 2026-10-27） | §3.8.3 裁决 2/5 |
| — | 逻辑层为 source of truth（推荐 A 案） | 用户未直接选 A/B/C，但后续所有裁决（覆盖不回写、映射由逻辑侧驱动）均蕴含此前提 |
| — | 一图一库 | 用户裁决 2026-10-26（m00287） |
| — | 不做历史数据兼容 / schema 迁移 | 用户裁决 2026-10-26（m00287） |
| — | SDK 暴露解析器、App 装配三层作用域 | 用户裁决 2026-10-26（m00282） |
| — | lint 常态化，诊断不入库、用户选择入库 | 用户裁决 2026-10-26（m00282） |
| — | 方言切换：不存在=硬冲突要求修正；存在但不一致=软冲突建议 | 用户裁决 2026-10-26（m00277） |

---

## 16. erwin 兼容层

> 本节把 erwin 的官方概念映射到本项目的实现，是 P7（erwin 导入器）的设计依据。
> 所有 erwin 事实均可在 `docs/references/erwin/` 中查到对应来源页。

### 16.1 概念对照表

| erwin 官方概念 | erwin 元素/术语 | 本项目 | 来源页 |
|---|---|---|---|
| 逻辑实体 | Entity（`EntryId`/`EntryName`/`EntryDesc`） | `LogicalEntity` | `Entity_Editor`、`Entities` |
| 逻辑属性 | Attribute（`attributeid`/`attributeName`/`arributeDesc`/`attributetype`） | `LogicalAttribute` | `Entity_Editor` |
| 逻辑→物理对应 | `fieldid` / `fieldId` | `LogicalAttribute.fieldId` → `PhysicalField.id` | 用户提供的 erwin 样本结构 |
| 物理表 | Table（`tableName`） | `Table.name` | `Tables` |
| 物理列 | Field（`fieldName`/`FieldType`/`Comment`） | `PhysicalField`（`name`/`fieldType`/`comment`） | 用户提供的 erwin 样本结构 |
| 物理数据类型 | `FieldType.Datatype` + `length` | `PhysicalSpec.type` + `length` | 同上 |
| 域（逻辑） | Domain + Logical Data Type | `LogicalDomain` | `Data_Types_and_Data_Type_Standards` |
| 域（物理） | Domain + Physical Data Type + Schema + Anchored to Type | `PhysicalDomainSpec` | 同上 |
| 域父级 | Domain Parent + 可继承/不可继承属性 | `LogicalDomain.parentId`（**保留但本期不生效**，Q13） | 同上 |
| 数据类型标准 | **DSM（Data Standards Management）Option** | 三级作用域的族+域+映射集合 | 同上 |
| 类型映射 | DSM Option Editor 的 **Mapping 页**（From 数据库 → To 数据库） | `LogicalTypeFamily.mappings` / `LogicalDomain.physical` | 同上 |
| 逻辑类型分配 | 按属性的逻辑数据类型自动分配物理类型 | `resolveType` 的生成侧 | 同上 |
| 换库提示 | 迁移时提示用户确认类型转换 | §6.4 三分支 | 同上 |
| 非对称对象 | **Logical Only / Physical Only** | `logicalOnly` / `physicalOnly`（**字段级强制一对一后降级为导入异常标记**，§3.5.1） | `Logical_and_Physical_Model_Denormalization` |
| 显示级别 | Display Attribute Data Type / Display Column Datatype | §7.1 / §7.2 | `Set_Entity_Display_Preferences`、`Set_Table_Display_Preferences` |
| 物理列序 | Physical Order（物理库实际列序）vs Column（逻辑索引序） | 物理层字段顺序 | `Set_Table_Display_Preferences` |
| 命名标准 | NSM + 宏 `%EntityName %AttName %AttDomain %KeyType %TableName %OwnerEntity` | 二期议题（§7.3） | `name_mapping_conventions_using_macros` |
| 推导模型 | Derive Model Wizard（选目标库 → 类型筛选 → 对象选择 → 命名标准） | "转成新图"（§1.2 一图一库） | `how_to_derive_a_model` |
| 多来源模型 | Model Sources（跨层链接 + 同步） | 二期议题 | `Model_Sources`、`How_to_Synchronize_Models` |
| 类型冲突裁决 | Type Resolution Wizard（同名不同型 → 拆名；缺失类型 → 双向复制） | 二期议题 | `CC_Type_Resolution_Wizard` |
| 文件格式 | XML Standard Files / with Min Info / Repository Format | 导入目标 = **XML Standard Files** | `XML_Format`、`Save_a_Model_in_XML_Format_XML_Export`、`Open_Model_in_XML_Format` |
| 逻辑键组 | Key Group（PK / FK / AK / IE 四种，带 Definition） | **不设独立对象**：键角色挂逻辑属性（`keyRole`），Definition 文本挂 `Index.comment`（§3.7.4、§3.8.3） | `Enter_a_key_group_definition` |
| 物理索引 | Index（PK Index / FK Index / 唯一非主索引 / 非唯一索引） | `Table.indices`：`Index`（**双名** `logicalName`/`name` + 自动命名、`columns` 按字段 id、`unique`、`type`、`where`、`include`、`comment`、`supportsRelationshipId`）（D26） | `Comparison_of_Logical_and_Physical_Model_Objects` |
| 物理键约束 | Key Group 迁移产物（PK / FK / 唯一约束） | `Table.primaryKey` / `Table.uniqueKeys` / `Table.foreignKeys`（均为**独立双名对象**，`field.primary` 废弃；`ForeignKey` 经 `relationshipId` 关联 `Relationship`，INV-10 一对一）（D27） | `Enter_a_key_group_definition`、同上 |
| 逻辑关系 | Relationship（Identifying / Non-Identifying / Subtype / Many-to-many / Referential Integrity / Cardinality） | `LogicalRelationship`（角色名、基数、关系类型、`physicalPending`） | 同上 |
| 物理关系 | Relationship（用 FK 实现；FK 属子表 PK / 不属子表 PK / 关联表 / 触发器） | `Relationship`（现状结构）+ 索引的 `supportsRelationshipId` 标记 FK 支撑索引 | 同上 |

### 16.2 导入目标格式与版本基准

**版本基准：ERWin 7**（用户裁决 2026-10-27）。erwin 有多个版本，各版本 Schema 定义
不尽相同，导入器以 **ERWin 7 的 Schema 为基准**实现，处理导入问题时再决定导入逻辑
（用户原话：「我们实现不是照抄，是借鉴」）。版本差异化策略见 §16.6。

| 格式 | 是否支持 | 理由 |
|---|---|---|
| **XML Standard Files** | ✅ 首要目标 | 官方说明"可用于再导入 erwin Data Modeler"；不展开宏与名字，语义最接近我们的双层模型 |
| XML Standard with Min Info Files | 🔶 可选 | 只存重开模型所需最小信息，**不含**宏与派生信息，信息量不足 |
| XML Repository Format | ❌ | 展开宏、物理名与派生属性，**不能用 erwin 打开**，回环不成立 |
| 二进制 `.erwin`（ERWIN r7+） | ❌ 本期不做 | 二进制私有格式，逆向成本极高；且 erwin 官方推荐用 XML 做集成 |
| ERX（旧文本格式） | ❌ | 已被 XML 取代 |

**导入流程**：

```
XML 文件
  ↓ 解析（DOMParser / XMLParser）
  ↓ 版本识别（§16.6）→ 映射到 ERWin 7 基准模型
  ↓ 按 §16.1 对照表映射元素
  ↓ 产出：逻辑层（实体/属性）+ 物理层（表/字段）+ 域定义
  ↓ 应用一致性不变量（§3.5）：清理孤儿引用、去重、报告
  ↓ 生成导入报告：实体数/属性数/字段数/域数/跳过项/警告
  ↓
Diagram
```

### 16.3 导入的域与映射处理

erwin 的 Domain 在我们的模型里**同时**贡献两样东西：

| erwin Domain 内容 | 导入后落到 |
|---|---|
| Domain 名称 | `LogicalDomain.name` |
| Logical Data Type | `LogicalDomain.family`（按 DSM 默认逻辑数据类型匹配到族） |
| Physical Data Type（+ Schema） | `LogicalDomain.physical[targetDb]` |
| Domain Parent | `LogicalDomain.parentId`（**保留但不生效**，Q13） |
| Domain 的可继承属性 | 本期仅作为备注导入，不落地为字段属性（→ Q13） |

**字段的物理类型**来自 erwin 的 `FieldType`，导入后
`fieldTypeSource = "imported"`（默认不自动重算，§4.2）。

### 16.4 不支持与待定

| 项 | 状态 | 说明 |
|---|---|---|
| 二进制 `.erwin` | 不支持 | 私有二进制格式 |
| 宏与命名标准展开 | 不支持 | 我们只读 XML Standard Files（宏未展开），不需要处理 |
| UDP（用户自定义属性） | **待定** | erwin 有完整的 UDP 机制（`Property_Type`、`tag_Udp_Owner_Type`），我们暂无 UDP 概念 |
| Volumetrics（体量估算） | 不支持 | erwin 的 Entity Editor 特有 |
| Business Terms / Glossary | 不支持 | erwin 的商业术语库 |
| 导出回 erwin | **本期不做** | 用户当前需求是"读入 erwin"；反向导出可后续基于 XML Standard Files 实现 |
| **真实样本** | **必须补齐** | 用户将在开发期提供 erwin 导出的 Schema 示例文档；在此之前元素名只能推断 —— P7 第一个任务就是取得真实样本逆向（R11） |

### 16.5 宽松导入模式（Q15，已裁决）

导入器采用**宽松模式**：遇到不认识或暂不支持的元素时，**不中断导入、不抛错**。

**Q18（已裁决 2026-10-27）**：被跳过的内容**不是丢弃，而是"在对应位置标记为无效"**，
并在导入报告中逐项给出。原则：**数据位置在、语义标无效** —— 用户能看到"这里原本有东西，
但我们没读懂"，而不是"这里什么都没有"。

| 情形 | 处理 | 标记方式 |
|---|---|---|
| 未知 XML 元素（不在 §16.1 对照表内） | 跳过该子树，主体对象仍导入 | 在**对应位置**留一条 `invalid` 占位（带元素名与路径） |
| 已知但暂不支持的特性（UDP、Volumetrics、Business Terms、宏展开） | 跳过该属性/节点 | 该**特性字段**置无效（值丢弃 + 标记），主体对象正常导入 |
| 元素可识别但内容格式与预期不同 | 尝试宽松解析（如长度写成 `"50"` 字符串则转数字）；失败则留空 | 该**值**置无效 + 标记，记录原始值 |
| 逻辑属性无对应物理字段 / 反之（erwin 源数据不对称） | 按 §3.5.1 视为异常 | 缺失侧补占位对象并标记 `logicalOnly`/`physicalOnly` |
| 无法匹配到族的逻辑数据类型 | 归入 `common` 族（按字符串映射） | 记 `UNRESOLVED_TYPE` 诊断 |

**"无效"的表达**：需要一个可序列化的**无效标记**结构，与被丢弃的数据分开存放，
使图数据仍保持有效（不因未知元素而无法打开）：

```ts
/** 导入期间记录的无效内容占位（Q18） */
export interface InvalidMarker {
  /** 所在对象（实体/属性/字段）的 id */
  ownerId: string;
  /** 位置路径，如 "Entity[3]/Attribute[2]/FieldType" */
  path: string;
  /** 原始元素名或属性名 */
  sourceName: string;
  /** 无效原因 */
  reason: "unsupported" | "unparsable" | "unknown-element" | "asymmetric";
  /** 原始内容（尽力保留，便于人工修） */
  original?: unknown;
}
```

存放位置：随图存在（`Diagram.invalidMarkers` 或挂在 `Table`/`LogicalEntity` 上），
以便导入报告与图数据都能呈现。**渲染时这些占位以"无效项"样式显示**
（灰色 + 提示文本），**不参与导出 SQL**。

> **宽松 ≠ 静默**。每一次无效都在导入报告中列明，用户可见、可导出（对应 §6.5
> "记录"原则的同一条思路：保留用户的知情权，而不是保留诊断快照）。
> 报告中每项包含：对象类型、元素名/属性名、原因（不支持 / 无法解析 / 不对称）、
> 建议的人工处理方式。

### 16.6 多版本 Schema 的差异化处理

erwin 有多个版本，各版本 Schema 定义不尽相同（用户裁决 2026-10-27）。
导入器以 **ERWin 7 为基准**，其余版本通过"**识别 → 映射 → 宽松降级**"处理。

> **Q17 暂定**：用户裁决「暂定，这部分做的时候具体讨论」——
> 以下是**候选方案**，不是定稿；实现 P7 时按真实样本重新确定。
> 识别判据与降级细节留到该任务开始时再讨论。

**处理原则**：

1. **基准优先**：先按 ERWin 7 的 Schema 实现完整解析路径。
2. **识别差异**：解析时检测版本特征（见下表），把差异归一化到基准模型。
3. **宽松降级**：无法归一的差异走 §16.5 的宽松模式 —— **标记无效 + 报告**，不报错。

| 版本差异 | 归一化方式 |
|---|---|
| 元素改名（如新版改了 `Entity`/`Attribute` 的标签名） | 别名表：一个基准元素名 → 多个已知历史名 |
| 元素新增（新版多出的字段） | 忽略该字段，并在对应位置留 `invalid` 标记（Q18） |
| 元素缺失（旧版没有的字段） | 该字段留空 + `invalid` 标记；下游按默认值处理（如物理类型缺失 → `common`） |
| 结构变化（集合变单值、或层级调整） | 归一化层：把单值包装成单元素数组 / 把多元素折叠取第一个 + 标记 |
| 命名风格变化（`EntryName` vs `entry_name`） | 属性名归一化：忽略大小写与下划线/驼峰差异后匹配 |

> **版本识别尚未确定具体判据**（§11 Q17）。候选：以根元素或某个固定元素的
> `version`/`Version` 属性为准；若无该属性，则以"属性名归一化后能否匹配基准"来反推。
> 待拿到多版本真实样本后确定。

**用户提供的样本结构**（记忆版，待真实文件校对）：
用户口述的 erwin table/entity 核心结构（**非官方文档原文**）：

```
{
  EntryId: "guid",        // 实体唯一 id
  EntryName: "表1",        // 逻辑名称，视为实体定义
  EntryDesc: "测试表1",
  attributes: [            // 逻辑描述
    { attributeid:"guid", attributeName:"属性1", arributeDesc:"属性1的描述",
      attributetype:"String", fieldid:"guid" }
  ],
  tableName: "table1",     // 物理名称
  comment: "测试表1",      // 数据库 comment
  Fields: [                // 物理字段描述
    { fieldId:"guid", fieldName:"field1",
      FieldType: { Datatype:"varchar2", length:50 },
      Comment: "这里是字段描述" }
  ]
}
```

> 注意：这是用户凭记忆给出的**结构示意**，字段名与 erwin 真实 XML 元素名可能不同
> （例如真实 XML 里可能是 `<Entity>`/`<Attribute>` 这类标签而非 `EntryName` 这样的扁平键）。
> **以真实样本为准**；开发期用户会提供 erwin 导出的 Schema 示例文档。
