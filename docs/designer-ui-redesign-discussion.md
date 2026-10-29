# 设计器界面改造 — UI/UX 附加设计文档

> **版本**: v1.0（定稿）
> **日期**: 2026-10-27
> **状态**: 已定稿 —— §11 开放问题已于 2026-10-27 全部裁决（见 §11 裁决记录表），正文各处裁决已生效
> **关联文档**: `sdk-workspace/docs/spec.md`、`sdk-workspace/docs/plan.md`、
> [`docs/superpowers/specs/2026-10-26-erwin-type-system-design.md`](superpowers/specs/2026-10-26-erwin-type-system-design.md)
> （下称「类型系统设计」）
> **适用范围**: `@drawdb/vue-sdk` 的编辑器外壳（`EditorLayout.vue`、`Header`、`SidePanel`、`Canvas`）及其在独立应用 `drawdb-vue-app` 中的表现

> **v1.0 变更说明（2026-10-27）**：§11 开放问题 19 条全部裁决（Q1–Q9、Q11–Q20，Q10 此前已由类型系统设计裁决移除），裁决结果见 §11 裁决记录表，相关正文章节以「（裁决：…）」标注。类型系统核心 P1–P4 实施计划已另立：
> [`docs/superpowers/plans/2026-10-27-erwin-type-system-core.md`](superpowers/plans/2026-10-27-erwin-type-system-core.md)。

---

## 1. 背景与目标

当前设计器的左侧面板以 Tab 页组织（Tables / Relationships / Areas / Notes 等），顶部操作区以菜单为主。随着图表规模增大（百表级），现有结构存在三个痛点：

1. **定位困难**：在大图中找到某个表 / 字段需要在画布上反复平移缩放，Tab 列表与画布之间缺少双向定位。
2. **编辑路径长**：修改单个表 / 字段 / 关系的属性需要打开模态对话框，无法快速连续编辑多个对象。
3. **反馈分散**：导入告警、校验错误、操作历史等信息没有统一的呈现区域。

「类型系统设计」进一步引入了三类必须被界面承载的新能力：

4. **逻辑 / 物理双层模型**（erwin 式）：两层是**可分别编辑**的数据，画布按层渲染，编辑面板成对呈现两层全部信息。
5. **索引与约束的一等公民化**（P2'）：PK/UK/FK/Index 均为独立双名对象（`logicalName` + `name`），需要完整的增删改查、定位与校验 UI。
6. **DSM（数据类型标准）治理**：族 / 域 / 方言映射的三级作用域配置与方言 lint 诊断，需要一个批量治理界面。

本次改造的目标：

- 左侧改为**树型结构大纲导航**，覆盖图表内全部对象（含约束 / 索引 / 逻辑域），支持双向定位。
- 右侧新增**统一属性编辑面板**，随当前选中对象联动；字段以「逻辑 + 物理」成对呈现。
- 画布表视图新增**约束 / 索引条目区**（表格下方分割线以下，图标 + 名称）。
- 画布顶部新增**矢量图标工具栏**，按九组工具组织。
- 底部新增**可伸缩的告警与调试区域**，集中呈现方言 lint、索引 / 约束诊断、日志、trace、操作日志。
- 新增 **DSM 映射管理界面**（类型系统设计 §7.0 三区划分之「映射管理界面」）。
- 左右两侧面板均支持收缩 / 展开。

非目标：本次改造不改变数据模型与命令管理器语义（模型设计以「类型系统设计」为准）、不涉及实时协作、不实现逻辑名 / 物理名自动同步（二期议题，类型系统设计 §7.3）。

---

## 2. 总体界面结构

```
┌──────────────────────────────────────────────────────────────────────┐
│  Header（应用标题、图表名、保存状态、全局菜单）                          │
├──────────┬───────────────────────────────────────────────┬───────────┤
│          │  ┌─────────────────────────────────────────┐  │           │
│          │  │  画布工具栏（九组矢量图标按钮）            │  │           │
│          │  └─────────────────────────────────────────┘  │           │
│  左侧    │                                               │  右侧     │
│  树型    │         画布 Canvas                           │  统一     │
│  大纲    │         ┌─ 表视图 ─────────────┐              │  编辑     │
│  导航    │         │ 表头（逻辑名/物理名）  │              │  面板     │
│          │         │ 字段区（按视图分层）   │              │ （逻辑+   │
│          │         │ ── 分割线 ────────── │              │  物理     │
│          │         │ 条目区 PK/UK/FK/IDX  │              │  成对）   │
│          │         └─────────────────────┘              │           │
│ ◄收缩    │                                               │  收缩►    │
├──────────┴───────────────────────────────────────────────┴───────────┤
│  底部可伸缩区域：告警 / 日志 / Trace / 操作日志（可拖拽调高、可收缩）    │
└──────────────────────────────────────────────────────────────────────┘
   DSM 映射管理界面：独立界面（从配置工具进入，形态待定，见 §6.9 与 Q16）
```

- 三栏 + 顶栏 + 底栏的经典 IDE 式布局。
- 左侧面板默认展开，宽度建议 240–320px（可拖拽调整）；右侧面板默认展开，宽度建议 280–400px（统一编辑面板信息密度高于普通属性面板，取更宽区间；可拖拽调整）。
- 底部区域默认**收缩**，仅在出现新告警 / 错误或用户主动展开时占高，展开默认高度建议 160–240px，最大不超过视口高度的 50%。
- 面板宽度、高度、收缩状态持久化到用户偏好（按图表或按用户全局，见开放问题 Q5）。

---

## 3. 左侧：树型结构大纲导航

### 3.1 节点层级（建议稿，已并入类型系统对象）

```
图表（Diagram）
├── Tables
│   ├── table_a（视图随动：逻辑视图显示逻辑实体名，物理视图显示物理表名）
│   │   ├── Fields（字段节点：徽标内联显示 keyRole / PK·UK·FK 成员身份）
│   │   ├── Constraints（PK / UK / FK 条目，与画布条目区同源）
│   │   └── Indexes（索引条目）
│   └── table_b ...
├── Relationships（逻辑关系：角色名 / 基数 / 关系类型；
│   多对多·子类型关系带 physicalPending 徽标）
├── Domains（逻辑域：全局唯一对象，图标区分内置 / 用户自定义）
├── Areas（主题区域，子节点列出其包含的表）
├── Notes
└── （物理侧独有：Views / Enums / Types；逻辑视图下这些类别隐藏或置灰——见 Q15）
```

设计要点：

- **一级节点为对象类别**，带对象计数徽标。相比 v0.1 新增 **Constraints / Indexes 子节点**（承载类型系统设计 D27 的双名约束对象）与 **Domains 类别**（逻辑域是全局唯一、跨表复用的对象，必须可在树中定位与选中）。
- **树随视图分层显示命名**：逻辑视图显示各对象的逻辑名（`LogicalEntity.name` / `LogicalAttribute.name` / 约束与索引的 `logicalName`），物理视图显示物理名（`Table.name` / `PhysicalField.name` / `name`）；tooltip 同时显示另一层的名字。域只有单名，两种视图均显示域名（不变式 2：域显示自己的名字，不显示其族）。
- **排序**：类别内默认按名称排序，提供「按名称 / 按创建顺序」切换。
- **过滤**：树顶部过滤输入框按名称模糊匹配（同时匹配逻辑名与物理名；匹配字段名时带出所属表节点并高亮）。
- **虚拟滚动**：百表级 + 每表数十字段 + 约束 / 索引节点时节点数可达数千，树必须虚拟滚动渲染。

### 3.2 与画布的双向联动

| 方向 | 交互 | 行为 |
|---|---|---|
| 树 → 画布 | 单击节点 | 画布选中对应对象；若对象不在视口内，画布**平滑平移 + 适度缩放**使其进入视口并短暂高亮（动画 ≤ 600ms，可在显示配置中关闭）。约束 / 索引节点单击 → 选中其所属表并高亮条目区对应条目 |
| 树 → 画布 | 双击字段节点 | 定位画布，并在右侧编辑面板聚焦该字段的成对行（§4.3） |
| 树 → 画布 | 双击约束 / 索引节点 | 定位画布条目区，并打开对应编辑器（索引 → 索引编辑器；PK/UK → 约束编辑器；FK → 关系编辑器）——与条目区「点击定位」行为一致（D27） |
| 画布 → 树 | 画布上选中对象（含条目区条目） | 树自动展开到该节点、滚动可见并高亮（reveal） |
| 多选 | Ctrl/Shift 多选 | 树的多选与画布多选保持一致（同一 selection 状态源） |

### 3.3 树节点上的操作

