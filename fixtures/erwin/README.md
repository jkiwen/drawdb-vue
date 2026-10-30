# erwin 样本（P7）

这里放**真实 erwin 导出**的 XML Standard File，用来检验导入器对真实元素名、
真实属性名和真实怪癖的容忍度。它们不进任何 npm 包：仓库根的 `fixtures/`
不在 `packages/` 之下，`packages/core` 的构建不会包含它们。

测试从这里读：`packages/core/src/erwin/samples.test.ts` 用
`new URL("../../../../fixtures/erwin/", import.meta.url)` 定位，逐个文件跑
「不抛错 + 结构不变量」；带 `.expected.json` 的文件还会比对报告计数。

## 目录约定

```
fixtures/erwin/
  README.md                 ← 本文件
  <scenario>.xml            ← 一个场景一个文件（ERWin 7 XML Standard File）
  <scenario>.expected.json  ← 可选：该文件的报告快照（由脚本生成、人工复核后提交）
  <scenario>.notes.md       ← 可选：该文件的来源、脱敏方式、值得注意的怪癖
```

## 命名

`<erwin 版本>-<场景>[-<数据库>].xml`，全小写、连字符分隔，例如：

- `erwin7-baseline.xml` —— 最小可用：1–2 个实体、逻辑属性与物理字段成对、一个 PK、一条关系
- `erwin7-domains.xml` —— 域与父域，同一个域被多个实体引用
- `erwin7-keys.xml` —— 复合主键、唯一键、外键（多列）、索引
- `erwin7-unsupported.xml` —— UDP、Volumetrics、Business Terms、宏展开等已知不支持项
- `erwin7-unknown.xml` —— 导入器不认识的元素/属性（考验报告，而不是考验崩溃）
- `erwin7-asymmetric.xml` —— 逻辑属性没有字段、字段没有属性（§3.5.1 的异常）
- `erwin7-types.xml` —— 少见类型：`uniqueidentifier`、`datetime2`、`varbinary(max)`、`money`
- `erwin5-legacy.xml` —— 旧版本的元素名/属性名（考验别名表与名字归一化）
- `erwin7-large.xml` —— 规模样本（>50 实体，用于计数与性能观察）

## 每个文件希望覆盖到什么（写文件时对照）

| 场景 | 希望文件里出现 |
| --- | --- |
| baseline | `Entity` + `Attribute` + `Field` + `FieldType` + `Relationship`；逻辑名与物理名不同 |
| domains | `Domain`（含 `ParentId`）、实体属性引用域 |
| keys | `primaryKey="true"` 多列；唯一键；外键的多列映射 |
| unsupported | `UDP`、`Volumetrics`、`Business Terms` 等非核心节点 |
| unknown | 至少一个导入器不认识的元素与一个不认识的属性 |
| asymmetric | 有 `Attribute` 无对应 `Field`；有 `Field` 无对应 `Attribute` |
| types | 长度/精度/scale 的各种写法，包含一个写成字符串的非法数字（如 `length="many"`） |
| legacy | 旧版元素名（如 `Column` 代替 `Attribute`）或旧属性名（如 `Entry_Name`） |
| large | 数量足够触发网格布局多个行/列，最好含 2–3 条关系 |

## 写完之后我会做什么

1. `node --experimental-strip-types scripts/erwin-probe.mjs <文件>`：打印读到的
   版本、实体数、每个实体前几个属性/字段名、以及 `skipped` 列表——先用它确认
   别名表能覆盖真实元素名，再写断言。
2. 依据 probe 结果决定：补齐别名表（只加真实出现过的名字，不猜）、修读取器、
   或把该项记为「不支持 + 报告」。
3. 跑 `scripts/erwin-snapshot.mjs` 生成 `<scenario>.expected.json`，人工复核后提交。
4. `samples.test.ts` 对每个文件断言：不抛错、实体/字段计数 > 0、每条 `skipped`
   都有 `path`/`sourceName`/`reason`、没有 `Entity`/`Attribute`/`Field` 被误报为
   `unknown-element`（这一条就是「真实文件能被认出来」的判据）。

## 脱敏

如果样本含客户库表名，请说明是否要脱敏（把表名/字段名替换为 `t1`/`f1` 之类）。
脱敏后的文件仍能检验结构；只需在 `<scenario>.notes.md` 里写一句「已脱敏，原为 N 张表」。
