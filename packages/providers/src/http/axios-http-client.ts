import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";

import type { HttpClient } from "./http-client.js";
import type { HttpRequest } from "./http-request.js";
import type { HttpResponse } from "./http-response.js";

export class AxiosHttpClient implements HttpClient {
  private readonly client: AxiosInstance;

  public constructor(config?: AxiosRequestConfig) {
    this.client = axios.create(config);
  }

  public async request<T>(
    request: HttpRequest,
  ): Promise<HttpResponse<T>> {
    const config: AxiosRequestConfig = {
      method: request.method,
      url: request.url,
    };

    if (request.headers !== undefined) {
      config.headers = request.headers;
    }

    if (request.query !== undefined) {
      config.params = request.query;
    }

    if (request.body !== undefined) {
      config.data = request.body;
    }

    if (request.timeout !== undefined) {
      config.timeout = request.timeout;
    }

    const response: AxiosResponse<T> =
      await this.client.request<T>(config);

    return {
      status: response.status,
      headers: response.headers as Record<string, string>,
      data: response.data,
    };
  }

  public get<T>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>({
      method: "GET",
      url,
      ...(headers !== undefined ? { headers } : {}),
    });
  }

  public post<T>(
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>({
      method: "POST",
      url,
      ...(body !== undefined ? { body } : {}),
      ...(headers !== undefined ? { headers } : {}),
    });
  }
}