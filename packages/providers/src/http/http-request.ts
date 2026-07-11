import type { HttpMethod } from "./http-method.js";

export interface HttpRequest {
  readonly method: HttpMethod;

  readonly url: string;

  readonly headers?: Readonly<Record<string, string>>;

  readonly query?: Readonly<Record<string, string | number | boolean>>;

  readonly body?: unknown;

  readonly timeout?: number;
}
