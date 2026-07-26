import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

export function createSystemInfoTool(): Tool {
  return new DefaultTool(
    "system_info",
    "Get system information: CPU, memory, disk, network, hostname, uptime, and platform details.",
    async (input) => {
      const category = (input.category as string) || "all";

      const os = await import("node:os");
      const { execSync } = await import("node:child_process");

      try {
        const info: Record<string, unknown> = {};

        if (category === "all" || category === "cpu") {
          info.cpu = {
            model: os.cpus()[0]?.model || "Unknown",
            cores: os.cpus().length,
            speed: os.cpus()[0]?.speed || 0,
            loadAverage: os.loadavg(),
          };
        }

        if (category === "all" || category === "memory") {
          const totalMem = os.totalmem();
          const freeMem = os.freemem();
          info.memory = {
            total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
            free: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
            used: `${((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(2)} GB`,
            usagePercent: `${(((totalMem - freeMem) / totalMem) * 100).toFixed(1)}%`,
          };
        }

        if (category === "all" || category === "disk") {
          try {
            const diskInfo = execSync("df -h / | tail -1", {
              encoding: "utf-8",
              timeout: 5000,
            });
            const parts = diskInfo.trim().split(/\s+/);
            info.disk = {
              filesystem: parts[0],
              size: parts[1],
              used: parts[2],
              available: parts[3],
              usagePercent: parts[4],
              mountpoint: parts[5],
            };
          } catch {
            info.disk = { error: "Unable to get disk info" };
          }
        }

        if (category === "all" || category === "network") {
          try {
            const hostname = os.hostname();
            const interfaces = os.networkInterfaces();
            const addresses: Record<string, string[]> = {};
            for (const [name, addrs] of Object.entries(interfaces)) {
              if (addrs) {
                addresses[name] = addrs
                  .filter((a) => !a.internal)
                  .map((a) => a.address);
              }
            }
            info.network = { hostname, addresses };
          } catch {
            info.network = { error: "Unable to get network info" };
          }
        }

        if (category === "all" || category === "platform") {
          info.platform = {
            type: os.type(),
            release: os.release(),
            arch: os.arch(),
            uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
            nodeVersion: process.version,
          };
        }

        return {
          success: true,
          output: info,
        };
      } catch (error) {
        return {
          success: false,
          output: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  );
}