- 右键上下文菜单：重命名（改当前视图对应层的名字）、删除、复制 / 粘贴、在 Area 间移动、定位到画布。
- 拖拽：表节点可拖入 / 拖出 Area 节点以改变归属；**不支持**通过拖拽调整字段顺序与索引列序（在编辑面板 / 索引编辑器内调整，避免树内误操作）。
- 删除节点与画布删除走同一 CommandManager 命令，保证 undo/redo 一致。**删除字段节点 = 跨层原子删除**（同时删除逻辑属性与物理字段，§3.5.2），删除前明确提示「将同时删除另一侧」。
- 域节点操作：重命名（受全局唯一性约束，撞名拒绝并提示「该名称已被使用（定义于 X 作用域）」，提供「跳转到已有定义」）、删除（需检查引用：被字段引用的域删除前提示引用计数与影响范围）、跳转至 DSM 映射管理界面。

### 3.4 边界场景

| 场景 | 行为 |
|---|---|
| 空图表 | 树仅显示类别空节点，占位文案引导「新建表 / 导入 SQL / 导入 erwin XML」 |
| 选中对象被删除（undo 后） | 树高亮清除，编辑面板回退到图表级属性（§4.4） |
| 过滤无匹配 | 空态文案 + 「清除过滤」按钮 |
| 导入产生的 `logicalOnly` / `physicalOnly` 异常对象 | 节点照常显示，带异常徽标（灰显 + 提示图标），tooltip 说明「源数据缺少另一侧」——这是**异常提示**，不是可用的建模状态（类型系统设计 §3.5.1、§7.1/§7.2） |
| 导入产生的 `InvalidMarker` 占位 | 以「无效项」样式显示（灰色 + 提示文本），可点击查看导入报告对应条目（§6.8、§8） |
| 对象级隐藏（待定能力） | 节点半透明显示 + 眼睛图标切换（是否引入见 Q3） |

---

## 4. 右侧：统一编辑面板

> 本节按「类型系统设计」§7.0/§7.4 的裁决（Q20/D16）重写：**编辑面板不拆逻辑 / 物理两个界面**，
> 同一屏内成对呈现两层全部信息 —— 「对应关系本身就是编辑对象」。

### 4.1 选择联动

编辑面板内容**完全由当前选中集驱动**，与左侧树、画布共用同一 selection 状态：

| 当前选中 | 编辑面板内容 |
|---|---|
| 单个表 | 基本组（**逻辑实体名 + 逻辑描述** ｜ **物理表名 + 物理注释**，两行成对）；字段组（成对表格，§4.2）；约束组（PK/UK/FK 列表）；索引组；外观组（颜色、所属 Area） |
| 单个字段（树 / 画布 / 成对行中选中） | 该字段的成对详情：逻辑侧（名称、描述、逻辑类型 = 族/域选择 + 参数、`keyRole` 键语义位、`required` 业务必填、`values` 业务取值域）｜物理侧（列名、物理类型 combobox、约束 notNull/unique/check/default、来源标记 `fieldTypeSource`） |
| 单条关系 | **成对呈现**：逻辑关系（角色名、基数、关系类型 = 识别/非识别/多对多/子类型、`physicalPending` 标记）｜物理 FK（`ForeignKey` 双名、列映射、级联规则、支撑索引列表）（类型系统设计 §3.7.6：逻辑关系也需成对呈现） |
| 单个约束（PK/UK/FK）或索引 | 双名（`logicalName` / `name` 成对编辑）、列（多列编辑器）、唯一开关 / 类型 / 部分条件 where / 包含列 include、注释、支撑关系标记（`supportsRelationshipId`） |
| 单个逻辑域 | 域名、所属族、参数覆写、各方言物理形态（`physical[db]`）、物化策略（inline/materialize，不支持物化的方言置灰并说明，R6）、注释；**不暴露** `parentId` 编辑入口（Q13：本期保留字段不实现继承） |
| 单个 Area / Note | 名称、颜色、内容（沿用现状属性） |
| 无选中 | 图表级属性：图表名称、数据库方言、全局备注（兜底态，永不显示空白面板） |

### 4.2 字段成对呈现（§7.4 的具体化）

表被选中时，字段组以「一行一对」组织，每行五列：

| 列 | 内容 | 写向 |
|---|---|---|
| 逻辑名 | `LogicalAttribute.name`（+ `description` 行内展开） | 逻辑层 |
| 逻辑类型 | 族 / 域选择 + 逻辑参数（长度/精度/scale，按族 `params` 规范联动） | 逻辑层 |
| 物理列名 | `PhysicalField.name` | 物理层 |
| 物理类型 | 物理类型 combobox（§4.5）+ 物理参数 | 物理层 |
| 对应状态 | 配对标记 + 诊断图标（lint 结果）+ 来源徽标（§4.6） | — |

- 面板顶部给**总览条**：「本表 12 个字段：12 对已配对，0 处类型不一致，1 处待处理」，点击跳到具体诊断（§8）。
- 信息密度控制（对应 R15）：支持**整表折叠物理列**（默认展开）；对应状态用图标 + tooltip 而非文字。
- **新增字段** = 同时新增逻辑属性与物理字段（一对一），随后分别填两侧；只填一侧是**允许的编辑暂态**（可保存草稿，INV-4 只提示不阻断）；导入产物的不对称才是**缺陷**（标记 + 报告）。区分依据是「该对是否由本次编辑会话创建」与来源标记（§3.5.2、R16）。
- **删除字段** = 跨层原子操作，删除前提示「将同时删除逻辑属性与物理字段」。
- 行的编辑（重命名等）只写当前列所属的那一层：改物理列名不动逻辑名，反之亦然（§3.5.2）；名称两侧**不做自动同步**（二期议题）。

### 4.3 聚焦联动

从树双击字段节点定位时，编辑面板滚动到字段组中对应成对行并短暂高亮；若字段组处于折叠态则自动展开。从画布条目区 / 树双击约束或索引时，打开对应编辑器并聚焦名称输入框（支持就地改名，D27）。

### 4.4 属性分组与编辑语义

- 属性按**可折叠分组**组织（基本 / 字段 / 约束 / 索引 / 外观等）；分组的展开 / 折叠状态按对象类型记忆。
- 复杂属性（字段、索引、约束）内嵌迷你表格，行内编辑 + 行尾操作按钮（上移 / 下移 / 删除 / 添加）。
- 所有修改即时生效并走 CommandManager；文本类输入在失焦或 Enter 时提交，避免每个按键产生一条 undo 记录。索引与约束的增删改走**索引级独立命令**（`AddIndexCommand` 等，P2' 裁决 3），撤销不回滚表的其他属性。

### 4.5 物理类型编辑控件（D3）

- 物理类型名使用**可输入下拉（combobox）**：下拉列表来自目标方言的类型白名单，**增量匹配**过滤；白名单外的输入**直接采用**，不阻止、不报错，由方言 lint 事后校验（`TYPE_NOT_IN_DIALECT` 等）。
- 字段参数（长度 / 精度 / scale）随 combobox 联动：按当前方言的类型能力（`isSized / hasPrecision`）显示或隐藏对应输入框。
- 手工修改物理类型后 `fieldTypeSource` 置 `explicit`（映射再变也不动它），并在来源徽标中体现。

### 4.6 来源标记与诊断呈现（R12）

- 每个字段的物理类型带**来源徽标**：`mapped`（映射生成，映射变化时自动重算）/ `explicit`（用户手工设定）/ `imported`（erwin 导入）。
- 提供「批量转为 mapped 以启用自动重算」入口（表级 / 图级），避免用户「改了映射以为没用」的困惑。
- 行内诊断图标点击 → 展开该字段的诊断详情（code + 建议 + **一键应用建议**按钮，`fixable` 时），诊断同时汇入底部告警区域（§8）。

### 4.7 边界场景

| 场景 | 行为 |
|---|---|
| 无选中 | 显示图表级属性（兜底），不显示空面板 |
| 多选同类对象（多个表） | 显示交集属性；值不一致的显示「多个值」占位；修改后批量应用（单条批量命令，一次 undo 回退） |
| 多选异类对象 | 显示通用属性（如颜色）+ 选中计数摘要 |
| 选中对象被删除 / undo 移除 | 回退到图表级属性 |
| 属性校验失败（重名表、域撞名、类型参数越界） | 行内红字提示 + 写入底部告警区域，**不弹模态框**打断编辑流；域撞名按全局唯一性**拒绝创建**并给出两个后续动作（跳转已有定义 / 在某作用域覆盖其方言映射）（§3.3.1、R17） |
| `logicalOnly` / `physicalOnly` 异常数据 | 对应侧显示异常占位（灰显 + 提示），并提供「补建另一侧」的修复动作（Q14 的 UI 入口：异常标记入口 + 预留建模开关） |

---

## 5. 左右面板的收缩 / 展开

