import type { Command } from "./command.ts";

export interface CommandManagerState {
  undoStack: readonly Command[];
  redoStack: readonly Command[];
}

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoDescription(): string | undefined {
    return this.undoStack.at(-1)?.description;
  }

  get redoDescription(): string | undefined {
    return this.redoStack.at(-1)?.description;
  }

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;
    command.undo();
    this.redoStack.push(command);
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;
    if (command.redo) {
      command.redo();
    } else {
      command.execute();
    }
    this.undoStack.push(command);
    return true;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Moves the history to the position `depth` entries are applied, undoing or
   * redoing the commands in between (the history tab clicks a row).
   *
   * `depth` is the length the undo stack should have: 0 is the state before
   * the first command, `snapshot().undoStack.length` is the current state. A
   * depth beyond what the stacks can reach is clamped, and the return value
   * says whether the move landed exactly there.
   */
  jumpTo(depth: number): boolean {
    const wanted = Math.trunc(depth);
    const reachable = this.undoStack.length + this.redoStack.length;
    const target = Math.max(0, Math.min(wanted, reachable));
    while (this.undoStack.length > target) {
      if (!this.undo()) return false;
    }
    while (this.undoStack.length < target) {
      if (!this.redo()) return false;
    }
    // The position is reached exactly when it was reachable at all: a depth
    // beyond the history lands on the closest one, and says so.
    return target === wanted;
  }

  snapshot(): CommandManagerState {
    return {
      undoStack: Object.freeze([...this.undoStack]),
      redoStack: Object.freeze([...this.redoStack]),
    };
  }
}
