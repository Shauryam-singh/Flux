export class AgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentError";
  }
}

export class ProviderError extends AgentError {}

export class ToolError extends AgentError {}

export class RouterError extends AgentError {}
