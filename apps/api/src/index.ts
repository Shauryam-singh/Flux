import { createServer } from "node:http";
import { createFlux, type FluxConfig } from "@ai-agent/cli/flux";

const PORT = parseInt(process.env.FLUX_API_PORT ?? "3141", 10);

const fluxConfig: FluxConfig = {
  provider: "ollama",
  model: "qwen2.5-coder:7b",
  providerConfigs: {
    ollama: { baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434" },
  },
};

const flux = createFlux(fluxConfig);

interface ChatRequest {
  message: string;
}

interface ChatResponse {
  reply: string;
  sessionId: string;
}

function parseBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function sendJson(res: import("node:http").ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "ok", version: "0.1.0" });
    return;
  }

  if (req.method === "POST" && req.url === "/chat") {
    try {
      const body = await parseBody(req);
      const { message } = JSON.parse(body) as ChatRequest;

      if (!message || typeof message !== "string") {
        sendJson(res, 400, { error: "message is required" });
        return;
      }

      const reply = await flux.process(message);

      const response: ChatResponse = {
        reply,
        sessionId: flux.session.id,
      };

      sendJson(res, 200, response);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/services") {
    sendJson(res, 200, {
      services: [
        { name: "chat", description: "General conversation" },
        { name: "coding", description: "Code assistant" },
        { name: "search", description: "Web search" },
        { name: "system", description: "System control" },
        { name: "reminders", description: "Reminders & notes" },
        { name: "files", description: "File manager" },
      ],
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Flux API server running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  POST /chat     - Send a message`);
  console.log(`  GET  /health   - Health check`);
  console.log(`  GET  /services - List available services`);
});
