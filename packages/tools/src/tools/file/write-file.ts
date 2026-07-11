import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

export function createWriteFileTool(): Tool {
  return new DefaultTool(
    "write_file",
    "Write content to a file at the given path. Creates the file and any necessary directories.",
    async (input) => {
      const filePath = input.path as string;
      const content = input.content as string;

      if (!filePath) {
        return { success: false, output: { error: "Path is required" } };
      }

      if (content === undefined || content === null) {
        return { success: false, output: { error: "Content is required" } };
      }

      try {
        const resolved = path.resolve(filePath);
        const dir = path.dirname(resolved);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(resolved, content, "utf-8");
        return {
          success: true,
          output: { path: resolved, bytesWritten: content.length },
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return { success: false, output: { error: message } };
      }
    },
  );
}
