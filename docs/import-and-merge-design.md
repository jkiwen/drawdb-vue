# 导入向导、合并与审计 — 设计讨论稿

**状态**：讨论稿（v0.1，2026-10-30）
**范围**：SQL / DBML / JSON / erwin XML 四种来源的**导入路径、导入逻辑、验证体系、审计体系**
**不在本期**：导入时自动映射类型系统的域（只在报告里提示）、erwin 的 Repository Format 与二进制 `.erwin`

---

## 1. 为什么要重做导入

### 1.1 现状（代码事实）

| 位置 | 现在的行为 | 问题 |
|---|---|---|
| `packages/sdk/src/components/Dialogs/ImportDialog.vue` | 一个对话框：选格式 → 粘贴源码 → `apply()` 解析 → 报错或 `confirmImport()` | 只有一个"解析成功/失败"的二元结论；没有结构校验、没有合并、没有审计 |
| `packages/sdk/src/components/Dialogs/ImportDialog.vue` 的 `confirmImport()` | `diagram.setImportedDiagram(parsed)` | **整图替换**，等价于 `setDiagram`：现有内容一次性消失，不可撤销 |
| `packages/sdk/src/stores/diagram.ts:242` | `setImportedDiagram(next) { setDiagram(next) }` | 没有历史记录，替换即不可回退 |
| `packages/sdk/src/composables/editor-menu.ts:71-79` | `file:import-sql` / `file:import-json` / `file:import-erwin` | 缺 DBML 入口；三种入口都是同一个"替换当前图"的对话框 |
| `packages/sdk/src/components/Toolbar/ToolbarFile.vue:23` → `DrawDBEditor.vue:188/202` → `editor-menu.ts` | 工具栏第 5 个按钮 emits `file:import`；`onMenu` 转给 `commands.onMenu()`，而 `editor-menu.ts` 只认 `file:import-sql` / `-json` / `-erwin` | **`file:import` 没有 case，按钮是死的**（用户清单第 2 条）；且菜单里也没有 DBML 入口 |
| `packages/core/src/erwin/erwin-import.ts:292` | `importErwinXml()` 返回 `{ diagram, report }` | 只有 erwin 有报告；SQL/DBML/JSON 没有任何审计产物 |

### 1.2 目标

把"解析一段文本然后替换整张图"改造成一条**可校验、可决策、可回溯**的导入流水线：

1. **入口统一**：菜单、工具栏、拖拽、空态页、宿主 API 都进入同一个向导。
2. **先验证再执行**：解析 → 结构校验 → 语义校验 → 合并预检，四级门禁。
3. **用户决策**：导入到**新图**还是**当前图（追加合并）**；冲突逐项决策；域是否注册。
4. **审计可查**：一次导入产生一份可导出的 `ImportSession`，关闭对话框不丢。
5. **失败可退**：无论哪一步中止，文档保持原样；成功导入是一次可撤销的历史条目。

---

## 2. 导入路径（入口矩阵）

| 入口 | 触发 | 行为 |
|---|---|---|
| 文件菜单 | `File ▸ Import…`（合并成一个入口），展开子菜单 SQL / DBML / JSON / erwin XML | 打开向导，来源步骤预选格式 |
| 工具栏文件组 | `toolbar-file-import`（现已有按钮，需接线） | 同菜单入口，格式未定（向导第一步选） |
| 画布拖拽 | 拖入 `.sql` / `.dbml` / `.json` / `.xml` 文件 | 打开向导，读文件、按扩展名猜格式 |
| 空态 | 空图的画布中央"导入" | 同上 |
| 宿主 API | `editor.import(source, options)` | 不弹窗，直接返回 `ImportPlan`（供宿主自绘 UI） |
| 命令面板/快捷键 | 预留 `mod+shift+i` | 同菜单入口 |

**入口统一原则**：所有入口都只做两件事——确定「来源」与「目标候选」，然后交给 `ImportWizard`。菜单和工具栏不再各自组装参数。

**向导末步的"执行"只有一处**：`diagram.applyImport(plan)`。任何入口都不允许绕过它直接 `setDiagram`。

---

## 3. 向导流程（五步）

```
①来源 ──▶ ②解析与报告 ──▶ ③目标决策 ──▶ ④冲突与预检 ──▶ ⑤执行与结果
   │            │                │                │              │
 选格式/文件   只读解析        新图 / 当前图     逐项决策        写入 + 审计
 粘贴或拖入    展示读到了什么   现有内容盘点      阻断项确认       呈现与撤销
```

