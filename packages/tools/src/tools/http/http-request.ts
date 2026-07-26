import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

export function createHttpRequestTool(): Tool {
  return new DefaultTool(
    "http_request",
    "Make HTTP requests to APIs and web services. Supports GET, POST, PUT, DELETE, PATCH methods with custom headers and body.",
    async (input) => {
      const url = input.url as string;
      const method = ((input.method as string) || "GET").toUpperCase();
      const headers = (input.headers as Record<string, string>) || {};
      const body = input.body as string | undefined;
      const timeout = (input.timeout as number) || 30000;

      if (!url) {
        return { success: false, output: { error: "URL is required" } };
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const fetchInit: RequestInit = {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          signal: controller.signal,
        };

        if (body && ["POST", "PUT", "PATCH"].includes(method)) {
          fetchInit.body = typeof body === "object" ? JSON.stringify(body) : body;
        }

        const response = await fetch(url, fetchInit);
        clearTimeout(timer);

        const contentType = response.headers.get("content-type") || "";
        let responseData: unknown;

        if (contentType.includes("application/json")) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        return {
          success: response.ok,
          output: {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            data: responseData,
          },
        };
      } catch (error) {
        return {
          success: false,
          output: {
            error: error instanceof Error ? error.message : String(error),
            url,
            method,
          },
        };
      }
    },
  );
}
