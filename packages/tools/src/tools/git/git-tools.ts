import { execFile } from "node:child_process";
import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

function runGit(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(
      "git",
      args,
      { cwd: cwd || process.cwd(), timeout: 30000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout || "",
          stderr: stderr || "",
          exitCode: error ? (typeof error.code === "number" ? error.code : 1) : 0,
        });
      },
    );
  });
}

export function createGitStatusTool(): Tool {
  return new DefaultTool(
    "git_status",
    "Show the working tree status. Shows which files are modified, staged, or untracked.",
    async (input) => {
      const cwd = (input.cwd as string) || process.cwd();
      const result = await runGit(["status", "--porcelain"], cwd);

      if (result.exitCode !== 0) {
        return { success: false, output: { error: result.stderr || "Not a git repository" } };
      }

      const lines = result.stdout.split("\n").filter((l) => l.trim());
      const files = lines.map((line) => {
        const status = line.substring(0, 2).trim();
        const file = line.substring(3);
        let statusText: string;
        switch (status) {
          case "M": statusText = "modified"; break;
          case "A": statusText = "staged"; break;
          case "D": statusText = "deleted"; break;
          case "??": statusText = "untracked"; break;
          case "R": statusText = "renamed"; break;
          case "C": statusText = "copied"; break;
          default: statusText = status; break;
        }
        return { status: statusText, file };
      });

      return {
        success: true,
        output: {
          branch: (await runGit(["branch", "--show-current"], cwd)).stdout.trim(),
          files,
          summary: lines.length === 0 ? "Working tree clean" : `${lines.length} file(s) changed`,
        },
      };
    },
  );
}

export function createGitDiffTool(): Tool {
  return new DefaultTool(
    "git_diff",
    "Show changes in the working tree. Optionally compare specific files or commits.",
    async (input) => {
      const cwd = (input.cwd as string) || process.cwd();
      const file = input.file as string | undefined;
      const staged = input.staged as boolean | undefined;

      const args = ["diff"];
      if (staged) args.push("--staged");
      if (file) {
        args.push("--");
        args.push(file);
      }

      const result = await runGit(args, cwd);

      if (result.exitCode !== 0 && !result.stdout) {
        return { success: false, output: { error: result.stderr || "No changes or not a git repository" } };
      }

      return {
        success: true,
        output: {
          diff: result.stdout || "No changes",
          file: file || "all files",
          staged: staged || false,
        },
      };
    },
  );
}

export function createGitLogTool(): Tool {
  return new DefaultTool(
    "git_log",
    "Show commit history. Optionally limit to N commits or specific file.",
    async (input) => {
      const cwd = (input.cwd as string) || process.cwd();
      const count = (input.count as number) || 10;
      const file = input.file as string | undefined;

      const args = ["log", "--oneline", `-${count}`];
      if (file) {
        args.push("--");
        args.push(file);
      }

      const result = await runGit(args, cwd);

      if (result.exitCode !== 0) {
        return { success: false, output: { error: result.stderr || "Not a git repository" } };
      }

      const commits = result.stdout.split("\n").filter((l) => l.trim()).map((line) => {
        const [hash, ...rest] = line.split(" ");
        return { hash: hash || "", message: rest.join(" ") };
      });

      return {
        success: true,
        output: {
          commits,
          count: commits.length,
          file: file || "all files",
        },
      };
    },
  );
}

export function createGitAddTool(): Tool {
  return new DefaultTool(
    "git_add",
    "Stage files for commit. Use '.' to stage all files, or specify file paths.",
    async (input) => {
      const cwd = (input.cwd as string) || process.cwd();
      const files = (input.files as string) || ".";

      const result = await runGit(["add", files], cwd);

      if (result.exitCode !== 0) {
        return { success: false, output: { error: result.stderr || "Failed to stage files" } };
      }

      return {
        success: true,
        output: {
          files,
          message: `Staged ${files}`,
        },
      };
    },
  );
}

export function createGitCommitTool(): Tool {
  return new DefaultTool(
    "git_commit",
    "Create a new commit with staged changes.",
    async (input) => {
      const cwd = (input.cwd as string) || process.cwd();
      const message = input.message as string;

      if (!message) {
        return { success: false, output: { error: "Commit message is required" } };
      }

      const result = await runGit(["commit", "-m", message], cwd);

      if (result.exitCode !== 0) {
        return { success: false, output: { error: result.stderr || "Failed to commit" } };
      }

      return {
        success: true,
        output: {
          message,
          output: result.stdout,
        },
      };
    },
  );
}

export function createGitBranchTool(): Tool {
  return new DefaultTool(
    "git_branch",
    "List branches or create a new branch.",
    async (input) => {
      const cwd = (input.cwd as string) || process.cwd();
      const name = input.name as string | undefined;

      if (name) {
        // Create new branch
        const result = await runGit(["branch", name], cwd);
        if (result.exitCode !== 0) {
          return { success: false, output: { error: result.stderr || "Failed to create branch" } };
        }
        return {
          success: true,
          output: { message: `Created branch '${name}'` },
        };
      }

      // List branches
      const result = await runGit(["branch"], cwd);
      if (result.exitCode !== 0) {
        return { success: false, output: { error: result.stderr || "Not a git repository" } };
      }

      const branches = result.stdout.split("\n").filter((l) => l.trim()).map((line) => {
        const isCurrent = line.startsWith("*");
        const name = line.replace(/^\*?\s+/, "").trim();
        return { name, current: isCurrent };
      });

      return {
        success: true,
        output: {
          branches,
          current: branches.find((b) => b.current)?.name || "unknown",
        },
      };
    },
  );
}

export function createGitCheckoutTool(): Tool {
  return new DefaultTool(
    "git_checkout",
    "Switch to a different branch or create a new branch.",
    async (input) => {
      const cwd = (input.cwd as string) || process.cwd();
      const branch = input.branch as string;
      const create = input.create as boolean | undefined;

      if (!branch) {
        return { success: false, output: { error: "Branch name is required" } };
      }

      const args = ["checkout"];
      if (create) args.push("-b");
      args.push(branch);

      const result = await runGit(args, cwd);

      if (result.exitCode !== 0) {
        return { success: false, output: { error: result.stderr || "Failed to checkout" } };
      }

      return {
        success: true,
        output: {
          branch,
          message: create ? `Created and switched to branch '${branch}'` : `Switched to branch '${branch}'`,
        },
      };
    },
  );
}

export function createGitPushTool(): Tool {
  return new DefaultTool(
    "git_push",
    "Push commits to remote repository.",
    async (input) => {
      const cwd = (input.cwd as string) || process.cwd();
      const remote = (input.remote as string) || "origin";
      const branch = input.branch as string | undefined;

      const args = ["push", remote];
      if (branch) args.push(branch);

      const result = await runGit(args, cwd);

      if (result.exitCode !== 0) {
        return { success: false, output: { error: result.stderr || "Failed to push" } };
      }

      return {
        success: true,
        output: {
          remote,
          branch: branch || "current branch",
          output: result.stdout,
        },
      };
    },
  );
}

export function createGitPullTool(): Tool {
  return new DefaultTool(
    "git_pull",
    "Pull changes from remote repository.",
    async (input) => {
      const cwd = (input.cwd as string) || process.cwd();
      const remote = (input.remote as string) || "origin";

      const result = await runGit(["pull", remote], cwd);

      if (result.exitCode !== 0) {
        return { success: false, output: { error: result.stderr || "Failed to pull" } };
      }

      return {
        success: true,
        output: {
          remote,
          output: result.stdout,
        },
      };
    },
  );
}
