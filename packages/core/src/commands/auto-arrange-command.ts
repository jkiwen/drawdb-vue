import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";

/** The coordinates of one table on the canvas. */
export interface TablePosition {
  x: number;
  y: number;
}

/**
 * Moves the tables of the diagram to the coordinates of an automatic layout.
 *
 * The command receives the coordinates of the layout and the coordinates that
 * the tables had before, so that the undo restores them.
 */
export class AutoArrangeCommand implements Command {
  private readonly diagram: Diagram;
  private readonly positions: TablePosition[];
  private readonly previous: TablePosition[];

  constructor(
    diagram: Diagram,
    positions: TablePosition[],
    previous: TablePosition[],
  ) {
    this.diagram = diagram;
    this.positions = positions;
    this.previous = previous;
  }

  get description(): string {
    return "Arrange the tables";
  }

  execute(): void {
    this.diagram.tables.forEach((table, index) => {
      const position = this.positions[index];
      if (!position) return;
      table.x = position.x;
      table.y = position.y;
    });
  }

  undo(): void {
    this.diagram.tables.forEach((table, index) => {
      const position = this.previous[index];
      if (!position) return;
      table.x = position.x;
      table.y = position.y;
    });
  }
}
