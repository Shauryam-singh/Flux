import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

export function createDockerTool(): Tool {
  return new DefaultTool(
    "docker",
    "Manage Docker containers, images, and compose stacks. Actions: ps, images, pull, run, stop, rm, logs, exec, compose-up, compose-down.",
    async (input) => {
      const { execSync } = await import("node:child_process");
      const action = (input.action as string) || "ps";
      const target = (input.target as string) || "";
      const options = (input.options as string) || "";

      try {
        switch (action) {
          case "ps": {
            const output = execSync("docker ps -a --format 'table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}'", {
              encoding: "utf-8",
              timeout: 15000,
            });
            const containers = output.trim().split("\n").slice(1);
            return {
              success: true,
              output: {
                containers,
                count: containers.length,
              },
            };
          }

          case "images": {
            const output = execSync("docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}'", {
              encoding: "utf-8",
              timeout: 15000,
            });
            const images = output.trim().split("\n").slice(1);
            return {
              success: true,
              output: {
                images,
                count: images.length,
              },
            };
          }

          case "pull": {
            if (!target) {
              return { success: false, output: { error: "Image name is required (e.g. nginx, ubuntu:22.04)" } };
            }
            execSync(`docker pull ${target}`, { encoding: "utf-8", timeout: 120000 });
            return {
              success: true,
              output: { pulled: target },
            };
          }

          case "run": {
            if (!target) {
              return { success: false, output: { error: "Image name is required" } };
            }
            const name = input.name as string || `flux-${Date.now()}`;
            const cmd = `docker run -d --name ${name} ${options} ${target}`;
            const output = execSync(cmd, { encoding: "utf-8", timeout: 60000 });
            return {
              success: true,
              output: {
                containerId: output.trim(),
                name,
                image: target,
              },
            };
          }

          case "stop": {
            if (!target) {
              return { success: false, output: { error: "Container name or ID is required" } };
            }
            execSync(`docker stop ${target}`, { encoding: "utf-8", timeout: 30000 });
            return {
              success: true,
              output: { stopped: target },
            };
          }

          case "rm": {
            if (!target) {
              return { success: false, output: { error: "Container name or ID is required" } };
            }
            execSync(`docker rm ${target}`, { encoding: "utf-8", timeout: 15000 });
            return {
              success: true,
              output: { removed: target },
            };
          }

          case "logs": {
            if (!target) {
              return { success: false, output: { error: "Container name or ID is required" } };
            }
            const lines = (input.lines as number) || 50;
            const output = execSync(`docker logs --tail ${lines} ${target}`, {
              encoding: "utf-8",
              timeout: 15000,
            });
            return {
              success: true,
              output: {
                container: target,
                logs: output.trim().split("\n"),
              },
            };
          }

          case "exec": {
            if (!target || !options) {
              return {
                success: false,
                output: { error: "Container name/ID and command are required" },
              };
            }
            const output = execSync(`docker exec ${target} ${options}`, {
              encoding: "utf-8",
              timeout: 30000,
            });
            return {
              success: true,
              output: {
                container: target,
                output: output.trim(),
              },
            };
          }

          case "compose-up": {
            const dir = target || ".";
            const output = execSync("docker compose up -d", {
              encoding: "utf-8",
              timeout: 120000,
              cwd: dir,
            });
            return {
              success: true,
              output: {
                directory: dir,
                output: output.trim(),
              },
            };
          }

          case "compose-down": {
            const dir = target || ".";
            const output = execSync("docker compose down", {
              encoding: "utf-8",
              timeout: 60000,
              cwd: dir,
            });
            return {
              success: true,
              output: {
                directory: dir,
                output: output.trim(),
              },
            };
          }

          default:
            return {
              success: false,
              output: {
                error: `Unknown action: ${action}. Available: ps, images, pull, run, stop, rm, logs, exec, compose-up, compose-down`,
              },
            };
        }
      } catch (error) {
        return {
          success: false,
          output: {
            error: error instanceof Error ? error.message : String(error),
            action,
            target,
          },
        };
      }
    },
  );
}
