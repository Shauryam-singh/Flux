import * as fs from "node:fs";
import * as path from "node:path";
import { paint, theme } from "../ui/theme.js";

interface UndoEntry {
  type: "create" | "edit" | "delete";
  path: string;
  oldContent?: string;
  newContent?: string;
  timestamp: Date;
}

class UndoManager {
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private maxHistory = 50;

  record(entry: { type: "create" | "edit" | "delete"; path: string; oldContent?: string; newContent?: string }): void {
    this.undoStack.push({ ...entry, timestamp: new Date() });
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  async undo(): Promise<{ success: boolean; message: string }> {
    const entry = this.undoStack.pop();
    if (!entry) {
      return { success: false, message: "Nothing to undo" };
    }

    try {
      switch (entry.type) {
        case "create":
          if (fs.existsSync(entry.path)) {
            fs.unlinkSync(entry.path);
          }
          this.redoStack.push(entry);
          return { success: true, message: `Undid creation of ${path.basename(entry.path)}` };

        case "delete":
          if (entry.oldContent !== undefined) {
            const dir = path.dirname(entry.path);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(entry.path, entry.oldContent);
          }
          this.redoStack.push(entry);
          return { success: true, message: `Restored ${path.basename(entry.path)}` };

        case "edit":
          if (entry.oldContent !== undefined) {
            fs.writeFileSync(entry.path, entry.oldContent);
          }
          this.redoStack.push(entry);
          return { success: true, message: `Undid edit to ${path.basename(entry.path)}` };
      }
    } catch (err) {
      return { success: false, message: `Undo failed: ${err}` };
    }

    return { success: false, message: "Unknown undo type" };
  }

  async redo(): Promise<{ success: boolean; message: string }> {
    const entry = this.redoStack.pop();
    if (!entry) {
      return { success: false, message: "Nothing to redo" };
    }

    try {
      switch (entry.type) {
        case "create":
          if (entry.newContent !== undefined) {
            const dir = path.dirname(entry.path);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(entry.path, entry.newContent);
          }
          this.undoStack.push(entry);
          return { success: true, message: `Redid creation of ${path.basename(entry.path)}` };

        case "delete":
          if (fs.existsSync(entry.path)) {
            fs.unlinkSync(entry.path);
          }
          this.undoStack.push(entry);
          return { success: true, message: `Redid deletion of ${path.basename(entry.path)}` };

        case "edit":
          if (entry.newContent !== undefined) {
            fs.writeFileSync(entry.path, entry.newContent);
          }
          this.undoStack.push(entry);
          return { success: true, message: `Redid edit to ${path.basename(entry.path)}` };
      }
    } catch (err) {
      return { success: false, message: `Redo failed: ${err}` };
    }

    return { success: false, message: "Unknown redo type" };
  }

  getHistory(): UndoEntry[] {
    return [...this.undoStack];
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export const undoManager = new UndoManager();

export function recordFileOperation(
  type: "create" | "edit" | "delete",
  filePath: string,
  oldContent?: string,
  newContent?: string
): void {
  const entry: { type: "create" | "edit" | "delete"; path: string; oldContent?: string; newContent?: string } = {
    type,
    path: filePath,
  };
  if (oldContent !== undefined) entry.oldContent = oldContent;
  if (newContent !== undefined) entry.newContent = newContent;
  undoManager.record(entry);
}

export async function handleUndo(printFn?: (text: string) => void): Promise<void> {
  const result = await undoManager.undo();
  const log = printFn || console.log;
  if (result.success) {
    log(paint(`  ↩ ${result.message}`, theme.success));
  } else {
    log(paint(`  ${result.message}`, theme.warning));
  }
}

export async function handleRedo(printFn?: (text: string) => void): Promise<void> {
  const result = await undoManager.redo();
  const log = printFn || console.log;
  if (result.success) {
    log(paint(`  ↪ ${result.message}`, theme.success));
  } else {
    log(paint(`  ${result.message}`, theme.warning));
  }
}