### 3.1 步骤 ①：来源

- 格式选择（SQL / DBML / JSON / erwin XML）+ 数据库方言（SQL 与 erwin 需要，默认取当前图的 `database`）。
- 文件拖入或选择；也可以直接粘贴文本。
- **不解析**：这一步只收集来源，避免用户每敲一个字就跑解析。

### 3.2 步骤 ②：解析与报告（只读）

- 调 `buildImportSource()`（见 §5）得到 `ImportSource`：`{ kind, format, database, bytes, parsed?: Diagram, report?, error? }`。
- 展示"读到了什么"：表 / 列 / 键 / 关系 / 域的计数，加上解析器自身报告（erwin 的 `skipped` 与 `markers` 在这里逐条列出）。
- 域单独一节：逐个勾选（`import-domain-<name>`，**默认不勾**）才在导入时注册进类型系统的 application 层（Q3 裁决：确认才注册）。
- **解析失败不入库**：错误原文 + 位置（能定位到行就定位），用户可返回修改。
- 这一步的产物是**内存里的 `Diagram`（候选图）**，尚未触碰文档。

### 3.3 步骤 ③：目标决策

先盘点当前图（这是用户清单 1.1 的要求：**现有图不一定是空的，必须先验证**）：

| 当前图状态 | 界面 | 默认选项 |
|---|---|---|
| 空图（0 表 0 关系 0 便笺） | 只显示"导入到新图 / 导入到当前图"两个单选，"到当前图"没有任何代价 | 到当前图 |
| 非空（有内容但未保存/有未保存标记） | 显示计数 + "本次导入将把 N 张表并入当前图"；替换选项默认**关闭** | 追加合并 |
| 非空且当前图有未保存修改 | 多一条提示："当前图有未保存的修改" | 追加合并 |
| 宿主只读（`readonly`） | 只允许"导入到新图" | 新图 |

三种目标（用户清单 1.2）：

1. **新图**（默认给空图，或用户显式选）：新建一个 diagram 并用新窗口/新标签打开；当前图原样保留。
2. **当前图追加合并**：把来源里的表/关系/键/便笺/区域并入当前图，冲突按 §4 处理，**一次可撤销的历史条目**。
3. **替换当前图**（保留但降级为末位选项）：等价于旧行为，必须显式勾选"我确认丢弃当前图的 N 个对象"，且先在历史里写一条可撤销的 `ReplaceDiagramCommand`（现在连撤销都没有）。

### 3.4 步骤 ④：冲突与预检

- 列出**结构化冲突**（不是错误）：同名表、同名列、同名键（schema 级物理名）、同端点关系、同名域。
- 每行给一个决策（跳过 / 保留两者（改名）/ 并入现有）。**不预选任何决策**（Q1 裁决）：未决策的行把"下一步"按钮置灰，页脚显示"还有 3 项待决定"。批量动作（"其余全部改名"）是显式按钮，不代替默认值。
- 表清单可勾选（Q2 裁决）：`import-table-<name>` 默认全选，取消勾选即不导入该表；其列/键随之不导入，指向未选表的关系记一条 `info` 跳过，区域/便笺跟着所属表走。
- 所有**阻断项**单独置顶，必须处理完才能继续：解析错误、结构不变量违反、重复 id、不可映射的类型。
- 底部显示将发生的变化摘要：`+12 表 / +86 列 / +9 键 / +4 关系 / 跳过 3`。

### 3.5 步骤 ⑤：执行与结果

- `applyImport(plan)` 写一次历史（`ImportCommand`，description 如 `Import erwin XML (append 12 tables)`，undo 完整回退）。
- 结果页：成功计数、跳过明细、写入后的审计 id；两个动作：「在图中查看」（选中新表并居中，用户清单第 2 条的"导入完成后应进行图形呈现"）与「查看审计」。
- 失败：文档不变、展示失败原因、给出"重试 / 导出报告"。

---

## 4. 导入逻辑：从候选图到文档

### 4.1 单一写入口

```text
buildImportSource(raw, { format, database })  →  ImportSource
planImport(source, targetDiagram, decisions)   →  ImportPlan
applyImport(plan)                              →  ImportOutcome
```

- `planImport` **纯函数**，不碰 store；`ImportPlan` 是可序列化的"该做什么"，因此可以做 dry-run、可以在宿主里自绘确认页。
- `applyImport` 是唯一写入点：写一条 `ImportCommand` + 一份 `ImportSession`（审计）。
- 三个函数都放 `packages/core/src/import/`（`source.ts` / `plan.ts` / `apply.ts` / `audit.ts`），SDK 只做 UI 与 store 桥接。

