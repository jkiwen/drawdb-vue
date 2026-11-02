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

## 官方文档行号锚点登记表（2026-11-02 补齐）

引用官方文档时，锚点写成 **官方页级 URL + 缓存副本:行号**（行号指向缓存副本，
即 `references/erwin/` 下的原始 `.html` 抓取件）。

**回退规则**：若某条官方 URL 在缓存文档中**定位不到支撑该结论的精确事实**，
**不得臆造行号**——回退为**页级 URL**（不带行号），并在下表登记为「行号待补」；
补齐前该结论按"待校对"处理（对应上文「使用约定」第 4 条）。

| 引用点 | 官方页级 URL | 缓存副本 | 行号锚点 | 状态 |
|---|---|---|---|---|
| spec §0.2 逻辑模型定义 | https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/The_Logical_Model.html | `references/erwin/html/The_Logical_Model.html` | `:215` | 已锚定 |
| spec §0.2 物理模型定义 | https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/The_Physical_Model.html | `references/erwin/html/The_Physical_Model.html` | `:215` | 已锚定 |
| spec §2.1 Model Sources | https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/Model_Sources.html | `references/erwin/html/Model_Sources.html` | `:216` | 已锚定 |
| spec §3.0 / §3.7.1 逻辑↔物理对象对照 | https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/Comparison_of_Logical_and_Physical_Model_Objects.html | `references/erwin/html/Comparison_of_Logical_and_Physical_Model_Objects.html` | `:216`、`:295` | 已锚定 |
| spec §3.6 命名宏（`%AttDomain`） | https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/name_mapping_conventions_using_macros.html | `references/erwin/html/name_mapping_conventions_using_macros.html` | `:245` | 已锚定 |
| spec §4.2 / §6.4 换库提示确认转换 | https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/Data_Types_and_Data_Type_Standards.html | `references/erwin/html/Data_Types_and_Data_Type_Standards.html` | `:226` | 已锚定 |
| spec §7.1 显示 Attribute Domain | https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/Set_Entity_Display_Preferences.html | `references/erwin/html/Set_Entity_Display_Preferences.html` | `:221` | 已锚定 |
| spec §11 XML Standard vs Repository | https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/Save_a_Model_in_XML_Format_XML_Export.html | `references/erwin/html/Save_a_Model_in_XML_Format_XML_Export.html` | `:222` | 已锚定 |
| spec §3.3 Domain 对象构成 | https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/Data_Types_and_Data_Type_Standards.html | `references/erwin/html/Data_Types_and_Data_Type_Standards.html` | — | **行号待补** |
| spec §8 Domain 的物理类型 + Schema | https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/Data_Types_and_Data_Type_Standards.html | `references/erwin/html/Data_Types_and_Data_Type_Standards.html` | — | **行号待补** |

### 行号待补清单

| 待补项 | 官方页级 URL | 缓存副本检索结果 | 候选来源 | 状态 |
|---|---|---|---|---|
| Domain 持有可继承/不可继承属性；逻辑 edit mode 有 Logical Data Type、物理 edit mode 有 Physical Data Type（可带 Schema / Anchored to Type / Distinct Type）；支持 Logical Only / Physical Only | https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/User%20Guides/erwin%20Help/Data_Types_and_Data_Type_Standards.html | 该页缓存件（`.html` / `.txt`）全文无 `Domain`、`Physical Data Type`、`Anchored to Type`、`Distinct Type` 字样，无法定位精确事实 | Implementation Guide PDF 抽取件：`references/erwin/extracts/impl-guide-domains.txt:113`、`references/erwin/extracts/implementation-guide-15.0-fulltext.txt`（PDF 无页内行号，待确认对应官方页/章节后再补锚点） | **行号待补**（结论按"待校对"处理） |

> 待补说明：以上两条引用在 spec 中已按规则回退为**页级 URL** 并就地标注「行号待补」，
> 不写入任何臆造行号；补齐锚点后请回到本表更新状态，并同步 spec 中的标注。
