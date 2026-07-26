import { execFileSync } from "node:child_process";
import { paint, theme } from "../ui/theme.js";

export function getGitDiff(): string | null {
  try {
    const result = execFileSync("git", ["diff", "--staged"], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return result || null;
  } catch {
    return null;
  }
}

export function getUnstagedDiff(): string | null {
  try {
    const result = execFileSync("git", ["diff"], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return result || null;
  } catch {
    return null;
  }
}

export function stageAllFiles(): boolean {
  try {
    execFileSync("git", ["add", "-A"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function gitCommit(message: string): { success: boolean; output: string } {
  try {
    const output = execFileSync("git", ["commit", "-m", message], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output };
  } catch (err) {
    return { success: false, output: err instanceof Error ? err.message : String(err) };
  }
}

export function autoCommit(
  generateMessage: (diff: string) => Promise<string>,
  userMessage?: string
): { success: boolean; message: string } | Promise<{ success: boolean; message: string }> {
  return autoCommitInternal(generateMessage, userMessage, false);
}

async function autoCommitInternal(
  generateMessage: (diff: string) => Promise<string>,
  userMessage?: string,
  retried = false
): Promise<{ success: boolean; message: string }> {
  const diff = getGitDiff();
  if (!diff) {
    const unstaged = getUnstagedDiff();
    if (!unstaged) {
      return { success: false, message: "No changes to commit" };
    }

    const staged = stageAllFiles();
    if (!staged) {
      return { success: false, message: "Failed to stage files" };
    }

    const newDiff = getGitDiff();
    if (!newDiff) {
      return { success: false, message: "No changes to commit after staging" };
    }

    if (retried) {
      return { success: false, message: "Failed to generate commit message after retries" };
    }

    return autoCommitInternal(generateMessage, userMessage, true);
  }

  const message = userMessage || await generateMessage(diff);
  const result = gitCommit(message);

  if (result.success) {
    return { success: true, message };
  } else {
    return { success: false, message: result.output };
  }
}

export function formatCommitResult(result: { success: boolean; message: string }): string {
  const lines: string[] = [];
  
  if (result.success) {
    lines.push(paint("  ✓ Changes committed", theme.success));
    lines.push(paint(`  📝 ${result.message}`, theme.text));
  } else {
    lines.push(paint(`  ✗ Commit failed: ${result.message}`, theme.error));
  }
  
  return lines.join("\n");
}
