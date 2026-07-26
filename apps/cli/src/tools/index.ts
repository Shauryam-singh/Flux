import type { Tool } from "@ai-agent/tools";
import { undoManager } from "./undo.js";
import { withRetry } from "./error-recovery.js";
import {
  replaceFunction,
  addImport,
  removeImport,
} from "./code-edit.js";
import {
  getSupportedFrameworks,
  generateProjectFromDescription,
  formatScaffoldResult,
} from "./scaffold.js";
import {
  autoCommit,
  formatCommitResult,
} from "./git-commit.js";

export function createUndoTool(): Tool {
  return {
    name: "undo",
    description: "Undo the last file operation",
    execute: async () => {
      const result = await undoManager.undo();
      return { success: result.success, output: result.message };
    },
  };
}

export function createRedoTool(): Tool {
  return {
    name: "redo",
    description: "Redo the last undone file operation",
    execute: async () => {
      const result = await undoManager.redo();
      return { success: result.success, output: result.message };
    },
  };
}

export function createEditFunctionTool(): Tool {
  return {
    name: "edit_function",
    description: "Replace a specific function in a file with new code",
    execute: async (input: unknown) => {
      const args = input as { file: string; function_name: string; new_code: string };
      const fs = await import("node:fs");
      
      const result = await withRetry(async () => {
        if (!fs.existsSync(args.file)) {
          throw new Error(`File not found: ${args.file}`);
        }

        const content = fs.readFileSync(args.file, "utf-8");
        const newContent = replaceFunction(content, args.function_name, args.new_code);

        if (!newContent) {
          throw new Error(`Function "${args.function_name}" not found in ${args.file}`);
        }

        fs.writeFileSync(args.file, newContent);
        return `Replaced function "${args.function_name}"`;
      });

      if (result.error) {
        return { success: false, output: result.error };
      }
      return { success: true, output: result.result };
    },
  };
}

export function createAddImportTool(): Tool {
  return {
    name: "add_import",
    description: "Add an import statement to a file",
    execute: async (input: unknown) => {
      const args = input as { file: string; import: string };
      const fs = await import("node:fs");
      
      const result = await withRetry(async () => {
        if (!fs.existsSync(args.file)) {
          throw new Error(`File not found: ${args.file}`);
        }

        const content = fs.readFileSync(args.file, "utf-8");
        const newContent = addImport(content, args.import);
        fs.writeFileSync(args.file, newContent);
        return `Added import: ${args.import}`;
      });

      if (result.error) {
        return { success: false, output: result.error };
      }
      return { success: true, output: result.result };
    },
  };
}

export function createRemoveImportTool(): Tool {
  return {
    name: "remove_import",
    description: "Remove an import statement from a file",
    execute: async (input: unknown) => {
      const args = input as { file: string; module: string };
      const fs = await import("node:fs");
      
      const result = await withRetry(async () => {
        if (!fs.existsSync(args.file)) {
          throw new Error(`File not found: ${args.file}`);
        }

        const content = fs.readFileSync(args.file, "utf-8");
        const newContent = removeImport(content, args.module);
        fs.writeFileSync(args.file, newContent);
        return `Removed import for "${args.module}"`;
      });

      if (result.error) {
        return { success: false, output: result.error };
      }
      return { success: true, output: result.result };
    },
  };
}

export function createScaffoldTool(): Tool {
  return {
    name: "scaffold",
    description: "Create a new project from a template or description. Supports frameworks: react, express, nextjs, node, vue, svelte, fastapi, django, flask, rust, go",
    execute: async (input: unknown) => {
      const args = input as { framework: string; name: string; description: string };
      
      const result = await withRetry(async () => {
        const scaffoldResult = generateProjectFromDescription(
          args.framework,
          args.name,
          args.description || `${args.framework} project`,
          process.cwd()
        );
        return scaffoldResult;
      });

      if (result.error) {
        return { success: false, output: `Scaffold failed: ${result.error}` };
      }
      return { success: true, output: formatScaffoldResult(args.name, result.result!) };
    },
  };
}

export function createListTemplatesTool(): Tool {
  return {
    name: "list_templates",
    description: "List available project frameworks and templates",
    execute: async () => {
      const frameworks = getSupportedFrameworks();
      const output = `Available frameworks:\n${frameworks.map((f) => `  • ${f}`).join("\n")}`;
      return { success: true, output };
    },
  };
}

export function createAutoCommitTool(generateMessage?: (diff: string) => Promise<string>): Tool {
  return {
    name: "auto_commit",
    description: "Stage all changes and commit with an AI-generated message",
    execute: async (input: unknown) => {
      const args = input as { message?: string };
      
      const defaultGenerator = async (diff: string): Promise<string> => {
        const added = diff.split("\n").filter(l => l.startsWith("+") && !l.startsWith("+++")).length;
        const removed = diff.split("\n").filter(l => l.startsWith("-") && !l.startsWith("---")).length;
        const files = diff.split("diff --git").length - 1;
        
        const type = added > 0 && removed === 0 ? "feat" :
                     added === 0 && removed > 0 ? "chore" : "refactor";
        return `${type}: update ${files} file${files !== 1 ? 's' : ''}`;
      };

      const result = await autoCommit(generateMessage || defaultGenerator, args.message);
      return { success: result.success, output: formatCommitResult(result) };
    },
  };
}

export function createRunCommandWithRetryTool(): Tool {
  return {
    name: "run_command_retry",
    description: "Execute a shell command with automatic retry on failure",
    execute: async (input: unknown) => {
      const args = input as { command: string; cwd?: string; maxRetries?: number };
      const { exec } = await import("node:child_process");
      
      const result = await withRetry(async () => {
        return new Promise<string>((resolve, reject) => {
          exec(
            args.command,
            { cwd: args.cwd || process.cwd(), timeout: 30000 },
            (error, stdout, stderr) => {
              if (error) {
                reject(new Error(error.message));
              } else {
                resolve(stdout || stderr);
              }
            }
          );
        });
      }, { maxRetries: args.maxRetries || 2 });

      if (result.error) {
        return { success: false, output: result.error };
      }
      return { success: true, output: result.result };
    },
  };
}
