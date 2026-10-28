# drawDB Vue 3 SDK 架构设计

> **版本**: v1.0
> **日期**: 2026-10-23
> **目标**: 将 drawDB 从 React 18 + Semi UI 重构为 Vue 3 + Naive UI + TypeScript 的 SDK，同时支持嵌入式组件和独立应用两种交付形态。

---

## 1. 设计目标

### 1.1 核心目标

- **可嵌入**: 以 npm 包形式提供 `<DrawDBEditor />` 组件，可在任意 Vue 3 项目中使用
- **可独立**: 提供完整的 drawDB 独立 Web 应用
- **可扩展**: 支持元数据扩展、插件系统、自定义数据类型
- **可测试**: 核心逻辑有完整单元测试覆盖
- **高性能**: 60fps 画布交互，支持百表级图表

### 1.2 非目标

- v1 不实现实时协作（但预留接口）
- v1 不实现移动端适配
- v1 不支持 Vue 2

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                      drawdb-vue-app                         │
│                   (独立应用入口)                             │
├─────────────────────────────────────────────────────────────┤
│                      @drawdb/vue-sdk                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   editor    │  │   canvas    │  │       core          │  │
│  │  (UI 组件)   │  │  (画布组件)  │  │ (数据模型+转换逻辑)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │             │
│  ┌──────▼────────────────▼────────────────────▼──────────┐  │
│  │                       stores                            │  │
│  │  (Pinia: diagram / ui / history / settings / save)      │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 三层架构

| 层级 | 职责 | 包路径 |
|------|------|--------|
| **core** | 数据模型、SQL 导入/导出、DBML 转换、undo/redo 命令、布局算法 | `packages/core` |
| **sdk** | Vue 组件、Pinia stores、插件系统、默认 UI | `packages/sdk` |
| **app** | 独立应用、路由、部署配置、示例 | `packages/app` |

---

## 3. 技术栈

### 3.1 核心依赖

| 类别 | 选型 | 版本 |
|------|------|------|
| 框架 | Vue 3 | ^3.4.0 |
| 语言 | TypeScript | ^5.3.0 |
| 构建 | Vite | ^5.0.0 |
| 包管理 | pnpm workspaces | - |
| 状态管理 | Pinia | ^2.1.0 |
| UI 组件库 | Naive UI | ^2.38.0 |
| 样式 | CSS Modules | - |
| 测试 | Vitest + Vue Test Utils | ^1.0.0 |
| 画布 | SVG + foreignObject | - |
| SQL 解析 | node-sql-parser | 继承 drawDB |
| DBML | @dbml/core | 继承 drawDB |
| 布局 | @dagrejs/dagre | 继承 drawDB |
| 导出图片 | html-to-image | 继承 drawDB |

### 3.2 不保留的依赖

- React 18 → Vue 3
- @douyinfe/semi-ui → Naive UI
- React Context → Pinia
- react-hotkeys-hook → VueUse / 自定义快捷键
- framer-motion → Vue Transition
- @monaco-editor/react → monaco-editor 原生
- @lexical/react → 评估保留或替换

---

## 4. 模块设计

### 4.1 core 包

```
packages/core/src/
├── models/                    # 数据模型
│   ├── diagram.ts             # Diagram 根模型
│   ├── table.ts               # Table 模型
│   ├── field.ts               # Field 模型
│   ├── relationship.ts        # Relationship 模型
│   ├── area.ts                # Area 模型
│   ├── note.ts                # Note 模型
│   ├── view.ts                # View 模型
│   ├── enum.ts                # Enum 模型
│   ├── type.ts                # Type 模型
│   └── index.ts
├── commands/                  # 命令模式（undo/redo）
│   ├── command.ts             # Command 接口
│   ├── command-manager.ts     # 历史栈管理
│   ├── add-table.ts
│   ├── update-table.ts
│   ├── remove-table.ts
│   ├── add-relationship.ts
│   └── ...
├── sql/                       # SQL 导入/导出
│   ├── export/
│   │   ├── mysql.ts
│   │   ├── postgres.ts
│   │   ├── sqlite.ts
│   │   ├── mariadb.ts
│   │   ├── mssql.ts
│   │   ├── oraclesql.ts
│   │   └── generic.ts
│   └── import/
│       ├── parser.ts
│       ├── mysql.ts
│       └── ...
├── dbml/                      # DBML 转换
│   ├── parse.ts
│   ├── export.ts
│   ├── diff.ts
│   └── reconcile.ts
├── layout/                    # 自动布局
│   ├── auto-arrange.ts
│   └── calc-path.ts
├── storage/                   # 存储抽象
│   ├── storage-adapter.ts     # 接口
│   ├── indexeddb-adapter.ts
│   └── memory-adapter.ts
├── plugins/                   # 插件系统
│   ├── plugin.ts              # Plugin 接口
│   ├── plugin-manager.ts
│   └── extension-points.ts
├── metadata/                  # 元数据扩展
│   ├── metadata-schema.ts
│   └── metadata-registry.ts
└── index.ts
```

