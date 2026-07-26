import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const CRON_FILE = path.join(os.homedir(), ".ai-agent", "cron.json");

interface CronJob {
  id: string;
  schedule: string;
  command: string;
  description: string;
  created: string;
  lastRun?: string;
}

function loadJobs(): CronJob[] {
  try {
    const dir = path.dirname(CRON_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(CRON_FILE)) {
      return JSON.parse(fs.readFileSync(CRON_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveJobs(jobs: CronJob[]): void {
  const dir = path.dirname(CRON_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CRON_FILE, JSON.stringify(jobs, null, 2));
}

export function createCronTool(): Tool {
  return new DefaultTool(
    "cron",
    "Schedule recurring tasks using cron syntax. Add, list, remove, or run scheduled jobs. Examples: 'add 0 9 * * * echo hello' to run daily at 9am.",
    async (input) => {
      const action = (input.action as string) || "list";
      const schedule = (input.schedule as string) || "";
      const command = (input.command as string) || "";
      const description = (input.description as string) || "";
      const jobId = (input.id as string) || "";

      try {
        switch (action) {
          case "add": {
            if (!schedule || !command) {
              return {
                success: false,
                output: { error: "Schedule (cron) and command are required" },
              };
            }

            const job: CronJob = {
              id: `cron_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              schedule,
              command,
              description: description || `Run: ${command}`,
              created: new Date().toISOString(),
            };

            const jobs = loadJobs();
            jobs.push(job);
            saveJobs(jobs);

            // Also add to system crontab
            const { execSync } = await import("node:child_process");
            const cronLine = `${schedule} ${command} # ${job.id}`;
            try {
              const existing = execSync("crontab -l 2>/dev/null || true", {
                encoding: "utf-8",
              });
              const newCrontab = `${existing.trim()}\n${cronLine}`;
              execSync(`echo ${JSON.stringify(newCrontab)} | crontab -`, {
                encoding: "utf-8",
              });
            } catch {
              // System crontab might not be available
            }

            return {
              success: true,
              output: {
                job,
                message: `Scheduled: "${schedule}" → ${command}`,
              },
            };
          }

          case "list": {
            const jobs = loadJobs();
            return {
              success: true,
              output: {
                jobs,
                count: jobs.length,
              },
            };
          }

          case "remove": {
            if (!jobId) {
              return { success: false, output: { error: "Job ID is required" } };
            }

            const jobs = loadJobs();
            const filtered = jobs.filter((j) => j.id !== jobId);

            if (filtered.length === jobs.length) {
              return {
                success: false,
                output: { error: `Job not found: ${jobId}` },
              };
            }

            saveJobs(filtered);

            return {
              success: true,
              output: {
                removed: true,
                id: jobId,
                remaining: filtered.length,
              },
            };
          }

          case "run": {
            if (!jobId) {
              return { success: false, output: { error: "Job ID is required" } };
            }

            const jobs = loadJobs();
            const job = jobs.find((j) => j.id === jobId);

            if (!job) {
              return {
                success: false,
                output: { error: `Job not found: ${jobId}` },
              };
            }

            const { execSync } = await import("node:child_process");
            const output = execSync(job.command, {
              encoding: "utf-8",
              timeout: 30000,
            });

            job.lastRun = new Date().toISOString();
            saveJobs(jobs);

            return {
              success: true,
              output: {
                job,
                output: output.trim(),
              },
            };
          }

          default:
            return {
              success: false,
              output: {
                error: `Unknown action: ${action}. Available: add, list, remove, run`,
              },
            };
        }
      } catch (error) {
        return {
          success: false,
          output: {
            error: error instanceof Error ? error.message : String(error),
            action,
          },
        };
      }
    },
  );
}
