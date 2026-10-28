import type { useDiagramStore } from "../../stores/diagram.ts";
import type { OutlineNode } from "./outline-model.ts";
import type { OutlineViewLayer } from "./outline-model.ts";

/**
 * The context-menu actions of the outline tree (plan Task 2), kept out of
 * the component so it stays small. The rename writes the name of the
 * current view layer (logical or physical); the delete goes through the
 * existing diagram-store commands — `removeField` deletes the logical
 * attribute with the physical field atomically.
 */

type DiagramStore = ReturnType<typeof useDiagramStore>;

/** Renames the node on the current view layer; an empty name is a no-op. */
export function renameOutlineNode(
  store: DiagramStore,
  node: OutlineNode,
  value: string,
  layer: OutlineViewLayer,
): void {
  const name = value.trim();
  if (!name || name === node.label) return;
  switch (node.kind) {
    case "table": {
      const table = store.tableById(node.refId!);
      if (!table) return;
      if (layer === "logical") {
        store.updateTable(node.refId!, { logical: { ...table.logical, name } });
      } else {
        store.updateTable(node.refId!, { name });
      }
      return;
    }
    case "field": {
      const table = store.tableById(node.parentRefId!);
      if (!table) return;
      if (layer === "logical") {
        store.updateTable(node.parentRefId!, {
          logical: {
            ...table.logical,
            attributes: table.logical.attributes.map((attribute) =>
              attribute.fieldId === node.refId ? { ...attribute, name } : attribute,
            ),
          },
        });
      } else {
        store.updateField(node.parentRefId!, node.refId!, { name });
      }
      return;
    }
    case "relationship":
      // TODO: the logical name of a relationship has no store command yet;
      // the rename writes the physical name on both layers for now.
      store.updateRelationship(node.refId!, { name });
      return;
    case "area":
      store.updateArea(node.refId!, { name });
      return;
    case "note":
      store.updateNote(node.refId!, { title: name });
      return;
    case "view":
      store.updateView(node.refId!, { name });
      return;
    case "enum":
      store.updateEnum(node.refId!, { name });
      return;
    case "type":
      store.updateType(node.refId!, { name });
  }
}

/** Deletes the node through the existing diagram-store commands. */
export function deleteOutlineNode(store: DiagramStore, node: OutlineNode): void {
  switch (node.kind) {
    case "table":
    case "area-table":
      store.removeTable(node.refId!);
      return;
    case "field":
      store.removeField(node.parentRefId!, node.refId!);
      return;
    case "relationship":
      store.removeRelationship(node.refId!);
      return;
    case "area":
      store.removeEntity(store.diagram.areas ? "areas" : "subjectAreas", node.refId);
      return;
    case "note":
      store.removeEntity("notes", node.refId);
      return;
    case "view":
      store.removeView(node.refId!);
      return;
    case "enum":
      store.removeEnum(node.refId!);
      return;
    case "type":
      store.removeType(node.refId!);
  }
}