### 4.2 合并算法（当前图追加）

| 对象 | 匹配键 | 可选策略（**无默认**，用户逐项裁决） | 备注 |
|---|---|---|---|
| 表 | 物理名（大小写不敏感） | 跳过 / 导入侧改名 `<name>_2` / 并入现有 | 三选一由用户当场决定（Q1 裁决：不设默认） |
| 列 | 物理名 | 新增列直接加；同名同类型视为同一列；同名不同类型 → 必须裁决 | 并入现有时类型以现有为准（`explicit`） |
| 主键 | 表内唯一 | 现有表已有主键 → 跳过导入侧主键并记 warning | 合并后重跑 `normalizeDiagramKeys` |
| 唯一键 / 索引 | schema 级物理名 | 跳过 / 撞名加 `_2` / 换名 | 键的命令模型已就绪（P2'） |
| 关系 | (子表, 父表, 列对集合) | 跳过 / 新增 | 子表侧同步生成 `foreignKeys` |
| 便笺 / 视图 / 区域 | 名字 | 跳过 / 改名 | 位置按 §4.4 偏移 |
| 域 | 名字 | 在 ② 报告里逐个勾选（默认不勾）才注册 | 写 application 层；撞名跳过并记 warning（Q3 裁决） |

### 4.3 ID 与引用重映射

合并时**所有 id 重新生成**（表、字段、键、索引、关系、便笺、区域、逻辑实体），并重映射：

- `IndexColumn.fieldId`、`Key_Group` 成员、`UniqueKey.columns`
- `Relationship.startFieldId/endFieldId` 与 `fields[]`
- `ForeignKey.relationshipId`、`LogicalRelationship.id`
- `LogicalAttribute.fieldId`
- `View.baseTableId`、`Area` 归属（区域无成员列表，靠几何）

实现方式：`remapDiagram(source, idMap)` 一次建立映射表再整体改写，避免"边改边查"漏项。

### 4.4 位置

- 导入的表沿用源坐标（保留原布局是导入的价值之一），整体平移使**包围盒左上角落在当前视口中心**（复用 `packages/sdk/src/utils/placement.ts` 的 `centreOfViewport`）。
- 与现有内容重叠时按 `cascadeShift` 级联 24px。
- 用户可在 ④ 选择"保留原坐标 / 平移到视口"。

### 4.5 原子性与撤销

- `ImportCommand` 内保存 `{ before: Diagram, after: Diagram }`（浅拷贝 + 变更对象引用），undo 恢复整份文档——与现有 `SetTableKeysCommand` 同类思路，但粒度是整次导入。
- 大图导入（>500 表）时 `after` 的深拷贝成本可接受（一次导入一次拷贝），但要在计划里标注内存上限（见 §12 Q7）。

---

## 5. 验证体系（四级门禁）

| 级别 | 内容 | 阻断执行？ | 现有实现 |
|---|---|---|---|
| **L1 语法** | 解析器抛错；部分解析可用的格式（DBML 有 `parseDBMLPartial`）允许"部分导入" | 是（除非用户选"修复模式"） | `importSQL` / `parseDBML` / `parseDBMLPartial` / `importDiagramJson` / `importErwinXml` |
| **L2 结构** | 表内 id 唯一、字段↔属性一对一、索引列存在、键命名唯一（schema 级）、关系端点存在、`invalidMarkers` 对应元素仍在 | 是 | `packages/core/src/models/invariants.ts` 的 `validateTableInvariants` / `validateRelationshipInvariants`；`validation/key-rules.ts` 的 `checkKeys` |
| **L3 语义** | 方言可表达性（`lintDiagram` 的 12 个 `DialectDiagnostic`）+ 图级问题（`collect()` 的 `DiagramIssue`） | 否（warning/info） | `packages/core/src/validation/` |
| **L4 合并预检** | 冲突清单、将做的破坏性动作（替换/跳过/改名）、ID 重映射完整性 | 是（必须逐项确认） | 新增 `planImport()` |

**严重度与决策规则**

- `error`：必须修复或显式勾选"跳过该项"。跳过被记为 `ImportSkip`（对应 `InvalidMarker`），且**不写入文档**。
- `warning`：默认继续，界面可逐项豁免。
- `info`：只记录（域未注册、无主键的表、缺索引的外键）。

