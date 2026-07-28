import type { WorkspaceSnapshot, BrowserTab, WorkspaceTerminal, WorkspaceContainer } from "@ai-agent/ambient-types";

export interface WorkspaceSensor {
  snapshot(): Promise<WorkspaceSnapshot>;
  getOpenApplications(): Promise<ReadonlyArray<{ name: string; windowCount: number; active: boolean }>>;
  getBrowserTabs(): Promise<ReadonlyArray<BrowserTab>>;
  getTerminals(): Promise<ReadonlyArray<WorkspaceTerminal>>;
  getContainers(): Promise<ReadonlyArray<WorkspaceContainer>>;
  getClipboard(): Promise<{ content: string; type: "text" | "image" | "file" | "unknown" } | null>;
  isAvailable(): boolean;
  onChange(handler: (snapshot: WorkspaceSnapshot) => void): () => void;
}

export interface WorkspaceConfig {
  readonly pollIntervalMs: number;
  readonly enabled: boolean;
  readonly trackClipboard: boolean;
  readonly trackBrowser: boolean;
  readonly trackTerminals: boolean;
  readonly trackContainers: boolean;
}
