import { paint, theme } from "../ui/theme.js";

interface RetryConfig {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier: number;
}

const defaultConfig: RetryConfig = {
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 1.5,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<{ result?: T; error?: string; attempts: number }> {
  const cfg = { ...defaultConfig, ...config };
  let lastError: string = "";
  
  for (let attempt = 1; attempt <= cfg.maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        console.log(paint(`  ✓ Succeeded on attempt ${attempt}`, theme.success));
      }
      return { result, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      
      if (attempt < cfg.maxRetries) {
        const delay = cfg.delayMs * Math.pow(cfg.backoffMultiplier, attempt - 1);
        console.log(paint(`  ⚠ Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`, theme.warning));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return { error: lastError, attempts: cfg.maxRetries };
}

export function suggestFix(error: string): string | null {
  const lower = error.toLowerCase();
  
  if (lower.includes("enoent") || lower.includes("no such file")) {
    return "The file or directory doesn't exist. Create it first or check the path.";
  }
  
  if (lower.includes("eacces") || lower.includes("permission denied")) {
    return "Permission denied. Try running with sudo or check file permissions.";
  }
  
  if (lower.includes("eexist") || lower.includes("file already exists")) {
    return "File already exists. Use edit_file to modify it or delete it first.";
  }
  
  if (lower.includes("enospc") || lower.includes("no space left")) {
    return "No space left on device. Free up disk space and try again.";
  }
  
  if (lower.includes("module not found") || lower.includes("cannot find module")) {
    return "Module not found. Run npm install or check import paths.";
  }
  
  if ((lower.includes("typescript") || lower.includes("ts")) && lower.includes("error")) {
    return "TypeScript error. Check types and fix type annotations.";
  }
  
  if (lower.includes("syntax error")) {
    return "Syntax error. Check brackets, semicolons, and code structure.";
  }
  
  if (lower.includes("network") || lower.includes("timeout")) {
    return "Network error. Check your internet connection and try again.";
  }
  
  return null;
}

export function formatErrorWithSuggestion(error: string): string {
  const lines: string[] = [];
  lines.push(paint(`  ✗ Error: ${error}`, theme.error));
  
  const suggestion = suggestFix(error);
  if (suggestion) {
    lines.push(paint(`  💡 Suggestion: ${suggestion}`, theme.primary));
  }
  
  return lines.join("\n");
}