- 两侧面板内缘各有一个收缩把手（chevron 图标），点击在「展开 ↔ 完全收缩」间切换，带 200ms 宽度动画（可在显示配置中关闭）。
- 收缩后仅保留一条窄边栏（约 36px），内有展开图标；左侧窄栏保留类别图标入口（点击某类别图标即以浮层形式快速查看，点击画布自动收起浮层——此点待定，见 Q4）。
- 拖拽分栏分隔条可连续调整宽度，双击分隔条恢复默认宽度。
- 快捷键建议：`Ctrl/Cmd + B` 切换左侧，`Ctrl/Cmd + Alt + B` 切换右侧（最终键位待统一盘点，见 §9.3）。
- 小视口（宽度 < 1024px）时两栏默认收缩。

---

## 6. 画布顶部工具栏

### 6.0 通用规则

- 全部使用**矢量图标按钮**（同一图标库，统一 16/20px），每组之间以分隔线分组，共九组：

```
[显示切换] [table视图切换] | [布局] [逻辑/物理] [对齐] | [图] | [Undo/Redo] | [文件] | [配置]
```

- 每个图标按钮必须有 **tooltip**（名称 + 快捷键）；纯图标无文字。
- 按钮三态：可用 / 不可用（置灰 + tooltip 说明原因）/ 激活（切换类工具显示当前状态）。
- **操作范围规则**（贯穿显示切换与 table 视图切换两组工具）：

  | 操作范围 | 判定条件 |
  |---|---|
  | 选中单个或多个表 | 画布 / 树中存在表选中 |
  | 选中 Area | 选中了 Area（作用于该 Area 包含的所有表） |
  | 整个画布 | 无任何选中（兜底范围） |

  即：**有选中按选中作用，无选中作用于整个画布**。范围选择器的呈现方式见 Q1。

### 6.1 显示切换工具（TABLE 视图显示方式）

四种互斥模式，以分段按钮（segmented）或下拉按钮呈现，当前模式高亮。**引入双层模型后，每种模式在两个视图下的具体显示内容**：

| 模式 | 逻辑视图 | 物理视图 |
|---|---|---|
| 实体方式 | 仅逻辑实体名 | 仅物理表名 |
| 定义方式 | 逻辑实体名 + 逻辑描述（EntryDesc） | 物理表名 + 物理注释（comment） |
| 属性方式 | 逻辑实体名 + 逻辑属性名 + 逻辑类型名（域显示自己的名字） | 物理表名 + 物理列名 + 物理类型规格 |
| 全部方式 | 属性方式 + 逻辑描述 + **条目区**（显示 `logicalName`） | 属性方式 + 物理注释 + **条目区**（显示物理 `name`） |

> 「全部方式」中的 PK/UK/FK 信息与 Index 信息，在引入条目区后**具体化**为：表格下方分割线条目区
> 全量显示（D27），字段行上的 PK/UK/FK 成员徽标由 PK/UK/FK 对象的 `columns` 成员关系推导
> （`field.primary` 已废弃，D27）。

- **交互**：点击模式立即应用到操作范围内的所有表视图；模式属于**视图状态**，不进 undo 栈、不影响图表数据（是否随图表保存为显示偏好，见 Q2）。
- **边界场景**：
  - 无选中：应用到整个画布。
  - 选中 Area：应用到 Area 内全部表；Area 内后续移入的表是否继承该模式（待定）。
  - 混合范围（表 + Area）：取并集，不重复处理。
  - 逻辑视图下「定义方式」无物理注释可读、物理视图下无逻辑描述可读——两层各自显示本层数据，不跨层取数（不变式 2）。

### 6.2 table 视图切换工具（逐项显示开关）

- 对表视图的显示部分逐项开关：**描述、字段信息、PK/UK/FK、INDEX** 四个独立 toggle。
- 引入条目区后，后两个开关的语义具体化为**条目区分段开关**：PK/UK/FK 开关控制约束分段显隐，INDEX 开关控制索引分段显隐（与条目区的表级显示开关共用同一状态源，§7.2）。
- 与 §6.1 的关系：四种显示方式是这四个开关的**预设组合**；手动调整后，显示切换工具进入「自定义」态。
- **操作范围**与 §6.1 完全一致。
- **边界场景**：全部关闭 = 等同「实体方式」；对正在内联编辑中的表切换显示项，编辑中的行保持可见，切换在编辑提交后生效。

### 6.3 布局工具

- **Grid / Flow / Auto(Flow)** 三种方式，作用于选中的多个表（无选中时整个画布）：
  - **Grid**：按网格均匀排列，列数按选中数量开方取整，可配置间距。
  - **Flow**：按关系拓扑分层布局，减少连线交叉。
  - **Auto(Flow)**：画布内容变化后自动执行一次 Flow 的开关。
- Grid / Flow 为即时命令（进 undo 栈）；Auto(Flow) 为持续状态开关（不进 undo 栈）。
- **边界场景**：无选中时对整个画布执行，表数 > 阈值（建议 50）时先确认；仅选中 1 个表时 Grid/Flow 置灰并提示；Auto(Flow) 与手动定位的冲突策略见 Q6；布局动画 ≤ 400ms，可在显示配置中关闭。

### 6.4 逻辑 / 物理切换工具（**v0.2 重大修订**）

- 单按钮切换**逻辑视图 / 物理视图**，图标与 tooltip 显示当前状态及切换目标。
- **语义修订（Q9/D5）**：逻辑层与物理层是**双层并存、可分别编辑的两份数据**，不是同一数据的两种显示精度。切换改变的是**画布、树、条目区显示哪一层**（不变式 2：逻辑视图显示逻辑名 + 逻辑类型名；物理视图显示物理名 + 物理类型规格；域显示自己的名字）。
- **编辑面板不受切换影响**：统一编辑面板始终呈现两层全部信息（Q20），切换视图不切换面板内容，只切换画布呈现与树的命名显示。
- 两个视图下**都可编辑**：逻辑视图的类型编辑作用于逻辑侧（选族 / 选域 / 设参数）；物理视图的类型编辑直接写物理层并置 `explicit`，不回写逻辑层（不变式 5）。
- 切换状态属于视图状态（不进 undo 栈）；是否随图表持久化见 Q2。
- **边界场景**：
  - 逻辑名缺失：回退显示物理名并以浅色徽标提示「未设置逻辑名」（反之亦然）。
  - 导入异常数据（`logicalOnly` / `physicalOnly`）：对象在对应视图照常显示并带异常徽标（§3.4）。
  - 物理侧独有对象（View / Enum / Type / 备注 / 区域）在逻辑视图下的呈现：隐藏或置灰，需统一裁决（Q15）。

### 6.5 对齐工具

- 对选中的多个 UI 视图（表 / 便签 / Area）位置对齐：左 / 水平居中 / 右 / 顶 / 垂直居中 / 底对齐；附带水平 / 垂直等距分布（≥3 个选中）。
- 对齐基准默认取选中集包围盒；「对齐到画布网格」修饰模式待定。
- **边界场景**：选中 < 2 个（分布 < 3 个）置灰并说明；Area 作为整体参与，内部表相对位置不变；对齐产生重叠不自动避让，重叠检测可写入底部告警（待定）。
- 对齐是数据变更，进 undo 栈。

### 6.6 图工具

- **缩放**：缩小 / 放大 / 适应画布（Fit）/ 缩放到选中 / 100%；百分比文本可点击输入精确值；缩放范围建议 10%–400%，到达边界对应按钮置灰；空画布 Fit = 重置 100% 居中。
- **背景定位点**：切换网格点阵显示 / 隐藏。
- **FullScreen**：Fullscreen API 全屏，Esc 退出；浏览器拒绝或 iframe 嵌入受限时 toast 提示并保持原状（SDK 需提供能力探测）。

### 6.7 操作工具（Undo / Redo）

- 两个按钮，tooltip 显示将撤销 / 重做的**可读命令描述**（如「撤销：移动 3 个表」「重做：修改索引 idx_users_email」）——要求 CommandManager 记录命令描述；索引 / 约束的独立命令（P2'）使索引编辑的撤销粒度精确到单个索引，不回滚表的其他属性。
- 无可撤销 / 可重做时置灰；快捷键 `Ctrl/Cmd + Z`、`Ctrl/Cmd + Shift + Z`（兼容 `Ctrl + Y`）。
- **边界场景**：视图状态类操作不进 undo 栈；撤销与进行中的布局动画冲突时先取消动画。

### 6.8 文件工具

