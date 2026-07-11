import type { HttpRequest } from "./http-request.js";
import type { HttpResponse } from "./http-response.js";

export interface HttpClient {
  request<T>(request: HttpRequest): Promise<HttpResponse<T>>;

  get<T>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>>;

  post<T>(
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>>;
}
