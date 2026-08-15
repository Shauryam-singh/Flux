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
      const isWin32 = process.platform === "win32";

      try {
        switch (action) {
          case "list": {
            let output: string;
            if (isWin32) {
              const cmd = query
                ? `powershell -Command "Get-Process -Name '*${query}*' -ErrorAction SilentlyContinue | Sort-Object WorkingSet64 -Descending | Select-Object -First 20 Name, Id, @{N='CPU';E={$_.CPU}}, @{N='Mem(MB)';E={[math]::Round($_.WorkingSet64/1MB)}} | Format-Table -AutoSize | Out-String"`
                : `powershell -Command "Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 20 Name, Id, @{N='CPU';E={$_.CPU}}, @{N='Mem(MB)';E={[math]::Round($_.WorkingSet64/1MB)}} | Format-Table -AutoSize | Out-String"`;
              output = execSync(cmd, { encoding: "utf-8", timeout: 10000 });
            } else {
              const filter = query ? ` | grep -i "${query}"` : "";
              output = execSync(`ps aux --sort=-%mem${filter} | head -20`, { encoding: "utf-8", timeout: 10000 });
            }
            return {
              success: true,
              output: {
                processes: output.trim().split("\n"),
                count: output.trim().split("\n").length,
              },
            };
          }

          case "count": {
            let output: string;
            if (isWin32) {
              output = execSync(`powershell -Command "(Get-Process).Count"`, { encoding: "utf-8", timeout: 10000 });
            } else {
              output = execSync("ps aux | wc -l", { encoding: "utf-8", timeout: 10000 });
            }
            return {
              success: true,
              output: {
                totalProcesses: parseInt(output.trim(), 10) - (isWin32 ? 0 : 1),
              },
            };
          }

          case "status": {
            const pid = input.pid as string;
            if (!pid) {
              return { success: false, output: { error: "PID is required for status check" } };
            }
            let output: string;
            if (isWin32) {
              output = execSync(`powershell -Command "Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, CPU, @{N='Mem(MB)';E={[math]::Round($_.WorkingSet64/1MB)}} | Format-Table -AutoSize | Out-String"`, { encoding: "utf-8", timeout: 10000 });
            } else {
              output = execSync(`ps -p ${pid} -o pid,stat,etime,cmd`, { encoding: "utf-8", timeout: 10000 });
            }
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
            const dangerous = isWin32
              ? ["system", "registry", "csrss", "smss", "wininit", "services"]
              : ["systemd", "kernel", "init", "ssh", "bash", "zsh"];
            if (dangerous.some((p) => target.toLowerCase().includes(p))) {
              return {
                success: false,
                output: {
                  error: "Cannot kill critical system process",
                  target,
                },
              };
            }

            if (isWin32) {
              if (/^\d+$/.test(target)) {
                execSync(`powershell -Command "Stop-Process -Id ${target} -Force -ErrorAction SilentlyContinue"`, { encoding: "utf-8", timeout: 10000 });
              } else {
                execSync(`powershell -Command "Get-Process -Name '*${target}*' -ErrorAction SilentlyContinue | Stop-Process -Force"`, { encoding: "utf-8", timeout: 10000 });
              }
            } else {
              const sigArg = signal === "SIGKILL" ? "-9" : "";
              execSync(`kill ${sigArg} ${target}`, { encoding: "utf-8", timeout: 10000 });
            }
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
