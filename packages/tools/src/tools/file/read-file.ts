import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

export function createReadFileTool(): Tool {
  return new DefaultTool(
    "read_file",
    "Read the contents of a file at the given path. Returns the file content as a string.",
    async (input) => {
      const filePath = input.path as string;

      if (!filePath) {
        return { success: false, output: { error: "Path is required" } };
      }

      try {
        const resolved = path.resolve(filePath);
        const content = await fs.readFile(resolved, "utf-8");
        return { success: true, output: { content, path: resolved } };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return { success: false, output: { error: message } };
      }
    },
  );
}
