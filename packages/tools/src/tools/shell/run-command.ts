import { exec } from "node:child_process";
import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

const MAX_OUTPUT_LENGTH = 10000;

const DANGEROUS_PATTERNS = [
  /\brm\s+-rf?\s+\/\b/i,
  /\brm\s+-rf?\s+\*/i,
  /\bdd\s+if=/i,
  /\bmkfs\b/i,
  /\b:(){ :|:& };:/,
  /\bchmod\s+-R\s+777\s+\//i,
  /\bchown\s+-R\s+.*\//i,
  /\bsudo\s+rm\b/i,
  /\bcurl\b.*\|\s*sh/i,
  /\bwget\b.*\|\s*sh/i,
  /\bmv\s+\/\s+/i,
  /\b>\s+\/dev\/sd[a-z]/i,
  /\bkill\s+-9\s+-1\b/i,
  /\bpkill\s+-9\s+.*\*/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\binit\s+0\b/i,
  /\brmdir\s+\/\b/i,
];

interface CommandCheckResult {
  safe: boolean;
  reason?: string;
}

function checkCommandSafety(command: string): CommandCheckResult {
  const trimmed = command.trim();
  
  if (!trimmed) {
    return { safe: false, reason: "Empty command" };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { 
        safe: false, 
        reason: `Potentially dangerous command detected: ${pattern.source}` 
      };
    }
  }

  const dangerousCommands = ['rm -rf /', 'rm -fr /', 'dd', 'mkfs', ':(){', '> /dev/sd'];
  const lower = trimmed.toLowerCase();
  for (const dangerous of dangerousCommands) {
    if (lower.includes(dangerous)) {
      return { 
        safe: false, 
        reason: `Blocked dangerous command: ${dangerous}` 
      };
    }
  }

  return { safe: true };
}

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

      const safetyCheck = checkCommandSafety(command);
      if (!safetyCheck.safe) {
        return {
          success: false,
          output: {
            error: safetyCheck.reason || "Command blocked for safety",
            command,
          },
        };
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
