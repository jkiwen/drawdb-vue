export { default as Area } from "./Area.vue";
export { default as Canvas } from "./Canvas.vue";
export { default as ContextMenu } from "./ContextMenu.vue";
export { default as FieldHandle } from "./FieldHandle.vue";
export { default as LogicalRelationship } from "./LogicalRelationship.vue";
export { default as LogicalTable } from "./LogicalTable.vue";
export { default as Minimap } from "./Minimap.vue";
export { default as Note } from "./Note.vue";
export { default as Relationship } from "./Relationship.vue";
export { default as ResizeHandles } from "./ResizeHandles.vue";
export { default as Table } from "./Table.vue";
export { default as TableField } from "./TableField.vue";
export { default as TableHeader } from "./TableHeader.vue";
export { default as View } from "./View.vue";
export * from "./geometry.ts";
export * from "./logical-geometry.ts";
export {
  useCanvasActions,
  type CanvasActions,
  type CanvasActionsOptions,
} from "./interactions/use-canvas-actions.ts";
export {
  useCanvasCommands,
  type CanvasCommands,
} from "./interactions/use-canvas-commands.ts";
export {
  useCanvasHandlers,
  type CanvasHandlersApi,
  type CanvasHandlersOptions,
  type CanvasRect,
} from "./interactions/use-canvas-handlers.ts";
export {
  useContextMenu,
  type ContextMenuApi,
  type CanvasContextMenuState,
  type ContextMenuTarget,
} from "./interactions/use-context-menu.ts";
export {
  useLinking,
  type LinkingApi,
  type LinkingOptions,
  type LinkingState,
  type LinkingTarget,
} from "./interactions/use-linking.ts";
export {
  MIN_TABLE_HEIGHT,
  MIN_TABLE_WIDTH,
  useResize,
  type ResizeApi,
  type ResizeState,
} from "./interactions/use-resize.ts";
export {
  rectBetween,
  useSelectionBox,
  type SelectionBox,
  type SelectionBoxApi,
  type SelectionRect,
} from "./interactions/use-selection-box.ts";
