import { createId } from "@drawdb/core";
import type { Area, Note, Relationship, Table } from "@drawdb/core";

/**
 * Factories for the elements the editor can create from its toolbars.
 *
 * They keep the default values in one place, so that the header, the side
 * panel and the canvas create the same elements.
 */

/** A name that is not used by one of the existing tables yet. */
export function uniqueTableName(existing: readonly Table[], base = "table"): string {
  const names = new Set(existing.map((table) => table.name.toLowerCase()));
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
  return {
    id: createId(),
    name,
    x: position.x,
    y: position.y,
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
): Area {
  return {
    id: createId(),
    name,
    x: position.x,
    y: position.y,
    width: 240,
    height: 160,
  };
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
