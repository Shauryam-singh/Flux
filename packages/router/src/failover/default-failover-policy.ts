import type { Provider } from "@ai-agent/providers";
import type { FailoverPolicy } from "./failover-policy.js";

export class DefaultFailoverPolicy implements FailoverPolicy {
  public next(
    failed: Provider,
    providers: readonly Provider[],
  ): Provider | undefined {
    return providers.find((provider) => provider.name !== failed.name);
  }
}