**"修复模式"**：当 L1/L2 有阻断项时提供第二种执行方式——"只导入能导入的部分"。此时每个阻断项转成一条 `ImportSkip{path, reason}`，写进审计与图的 `invalidMarkers`，画的图仍然可打开、可编辑（延续 P7 的宽松但不静默原则）。

---

## 6. 审计体系

### 6.1 数据结构

```ts
interface ImportSession {
  id: string;
  startedAt: string;
  finishedAt?: string;
  source: { kind: "file" | "text" | "host"; format: ImportFormat; fileName?: string; bytes: number; version?: string };
  target: { kind: "new" | "current"; diagramId?: string; title: string };
  decisions: { conflicts: ConflictDecision[]; registerDomains: boolean; keepCoordinates: boolean };
  counts: { tables: number; fields: number; keys: number; relationships: number; domains: number; notes: number; areas: number; skipped: number };
  entries: ImportAuditEntry[];   // 逐条：level / code / path / message
  outcome: "applied" | "aborted" | "failed";
  error?: string;
}

interface ImportAuditEntry {
  level: "error" | "warning" | "info";
  code: string;          // 复用解析器/校验器的 code，如 index.unknown_field、erwin.unsupported
  path: string;          // Entity[19] / Table[SYSSV_MSG_Channel]/Column[MsgChannelId]
  message: string;
  subject?: { kind: "table" | "field" | "key" | "relationship" | "domain"; id?: string; name?: string };
}
```

### 6.2 存放与展示

- **随图存放**：`Diagram.imports?: ImportSession[]`（`serialize/export.ts` / `import.ts` 双向携带；旧档缺省 `[]`）。理由：导入是**这张图的历史**，跟着图走才能解释"这些表是哪来的"。
- **同时推送告警通道**：`error`/`warning` 进入底部面板的告警 Tab（现有 `use-alerts.ts` 双通道加第三通道 `imports`），点击可跳回该表。
- **操作日志**：`applyImport` 写一条历史（撤销栈）与一条日志（时间、来源、计数）。
- **结果页与审计页**：同一份 `ImportSession` 两种呈现——结果页是摘要，审计页是完整表格（按级别筛选、搜索、导出 JSON / Markdown）。

### 6.3 可重复与对照

同一文件再次导入时，在与上一份 `ImportSession` 对照后给出"有什么变化"（新增 3 表、2 表被跳过、1 关系变化），这是把审计从"日志"变成"决策依据"的关键。

---

## 7. 界面与契约（testid / i18n）

| 组件 | testid |
|---|---|
| 向导根 / 步骤 | `import-wizard`、`import-step-<source\|review\|target\|conflicts\|apply>` |
| 来源 | `import-format`、`import-database`、`import-file`、`import-source`、`import-next`、`import-back` |
| 报告 | `import-report-counts-<kind>`、`import-report-issues`、`import-issue-<i>`、`import-issue-filter-<level>`、`import-report-export`、`import-report-copy` |
| 目标 | `import-target-new`、`import-target-current`、`import-target-replace`、`import-replace-confirm`、`import-target-summary` |
| 冲突 | `import-conflict-<i>-<skip\|rename\|merge>`、`import-conflict-apply-all` |
| 执行 | `import-apply`、`import-cancel`、`import-result-focus`、`import-result-audit` |

- i18n 新键统一 `import_*` 前缀（约 45 个），需要落到 51 个 locale（沿用本轮既有流程：en 先写、按键序排序、其余 50 个批量翻译）。
- 向导宽度固定 720px，报告区内部滚动；表列表超过 200 行时折叠为"前 50 + 展开"。

---

## 8. 代码接缝（改动落点）

| 层 | 新增 | 修改 |
|---|---|---|
| core | `src/import/source.ts`、`plan.ts`、`apply.ts`、`audit.ts`、`index.ts` | `serialize/types.ts`+`export.ts`+`import.ts` 增 `imports`；`models/diagram.ts` 增 `imports?` |
| sdk | `components/Import/ImportWizard.vue` + 四个步骤组件 + `import.module.css`、`stores/import-session.ts` | `Dialogs/ImportDialog.vue` 退役（或包一层向导）；`stores/dialogs.ts` 的 `ImportFormat` 与打开参数；`ToolbarFile.vue` 的 `file:import` 接线；`composables/editor-menu.ts` 合并导入菜单项；`DrawDBEditor.vue` 的 `onMenu` 分支 |
| app | 无（沿用 SDK 向导） | 空态页与拖拽入口 |

---

## 9. 分期

