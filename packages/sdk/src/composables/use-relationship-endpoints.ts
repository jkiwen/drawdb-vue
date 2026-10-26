import { computed, type ComputedRef } from "vue";
import type { Area } from "@drawdb/core";
import { areaHoldsElement } from "../utils/elements.ts";
import {
  boundsCenter,
  collapsedAreaAnchor,
  tableBounds,
  type EdgeAnchor,
} from "../components/Canvas/geometry.ts";
import type { useDiagramStore } from "../stores/diagram.ts";

/**
 * The anchors of the relationships with at least one end in a collapsed area.
 *
 * The end the area holds has no table on the canvas to attach to, so the
 * relationship anchors on the title bar of the area instead: a connection
 * that crosses the border of a collapsed area stays drawn, and so does one
 * between two different collapsed areas. A relationship whose both ends fold
 * with the same area is hidden with it and gets no anchor.
 */
export function useRelationshipEndpoints(
  diagram: ReturnType<typeof useDiagramStore>,
  collapsedAreas: ComputedRef<Area[]>,
): ComputedRef<Map<string, { start?: EdgeAnchor; end?: EdgeAnchor }>> {
  return computed(() => {
    const endpoints = new Map<string, { start?: EdgeAnchor; end?: EdgeAnchor }>();
    for (const relationship of diagram.relationships) {
      const startTable = diagram.tableById(relationship.startTableId);
      const endTable = diagram.tableById(relationship.endTableId);
      if (!startTable || !endTable) {
        continue;
      }
      const startArea = collapsedAreas.value.find((area) =>
        areaHoldsElement(area, startTable),
      );
      const endArea = collapsedAreas.value.find((area) =>
        areaHoldsElement(area, endTable),
      );
      // No collapsed end, or both ends in the same collapsed area: nothing to
      // re-anchor (the latter relationship is hidden with the area).
      if (!startArea && !endArea) {
        continue;
      }
      if (startArea && endArea && String(startArea.id) === String(endArea.id)) {
        continue;
      }
      const anchors: { start?: EdgeAnchor; end?: EdgeAnchor } = {};
      if (startArea) {
        anchors.start = collapsedAreaAnchor(
          startArea,
          boundsCenter(tableBounds(endTable)),
        );
      }
      if (endArea) {
        anchors.end = collapsedAreaAnchor(
          endArea,
          boundsCenter(tableBounds(startTable)),
        );
      }
      endpoints.set(String(relationship.id), anchors);
    }
    return endpoints;
  });
}
