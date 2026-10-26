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
  tableWidth,
  viewBounds,
  visibleWorldBounds,
  type Bounds,
} from "../components/Canvas/geometry.ts";
import {
  areaHoldsElement,
  elementBounds,
  heldByCollapsedArea,
} from "../utils/elements.ts";
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
  /**
   * The tables outside of each collapsed area that a hidden relationship
   * points at, by the id of the area. The badge on the title bar of the area
   * counts them and the hover on the badge draws a dashed line to each.
   */
  collapsedAreaLinks: ComputedRef<Map<string, Array<{ x: number; y: number }>>>;
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

  /** The collapsed areas, whose contents are hidden with their title bars. */
  const collapsedAreas = computed(() =>
    diagram.areas.filter((area) => area.collapsed === true),
  );

  const noteItems = computed<CanvasItem<Note>[]>(() =>
    diagram.notes
      .filter(
        (note) =>
          !heldByCollapsedArea(collapsedAreas.value, elementBounds(note)),
      )
      .map((note) => toItem(note, noteBounds(note))),
  );

  const viewItems = computed<CanvasItem<View>[]>(() =>
    diagram.views
      .filter(
        (view) =>
          !heldByCollapsedArea(collapsedAreas.value, elementBounds(view)),
      )
      .map((view) => toItem(view, viewBounds(view))),
  );

  const tableItems = computed<CanvasItem<Table>[]>(() =>
    diagram.tables
      .filter(
        (table) =>
          !table.hidden &&
          !heldByCollapsedArea(collapsedAreas.value, elementBounds(table)),
      )
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

      // A relationship to a table a collapsed area holds is hidden with it.
      if (
        heldByCollapsedArea(collapsedAreas.value, elementBounds(startTable)) ||
        heldByCollapsedArea(collapsedAreas.value, elementBounds(endTable))
      ) {
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

  /**
   * The tables outside of each collapsed area that a relationship still
   * connects to it.
   *
   * A relationship with one end inside a collapsed area and one end outside
   * of it is hidden with the area; the badge on the title bar counts these
   * relationships and the hover on the badge draws a dashed line to the
   * table outside, so the connections of a collapsed area stay discoverable.
   */
  const collapsedAreaLinks = computed(() => {
    const links = new Map<string, Array<{ x: number; y: number }>>();
    for (const area of collapsedAreas.value) {
      const targets: Array<{ x: number; y: number }> = [];
      for (const relationship of diagram.relationships) {
        const startTable = diagram.tableById(relationship.startTableId);
        const endTable = diagram.tableById(relationship.endTableId);
        if (!startTable || !endTable) {
          continue;
        }
        const startHeld = areaHoldsElement(area, startTable);
        const endHeld = areaHoldsElement(area, endTable);
        if (startHeld === endHeld) {
          continue;
        }
        const outside = startHeld ? endTable : startTable;
        targets.push({
          x: outside.x + tableWidth(outside) / 2,
          y: outside.y + 16,
        });
      }
      if (targets.length > 0) {
        links.set(String(area.id), targets);
      }
    }
    return links;
  });

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
    collapsedAreaLinks,
  };
}
