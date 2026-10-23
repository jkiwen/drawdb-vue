import type { Diagram } from "../models/diagram.ts";

export interface Command {
  execute(): void;
  undo(): void;
  redo?(): void;
  readonly description: string;
}

export function isCommand(value: unknown): value is Command {
  return (
    typeof value === "object" &&
    value !== null &&
    "execute" in value &&
    typeof (value as Command).execute === "function" &&
    "undo" in value &&
    typeof (value as Command).undo === "function" &&
    "description" in value &&
    typeof (value as Command).description === "string"
  );
}

export type DiagramTarget = Diagram;