### 4.2 sdk 包

```
packages/sdk/src/
├── components/                # Vue 组件
│   ├── DrawDBEditor.vue       # 主编辑器组件
│   ├── Canvas/
│   │   ├── Canvas.vue         # SVG 画布
│   │   ├── Table.vue          # 表节点
│   │   ├── Relationship.vue   # 关系连线
│   │   ├── Area.vue           # 区域
│   │   ├── Note.vue           # 笔记
│   │   └── View.vue           # 视图
│   ├── Header/
│   │   ├── Header.vue
│   │   ├── MenuBar.vue
│   │   ├── Toolbar.vue
│   │   └── UndoRedoButtons.vue
│   ├── SidePanel/
│   │   ├── SidePanel.vue
│   │   ├── TablesTab.vue
│   │   ├── RelationshipsTab.vue
│   │   ├── AreasTab.vue
│   │   ├── NotesTab.vue
│   │   ├── ViewsTab.vue
│   │   ├── TypesTab.vue
│   │   └── EnumsTab.vue
│   └── common/
│       ├── ColorPicker.vue
│       └── FieldEditor.vue
├── stores/                    # Pinia stores
│   ├── diagram.ts             # 图数据
│   ├── ui.ts                  # UI 状态
│   ├── history.ts             # undo/redo
│   ├── settings.ts            # 设置
│   └── save.ts                # 保存状态
├── composables/               # Vue 组合式函数
│   ├── use-canvas-events.ts
│   ├── use-selection.ts
│   ├── use-drag.ts
│   ├── use-hotkeys.ts
│   └── use-storage.ts
├── plugins/                   # 内置插件
│   └── builtin-plugins.ts
├── i18n/                      # 国际化
│   ├── index.ts
│   └── locales/               # 36 种语言
├── styles/
│   ├── editor.module.css
│   └── variables.css
├── types/
│   └── sdk-options.ts
└── index.ts                   # SDK 入口
```

### 4.3 app 包

```
packages/app/src/
├── main.ts
├── App.vue
├── router/
│   └── index.ts
├── views/
│   ├── HomeView.vue
│   ├── EditorView.vue
│   └── TemplateView.vue
├── layouts/
│   └── DefaultLayout.vue
├── config/
│   └── app.config.ts
└── styles/
    └── global.css
```

---

## 5. 数据模型

### 5.1 Diagram 模型

```typescript
interface Diagram {
  id: string;
  name: string;
  description?: string;
  database: DatabaseType;        // mysql | postgres | sqlite | ...
  tables: Table[];
  relationships: Relationship[];
  areas: Area[];
  notes: Note[];
  views: View[];
  enums: Enum[];
  types: CustomType[];
  metadata: Record<string, MetadataValue>;  // 自定义元数据
  settings: DiagramSettings;
  createdAt: number;
  updatedAt: number;
}
```

### 5.2 Table 模型

```typescript
interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  fields: Field[];
  indexes: Index[];
  comment?: string;
  color?: string;
  metadata: Record<string, MetadataValue>;
}

interface Field {
  id: string;
  name: string;
  type: string;
  size?: number;
  nullable: boolean;
  default?: string;
  comment?: string;
  primary?: boolean;
  unique?: boolean;
  autoinc?: boolean;
  metadata: Record<string, MetadataValue>;
}
```

### 5.3 视图模式

```typescript
type ViewMode = 'physical' | 'logical';

interface ViewModeConfig {
  mode: ViewMode;
  // 物理视图：显示字段类型、约束、索引
  // 逻辑视图：显示实体名、关系基数、业务描述
}
```

---

## 6. 组件接口

### 6.1 DrawDBEditor 组件

