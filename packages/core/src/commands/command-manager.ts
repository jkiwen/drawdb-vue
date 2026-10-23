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

  snapshot(): CommandManagerState {
    return {
      undoStack: Object.freeze([...this.undoStack]),
      redoStack: Object.freeze([...this.redoStack]),
    };
  }
}
