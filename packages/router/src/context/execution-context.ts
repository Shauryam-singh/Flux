import type { Provider } from "@ai-agent/providers";
import type { RouteRequest } from "../types/route-request.js";

export interface ExecutionContext {
  readonly request: RouteRequest;

  readonly provider: Provider;

  readonly startedAt: Date;

  readonly metadata: Readonly<Record<string, unknown>>;
}