```typescript
interface DrawDBEditorProps {
  // 数据模式
  modelValue?: Diagram;          // 受控模式
  initialValue?: Diagram;        // 非受控模式
  
  // 配置
  database?: DatabaseType;
  viewMode?: ViewMode;
  readonly?: boolean;
  locale?: string;
  theme?: 'light' | 'dark';
  
  // 扩展
  plugins?: Plugin[];
  metadataSchema?: MetadataSchema;
  customTypes?: CustomType[];
  
  // 存储
  storage?: StorageAdapter;
  autoSave?: boolean;
  autoSaveInterval?: number;
}

interface DrawDBEditorEmits {
  'update:modelValue': [diagram: Diagram];
  'change': [diagram: Diagram, changeInfo: ChangeInfo];
  'save': [diagram: Diagram];
  'export-sql': [sql: string];
  'import-sql': [diagram: Diagram];
  'error': [error: Error];
  'select': [selection: Selection];
}
```

### 6.2 插件接口

```typescript
interface Plugin {
  id: string;
  name: string;
  version: string;
  activate: (context: PluginContext) => void;
  deactivate?: () => void;
}

interface PluginContext {
  diagram: DiagramStore;
  ui: UIStore;
  history: HistoryStore;
  registerSlot: (slotName: string, component: Component) => void;
  registerCommand: (command: CommandConstructor) => void;
  registerMetadata: (schema: MetadataSchema) => void;
}
```

### 6.3 存储适配器接口

```typescript
interface StorageAdapter {
  load(id: string): Promise<Diagram | null>;
  save(diagram: Diagram): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<DiagramSummary[]>;
}
```

---

## 7. 状态管理设计

### 7.1 Pinia Stores

```typescript
// stores/diagram.ts
export const useDiagramStore = defineStore('diagram', () => {
  const diagram = ref<Diagram>(createEmptyDiagram());
  
  // actions
  const addTable = (table: Table) => { /* ... */ };
  const updateTable = (id: string, updates: Partial<Table>) => { /* ... */ };
  const removeTable = (id: string) => { /* ... */ };
  // ...
  
  return { diagram, addTable, updateTable, removeTable };
});

// stores/history.ts
export const useHistoryStore = defineStore('history', () => {
  const commandManager = new CommandManager();
  
  const execute = (command: Command) => { /* ... */ };
  const undo = () => { /* ... */ };
  const redo = () => { /* ... */ };
  const canUndo = computed(() => commandManager.canUndo());
  const canRedo = computed(() => commandManager.canRedo());
  
  return { execute, undo, redo, canUndo, canRedo };
});
```

### 7.2 命令模式

```typescript
interface Command {
  id: string;
  type: string;
  execute(): void;
  undo(): void;
  redo(): void;
  description: string;
}

class AddTableCommand implements Command {
  constructor(
    private diagramStore: DiagramStore,
    private table: Table
  ) {}
  
  execute() { this.diagramStore.addTable(this.table); }
  undo() { this.diagramStore.removeTable(this.table.id); }
  redo() { this.execute(); }
  description = `Add table ${this.table.name}`;
}
```

---

## 8. 物理/逻辑视图

### 8.1 物理视图

- 显示真实表结构
- 字段显示：物理字段名、物理类型规格（类型 + 长度/精度/标度）、约束、默认值、注释
- 关系显示：外键连线，基数标注
- 逻辑/物理双层并存（erwin 式）：物理视图读取 `PhysicalField.name` 与 `PhysicalField.fieldType`；类型规格的来源由 `fieldTypeSource` 标记（`mapped` / `explicit` / `imported`）

### 8.2 逻辑视图

- 显示业务实体关系
- 字段显示：逻辑属性名、逻辑类型（族或域）、业务描述
- 关系显示：实体关系（1:1, 1:N, N:M）
- 隐藏技术细节（索引、约束、数据类型）
- 视图即层：逻辑视图读取 `Table.logical`（`LogicalEntity`/`LogicalAttribute`），物理侧独有对象（View、自定义 Type/Enum）在逻辑视图不显示

### 8.3 切换机制

- 同一数据源（`Table` 内嵌逻辑实体），不同渲染方式
- 视图模式切换不丢失数据
- 各视图模式可独立配置显示选项

---

## 9. 元数据扩展

### 9.1 自定义属性

```typescript
interface MetadataSchema {
  target: 'diagram' | 'table' | 'field' | 'relationship' | 'area' | 'note' | 'view';
  properties: MetadataProperty[];
}

interface MetadataProperty {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date';
  label: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  options?: SelectOption[];
}
```

### 9.2 自定义数据类型

```typescript
interface CustomType {
  id: string;
  name: string;
  database: DatabaseType;
  definition: string;
  color?: string;
}
```

### 9.3 插件扩展点