- New / Open / Save / SaveAs / Import / Export / Print / PrintPreview。
- **New**：有未保存修改时先确认（保存 / 不保存 / 取消）。
- **Save / SaveAs**：独立应用写存储适配器（默认 IndexedDB）；嵌入形态触发 SDK save 回调由宿主接管。
- **Import**：格式 = SQL（7 方言）/ DBML / JSON / **erwin XML Standard Files（新增，P7）**。
  - erwin 导入采用**宽松模式**（Q15/Q18）：不认识的元素不中断、不抛错，**在对应位置标记为无效**（`InvalidMarker`，灰色无效样式、不参与 SQL 导出）。
  - **导入报告是强制呈现物**（R14：不允许静默成功）：导入完成界面必须展示报告摘要（实体数 / 属性数 / 字段数 / 域数 / 跳过项 / 警告），完整报告逐项列出（对象类型 / 元素名 / 原因 / 建议的人工处理方式），可导出；关键项同时落入底部告警 Tab 并支持点击定位。
  - 导入产物中物理类型的 `fieldTypeSource` 置 `imported`（默认不自动重算，可批量转 `mapped`）。
  - 导入解析失败（文件级错误）：不清空现有图表；错误详情进入底部日志。
- **Export**：SQL / DBML / JSON；**DSL 导出**（元数据导出器，P8）在后续阶段加入 Export 列表。
- **Print / PrintPreview**：按当前画布呈现打印（所见即所得）或在预览中提供独立的显示方式覆盖（待定）；大图分页预览；是否内嵌 PDF 导出见 Q8。
- **边界场景**：`Ctrl/Cmd + S/O/P` 与浏览器默认行为的冲突——编辑器聚焦时拦截、失焦时放行，统一盘点见 §9.3。

### 6.9 配置工具（**v0.2 部分具体化**）

类型系统设计落地后，「元数据配置」已有明确形态，即 **DSM 映射管理界面**（§7.0 三区划分之第三区，目标 = 批量治理）。配置工具组因此拆为两类入口：

**A. DSM 映射管理界面（形态已定方向，入口与容器待定，Q16）**

| 功能区 | 内容 |
|---|---|
| 族管理 | 11 个内置族的参数规范与各方言默认映射（穷举，77 条）；用户自定义族（允许映射留空，留空走 common 规则 + lint 诊断） |
| 域管理 | 逻辑域的增删改查：域名（**全局唯一**，撞名拒绝 + 跳转 / 覆盖两个后续动作，§3.3.1）、所属族、参数覆写、各方言物理形态、物化策略、注释；`parentId` 不暴露编辑入口（Q13） |
| 方言映射矩阵 | 族 × 方言、域 × 方言的映射查看与覆盖；**覆盖粒度 = 某域 / 某族的某个方言项**，不允许整层替换 |
| 三级作用域 | 应用级 / 工作区级 / 图级分层查看；作用域决定「值的来源」而非「同名并存」；应用级允许修改但存本地，提供「恢复默认」逃生口（Q5） |
| 方言 lint 清单 | 当前方言的全量诊断列表（12 个 code），支持按严重度 / code / 对象过滤，点击定位对象，一键应用建议（`fixable`）；与底部告警区域数据同源 |

**B. 显示配置与工具配置（组织方式待定，Q7）**

| 类别 | 候选配置项 |
|---|---|
| 显示配置 | 各部分（表头 / 字段行 / 条目区 / 备注 / 关系线 / Area / Note）的字体、字号、颜色、背景色；线条粗细、颜色、样式；动画总开关或分项开关（定位 / 布局 / 面板动画） |
| 工具配置 | 各工具默认参数（Grid 间距、Flow 方向、缩放步长、对齐基准）、工具栏按钮显隐与顺序 |
| 其他候选 | 快捷键映射、自动保存策略、底部区域默认 Tab 与高度 |

**边界场景**：嵌入形态下 DSM 界面与配置入口可由 SDK 选项整体关闭或替换（Q13）。

---

## 7. 画布表视图：约束 / 索引条目区（D27，新增）

### 7.1 呈现形态

- Table 表视图在字段区下方加一条**分割线**，分割线以下为**条目区**，按条目列出该表的 PK / UK / FK / 索引：
  - 每条 = **图标 + 名称**；图标区分四类：🔑 PK ／ UK ／ FK ／ IDX。
  - **逻辑视图显示 `logicalName`，物理视图显示物理 `name`**（与三区划分一致）。
  - **FK 条目显示在子表一侧**（与 erwin「FK 属子表」一致）。
- **可切换是否显示**：表级开关，与 details 折叠并列，默认随 details 展开状态；全局层面由工具栏逐项开关（§6.2 的 PK/UK/FK、INDEX 两个 toggle）控制分段显隐，二者共用同一状态源。
- **折叠态摘要**：条目区折叠时显示计数摘要「1 PK / 2 UK / 1 FK / 3 indices」。
- 取代现状 `TableDetails.vue` 的两个文本框区块（逗号分隔自由文本废弃）。

> **已落地（第三轮，2026-10-28）**：字段列表下方现按 **PK → FK → UK → INDEX → 描述** 顺序渲染只读分块
> （`components/Canvas/table-sections.ts` + `TableSections.vue`），块与块之间是 1px 分割线，块标题用
> SQL 惯例缩写 `PK` / `FK` / `UK` / `INDEX`（不新增 51 语言文案），描述块不设标题、直接排版注释文本并
> 保留双击编辑；表高 = 表头 + 字段行 + 分块高度之和，外框随之自动撑开。四个工具栏 toggle 与这些分块
> 一一对应（描述 / 字段 / PK·FK·UK / INDEX），`indexes` toggle 不再置灰。
> **已落地（P2'，2026-10-30）**：键是独立双名对象（`primaryKey`/`uniqueKeys`/`foreignKeys`/`indices`），画布下方的 PK/FK/UK/INDEX 分块与左侧树的键节点都读这些对象；编辑面板的键卡片可改名、加列、调序、增删；导出器打印 `CONSTRAINT <name>` 并支持列序。仍属后续：条目区的折叠摘要与双击就地改名（P6 收尾）。

### 7.2 交互

- **点击条目定位到对应编辑器**：索引 → 索引编辑器；PK/UK → 约束编辑器；FK → 关系编辑器（画布条目区、树节点、SidePanel/树列表共用同一编辑组件 `IndexEditor.vue`，只换容器，R19）。
- **名称就地编辑**：改的是**当前视图对应的那一个名字**（逻辑视图改 `logicalName`，物理视图改 `name`）；另一个名字在编辑面板成对修改。
- **新增 / 删除入口**：条目区尾部「+」按类型新增；条目右键或行尾按钮删除整条（现状无删除入口的缺口 B8 由此补齐）；**锁定表只读**（锁定判定以 core 命令层的 `isLocked` 为准，UI 不另判一次）。
- **自动命名**（D26）：创建时物化双名——索引逻辑名 = `Idx_` + 表逻辑名，物理名 = `Idx_` + 物理表名；PK/UK/FK 前缀分别为 `PK_` / `UK_` / `FK_`（FK 默认名含子表 + 父表）；撞名追加 `_2`、`_3`；**表改名不回溯**既有条目名；双名用户均可改。
- 条目 tooltip 显示：另一层名字 + 列组成 + 唯一性 / 类型 / FK 支撑关系摘要。

### 7.3 条目编辑器（弹层 / 编辑面板内嵌）

- **多列编辑器**取代逗号分隔文本：每列一个字段下拉（按字段 id 引用）、可调整列序、每列可选排序方向（asc/desc）、可删列、可增列。
- 高级区（按方言能力位显示，不支持的能力**置灰并说明**，不静默丢弃，R21）：唯一开关、索引类型（btree/hash/gist/gin/brin/fulltext/spatial）、部分索引条件（where）、包含列（include）、注释（承载 erwin Key Group Definition）。
- FK 索引支撑：新建关系时提供**可选动作**「一并创建 FK 索引」（不强制，Q29）；条目上显示 FK 支撑标记（`supportsRelationshipId`）。

### 7.4 边界场景

| 场景 | 行为 |
|---|---|
| 表无任何约束 / 索引 | 条目区不渲染分割线（或显示空态「+ 添加」一行，待定细节） |
| 条目区显示但某分段为空 | 该分段不渲染（如只有索引时只显示 IDX 段） |
| 索引引用失效字段（`index.unknown_field`） | 条目带错误徽标，tooltip 说明；诊断入底部告警 |
| 约束 / 索引名撞名（schema 级物理命名空间 / 同表逻辑命名空间） | 保存时报诊断；条目区相应条目带警告徽标 |
| 「实体方式」显示模式下 | 条目区强制隐藏（该模式仅显示名称）；切换回包含条目区的模式时恢复 |

---

## 8. 底部可伸缩区域（告警与调试）

### 8.1 内容与 Tab

Tab 分组：**告警（Alerts）/ 日志（Logs）/ Trace / 操作日志（Activity）**，各 Tab 带未读计数徽标。

**告警 Tab** 汇聚两个诊断通道（类型系统设计落地后有了具体内容源）：

