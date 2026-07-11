import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

export function createEditFileTool(): Tool {
  return new DefaultTool(
    "edit_file",
    "Edit a file by replacing old_string with new_string. Use this for targeted edits to existing files.",
    async (input) => {
      const filePath = input.path as string;
      const oldString = input.old_string as string;
      const newString = input.new_string as string;

      if (!filePath) {
        return { success: false, output: { error: "Path is required" } };
      }

      if (oldString === undefined || oldString === null) {
        return { success: false, output: { error: "old_string is required" } };
      }

      if (newString === undefined || newString === null) {
        return { success: false, output: { error: "new_string is required" } };
      }

      try {
        const resolved = path.resolve(filePath);
        const content = await fs.readFile(resolved, "utf-8");

        if (!content.includes(oldString)) {
          return {
            success: false,
            output: { error: "old_string not found in file" },
          };
        }

        const updated = content.replace(oldString, newString);
        await fs.writeFile(resolved, updated, "utf-8");

        return { success: true, output: { path: resolved } };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return { success: false, output: { error: message } };
      }
    },
  );
}
