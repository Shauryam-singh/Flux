import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

export function createProcessMonitorTool(): Tool {
  return new DefaultTool(
    "process_monitor",
    "Monitor and manage running processes. List processes, check status, or kill processes by name or PID.",
    async (input) => {
      const { execSync } = await import("node:child_process");
      const action = (input.action as string) || "list";
      const query = (input.query as string) || "";
      const signal = (input.signal as string) || "SIGTERM";

      try {
        switch (action) {
          case "list": {
            const filter = query ? ` | grep -i "${query}"` : "";
            const output = execSync(
              `ps aux --sort=-%mem${filter} | head -20`,
              { encoding: "utf-8", timeout: 10000 },
            );
            return {
              success: true,
              output: {
                processes: output.trim().split("\n"),
                count: output.trim().split("\n").length,
              },
            };
          }

          case "count": {
            const output = execSync("ps aux | wc -l", {
              encoding: "utf-8",
              timeout: 10000,
            });
            return {
              success: true,
              output: {
                totalProcesses: parseInt(output.trim(), 10) - 1,
              },
            };
          }

          case "status": {
            const pid = input.pid as string;
            if (!pid) {
              return { success: false, output: { error: "PID is required for status check" } };
            }
            const output = execSync(`ps -p ${pid} -o pid,stat,etime,cmd`, {
              encoding: "utf-8",
              timeout: 10000,
            });
            return {
              success: true,
              output: {
                process: output.trim(),
                pid,
                running: output.includes(pid),
              },
            };
          }

          case "kill": {
            const target = (input.target as string) || query;
            if (!target) {
              return { success: false, output: { error: "Target (PID or name) is required" } };
            }

            // Safety: don't kill critical processes
            const dangerous = ["systemd", "kernel", "init", "ssh", "bash", "zsh"];
            if (dangerous.some((p) => target.toLowerCase().includes(p))) {
              return {
                success: false,
                output: {
                  error: "Cannot kill critical system process",
                  target,
                },
              };
            }

            const sigArg = signal === "SIGKILL" ? "-9" : "";
            execSync(`kill ${sigArg} ${target}`, { encoding: "utf-8", timeout: 10000 });
            return {
              success: true,
              output: {
                killed: true,
                target,
                signal,
              },
            };
          }

          default:
            return {
              success: false,
              output: {
                error: `Unknown action: ${action}. Available: list, count, status, kill`,
              },
            };
        }
      } catch (error) {
        return {
          success: false,
          output: {
            error: error instanceof Error ? error.message : String(error),
            action,
            query,
          },
        };
      }
    },
  );
}
