/**
 * Workflow Automation Engine
 *
 * Detects repetitive patterns and suggests/creates automations.
 * Includes error auto-fix, test generation triggers, and dependency audit.
 */

export interface WorkflowPattern {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly frequency: number;
  readonly lastSeen: number;
  readonly suggestedAutomation: string;
  readonly confidence: number;
}

export interface AutomationAction {
  readonly id: string;
  readonly type: "auto_fix" | "test_gen" | "dependency" | "security" | "workflow";
  readonly title: string;
  readonly description: string;
  readonly command?: string;
  readonly priority: "low" | "medium" | "high";
  readonly confidence: number;
  readonly timestamp: number;
  readonly context: Record<string, unknown>;
}

export class WorkflowAutomationEngine {
  private readonly patterns: Map<string, WorkflowPattern> = new Map();
  private readonly actions: AutomationAction[] = [];
  private readonly commandHistory: Array<{ command: string; timestamp: number; exitCode: number }> = [];
  private readonly errorHistory: Array<{ error: string; timestamp: number; context: string }> = [];
  private readonly lastPatternCheck = 0;
  private readonly lastAutoFixCheck = 0;

  /**
   * Record a command execution for pattern detection.
   */
  recordCommand(command: string, exitCode: number): void {
    this.commandHistory.push({
      command: command.trim(),
      timestamp: Date.now(),
      exitCode,
    });
    if (this.commandHistory.length > 200) {
      this.commandHistory.splice(0, this.commandHistory.length - 200);
    }
  }

  /**
   * Record an error for auto-fix analysis.
   */
  recordError(error: string, context: string): void {
    this.errorHistory.push({
      error: error.slice(0, 500),
      timestamp: Date.now(),
      context,
    });
    if (this.errorHistory.length > 100) {
      this.errorHistory.splice(0, this.errorHistory.length - 100);
    }
  }

  /**
   * Analyze patterns and suggest automations.
   */
  analyze(): AutomationAction[] {
    const now = Date.now();
    const results: AutomationAction[] = [];

    // ── 1. Repetitive Command Detection ──
    const recentCommands = this.commandHistory.filter(
      (c) => now - c.timestamp < 3600_000, // Last hour
    );
    const commandCounts = new Map<string, number>();
    for (const cmd of recentCommands) {
      const normalized = this.normalizeCommand(cmd.command);
      commandCounts.set(normalized, (commandCounts.get(normalized) ?? 0) + 1);
    }

    for (const [cmd, count] of commandCounts) {
      if (count >= 3) {
        const patternId = `repetitive_${this.hashString(cmd)}`;
        const existing = this.patterns.get(patternId);
        if (!existing || now - existing.lastSeen > 600_000) {
          results.push({
            id: patternId,
            type: "workflow",
            title: `Repeated command: ${cmd}`,
            description: `You've run "${cmd}" ${count} times in the last hour. Want me to create an alias or script?`,
            command: cmd,
            priority: count >= 5 ? "medium" : "low",
            confidence: Math.min(0.9, 0.5 + count * 0.1),
            timestamp: now,
            context: { count, command: cmd },
          });
          this.patterns.set(patternId, {
            id: patternId,
            type: "repetitive_command",
            description: `Repeated: ${cmd}`,
            frequency: count,
            lastSeen: now,
            suggestedAutomation: `alias or script for: ${cmd}`,
            confidence: Math.min(0.9, 0.5 + count * 0.1),
          });
        }
      }
    }

    // ── 2. Error Auto-Fix Detection ──
    const recentErrors = this.errorHistory.filter(
      (e) => now - e.timestamp < 600_000, // Last 10 minutes
    );

    for (const err of recentErrors.slice(0, 3)) {
      const fix = this.suggestAutoFix(err.error, err.context);
      if (fix) {
        results.push(fix);
      }
    }

    // ── 3. Test Generation Suggestions ──
    // Detect patterns: edit file → no test run → edit same file again
    const recentEdits = recentCommands.filter(
      (c) => c.command.startsWith("nvim ") || c.command.startsWith("code ") ||
             c.command.includes("edit ") || c.command.includes("vim "),
    );
    const recentTestRuns = recentCommands.filter(
      (c) => c.command.includes("test") || c.command.includes("vitest") ||
             c.command.includes("jest") || c.command.includes("pytest"),
    );

    if (recentEdits.length >= 3 && recentTestRuns.length === 0) {
      results.push({
        id: "suggest_tests",
        type: "test_gen",
        title: "No tests run recently",
        description: `You've edited ${recentEdits.length} files but haven't run tests. Want me to run them?`,
        command: "pnpm run test",
        priority: "medium",
        confidence: 0.7,
        timestamp: now,
        context: { edits: recentEdits.length },
      });
    }

    // ── 4. Dependency Check ──
    const hasNpmInstall = recentCommands.some(
      (c) => c.command.includes("npm install") || c.command.includes("pnpm add"),
    );
    if (hasNpmInstall) {
      results.push({
        id: "dep_audit",
        type: "dependency",
        title: "Dependencies recently modified",
        description: "You recently installed packages. Want me to audit for vulnerabilities?",
        command: "pnpm audit",
        priority: "low",
        confidence: 0.6,
        timestamp: now,
        context: {},
      });
    }

    // ── 5. Git Workflow Suggestions ──
    const hasCommit = recentCommands.some((c) => c.command.includes("git commit"));
    const hasPush = recentCommands.some((c) => c.command.includes("git push"));
    if (hasCommit && !hasPush) {
      results.push({
        id: "suggest_push",
        type: "workflow",
        title: "Committed but not pushed",
        description: "You've committed but haven't pushed. Want me to push?",
        command: "git push",
        priority: "low",
        confidence: 0.6,
        timestamp: now,
        context: {},
      });
    }

    // Store actions
    for (const action of results) {
      this.actions.push(action);
      if (this.actions.length > 50) {
        this.actions.splice(0, this.actions.length - 50);
      }
    }

    return results;
  }