| 阶段 | 内容 | 出口标准 |
|---|---|---|
| **P8a 向导与门禁** | `buildImportSource` + L1/L2 校验 + 报告步骤 + 目标决策（新图/当前图/替换）+ 工具栏与菜单入口 | 四种格式都能走完向导；替换有确认与撤销 |
| **P8b 合并引擎** | `planImport` + `applyImport`（追加合并、ID 重映射、冲突决策、原子撤销）+ 结果呈现（选中并居中） | 合并 100 表样例、冲突逐项决策可跑 |
| **P8c 审计** | `ImportSession` 持久化 + 审计页 + 导出/对照 + 告警通道接线 + i18n + 大文件流式 | 审计可导出、可对照上一次导入 |

---

## 10. 裁决记录与开放问题

### 已裁决（2026-10-30）

| 问题 | 裁决 | 落到哪里 |
|---|---|---|
| Q1 同名表默认策略 | **不设默认，由用户逐项裁决**；批量动作显式执行 | §3.4（未决策则不能继续）、§4.2 表格列 |
| Q2 部分选择 | **允许**：② 与 ④ 都能按表勾选，关系/键/区域跟随 | §3.4、§4.2 |
| Q3 域注册 | **确认才注册**：报告里逐个勾选，不自动写入类型系统 | §3.2、§4.2 |

### 仍待裁决

- **Q1 冲突默认值**：同名表默认"改名保留两者"还是"并入现有"？前者安全、后者省事。
- **Q2 部分选择**：④ 是否允许勾选"只导入这些表"（表级多选），还是只做冲突级的跳过？
- **Q3 域**：导入时自动注册域（application 层）并标 `imported`，还是必须先看报告再手动确认？（现在报告里只有提示）
- **Q4 审计归属**：`Diagram.imports` 随图存，还是放工作区级（跨图的"最近导入"清单）？两者是否都要？
- **Q5 替换当前图**：保留为末位选项，还是彻底删掉（只允许"新图"与"追加"）？
- **Q6 拖拽**：拖文件进画布是否等同向导（会打断编辑），还是先给一个轻量确认条？
- **Q7 大文件**：>500 表的导入要不要做分块进度与取消？`ImportCommand` 的整份快照在超大图上是否需要换成增量 patch？
- **Q8 未保存修改**：当前图有未保存改动时，是自动存快照再导入，还是只提示？
- **Q9 审计保留**：`imports` 保留最近 N 次还是全部？（随图体积增长）

### 9.1 追加合并要处理图级的自定义逻辑类型（2026-10-30）

导入的图自带 `Diagram.domains`（见 P7 的裁决）。把它追加进一个已有图时，域的名字冲突与表的冲突一样是**用户裁决**的事：两个图各有一个 `_ID` 时，既不能静默覆盖（会改掉旧属性的语义），也不存在“哪一边优先”的规则（2026-10-30 裁决）。

规则（`packages/core/src/import/domains.ts`）：

- **不冲突就合**：只有导入侧写了的方言直接补进域；两边都没写的维度不动。报告里的 `DomainMergeNote` 记下补进来的方言。
- **冲突就列出来，不替你选**：`domainConflicts(mine, theirs)` 为「族不同」「两边都给了参数且不同」「同一方言两边都给了且规格不同」各返回一条 `DomainConflict{name, kind, database?, mine, theirs}`。
- **未裁决即阻塞**：`mergeDiagramDomains(mine, theirs, decisions)` 把每一条没有对应 `DomainDecision{name, kind, database?, side}` 的冲突放进 `undecided`；`undecided` 非空时调用方**不得**应用合并。这正是向导「决策」步要清空的列表。
- **裁决后才落值**：`side: "theirs"` 采用导入侧的值，`side: "mine"` 保留图内的值；同名域始终合并成一个，`idMap` 把导入侧域 id 重指过去，导入属性的 `logicalType.domainId` 随之改到合并后的域上。
- **名字保持图内那个**：不改名、不产生 `_2`。

报告在「域」这一节列出：新增的域、被并入的名字、补进来的方言，以及**仍需裁决的冲突**（每条带两边的值与所在维度）。

实现：`packages/core/src/import/domains.ts` 的 `domainConflicts()` 与 `mergeDiagramDomains(mine, theirs, decisions)` → `{ domains, idMap, undecided, notes }`，纯函数、有单测；P8 的 Task 3 收集 `undecided` 作为向导的决策项，Task 4（apply）消费 `idMap` 并把 `notes` 写进报告。
