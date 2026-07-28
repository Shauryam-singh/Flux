import type { WorldModel } from "../interfaces/world-model.js";
import type { WorldState, WorldStateDelta, ProjectState, ApplicationState, SystemState } from "../types/domain.js";
import { DEFAULT_PROJECT_STATE, DEFAULT_APPLICATION_STATE, DEFAULT_SYSTEM_STATE } from "../types/domain.js";
import type { Observation } from "@ai-agent/attention";

interface MutableProjectState {
  name: string;
  rootPath: string;
  activeBranch: string;
  isDirty: boolean;
  recentCommits: Array<{ hash: string; message: string; timestamp: number }>;
  openFiles: Array<string>;
  focusedFile: string | null;
}

interface MutableApplicationState {
  activeWindow: string;
  activeApp: string;
  browserUrl: string | null;
  terminalCommand: string | null;
}

interface MutableSystemState {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  batteryLevel: number | null;
  runningProcesses: Array<string>;
  openErrors: Array<{ source: string; message: string; timestamp: number }>;
  clipboard: string | null;
}

export class DefaultWorldModel implements WorldModel {
  private state: WorldState;
  private handlers: Array<(state: WorldState, delta: WorldStateDelta) => void> = [];

  constructor(initial?: Partial<WorldState>) {
    this.state = {
      project: initial?.project ?? null,
      application: initial?.application ?? { ...DEFAULT_APPLICATION_STATE },
      system: initial?.system ?? { ...DEFAULT_SYSTEM_STATE },
      timestamp: initial?.timestamp ?? Date.now(),
      version: initial?.version ?? 0,
    };
  }

  getState(): WorldState {
    return this.state;
  }

  getProject(): ProjectState | null {
    return this.state.project;
  }

  getApplication(): ApplicationState {
    return this.state.application;
  }

  getSystem(): SystemState {
    return this.state.system;
  }

