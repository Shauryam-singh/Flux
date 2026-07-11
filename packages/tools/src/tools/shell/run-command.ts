import { exec } from "node:child_process";
import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

const MAX_OUTPUT_LENGTH = 10000;

export function createRunCommandTool(): Tool {
  return new DefaultTool(
    "run_command",
    "Execute a shell command and return the output. Use this to run build commands, git operations, or any terminal command.",
    async (input) => {
      const command = input.command as string;
      const cwd = (input.cwd as string) || process.cwd();
      const timeout = (input.timeout as number) || 30000;

      if (!command) {
        return { success: false, output: { error: "Command is required" } };
      }

      return new Promise((resolve) => {
        exec(
          command,
          { cwd, timeout, maxBuffer: 1024 * 1024 },
          (error, stdout, stderr) => {
            let output = stdout || "";
            let errorOutput = stderr || "";

            if (output.length > MAX_OUTPUT_LENGTH) {
              output = `${output.slice(0, MAX_OUTPUT_LENGTH)}\n... (truncated)`;
            }

            if (errorOutput.length > MAX_OUTPUT_LENGTH) {
              errorOutput = `${errorOutput.slice(0, MAX_OUTPUT_LENGTH)}\n... (truncated)`;
            }

            if (error) {
              resolve({
                success: false,
                output: {
                  exitCode: error.code ?? 1,
                  stdout: output,
                  stderr: errorOutput,
                  error: error.message,
                },
              });
              return;
            }

            resolve({
              success: true,
              output: {
                exitCode: 0,
                stdout: output,
                stderr: errorOutput,
              },
            });
          },
        );
      });
    },
  );
}