| 诊断源 | 通道 | 示例 code |
|---|---|---|
| 方言 lint（类型系统） | `DialectDiagnostic`（12 个 code，现算现报，**不存储**；被保留的是用户的选择） | `TYPE_NOT_IN_DIALECT`、`TYPE_CAPABILITY_MISMATCH`、`PARAM_OUT_OF_RANGE`、`MAPPING_MISSING`、`UNRESOLVED_TYPE`、`NAME_CONFLICT`、`RELATIONSHIP_NOT_IMPLEMENTED` 等 |
| 索引 / 约束诊断 | `DiagramIssue`（`checkIndices` 扩展，P2' 裁决 6） | `index.unknown_field`、`index.duplicate_schema_name`、`constraint.duplicate_logical_name`、`table.multiple_primary_keys`、`index.relationship_without_index`（外键无索引 → 写入放大）等 |

- 每条告警：级别图标 + code + 摘要 + 关联对象；**点击定位**到对应对象（复用 §3.2 的定位联动：表 / 字段 / 条目区条目 / 域 / 关系均可定位）。
- 带 `suggestion` 且 `fixable` 的诊断提供**一键应用建议**（应用结果写为用户的显式选择——如物理类型改写后置 `explicit`，诊断本身不入库，§6.5）。
- **方言切换的三分支**在告警区呈现：硬冲突（目标方言不存在该类型，error，要求修正）、软冲突（不一致，warning，给建议不强制）、选择权完全交给用户；方言切换检查报告是**导出物**，可查看与导出（§6.5）。
- 级别过滤（error / warning / info）；`LOGICAL_ONLY` / `PHYSICAL_ONLY` / `LOGICAL_PHYSICAL_DIVERGED` 等提示性 code 永不阻断、默认归入 info/warning。

**日志 Tab**：运行日志（导入导出、保存、插件事件、erwin 导入报告归档），级别过滤。
**Trace Tab**：性能与调试 trace（渲染耗时、命令耗时），默认仅开发者模式开启（待定，Q14 已并入原编号）。
**操作日志 Tab**：用户操作历史（命令描述 + 时间），与 undo 栈同源但保留已撤销记录。

每条记录支持复制、导出当前 Tab 内容、清空。

### 8.2 伸缩交互

- **三种状态**：收缩（仅留 28px 标题条）/ 展开（默认 160–240px）/ 最大化（占满画布区高度）。
- 拖拽上边缘连续调整高度（120px – 视口高度的 50%）；双击标题条在「收缩 ↔ 上次展开高度」间切换。
- 新告警到达且面板收缩时：标题条闪烁 + 告警 Tab 徽标计数更新，**不自动展开**；error 级是否自动展开见 Q9。
- 快捷键建议：`Ctrl/Cmd + `` ` 切换底部区域；高度与展开状态持久化。

### 8.3 边界场景

| 场景 | 行为 |
|---|---|
| 无任何记录 | 各 Tab 显示空态文案 |
| 记录量过大 | 每 Tab 滚动加载 + 上限（如 1000 条，超出丢弃最旧并提示） |
| 告警对应对象已删除 | 定位链接置灰，标注「对象已不存在」 |
| 嵌入形态（SDK） | 底部区域可通过 SDK 选项整体关闭；日志 / Trace 可通过适配器输出到宿主 |

---

## 9. 通用交互规范

### 9.1 图标与按钮

- 全部工具栏图标为矢量图标，统一视觉风格与规格（16/20px）。
- 所有图标按钮必须有 tooltip（名称 + 快捷键）与键盘访问路径；置灰按钮的 tooltip 必须说明置灰原因。

### 9.2 视图状态 vs 文档数据

- **文档数据**（进 undo 栈、随图表保存）：布局结果、对齐结果、**逻辑层与物理层的一切编辑**（两个视图下的编辑都是数据编辑）、约束 / 索引增删改、属性修改。
- **视图状态**（不进 undo 栈）：显示方式切换、逐项显示开关（含条目区显隐）、**逻辑/物理视图切换**、缩放、面板收缩、底部区域状态。
- 视图状态是否随图表持久化（重新打开时恢复）见 Q2。

### 9.3 快捷键

- 所有工具栏操作提供快捷键；交付前统一盘点键位冲突（编辑器内、浏览器默认、嵌入宿主三方），形成快捷键总表。

### 9.4 可访问性

- 工具栏、树、编辑面板、条目区、底部区域均可完整键盘操作；焦点顺序与视觉顺序一致；焦点指示清晰可见。
- 拖拽类交互（面板调宽、底部调高、列序调整）提供非拖拽替代（双击恢复默认、快捷键切换、上下移动按钮）。

### 9.5 国际化

- 本次改造涉及的全部新文案（工具栏、条目区、索引编辑器、DSM 界面、诊断 code 文案）必须进入 `packages/sdk/src/i18n/locales/*.json` 的**全部 51 个 locale 文件**，提供真实翻译（对应类型系统设计的 i18n 要求与现状缺口 B12）。

---

## 10. 与「类型系统设计」的对应关系（追溯表）

| 本文档章节 | 类型系统设计依据 |
|---|---|
| §3.1 树层级（Constraints/Indexes/Domains 节点） | §3.8.3 裁决 1/2（双名对象）、§3.3（逻辑域）、Q1（全局唯一） |
| §3.4 异常对象 / 无效标记呈现 | §3.5.1（LOGICAL_ONLY/PHYSICAL_ONLY 降级为异常提示）、§16.5（InvalidMarker，Q18） |
| §4 统一编辑面板（成对呈现、暂态） | §7.0 三区划分、§7.4 字段布局（Q20/D16）、§3.5.2（中间态 vs 缺陷，R16） |
| §4.5 物理类型 combobox | §7.2.1（D3） |
| §4.6 来源徽标与批量转 mapped | §3.4（`fieldTypeSource` 三态，Q8）、R12 |
| §6.1/§6.2 显示切换与逐项开关 × 双层 | §2 不变式 2（视图即层）、§7.1/§7.2 |
| §6.4 逻辑/物理切换语义修订 | §0.2、§3.0（双层并存，Q9/D5）、§3.6（名称不同步） |
| §6.8 erwin 导入与报告 | §16（XML Standard Files，Q12/D9；宽松模式 Q15；InvalidMarker Q18；R14 不允许静默成功） |
| §6.9 DSM 映射管理界面 | §7.0（映射管理界面）、§3.3.1（全局唯一）、§5（三级作用域）、§6（lint）、§8（物化策略） |
| §7 条目区 | §3.8.3 裁决 2/5（D26/D27：双名 + 自动命名 + 表格下方分割线条目区）、Q29（FK 索引可选创建） |
| §8 告警 Tab 双诊断通道 | §6.2（DialectDiagnostic）、§3.8.3 裁决 6（12 条索引/约束诊断） |
| §4.4 索引级撤销 | §3.8.3 裁决 3（独立命令） |
| §9.5 i18n | §3.8.2 缺口 B12、§10（51 locale） |

---

## 11. 裁决记录（2026-10-27 全部裁决）

> 原开放问题 19 条（Q1–Q9、Q11–Q20；Q10 已由类型系统设计裁决移除）经用户逐条裁决，本表为唯一权威记录。裁决要点已在正文相应章节生效。

| # | 问题 | 裁决（2026-10-27） |
|---|---|---|
| Q1 | 显示/视图切换工具的操作范围显式化 | **自动判定**：有选中按选中（表/Area）、无选中整个画布；工具栏加**常驻范围指示器**明示当前作用范围 |
| Q2 | 视图状态是否随图表保存 | **随图表保存**（显示方式、逐项开关、逻辑/物理视图），**缩放除外**（缩放为会话态，不入文档） |
| Q3 | 对象级「隐藏」能力 | **本期不引入** |
| Q4 | 左侧收缩后窄栏浮层速览 | **提供**：窄栏保留类别图标，点击以浮层快速查看树，点击画布自动收起 |
| Q5 | 面板尺寸/收缩状态持久化作用域 | **按用户全局**（不随图表、不随宿主） |
| Q6 | Auto(Flow) 与手动定位的冲突策略 | **位置锁定属性**：被锁定的表不参与自动布局（用户未选「未手动定位过的表才参与」推荐项） |
| Q7 | 配置组织与作用域 | **DSM 独立容器**（映射管理界面，见 Q16）+ 独立「**首选项**」对话框（显示/工具/快捷键/自动保存）；显示/工具配置**仅应用级作用域**，不适用三级作用域 |
| Q8 | Print / PrintPreview 范围 | **内嵌分页预览 + 浏览器打印**；PDF 导出列为后续 |
| Q9 | 错误级告警自动展开 | **不自动展开**；标题条常驻 error 红色计数徽标 + 一次性 toast 提示 |
| Q11 | 树节点拖拽开放范围 | **仅「表 ↔ Area」归属调整**；字段顺序、索引列序在编辑面板/索引编辑器内调整 |
| Q12 | 多选批量应用粒度 | **原子整体回滚**：任一对象校验失败则整个批量命令不应用，逐条显示错误 |
| Q13 | SDK 嵌入可配置性 | **全量可配置，默认全开**：宿主可按组隐藏工具栏、可关闭底部区域、可替换 DSM 入口 |
| Q14 | Trace Tab 受众 | **仅开发者模式**开启才显示；普通用户只见告警/日志/操作日志 |
| Q15 | 物理侧独有对象（View/Enum/Type）在逻辑视图呈现 | **隐藏**（画布与树均不显示），新建入口禁用（视图即层语义最干净） |
| Q16 | DSM 界面入口与容器 | **app 独立路由页 + SDK 全屏模态**承载同一组件；均从配置工具组进入 |
| Q17 | 树是否吸收 SidePanel Indices 页 | **树吸收，不设独立清单页**：树节点（Constraints/Indexes）+ 条目区 + 编辑面板覆盖定位与编辑 |
| Q18 | erwin 导入报告形态 | **模态摘要（必须看一眼才关闭）+ 完整报告可导出 + 关键项入告警 Tab 可定位 + 日志 Tab 归档**；**不持久化**到图表文档 |
| Q19 | fieldTypeSource 来源徽标密度 | **仅编辑面板**逐字段显示 mapped/explicit/imported；画布字段行不显示（密度优先），诊断与告警里体现 |
| Q20 | 条目区与显示模式关系 | **逐项开关（PK/UK/FK、INDEX）为条目区显隐的唯一状态源**；四显示模式只是预设组合，手动调整后显示切换进「自定义」态 |

