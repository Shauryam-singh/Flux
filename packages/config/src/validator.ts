import type { AppConfig } from "./interfaces/app-config.js";

export function validateConfig(config: AppConfig): void {
  if (config.router.retryCount < 0) {
    throw new Error("retryCount must be >= 0");
  }

  if (config.router.requestTimeoutMs <= 0) {
    throw new Error("requestTimeoutMs must be positive");
  }
}
