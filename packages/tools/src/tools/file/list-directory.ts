import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

export function createListDirectoryTool(): Tool {
  return new DefaultTool(
    "list_directory",
    "List files and directories at the given path. Returns names and types (file or directory).",
    async (input) => {
      const dirPath = (input.path as string) || ".";

      try {
        const resolved = path.resolve(dirPath);
        const entries = await fs.readdir(resolved, { withFileTypes: true });

        const items = entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? "directory" : "file",
        }));

        return { success: true, output: { path: resolved, items } };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return { success: false, output: { error: message } };
      }
    },
  );
}
