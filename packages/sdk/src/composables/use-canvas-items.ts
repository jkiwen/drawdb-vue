import { computed, type ComputedRef } from "vue";
import type {
  Area,
  Note,
  Relationship,
  Table,
  View,
} from "@drawdb/core";
import { useDiagramStore } from "../stores/diagram.ts";
import { useUIStore } from "../stores/ui.ts";
import {
  areaBounds,
  logicalRelationshipBounds,
  logicalTableBounds,
  noteBounds,
  relationshipBounds,
  tableBounds,
  viewBounds,
  visibleWorldBounds,
  type Bounds,
} from "../components/Canvas/geometry.ts";
import {
  useVirtualization,
  type VirtualizableElement,
  type VirtualViewport,
} from "./use-virtualization.ts";

/** An element of the canvas together with the object it draws. */
export interface CanvasItem<T> extends VirtualizableElement {
  item: T;
}

/** The parts of the diagram the canvas draws, already culled. */
export interface CanvasItems {
  isLogical: ComputedRef<boolean>;
  world: ComputedRef<Bounds>;
  viewportRect: ComputedRef<VirtualViewport>;
  transform: ComputedRef<string>;
  visibleAreas: ComputedRef<Area[]>;
  visibleNotes: ComputedRef<Note[]>;
  visibleViews: ComputedRef<View[]>;
  visibleTables: ComputedRef<Table[]>;
  visibleRelationships: ComputedRef<Relationship[]>;
}

/** Turns the bounds of an element into an item of the virtualization. */
function toItem<T>(item: T, bounds: Bounds): CanvasItem<T> {
  return {
    id: String((item as { id: string | number }).id),
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    item,
  };
}

/**
 * Computes the elements of the canvas that are visible.
 *
 * The virtualization keeps the canvas responsive with a big diagram: the
 * elements that are outside of the viewport are not drawn at all.
 */
export function useCanvasItems(options: {
  width: () => number;
  height: () => number;
}): CanvasItems {
  const diagram = useDiagramStore();
  const ui = useUIStore();

  /** The part of the diagram that is currently visible. */
  const world = computed(() =>
    visibleWorldBounds(
      ui.scrollX,
      ui.scrollY,
      ui.zoom,
      options.width(),
      options.height(),
    ),
  );

  /** The logical view draws the entities instead of the tables. */
  const isLogical = computed(() => ui.viewMode === "logical");

  /** The visible area, in the coordinates of the canvas. */
  const viewportRect = computed(() => ({
    x: world.value.minX,
    y: world.value.minY,
    width: world.value.maxX - world.value.minX,
    height: world.value.maxY - world.value.minY,
  }));

  const areaItems = computed<CanvasItem<Area>[]>(() =>
    diagram.areas.map((area) => toItem(area, areaBounds(area))),
  );

  const noteItems = computed<CanvasItem<Note>[]>(() =>
    diagram.notes.map((note) => toItem(note, noteBounds(note))),
  );

  const viewItems = computed<CanvasItem<View>[]>(() =>
    diagram.views.map((view) => toItem(view, viewBounds(view))),
  );

  const tableItems = computed<CanvasItem<Table>[]>(() =>
    diagram.tables
      .filter((table) => !table.hidden)
      .map((table) =>
        isLogical.value
          ? toItem(table, logicalTableBounds(table))
          : toItem(table, tableBounds(table)),
      ),
  );

  const { visibleElements: visibleAreaItems } = useVirtualization(
    areaItems,
    viewportRect,
  );
  const { visibleElements: visibleNoteItems } = useVirtualization(
    noteItems,
    viewportRect,
  );
  const { visibleElements: visibleViewItems } = useVirtualization(
    viewItems,
    viewportRect,
  );
  const { visibleElements: visibleTableItems } = useVirtualization(
    tableItems,
    viewportRect,
  );

  const visibleAreas = computed(() =>
    visibleAreaItems.value.map((entry) => entry.item),
  );

  const visibleNotes = computed(() =>
    visibleNoteItems.value.map((entry) => entry.item),
  );

  const visibleViews = computed(() =>
    visibleViewItems.value.map((entry) => entry.item),
  );

  const visibleTables = computed(() =>
    visibleTableItems.value.map((entry) => entry.item),
  );

  const transform = computed(
    () =>
      `translate(${-ui.scrollX * ui.zoom} ${-ui.scrollY * ui.zoom}) scale(${ui.zoom})`,
  );

  const visibleRelationships = computed(() =>
    diagram.relationships.filter((relationship) => {
      const startTable = diagram.tableById(relationship.startTableId);
      const endTable = diagram.tableById(relationship.endTableId);

      if (!startTable || !endTable) {
        return false;
      }

      const bounds = isLogical.value
        ? logicalRelationshipBounds(startTable, endTable)
        : relationshipBounds(relationship, startTable, endTable);
      return (
        bounds.minX <= world.value.maxX &&
        bounds.maxX >= world.value.minX &&
        bounds.minY <= world.value.maxY &&
        bounds.maxY >= world.value.minY
      );
    }),
  );

  return {
    isLogical,
    world,
    viewportRect,
    transform,
    visibleAreas,
    visibleNotes,
    visibleViews,
    visibleTables,
    visibleRelationships,
  };
}