### 11.1 P5 实施中新提出的问题

| 编号 | 问题 | 现状 | 裁决 / 落地 |
|---|---|---|---|
| Q21 | 左侧面板「隐藏」有两个入口，语义不一致 | View 菜单「Toggle side panel」走 `ui.sidebarOpen` 卸载大纲树；`mod+b` 走 `settings.panelLeftCollapsed` 收起但保留挂载与状态 | **裁决：统一为「收起」**（2026-10-28）。`settings.panelLeftCollapsed` 成为唯一状态源，`ui.sidebarOpen` 改为它的镜像（读），`ui.toggleSidebar()` 写回设置；菜单项、Header 按钮、`mod+b` 三条入口因此同步。`showSidePanel` 不再随 `sidebarOpen` 卸载面板，树在收起期间保留状态，恢复即可逆。命令名暂保留 `Toggle side panel`（文案随 P6 首选项/菜单整理一并调整）。

---

## 12. 后续步骤

1. ~~评审本文档，收敛 §11 的开放问题~~ —— **已完成（2026-10-27，19 条全部裁决，见 §11）**。
2. ~~将定稿拆解为实施计划~~ —— **类型系统核心 P1–P4 计划已立**：[`docs/superpowers/plans/2026-10-27-erwin-type-system-core.md`](superpowers/plans/2026-10-27-erwin-type-system-core.md)（模型 → 解析器 → lint → 导出接入）。执行时按 using-git-worktrees 新建 worktree。
3. 后续计划（与类型系统设计分期对齐）：
   - **P2'（索引与约束维护，与 P1 并行线）** ↔ §7（条目区）、§3.1（树节点）、§8（索引诊断通道）——**未立项**；
   - ~~**P5（SDK 接入）** ↔ 本文档 §3–§5、§6.1/§6.2/§6.4、§4（统一编辑面板）~~ ——**已完成（2026-10-28，分支 `sdk-ui-redesign-p5`）**，见下方 §12.1；
   - **P6（App 接入）** ↔ §6.9A（DSM 映射管理界面）+ 首选项对话框（Q7）——**未立项**；
   - **P7（erwin 导入器）** ↔ §6.8（导入入口与报告呈现）、§3.4 / §8（异常标记与告警）——**未立项**。
4. ~~对百表级场景做树虚拟滚动、条目区渲染与布局动画的性能验证~~ —— P5 内已验（§12.1）。

### 12.1 P5 的落地情况（2026-10-28）

计划：`docs/superpowers/plans/2026-10-28-sdk-ui-redesign-p5.md`。落地与本文档的对应关系：

