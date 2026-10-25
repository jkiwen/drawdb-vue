import {
  AddEntityCommand,
  RemoveEntityCommand,
  UpdateEntityCommand,
} from "@drawdb/core";
import type { Diagram, DiagramEntityCollection } from "@drawdb/core";

/**
 * The actions the side panel writes the views, the types and the enums with.
 *
 * The three collections share one shape, so one action per verb and
 * collection covers all nine of them. Every action runs one command of the
 * history and bumps the revision, which is what makes the renderers of the
 * store see the new state.
 *
 * They live in their own file, so that the store of the diagram stays a file
 * of the size the repository allows.
 */
export function sidePanelActions(
  diagram: Diagram,
  history: { execute(command: unknown): void },
  bump: () => void,
) {
  const action = (
    collection: DiagramEntityCollection,
    verb: "add" | "update" | "remove",
  ) => (target: unknown, updates?: unknown) => {
    history.execute(
      verb === "add"
        ? new AddEntityCommand(
            diagram,
            collection,
            target as { id?: string | number; name?: string },
          )
        : verb === "update"
          ? new UpdateEntityCommand(
              diagram,
              collection,
              target as string | number,
              updates as Record<string, unknown>,
            )
          : new RemoveEntityCommand(
              diagram,
              collection,
              target as string | number | undefined,
            ),
    );
    bump();
  };

  return {
    addView: action("views", "add"),
    updateView: action("views", "update"),
    removeView: action("views", "remove"),
    addType: action("types", "add"),
    updateType: action("types", "update"),
    removeType: action("types", "remove"),
    addEnum: action("enums", "add"),
    updateEnum: action("enums", "update"),
    removeEnum: action("enums", "remove"),
  };
}
