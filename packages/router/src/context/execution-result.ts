import type { RouteResponse } from "../types/route-response.js";

export interface ExecutionResult {
  readonly response: RouteResponse;

  readonly durationMs: number;
}