| 本文档 | 落地位置（`packages/sdk/src/`） |
|---|---|
| §2 布局骨架、§5 面板收缩/展开、Q5 尺寸持久化、Q21 单一隐藏机制 | `components/EditorLayout.vue`、`components/Layout/ResizablePanel.vue`、`composables/use-panel-hotkeys.ts`（mod+b / mod+alt+b / mod+\`）、`stores/settings.ts`（`panelLeftCollapsed` 为唯一状态源，`ui.sidebarOpen` 是它的镜像） |
| §3 树型大纲、Q11 拖拽、§3.1 双层命名 | `components/Outline/`（`OutlineTree.vue`、`outline-nodes.ts`、`outline-model.ts`、`outline-actions.ts`） |
| §6.1 四显示模式 × 双层、§6.4 逻辑/物理切换 | `components/Canvas/render-model.ts`、`render-geometry.ts`、`stores/view-state.ts`、core `models/view-state.ts`（随图保存，Q2） |
| §6 九组工具栏（Q1 范围自动判定 + 常驻指示器、Q20 逐项开关为状态源） | `components/Toolbar/`、`stores/toolbar-scope.ts`（选中表/Area 范围只影响选中表，无选中写全局） |
| §4 统一编辑面板（五列成对、combobox、Q12 原子批量、Q19 来源徽标） | `components/EditPanel/`、`stores/edit-panel-actions.ts` |
| §8 底部告警区（Q9 不自动展开+徽标+Toast、Q14 Trace 仅开发者） | `components/BottomPanel/`（Alerts / History / Log，Trace 占位待 Q14 场景） |
| Q13 SDK 可配置 | `types/sdk-options.ts`（`outline` / `editPanel` / `bottomPanel` / `toolbar.groups` / `onOpenDsm`） |
| AGENTS.md 的 i18n 硬约束 | 108 个新 key × 51 个 locale 全部真实翻译 |

**第二轮补齐（2026-10-28，审计之后按 1/2/3 顺序完成）**：

| 本文档 | 第二轮落地 |
|---|---|
| §6.3 布局工具（Grid / Flow / Auto Flow）、§6.5 对齐工具 | `components/Toolbar/ToolbarLayout.vue`、`ToolbarAlign.vue`、core `layout/block-layout.ts`、`composables/align-geometry.ts`、`stores/arrange-actions.ts`（五种动作各一次 undo，锁定表不动） |
| §6.6 图工具（适应图表 / 缩放到选中 / 100% / 百分比输入） | `ToolbarZoom.vue` 重写、`composables/zoom-actions.ts` 与 `use-zoom-actions.ts` |
| §6.8 文件组（SaveAs / Import / Export） | `ToolbarFile.vue` 扩到六项，emit `file:*` 由宿主接 |
| §4 编辑面板的分组与选择态 | `EditPanel.vue` 增 constraints / indexes / appearance / diagram 四组，`TableConstraints.vue`、`TableIndexes.vue`、`TableAppearance.vue`、`DiagramEditor.vue`；混合选择改为计数 chip 而非空态 |
| Q19 来源徽标 | `FieldPairRow.vue` 的 `source-badge` + `edit-panel-groups.ts` 的 `SOURCE_KEYS` |
| §8 底部区（级别过滤 / fixable / 日志 / max 态） | `BottomPanel.vue` 三态、`AlertsTab.vue`（过滤 + 计数 + 一键修复 + 复制/导出）、`LogTab.vue`（命令历史）、`use-alerts.ts`（去重 + 1000 上限） |
| §9.5 国际化 | 第二轮再补 52 个 key（布局/对齐 24、编辑面板 20、底部区 8），en 共 555 键，51 个 locale 全量对齐 |

**仍未覆盖**：布局前的「>50 表确认」、Print / PrintPreview、总览条跳诊断、R15 整表折叠物理列、字段级独立详情面板、底部区 max 态的 50% 视口上限、Trace 的性能计数、导入/导出/保存事件写日志。

### 12.2 第三轮改动（2026-10-28，评审反馈）

| 反馈 | 落地 |
|---|---|
| 表的「描述 / PK / UK / FK / INDEX」不该挤在表名下方，应是字段列表下方的独立分块，用分割线区分，外框自动撑开 | `components/Canvas/table-sections.ts`（`TableSectionKind`、`tableSections()`、`tableSectionsHeight()`、`foreignKeyRows()`）、`TableSections.vue`；`render-model.ts` 的 `TableRenderModel` 改带 `sections` / `sectionsHeight`，`headerHeight` 固定为 `TABLE_HEADER_HEIGHT`；`TableHeader.vue` 只剩标题与按钮，描述移到 `TableSections.vue`（双击仍可编辑）；块与块之间 1px 分割线，顺序 PK → FK → UK → INDEX → 描述（§7.1） |
| 树里的关系节点应显示关系自身的 name | `Outline/outline-nodes.ts` 的 `relationshipLabels()` 改为两层都以 `relationship.name` 为准（缺失才退回 `表 → 表`），逻辑名放在副标签；`outline-model.test.ts` 同步 |
| 顶部工具栏不该浮在画布上盖住第一张表 | `EditorLayout.vue` 把工具栏改为画布列上方的固定条（`.ddb-editor__canvas` 变 flex 列 + `.ddb-editor__canvas-body`），`toolbar.module.css` 增加横向滚动，九组在窄列下不再被裁切 |
| INDEX 开关的占位状态 | `ToolbarViewToggles.vue` 去掉 `indexes` 的 disabled，四开关与画布四类分块一一对应 |

P5 **未覆盖**、留给后续期的部分（有意为之，不是缺口遗漏）：
- §7 条目区的**交互部分**（图标 + 名称的可点击条目、双名就地改名、条目编辑器、新增/删除入口、折叠摘要）与树中的 Constraints/Indexes 节点——属 P2'；分块的**显示**已在第三轮落地（§7.1），INDEX 开关不再置灰。Q17 的「树吸收 Indices 页」在 P2' 落地时一并接线。
- §6.8 erwin 导入与导入报告（P7）、§6.9A DSM 映射管理界面与首选项对话框（P6，`onOpenDsm` 已预留入口）。
- §6.6 图工具中的 Print / PrintPreview（Q8 裁决为内嵌分页预览 + 浏览器打印，P5 未实现）。
- Q3 对象级隐藏（本期不引入）——P5 计划明确排除；§6.3 布局与 §6.5 对齐已在第二轮补齐（见上表）。
- 树节点拖拽的落库行为（Q11 表↔Area）：P5 只发出事件并把表移入区域几何范围，属性级落库留待 Area 成员模型定案。
- §2 描述的「收缩后保留约 36px 窄边栏 + 类别图标浮层速览」（Q4）尚未实现：当前收起是宽度归零 + 边缘 chevron 按钮，没有类别图标也没有浮层。Q4 的裁决保留，实现留待 P6 与首选项一起做。

### 12.3 第四轮改动（2026-10-29，十二条评审反馈）

这一轮全部来自实际操作反馈，逐条对应到代码，每一条都有测试跟着：

| 反馈 | 落地 |
|---|---|
| 1 右侧属性表格里字段的单行编辑太挤 | `components/EditPanel/FieldPairRow.vue` 改成可折叠卡片：摘要行（名称、物理类型、状态、来源、删除）+ 展开后的 2×2 带标签控件（逻辑名/逻辑类型/物理列/物理类型）；`TableEditor.vue` 不再需要六列表头；样式在 `edit-panel.module.css` 的 `.field-card*` |
| 2 没选中任何元素时，视图切换应作用于所有表 | `stores/toolbar-scope.ts` 增 `clearOverridesForCanvas()`：canvas 范围的 toggle / 显示模式变化会清掉 `viewState.overrides`，早先按表范围改过的表也跟着变 |
| 3 导航点击后应把对象定位到可视区域中心 | `composables/zoom-actions.ts` 增 `centerScroll()`；`composables/canvas-viewport.ts` 保存画布视口（`ResizeObserver` 保持新鲜）；`composables/use-focus-measure.ts` 用 `tableRenderModel` 量节点尺寸；`selection-actions.ts` 的 `useFocusIssue(scrollTo, sizeOf)` 把**节点中心**交给 `ui.centerOn()` |
| 4 折叠成仅表名后，连线锚点没有跟随 | `Canvas/Relationship.vue` 的 `startModel`/`endModel` 传 `toolbarScope.overrideFor(id)`，与画布实际绘制同源；回归测试 `relationship-override.test.ts` |
| 5 PK 没有名称、tables 视图里不能选 PK/FK/UK | `table-sections.ts` 的 PK 行改为 `PRIMARY (id)`；树里新增键节点（见 8）；画布键行本身也可点选——`TableSectionModel.refs` 带着每行代表的对象，`TableSections.vue` 把有 ref 的行渲染成 `table-section-<kind>-line-<table>-<i>` 按钮，点 PK/UK/INDEX 行选中字段、点 FK 行选中关系（`SelectRef` → `ui.selectField` / `ui.selectRelationship`） |
| 6 PK/UK/FK 的字段不能编辑与排序 | `EditPanel/TableConstraints.vue` 重写为可编辑：PK 增删字段、UK 改名/加删/上下移字段/增删键、FK 改名；动作全部走 `diagram.updateField` / `updateTable` / `updateRelationship` |
| 7 无法编辑 PK/UK/FK 信息 | 同上；FK 行的「打开」按钮选中对应关系（`ui.selectRelationship`） |
| 8 导航里没有 PK | `Outline/outline-constraints.ts` 在表节点下、字段之前插入 `PK` / `UK <name>` / `FK <name>` 三种节点（`constraint:<tableId>:…`），点击选中表（外键再选中关系）；`OutlineTree.vue` 的 `select()` 与 `focus` 事件都认这一类 |
| 9 右键菜单一直显示 | `Canvas/ContextMenu.vue` 增 `@close`、点击外部与 Escape 关闭；`Canvas.vue` 在命令执行后、视口移动（`scrollX/scrollY/zoom`）时关闭——三个用例在 `canvas-interactions.test.ts` |
| 10 工具栏按钮多时应折行而不是滚动条 | `toolbar.module.css` 的 `.toolbar` 改 `flex-wrap: wrap`，按钮 24×24、间距收紧；窄画布列下两到三行而不是横向滚动 |
| 11 创建/缩放/Grid-Panel 按钮应并入工具栏并分组 | 新增 `Toolbar/ToolbarCreate.vue`（Add table / note / area，沿用 `add-table-btn` 等 testid）与 `ToolbarCanvasView.vue`（grid、panel）；`ToolbarGroupId` 增 `create` / `canvasView`；`Header.vue` 删掉旧的文本按钮工具栏与 `UndoRedoButtons.vue`，页头只留菜单栏、标题与保存状态 |
| 12 Note 无法编辑显示属性 | `EditPanel/NoteEditor.vue`：颜色、宽高、锁定，写入 `diagram.updateNote()`；`PanelTarget` 增 `{kind:"note"}` |

一条实现经验写在 `progress.md`：居中定位必须用**当下**量到的节点尺寸与视口尺寸——harness 的画布只有一百多像素高，挂载时测的视口是旧的，于是对象落在偏离中心 144px 的位置；`ResizeObserver` 让 `reportViewport()` 跟上布局变化后，e2e 里改成直接断言「对象中心 ≈ 视口中心」，不再依赖某个具体的 scroll 数值。
### 12.4 第五轮改动（2026-10-29，键的创建与索引编辑）

这一轮把「键」从只读展示变成可创建、可编辑的对象。四条反馈与落地位置：

| 反馈 | 落地 |
|---|---|
| 字段卡片里加 PK 复选框 | `components/EditPanel/FieldPairRow.vue` 的卡片正文末尾加一行跨两列的 `Primary key` 复选框（`field-primary-<fieldId>`），提交走 `store.updateField(..., { primary })`；逻辑层按既有规则降为只读 |
| Constraints 允许新增 UK/FK，新增时输入 name | `UniqueKeysPanel.vue` / `ForeignKeysPanel.vue`：`＋ Add` 先打开表单（`unique-create-name` 默认 `uk_<table>_<n>`、`foreign-create-name` 默认 `fk_<child>_<parent>`），确认后才写模型；取消不留痕 |
| UK 的编辑与 PK 相同 | 同一个面板里改名、从下拉加字段、↑/↓ 调序、× 删字段、删整键；写入走 `updateTable({ uniqueConstraints })` |
| FK 支持两表字段映射、多字段、调序 | `PairRows.vue`：每行「本表列 → 引用表列」，可增行、↑/↓ 调序、删行；`ForeignKeysPanel.vue` 在编辑已有 FK 时可换目标表并把已配对的引用列清空重选。`constraint-forms.ts` 的 `syncPairs()` 把第一对镜像回 `startFieldId`/`endFieldId`/`fields`，保证画布与导出仍按四 id 读取 |
| Indexes 允许新增、多字段、调序、unique | `TableIndexes.vue` 改写为可编辑：`index-create-open` 表单取名字与 unique，每行可改名、勾 unique、加字段、↑/↓ 调序、删字段、删索引；写入走 `updateTable({ indices })`，整份列表一次 undo |

新增的纯函数集中在 `components/EditPanel/constraint-forms.ts`（下一批名字、可加入的字段、pair 的读写与校验），因此三个面板不必各写一遍命名与校验规则。新增文案 4 个键：`index`、`edit_panel_foreign_target`、`edit_panel_foreign_local`、`edit_panel_foreign_referenced`。

### 12.5 第六轮改动（2026-10-29，键的卡片与树的图标分组）

| 反馈 | 落地 |
|---|---|
| PK/UK/FK 也用卡片编辑 | `packages/sdk/src/components/EditPanel/KeyCard.vue`：摘要行（徽标 + 名字 + 列清单 + 动作）+ 展开正文，与字段卡片同一套形制；PK、每个 UK、每个 FK、每个索引各一张卡（`constraint-primary`、`constraint-unique-<i>`、`constraint-foreign-<i>`、`index-<i>`），收起时仍可读摘要。 |
| 面板按钮统一为超级链接 | `edit-panel.module.css` 的 `.link-button`（无边框无底色、强调色文字、hover 下划线、禁用灰）与 `.link-button--muted`（图标类）；字段卡、键卡、批量编辑与 `PairRows` 全部改用它，旧的 `.add-button`/`.icon-button` 删除。 |
| 导航用不同矢量图标 | `packages/sdk/src/components/Outline/OutlineIcon.vue` + `outline-icons.ts`（`iconOf(node)`）：表、字段、键（PK/UK/FK/索引各一）、关系、区域、便笺、视图/枚举/类型与七个类目各有独立 16×16 路径，颜色走 `currentColor`。 |
| 表下按元素类型分组 | `outline-constraints.ts` 的 `keyNodes()` + `outline-nodes.ts` 的 `groupNode()`：表节点下依次是 Fields / Primary key / Unique keys / Foreign keys / Indexes 五个组（空组不出现、带数量徽标），与属性面板的分组同序；过滤命中字段时带上父表与所在组，命中表名时整表保留。 |

新增 3 个文案键（`outline_group_unique`/`outline_group_foreign`/`outline_group_indexes`），51 个 locale 均为 564 键。

## 12.6 第七轮改动（2026-10-29，bug 修复与 diagram 备注）

| 反馈 | 落地 |
|---|---|
| 两个 area 重叠时拖不开 | `areaNests(area, other)` 让 area 只带走**完全在它内部**的 area（`utils/elements.ts`）；table/note 仍按相交判定，所以表挂在区域边上依旧跟随。同级兄弟（含完全相同的矩形）互不携带。 |
| area 属性表缺内容 | `AreaEditor.vue` 补齐 name / color / opacity / width / height / locked / description，尺寸下限复用 `MIN_AREA_WIDTH`(80)、`MIN_AREA_HEIGHT`(60)，opacity 收敛到 0–1。 |
| diagram 无法改数据库类型 | `DiagramEditor.vue` 的 Database 由禁用的输入框改为下拉，选项来自 SDK 的 `utils/database-options.ts`（页头也改用它，两个入口同一份清单），写入走 `updateDiagram({ database })`。 |
| dialog 打开后右键菜单不消失 | 菜单的「画的东西」和「公开状态」原本是两个来源：渲染读 canvas 的 ref，关闭却写 ui store。现在 canvas 自己关（`closeMenu`），`ContextMenu.vue` 用 document 捕获阶段的 pointerdown 关（dialog 的 mask 会先吞掉冒泡事件），Escape 与命令执行同样关闭。 |
| diagram 增加备注字段 | core `Diagram.description` + `DiagramJson.description`（`serialize/export|import`）+ `DiagramProperties.description`（命令可改）+ 面板里的 Description 文本域。 |

## 12.7 第八轮改动（2026-10-29，颜色与放置）

| 反馈 | 落地 | 决定 |
|---|---|---|
| table 顶部颜色没有默认应用 | `packages/sdk/src/components/Canvas/TableHeader.vue` 的色带改无条件渲染，`background: table.color ?? DEFAULT_TABLE_COLOR` | 「没有颜色」和「默认颜色」在屏幕上必须能区分，所以默认给定一个可画的浅灰 `#cbd5e1` |
| 颜色在属性表格内无法修改 | 新增 `packages/sdk/src/components/EditPanel/ColorPicker.vue`（10 个预设 + 原生取色井 + 默认色块），`TableAppearance.vue` 改用它 | 不要求读者手写 `#rrggbb`；预设放在 `packages/sdk/src/utils/color-palette.ts`，与宿主换成同一组令牌 |
| 颜色支持多选修改 | `ColorPicker` 的 `multiple` 态不标记任何色块，`TableAppearance` 多选时走 `applyTableBatch`（一次`CompositeCommand`，Q12） | 混合选择时「没有一个为真」，这与面板其他多值字段的表现一致 |
| 颜色选择器增加约 10 个预定义色 | `TABLE_COLOR_PRESETS` 十条（slate/steel/sky/teal/green/lime/amber/orange/rose/violet） | 取自画布现有令牌的色相，避免与关系色、告警色冲突 |
| table 内的编辑移除索引与 UK | `TableDetails.vue` 只留颜色一行；`tableDetailsHeight()` 相应简化为「内边距 + 一行」 | 键是有名字、有列序的对象（P2'），画布上再放一个窄编辑器会有第二套规则 |
| 右键选择操作后菜单仍存在 | `Canvas.vue` 的 `onMenuCommand` 改调 `canvas.closeMenu()`（菜单由画布的引用绘制） | 关闭必须发生在绘制它的地方；只清 UI store 会留下可见的菜单 |
| 新建元素应落在可视区域并选中定位 | 新增 `packages/sdk/src/utils/placement.ts`（`centreOfViewport`/`placeAt`/`cascadeShift`），`ToolbarCreate.vue` 用视口中心 + 每类元素的 24px 级联落点，创建后选中并居中 | 落点由「当下量到的视口」决定，与导航定位共用同一条数学；级联避免同名元素完全重叠 |

