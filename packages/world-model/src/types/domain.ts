export interface ProjectState {
  readonly name: string;
  readonly rootPath: string;
  readonly activeBranch: string;
  readonly isDirty: boolean;
  readonly recentCommits: ReadonlyArray<{ hash: string; message: string; timestamp: number }>;
  readonly openFiles: ReadonlyArray<string>;
  readonly focusedFile: string | null;
}

export interface ApplicationState {
  readonly activeWindow: string;
  readonly activeApp: string;
  readonly browserUrl: string | null;
  readonly terminalCommand: string | null;
}

export interface SystemState {
  readonly cpuUsage: number;
  readonly memoryUsage: number;
  readonly diskUsage: number;
  readonly batteryLevel: number | null;
  readonly runningProcesses: ReadonlyArray<string>;
  readonly openErrors: ReadonlyArray<{ source: string; message: string; timestamp: number }>;
  readonly clipboard: string | null;
}

export interface WorldState {
  readonly project: ProjectState | null;
  readonly application: ApplicationState;
  readonly system: SystemState;
  readonly timestamp: number;
  readonly version: number;
}

export type WorldStateDelta = Partial<{
  project: Partial<ProjectState>;
  application: Partial<ApplicationState>;
  system: Partial<SystemState>;
}>;

export const DEFAULT_PROJECT_STATE: ProjectState = {
  name: "",
  rootPath: "",
  activeBranch: "main",
  isDirty: false,
  recentCommits: [],
  openFiles: [],
  focusedFile: null,
};

export const DEFAULT_APPLICATION_STATE: ApplicationState = {
  activeWindow: "",
  activeApp: "",
  browserUrl: null,
  terminalCommand: null,
};

export const DEFAULT_SYSTEM_STATE: SystemState = {
  cpuUsage: 0,
  memoryUsage: 0,
  diskUsage: 0,
  batteryLevel: null,
  runningProcesses: [],
  openErrors: [],
  clipboard: null,
};
