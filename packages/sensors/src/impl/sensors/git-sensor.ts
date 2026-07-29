import type {
  ObservationPriority,
  ObservationSource,
} from "@ai-agent/attention";
import type { SensorEvent, SensorMetadata } from "../../types/sensor.js";
import { BaseSensor } from "../base-sensor.js";

export interface GitState {
  readonly branch: string;
  readonly isDirty: boolean;
  readonly stagedCount: number;
  readonly unstagedCount: number;
  readonly untrackedCount: number;
  readonly ahead: number;
  readonly behind: number;
  readonly recentCommits: ReadonlyArray<{
    readonly hash: string;
    readonly message: string;
    readonly author: string;
    readonly timestamp: number;
  }>;
  readonly currentTag: string | null;
  readonly merging: boolean;
  readonly rebasing: boolean;
}

export interface GitEvent {
  readonly type:
    | "commit"
    | "branch_change"
    | "merge"
    | "rebase"
    | "push"
    | "pull"
    | "stash"
    | "conflict";
  readonly detail: string;
  readonly branch: string;
  readonly hash?: string;
}

const METADATA: SensorMetadata = {
  id: "git",
  name: "Git Sensor",
  description:
    "Monitors git repository state changes (commits, branches, merges, pushes)",
  category: "git",
  platform: "all",
  version: "1.0.0",
};

export class GitSensor extends BaseSensor<GitState> {
  private lastState: GitState | null = null;
  private readonly repoPath: string;

  constructor(repoPath: string, pollIntervalMs = 3000) {
    super(METADATA, pollIntervalMs);
    this.repoPath = repoPath;
  }

  protected async onStart(): Promise<void> {
    this.lastState = await this.pollGitState();
  }

  protected async onStop(): Promise<void> {
    this.lastState = null;
  }

  protected async onSnapshot(): Promise<GitState | null> {
    return this.pollGitState();
  }

  protected async onRefresh(): Promise<GitState | null> {
    const newState = await this.pollGitState();
    if (newState && this.lastState) {
      this.detectChanges(this.lastState, newState);
    }
    this.lastState = newState;
    return newState;
  }

  protected getEventSource(): ObservationSource {
    return "git";
  }

  protected getEventPriority(data: GitState): ObservationPriority {
    if (data.merging || data.rebasing) return "high";
    if (data.isDirty && data.stagedCount > 0) return "medium";
    if (data.ahead > 0) return "low";
    return "background";
  }

  private async pollGitState(): Promise<GitState | null> {
    const branch = this.execGit("git rev-parse --abbrev-ref HEAD");
    if (branch === null) return null;

    const isDirty = this.execGit("git status --porcelain") !== "";
    const staged = this.execGit("git diff --cached --numstat");
    const unstaged = this.execGit("git diff --numstat");
    const untracked = this.execGit("git ls-files --others --exclude-standard");
    const aheadBehind = this.execGit(
      "git rev-list --left-right --count HEAD...@{upstream}",
    );
    const log = this.execGit("git log --format=%H|%s|%an|%at -10");
    const tag = this.execGit("git describe --tags --exact-match 2>/dev/null");
    const merging =
      this.execGit("test -f .git/MERGE_HEAD && echo true") === "true";
    const rebasing =
      this.execGit("test -d .git/rebase-merge && echo true") === "true";

    const ahead = aheadBehind
      ? parseInt(aheadBehind.split("\t")[0] ?? "0", 10)
      : 0;
    const behind = aheadBehind
      ? parseInt(aheadBehind.split("\t")[1] ?? "0", 10)
      : 0;

    const recentCommits = log
      ? log
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [hash, message, author, ts] = line.split("|");
            return {
              hash: hash ?? "",
              message: message ?? "",
              author: author ?? "",
              timestamp: parseInt(ts ?? "0", 10) * 1000,
            };
          })
      : [];

    return {
      branch,
      isDirty,
      stagedCount: staged ? staged.split("\n").filter(Boolean).length : 0,
      unstagedCount: unstaged ? unstaged.split("\n").filter(Boolean).length : 0,
      untrackedCount: untracked
        ? untracked.split("\n").filter(Boolean).length
        : 0,
      ahead,
      behind,
      recentCommits,
      currentTag: tag || null,
      merging,
      rebasing,
    };
  }

  private detectChanges(oldState: GitState, newState: GitState): void {
    // Branch change
    if (oldState.branch !== newState.branch) {
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: "branch_change",
        data: newState,
        priority: "medium",
        source: "git",
      });
    }

    // New commits (ahead count increased or hash changed)
    const oldHash = oldState.recentCommits[0]?.hash;
    const newHash = newState.recentCommits[0]?.hash;
    if (oldHash !== newHash && newHash) {
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: "commit",
        data: newState,
        priority: "low",
        source: "git",
      });
    }

    // Merge started
    if (!oldState.merging && newState.merging) {
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: "merge",
        data: newState,
        priority: "high",
        source: "git",
      });
    }

    // Rebase started
    if (!oldState.rebasing && newState.rebasing) {
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: "rebase",
        data: newState,
        priority: "high",
        source: "git",
      });
    }

    // Push detected (ahead went from >0 to 0)
    if (oldState.ahead > 0 && newState.ahead === 0) {
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: "push",
        data: newState,
        priority: "low",
        source: "git",
      });
    }

    // Stash detected (dirty but staged count changed significantly)
    if (
      oldState.stagedCount !== newState.stagedCount &&
      newState.stagedCount === 0 &&
      oldState.stagedCount > 0
    ) {
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: "stash",
        data: newState,
        priority: "low",
        source: "git",
      });
    }
  }

  private execGit(cmd: string): string | null {
    return this.execCommand(`cd ${this.repoPath} && ${cmd}`);
  }
}