  update(observation: Observation): WorldStateDelta {
    const delta: WorldStateDelta = {};
    const ctx = observation.context ?? {};

    switch (observation.source) {
      case "screen": {
        const prev = this.state.application;
        const appUpdate: MutableApplicationState = {
          activeWindow: prev.activeWindow,
          activeApp: prev.activeApp,
          browserUrl: prev.browserUrl,
          terminalCommand: prev.terminalCommand,
        };
        let changed = false;
        if (ctx["app"]) { appUpdate.activeApp = ctx["app"]; changed = true; }
        if (ctx["window"]) { appUpdate.activeWindow = ctx["window"]; changed = true; }
        if (changed) delta.application = appUpdate;
        break;
      }
      case "code": {
        const prev = this.state.project ?? DEFAULT_PROJECT_STATE;
        const projUpdate: MutableProjectState = {
          name: prev.name,
          rootPath: prev.rootPath,
          activeBranch: prev.activeBranch,
          isDirty: prev.isDirty,
          recentCommits: [...prev.recentCommits],
          openFiles: [...prev.openFiles],
          focusedFile: prev.focusedFile,
        };
        let changed = false;
        if (ctx["file"]) {
          const file = ctx["file"];
          if (!projUpdate.openFiles.includes(file)) {
            projUpdate.openFiles = [...projUpdate.openFiles, file];
          }
          projUpdate.focusedFile = file;
          changed = true;
        }
        if (changed) delta.project = projUpdate;
        break;
      }
      case "git": {
        const prev = this.state.project ?? DEFAULT_PROJECT_STATE;
        const projUpdate: MutableProjectState = {
          name: prev.name,
          rootPath: prev.rootPath,
          activeBranch: prev.activeBranch,
          isDirty: prev.isDirty,
          recentCommits: [...prev.recentCommits],
          openFiles: [...prev.openFiles],
          focusedFile: prev.focusedFile,
        };
        let changed = false;
        if (ctx["branch"]) { projUpdate.activeBranch = ctx["branch"]; changed = true; }
        if (ctx["dirty"] !== undefined) { projUpdate.isDirty = ctx["dirty"] === "true"; changed = true; }
        if (ctx["commit"]) {
          const commit = { hash: ctx["commit"], message: ctx["message"] ?? "", timestamp: Date.now() };
          projUpdate.recentCommits = [commit, ...projUpdate.recentCommits].slice(0, 10);
          changed = true;
        }
        if (changed) delta.project = projUpdate;
        break;
      }
      case "terminal": {
        const prev = this.state.application;
        const appUpdate: MutableApplicationState = {
          activeWindow: prev.activeWindow,
          activeApp: prev.activeApp,
          browserUrl: prev.browserUrl,
          terminalCommand: prev.terminalCommand,
        };
        if (ctx["command"]) {
          appUpdate.terminalCommand = ctx["command"];
          delta.application = appUpdate;
        }
        break;
      }
      case "system": {
        const prev = this.state.system;
        const sysUpdate: MutableSystemState = {
          cpuUsage: prev.cpuUsage,
          memoryUsage: prev.memoryUsage,
          diskUsage: prev.diskUsage,
          batteryLevel: prev.batteryLevel,
          runningProcesses: [...prev.runningProcesses],
          openErrors: [...prev.openErrors],
          clipboard: prev.clipboard,
        };
        let changed = false;
        if (ctx["cpu"]) { sysUpdate.cpuUsage = parseFloat(ctx["cpu"]) || 0; changed = true; }
        if (ctx["memory"]) { sysUpdate.memoryUsage = parseFloat(ctx["memory"]) || 0; changed = true; }
        if (ctx["disk"]) { sysUpdate.diskUsage = parseFloat(ctx["disk"]) || 0; changed = true; }
        if (ctx["battery"]) { sysUpdate.batteryLevel = parseFloat(ctx["battery"]) || null; changed = true; }
        if (ctx["error"]) {
          sysUpdate.openErrors = [...sysUpdate.openErrors, { source: "system", message: ctx["error"], timestamp: Date.now() }];
          changed = true;
        }
        if (changed) delta.system = sysUpdate;
        break;
      }
      case "file": {
        const prev = this.state.project ?? DEFAULT_PROJECT_STATE;
        const projUpdate: MutableProjectState = {
          name: prev.name,
          rootPath: prev.rootPath,
          activeBranch: prev.activeBranch,
          isDirty: prev.isDirty,
          recentCommits: [...prev.recentCommits],
          openFiles: [...prev.openFiles],
          focusedFile: prev.focusedFile,
        };
        if (ctx["path"]) {
          const file = ctx["path"];
          if (!projUpdate.openFiles.includes(file)) {
            projUpdate.openFiles = [...projUpdate.openFiles, file];
          }
          projUpdate.focusedFile = file;
          delta.project = projUpdate;
        }
        break;
      }
      case "process": {
        const prev = this.state.system;
        const sysUpdate: MutableSystemState = {
          cpuUsage: prev.cpuUsage,
          memoryUsage: prev.memoryUsage,
          diskUsage: prev.diskUsage,
          batteryLevel: prev.batteryLevel,
          runningProcesses: [...prev.runningProcesses],
          openErrors: [...prev.openErrors],
          clipboard: prev.clipboard,
        };
        let changed = false;
        if (ctx["name"]) {
          const proc = ctx["name"];
          if (!sysUpdate.runningProcesses.includes(proc)) {
            sysUpdate.runningProcesses = [...sysUpdate.runningProcesses, proc];
            changed = true;
          }
        }
        if (ctx["error"]) {
          sysUpdate.openErrors = [...sysUpdate.openErrors, { source: "process", message: ctx["error"], timestamp: Date.now() }];
          changed = true;
        }
        if (changed) delta.system = sysUpdate;
        break;
      }
      default:
        break;
    }

    if (Object.keys(delta).length === 0) {
      return delta;
    }

    this.state = this.applyDelta(delta);
    this.emit(delta);
    return delta;
  }

  onChange(handler: (state: WorldState, delta: WorldStateDelta) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  reset(): void {
    this.state = {
      project: null,
      application: { ...DEFAULT_APPLICATION_STATE },
      system: { ...DEFAULT_SYSTEM_STATE },
      timestamp: Date.now(),
      version: 0,
    };
    this.emit({});
  }

  private applyDelta(delta: WorldStateDelta): WorldState {
    const prev = this.state;
    return {
      project: delta.project
        ? { ...(prev.project ?? { ...DEFAULT_PROJECT_STATE }), ...delta.project } as ProjectState
        : prev.project,
      application: delta.application
        ? { ...prev.application, ...delta.application } as ApplicationState
        : prev.application,
      system: delta.system
        ? { ...prev.system, ...delta.system } as SystemState
        : prev.system,
      timestamp: Date.now(),
      version: prev.version + 1,
    };
  }

  private emit(delta: WorldStateDelta): void {
    for (const handler of this.handlers) {
      handler(this.state, delta);
    }
  }
}
