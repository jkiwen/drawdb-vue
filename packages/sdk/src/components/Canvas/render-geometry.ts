import type {
  FieldId,
  Relationship,
  Table,
  ViewLayer,
  ViewStateToggles,
} from "@drawdb/core";
import {
  TABLE_FIELD_HEIGHT,
  type Bounds,
  type GeometryPoint,
} from "./geometry.ts";
import { nearestEdgeSide, type EdgeAnchor } from "./relationship-geometry.ts";
import {
  tableRenderModel,
  type TableRenderModel,
  type TableRenderOptions,
} from "./render-model.ts";

/**
 * The canvas geometry of the render model (UI document section 6.1).
 *
 * The boxes and the anchors of the canvas are measured with the render
 * model, so the virtualization, the relationship anchors and the obstacles
 * all agree with what the table node draws in the layer with the display
 * toggles. The legacy helpers of geometry.ts keep measuring the physical
 * table with every field, for the callers that are not layer-aware yet.
 */

/**
 * The bounds a table occupies on the canvas in a layer with the given
 * display toggles. The virtualization, the minimap and the selection box
 * cull and hit-test with these bounds, so they must match what the table
 * draws.
 */
export function tableRenderBounds(
  table: Table,
  layer: ViewLayer,
  toggles: ViewStateToggles,
  options?: TableRenderOptions,
): Bounds {
  const model = tableRenderModel(table, layer, toggles, options);
  return {
    minX: table.x,
    minY: table.y,
    maxX: table.x + model.width,
    maxY: table.y + model.height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The point where a relationship attaches to a table drawn by a render
 * model, on the edge nearest to the other end.
 *
 * The left and right edges anchor on the row of the field the relationship
 * points at — in either layer, the row is found by the physical field id
 * the attribute maps to. When the row is not drawn (the fields are hidden,
 * the field is unknown, the table is collapsed) the anchor clamps to the
 * edge across from the other end.
 */
export function renderEdgeAnchor(
  table: Table,
  model: TableRenderModel,
  fieldId: FieldId,
  toward: GeometryPoint,
): EdgeAnchor {
  const bounds: Bounds = {
    minX: table.x,
    minY: table.y,
    maxX: table.x + model.width,
    maxY: table.y + model.height,
  };
  const side = nearestEdgeSide(bounds, toward);
  if (side === "left" || side === "right") {
    const x = side === "right" ? bounds.maxX : bounds.minX;
    const index = table.collapsed
      ? -1
      : model.rows.findIndex(
          (row) =>
            row.fieldId !== undefined &&
            String(row.fieldId) === String(fieldId),
        );
    if (index >= 0) {
      return {
        x,
        y:
          table.y +
          model.headerHeight +
          index * TABLE_FIELD_HEIGHT +
          TABLE_FIELD_HEIGHT / 2,
        side,
      };
    }
    return { x, y: clamp(toward.y, bounds.minY, bounds.maxY), side };
  }
  return {
    x: clamp(toward.x, bounds.minX, bounds.maxX),
    y: side === "top" ? bounds.minY : bounds.maxY,
    side,
  };
}

/**
 * The bounds a relationship occupies in a layer, from the anchors of its
 * two ends. The virtualization of the canvas culls the relationships with
 * them.
 */
export function renderRelationshipBounds(
  relationship: Relationship,
  startTable: Table,
  endTable: Table,
  layer: ViewLayer,
  toggles: ViewStateToggles,
  options?: { start?: TableRenderOptions; end?: TableRenderOptions },
): Bounds {
  const startModel = tableRenderModel(startTable, layer, toggles, options?.start);
  const endModel = tableRenderModel(endTable, layer, toggles, options?.end);
  const endCenter = {
    x: endTable.x + endModel.width / 2,
    y: endTable.y + endModel.height / 2,
  };
  const startCenter = {
    x: startTable.x + startModel.width / 2,
    y: startTable.y + startModel.height / 2,
  };
  const start = renderEdgeAnchor(
    startTable,
    startModel,
    relationship.startFieldId,
    endCenter,
  );
  const end = renderEdgeAnchor(
    endTable,
    endModel,
    relationship.endFieldId,
    startCenter,
  );
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  };
}