### 12.7A 第八轮的补充决定（2026-10-29 复核后）

| 事项 | 决定 | 依据 |
|---|---|---|
| 取色器在混合选择时 | 不标记任何色块 | 混合选择没有共同的「当前颜色」，标记会误导；改由属性面板的分组标题说明是批量编辑 |
| 画布详情框的颜色 | 保留（只读态随锁定禁用） | 画布上快速改色是高频道动作，全部赶到右栏会多一次定位 |
| 工具栏「实际大小」按钮 | 条件由「缩放=100%」放宽为「缩放=100% 且未滚动」 | 面板/列表把画布滚到很远处时，用户需要一键回到原点，这与缩放无关 |
| 新元素的位置 | 视口中心 + 每个已存在元素再级联 24px | 「中心」让新元素一定可见；级联避免连续新建叠在同一处；两者相乘在 100 表批量脚本里会漂很远，故 e2e 先网格布局再断言虚拟滚动 |

## 12.8 第九轮改动（2026-10-30，P6：类型系统与打印）

| 需求 | 落地的位置 | 说明 |
| --- | --- | --- |
| 数据类型的作用域（Q16/§5） | packages/sdk/src/stores/type-scope.ts | 应用层与工作区层存在本地（drawdb:type-scope），图层的覆盖随文档走；撞名返回诊断且不落库 |
| DSM 映射管理界面（Q16） | packages/sdk/src/components/TypeSystem/ | 族 × 方言的映射网格、域的增删改；宿主传 onOpenDsm 就交回宿主自己的页面 |
| 独立首选项（Q7） | packages/app/src/components/PreferencesDialog.vue | 主题、默认数据库、自动保存与间隔；应用级作用域 |
| 独立的类型页 | packages/app/src/views/TypesView.vue + /types 路由 | 整页挂同一份 DSM，关闭回到首页 |
| 打印与预览（Q8） | packages/sdk/src/components/Print/ | 分页的 A4 纸面（print-layout.ts 的 printPages），文件组带两个入口，window.print 交给浏览器 |

## 12.9 第十轮改动（2026-10-30，P7 erwin 导入）

| 项 | 落地 | 说明 |
| --- | --- | --- |
| XML 读取 | `packages/core/src/erwin/xml.ts` | 无依赖的宽容解析器：元素/属性/文本/CDATA、实体解码、标签不配对时按名字收栈、名字归一化（忽略大小写与 `_`/`-`） |
| erwin 文档 | `packages/core/src/erwin/erwin-model.ts` | `readErwinDocument` 读成实体/属性/字段/域/关系；版本取根元素 `Version`，读不到记 `unknown`；未知元素与读不懂的值进 `skipped` |
| 映射 | `packages/core/src/erwin/erwin-import.ts` | 表名取物理名、逻辑实体取 `EntryName`、物理类型标 `imported`、PK 由标记合成、关系由 `Relationship` 合成，末尾跑 `normalizeDiagramKeys` |
| 无效标记 | `Diagram.invalidMarkers` | Q18：位置在、语义标无效；标记随图序列化，不参与导出 |
| 报告与入口 | `ImportDialog` 的 `format: "erwin"`、文件菜单 `Import erwin XML` | 对话框先显示版本/实体/属性/字段/域/关系/跳过的计数与列表，再确认替换 |

