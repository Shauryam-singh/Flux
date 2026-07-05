import type { Provider } from "@ai-agent/providers";

export interface FailoverPolicy {
  next(failed: Provider, providers: readonly Provider[]): Provider | undefined;
}
