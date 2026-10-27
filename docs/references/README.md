# references/ — 外部资料存档

本目录存放**第三方官方文档与原始资料**，作为 drawDB 设计与实现的外部依据。
这些文件**不是本项目产出**，未经改写，仅作为原始参考被引用。

## 目录约定

```
references/
└── erwin/
    ├── erwin-api-reference-2021R1.pdf   # 原始 PDF（Quest/erwin 官方）
    ├── erwin-implementation-guide-15.0.pdf
    ├── html/                            # 官方帮助页（.html 原始 + .txt 纯文本抽取）
    ├── extracts/                        # PDF 纯文本抽取与重点章节摘录
    └── schemas/                         # erwin XML Schema（.xsd），如能获取
```

## 命名约定

- PDF：`<产品>-<文档名>-<版本>.pdf`
- 帮助页：`<Page_Name>.html` + 同名 `.txt`（`.txt` 为去标签后的纯文本，便于检索）
- 抽取片段：`impl-guide-<主题>.txt` / `api-reference-*.txt`

## 抓取来源

erwin 官方 Bookshelf（Quest Software 官方文档站）：

- 帮助页基址：
  `https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/<Page>.html`
- Implementation Guide 15.0（PDF）：
  `https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/PDFs/Implementation%20Guide.pdf`
- API Reference 2021R1（PDF）：
  `https://bookshelf.erwin.com/bookshelf/public_html/2021R1/Content/PDFs/API%20Reference.pdf`

> 抓取日期：2026-10-26。erwin 为 Quest Software 商业产品，其文档与 schema 受版权与许可约束；
> 本目录仅作内部设计参考，不得随产品分发，也不得直接再分发官方文档原文。

## 使用约定

1. 设计文档引用外部事实时，**标注来源页名**（如 `Comparison_of_Logical_and_Physical_Model_Objects`），
   不要只写"官方文档"。
2. 由本资料推导出的**项目自身结论**（映射规则、模型形状、限制清单）写进
   `docs/superpowers/specs/2026-10-26-erwin-type-system-design.md`，不放在本目录。
3. 本目录内容**不做修改**；若需摘录，用 `extracts/` 下的片段文件，并保留来源页名。
4. 未经官方文档确认的 erwin 行为，一律标注为"待真实 .erwin 文件校对"，不得写成既定事实。

## 已知缺口

- **缺少真实样本**：没有 `.erwin`（二进制）与 erwin 导出的 **XML Standard Files** 样本，
  因此 XML 元素名与层级只能依据 API Reference 与帮助页推断，导入器实现前必须先逆向一份真实文件。
- **缺少 XSD**：`erwinSchema.xsd` / `UDP.xsd` / `EMX.xsd` / `EMXProps.xsd` 未在公开 Bookshelf 上提供
  （官方说明其随 erwin 安装目录分发，仅供第三方集成者参考）。`schemas/` 目录留空待补。