- `canvas-overlay`: 画布覆盖层
- `side-panel-tab`: 侧边栏新增 Tab
- `header-action`: 头部操作按钮
- `context-menu`: 右键菜单项
- `export-format`: 自定义导出格式
- `field-editor`: 字段编辑器扩展

---

## 10. 国际化

- 保留 drawDB 36 种语言资源
- 从 JSON 转换为 TypeScript/JSON 兼容格式
- 支持运行时切换语言
- 支持插件扩展翻译

---

## 11. 性能设计

### 11.1 画布渲染

- SVG 视口虚拟化：只渲染可见元素
- `requestAnimationFrame` 节流事件处理
- `shallowRef` 存储大量元素避免深度响应
- 组件级 memo（Vue `computed` + `shallowReactive`）

### 11.2 状态更新

- Pinia actions 批量更新
- 命令模式避免频繁状态变更
- 大数据表使用分页/虚拟滚动

---

## 12. 测试策略

### 12.1 测试层级

| 层级 | 范围 | 工具 |
|------|------|------|
| 单元测试 | core 包纯函数、命令、转换器 | Vitest |
| 组件测试 | SDK Vue 组件 | Vue Test Utils + Vitest |
| 集成测试 | 存储、导入导出端到端 | Playwright |
| 类型测试 | TypeScript 类型 | tsd |

### 12.2 核心测试覆盖

- SQL 导入/导出（7 种方言）
- DBML 转换
- undo/redo 命令
- 数据模型 CRUD
- 自动布局算法
- 视图模式切换
- 元数据验证

---

## 13. 打包与发布

### 13.1 包结构

```
drawdb-vue/
├── packages/
│   ├── core/                  # @drawdb/core
│   ├── sdk/                   # @drawdb/vue-sdk
│   └── app/                   # drawdb-vue-app
├── package.json               # workspace root
├── pnpm-workspace.yaml
├── tsconfig.json
└── turbo.json
```

### 13.2 输出格式

- `@drawdb/core`: ESM + CJS + 类型定义
- `@drawdb/vue-sdk`: ESM + 类型定义
- `drawdb-vue-app`: 静态站点构建

### 13.3 样式隔离

- CSS Modules 自动作用域
- CSS 变量暴露主题定制接口
- 不污染宿主应用全局样式

---

## 14. 开发阶段

### 阶段 0: 基础设施 (2 周)
- 创建 monorepo 结构
- 配置 pnpm workspaces
- 配置 Vite 构建
- 配置 TypeScript
- 配置 Vitest 测试
- 配置 ESLint + Prettier
- 配置 CI/CD

### 阶段 1: Core 包 (4 周)
- 数据模型定义
- 命令模式实现
- SQL 导入/导出迁移
- DBML 转换迁移
- 存储适配器
- 插件系统基础
- 元数据扩展基础

### 阶段 2: SDK 包 (6 周)
- Pinia stores
- Canvas 组件
- Table/Relationship/Area/Note/View 组件
- Header 组件
- SidePanel 组件
- 物理/逻辑视图切换
- 插件扩展点
- i18n
- 快捷键

### 阶段 3: App 包 (2 周)
- 独立应用框架
- 路由
- 首页/编辑器页/模板页
- 部署配置

### 阶段 4: 测试与优化 (2 周)
- 单元测试覆盖
- 组件测试
- 性能优化
- 文档

### 阶段 5: 发布与文档 (1 周)
- npm 发布
- 文档站点
- 示例

**总计**: 17 周（约 4 个月）

---

## 15. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Canvas 交互复杂度过高 | 高 | 分阶段实现，先做基础拖拽再优化 |
| 原 drawDB 代码与 React 深度耦合 | 高 | 优先迁移纯函数工具，逐步替换组件 |
| 36 语言 i18n 迁移工作量大 | 中 | 使用脚本自动转换格式 |
| 物理/逻辑视图切换设计复杂 | 中 | MVP 只支持显示层切换，不改动数据模型 |
| 插件系统设计过度 | 中 | v1 只实现核心扩展点，后续迭代 |

---

## 16. 成功标准

| 指标 | 目标 |
|------|------|
| 核心单元测试覆盖率 | > 80% |
| 组件测试覆盖率 | > 60% |
| 画布拖拽帧率 | 60fps (100 表) |
| 包体积（gzipped）| < 500KB (sdk) |
| 构建时间 | < 60s |
| TypeScript 类型错误 | 0 |

---

*本 spec 是实施计划的基础。下一步将基于本 spec 编写详细的任务级实施计划。*
