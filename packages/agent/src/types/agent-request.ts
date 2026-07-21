export type AgentMode = "plan" | "auto" | "normal";

export interface AgentRequest {
  input: Record<string, unknown>;
  mode?: AgentMode;
}
