import type { Command } from "./command.ts";

/**
 * Several changes that the history records and takes back as one.
 *
 * The drag of an area moves the tables that sit in it with the area, so the
 * undo of that drag has to put all of them back at once: the command of every
 * element of the drag is wrapped in one command of the history.
 */
export class CompositeCommand implements Command {
  readonly description: string;
  private readonly commands: readonly Command[];

  constructor(description: string, commands: readonly Command[]) {
    this.description = description;
    this.commands = commands;
  }

  execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  undo(): void {
    for (const command of [...this.commands].reverse()) {
      command.undo();
    }
  }
}