  /**
   * Get recent automation actions.
   */
  getRecent(limit = 10): ReadonlyArray<AutomationAction> {
    return this.actions.slice(-limit);
  }

  /**
   * Get detected patterns.
   */
  getPatterns(): ReadonlyArray<WorkflowPattern> {
    return Array.from(this.patterns.values());
  }

  /**
   * Get command history for analysis.
   */
  getCommandHistory(limit = 50): ReadonlyArray<{ command: string; timestamp: number; exitCode: number }> {
    return this.commandHistory.slice(-limit);
  }

  private suggestAutoFix(error: string, context: string): AutomationAction | null {
    const now = Date.now();
    const lower = error.toLowerCase();

    // TypeScript/JavaScript errors
    if (lower.includes("cannot find module") || lower.includes("module not found")) {
      const match = error.match(/module\s+["']([^"']+)["']/i);
      const moduleName = match?.[1] ?? "unknown";
      return {
        id: `autofix_missing_module_${now}`,
        type: "auto_fix",
        title: `Missing module: ${moduleName}`,
        description: `Module "${moduleName}" not found. Want me to install it?`,
        command: `pnpm add ${moduleName}`,
        priority: "medium",
        confidence: 0.8,
        timestamp: now,
        context: { module: moduleName, error },
      };
    }

    if (lower.includes("typescript") && lower.includes("error ts") || /\bts\d{4}\b/.test(lower)) {
      return {
        id: `autofix_ts_error_${now}`,
        type: "auto_fix",
        title: "TypeScript error detected",
        description: "TypeScript compilation error. Want me to analyze and fix it?",
        priority: "medium",
        confidence: 0.7,
        timestamp: now,
        context: { error },
      };
    }

    if (lower.includes("enoent") || lower.includes("no such file")) {
      return {
        id: `autofix_enoent_${now}`,
        type: "auto_fix",
        title: "File not found",
        description: "A file operation failed. Want me to check the path?",
        priority: "low",
        confidence: 0.6,
        timestamp: now,
        context: { error, context },
      };
    }

    if (lower.includes("eacces") || lower.includes("permission denied")) {
      return {
        id: `autofix_permission_${now}`,
        type: "auto_fix",
        title: "Permission denied",
        description: "Permission error detected. Want me to fix file permissions?",
        priority: "medium",
        confidence: 0.7,
        timestamp: now,
        context: { error },
      };
    }

    // Docker errors
    if (lower.includes("docker") && (lower.includes("error") || lower.includes("failed"))) {
      return {
        id: `autofix_docker_${now}`,
        type: "auto_fix",
        title: "Docker error detected",
        description: "Docker operation failed. Want me to check container status?",
        command: "docker ps -a",
        priority: "medium",
        confidence: 0.7,
        timestamp: now,
        context: { error },
      };
    }

    // Git errors
    if (lower.includes("git") && lower.includes("merge conflict")) {
      return {
        id: `autofix_merge_conflict_${now}`,
        type: "auto_fix",
        title: "Merge conflict detected",
        description: "Git merge conflict. Want me to help resolve it?",
        priority: "high",
        confidence: 0.9,
        timestamp: now,
        context: { error },
      };
    }

    return null;
  }

  private normalizeCommand(cmd: string): string {
    // Normalize paths and arguments for pattern detection
    return cmd
      .replace(/\/[^\s]+/g, "<path>") // Replace paths
      .replace(/\s+/g, " ")
      .trim();
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
