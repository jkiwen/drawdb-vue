import { createId } from "@drawdb/core";
import type { Area, Note, Relationship, Table, View } from "@drawdb/core";
import {
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_NOTE_WIDTH,
  DEFAULT_VIEW_HEIGHT,
  DEFAULT_VIEW_WIDTH,
  tableHeight,
  tableWidth,
} from "../components/Canvas/geometry.ts";

/**
 * Factories for the elements the editor can create from its toolbars.
 *
 * They keep the default values in one place, so that the header, the side
 * panel and the canvas create the same elements.
 */

/** A name that is not used by one of the existing elements yet. */
export function uniqueTableName(
  existing: readonly { name: string }[],
  base = "table",
): string {
  const names = new Set(existing.map((item) => item.name.toLowerCase()));
  if (!names.has(base)) {
    return base;
  }
  let counter = 1;
  while (names.has(`${base}_${counter}`)) {
    counter += 1;
  }
  return `${base}_${counter}`;
}

export function createTable(
  name: string,
  position: { x: number; y: number } = { x: 0, y: 0 },
): Table {
  const id = createId();
  return {
    id,
    name,
    x: position.x,
    y: position.y,
    logical: { id: `l_${id}`, name, attributes: [] },
    fields: [],
  };
}

export function createNote(
  position: { x: number; y: number } = { x: 0, y: 0 },
  content = "",
): Note {
  return {
    id: createId(),
    x: position.x,
    y: position.y,
    title: "Note",
    content,
  };
}

export function createArea(
  name: string,
  position: { x: number; y: number } = { x: 0, y: 0 },
  description?: string,
): Area {
  return {
    id: createId(),
    name,
    description,
    x: position.x,
    y: position.y,
    width: 240,
    height: 160,
  };
}

/**
 * Whether an element sits in an area.
 *
 * The membership rule is geometric: an element belongs to an area when the
 * rectangle of the area and the rectangle of the element overlap. The rule is
 * read from the places of the elements, so that it needs no field in the
 * model and stays true to the drawing.
 *
 * The overlap of the two rectangles, and not the corner of the element, is
 * the rule that answers the question the user asks: an element that lies in
 * an area belongs to it, even when it hangs over the edge of the area. A rule
 * of the corner alone would leave such an element outside of the area, and a
 * table that is drawn in an area would not fold with it.
 */
export function areaHolds(
  area: Area,
  element: { x: number; y: number; width?: number; height?: number },
): boolean {
  const width = element.width ?? 0;
  const height = element.height ?? 0;
  // An element without a size is a point: the rule of the point is the rule
  // of the corner, and the corner lies in the area when it is in the area.
  if (width <= 0 && height <= 0) {
    return (
      element.x >= area.x &&
      element.x <= area.x + area.width &&
      element.y >= area.y &&
      element.y <= area.y + area.height
    );
  }
  return (
    element.x < area.x + area.width &&
    element.x + width > area.x &&
    element.y < area.y + area.height &&
    element.y + height > area.y
  );
}

/**
 * Whether an element is held by a collapsed area, and is hidden with it.
 *
 * A collapsed area draws only its title bar, so the elements it holds are not
 * drawn at all — otherwise they would float over the canvas around the
 * folded bar.
 */
export function heldByCollapsedArea(
  areas: readonly Area[],
  element: { x: number; y: number; width?: number; height?: number },
): boolean {
  return areas.some(
    (area) => area.collapsed === true && areaHolds(area, element),
  );
}

/**
 * Whether an element is held by a locked area, and is read-only with it.
 *
 * The lock of an area extends to the elements the area holds, the way the
 * collapse extends to them: an element that a locked area holds is treated as
 * locked itself, so that it cannot be moved, resized or edited while the area
 * around it is locked.
 */
export function heldByLockedArea(
  areas: readonly Area[],
  element: { x: number; y: number; width?: number; height?: number },
): boolean {
  return areas.some((area) => area.locked === true && areaHolds(area, element));
}

/**
 * The rectangle of an element of the canvas, in the coordinates of the canvas.
 *
 * The membership rule of an area needs the size of the element and not only
 * its corner, so that an element that lies in an area belongs to it. The size
 * of a table follows its fields, the size of a note and of a view is the one
 * they store, with the default of the canvas when they store none.
 */
export function elementBounds(element: {
  x: number;
  y: number;
  width?: number;
  height?: number;
}): { x: number; y: number; width: number; height: number } {
  if ("fields" in element) {
    const table = element as Table;
    return {
      x: table.x,
      y: table.y,
      width: tableWidth(table),
      height: tableHeight(table),
    };
  }
  if ("content" in element || "title" in element) {
    const note = element as Note;
    return {
      x: note.x,
      y: note.y,
      width: note.width && note.width > 0 ? note.width : DEFAULT_NOTE_WIDTH,
      height:
        note.height && note.height > 0 ? note.height : DEFAULT_NOTE_HEIGHT,
    };
  }
  if ("baseTableId" in element) {
    const view = element as View;
    return {
      x: view.x,
      y: view.y,
      width: view.width && view.width > 0 ? view.width : DEFAULT_VIEW_WIDTH,
      height: DEFAULT_VIEW_HEIGHT,
    };
  }
  return {
    x: element.x,
    y: element.y,
    width: element.width ?? 0,
    height: element.height ?? 0,
  };
}

/**
 * Whether an area holds an element of the canvas.
 *
 * The size of the element is taken from its own shape, so that a table that
 * hangs over the edge of an area still belongs to it.
 */
export function areaHoldsElement(
  area: Area,
  element: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  },
): boolean {
  return areaHolds(area, elementBounds(element));
}

/**
 * Whether one area nests another one.
 *
 * Two areas overlap for many reasons — a reader drags one across the other, or
 * a diagram lays them side by side — so an area only carries another one along
 * when that one lies wholly inside it. Rectangles that are exactly the same are
 * siblings too: neither of them could ever be dragged away from the other.
 */
export function areaNests(
  area: { x: number; y: number; width: number; height: number },
  other: { x: number; y: number; width?: number; height?: number },
): boolean {
  const width = other.width ?? 0;
  const height = other.height ?? 0;
  const same =
    other.x === area.x &&
    other.y === area.y &&
    width === area.width &&
    height === area.height;
  if (same) {
    return false;
  }
  return (
    other.x >= area.x &&
    other.y >= area.y &&
    other.x + width <= area.x + area.width &&
    other.y + height <= area.y + area.height
  );
}

/** The opacity of the background fill of an area that does not set one. */
export const DEFAULT_AREA_OPACITY = 0.08;

/**
 * A color with an opacity, as an `rgba()` string.
 *
 * The canvas stores colors as hex strings (`#rgb` or `#rrggbb`); the fill of
 * an area softens the color with an opacity, so the hex is split into its
 * channels. A color that is not a hex string is returned unchanged.
 */
export function withOpacity(color: string, opacity: number): string {
  const hex = color.replace("#", "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) {
    return color;
  }
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : hex;
  const red = parseInt(full.slice(0, 2), 16);
  const green = parseInt(full.slice(2, 4), 16);
  const blue = parseInt(full.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

/**
 * A relationship between two tables.
 *
 * The endpoints are filled in by the editor as soon as the user picks the
 * tables, the default points at the first two tables of the diagram.
 */
export function createRelationship(
  startTableId: string,
  endTableId: string,
  startFieldId: string,
  endFieldId: string,
): Relationship {
  return {
    id: createId(),
    name: `fk_${startTableId}_${endTableId}`,
    startTableId,
    endTableId,
    startFieldId,
    endFieldId,
    cardinality: "many_to_one",
  };
}
