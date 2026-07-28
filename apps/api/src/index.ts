import { createServer } from "node:http";
import { createFlux, type FluxConfig } from "@ai-agent/cli/flux";
import { WhisperEngine } from "@ai-agent/voice-stt";
import { PiperEngine } from "@ai-agent/voice-tts";

const PORT = parseInt(process.env.FLUX_API_PORT ?? "3141", 10);

const fluxConfig: FluxConfig = {
  provider: "ollama",
  model: "qwen2.5-coder:7b",
  providerConfigs: {
    ollama: { baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434" },
  },
};

const flux = createFlux(fluxConfig);
const stt = new WhisperEngine();
const tts = new PiperEngine();

interface ChatRequest {
  message: string;
}

interface ChatResponse {
  reply: string;
  sessionId: string;
}

function parseBody(req: import("node:http").IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
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

function wavToFloat32(buffer: Buffer): Float32Array {
  if (buffer.length < 44) return new Float32Array(0);
  const dataOffset = 44;
  const dataLength = buffer.length - dataOffset;
  const sampleCount = Math.floor(dataLength / 2);
  const result = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const offset = dataOffset + i * 2;
    const sample = buffer.readInt16LE(offset);
    result[i] = sample / 32768;
  }
  return result;
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

  if (req.method === "POST" && req.url === "/chat/stream") {
    try {
      const body = await parseBody(req);
      const { message } = JSON.parse(body.toString()) as ChatRequest;

      if (!message || typeof message !== "string") {
        sendJson(res, 400, { error: "message is required" });
        return;
      }

      // SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      await flux.session.memory.add("user", message);

      // Build the prompt with conversation history
      const history = await flux.session.memory.history();
      const messages = history.map((m) => `${m.role}: ${m.content}`).join("\n");
      const prompt = `You are Flux — not a chatbot. You're a friend. Talk like a real person — casual, natural, witty. Match the user's energy. No "As an AI..." or "I'd be happy to help!" Just be genuine.\n\nConversation:\n${messages}\n\nFlux:`;

      let fullText = "";

      if (flux.runtime.provider.completeStream) {
        await flux.runtime.provider.completeStream(
          { model: flux.model, prompt, temperature: 0.7 },
          {
            onToken: (token: string) => {
              fullText += token;
              res.write(`data: ${JSON.stringify({ token, done: false })}\n\n`);
            },
            onDone: async (response: unknown) => {
              await flux.session.memory.add("assistant", fullText);
              res.write(`data: ${JSON.stringify({ token: "", done: true, text: fullText })}\n\n`);
              res.end();
            },
            onError: (error: Error) => {
              res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
              res.end();
            },
          },
        );
      } else {
        // Fallback: non-streaming
        const response = await flux.llmProvider.complete({
          model: flux.model,
          prompt,
          temperature: 0.7,
        });
        fullText = response.text;
        await flux.session.memory.add("assistant", fullText);
        res.write(`data: ${JSON.stringify({ token: fullText, done: false })}\n\n`);
        res.write(`data: ${JSON.stringify({ token: "", done: true, text: fullText })}\n\n`);
        res.end();
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ error })}\n\n`);
      res.end();
    }
    return;
  }

  if (req.method === "POST" && req.url === "/chat") {
    try {
      const body = await parseBody(req);
      const { message } = JSON.parse(body.toString()) as ChatRequest;

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

  if (req.method === "POST" && req.url === "/voice/transcribe") {
    try {
      const body = await parseBody(req);
      const json = JSON.parse(body.toString()) as { audio?: string; sampleRate?: number };

      if (!json.audio) {
        sendJson(res, 400, { error: "audio (base64) is required" });
        return;
      }

      await stt.initialize();

      const audioBuffer = Buffer.from(json.audio, "base64");
      const audioFloat = wavToFloat32(audioBuffer);
      const sampleRate = json.sampleRate ?? 16000;

      const text = await stt.transcribe(audioFloat, sampleRate);

      sendJson(res, 200, { text });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/voice/speak") {
    try {
      const body = await parseBody(req);
      const { text } = JSON.parse(body.toString()) as { text?: string };

      if (!text || typeof text !== "string") {
        sendJson(res, 400, { error: "text is required" });
        return;
      }

      await tts.initialize();

      const audio = await tts.synthesize(text);

      res.writeHead(200, {
        "Content-Type": "audio/wav",
        "Access-Control-Allow-Origin": "*",
        "Content-Length": audio.length,
      });
      res.end(audio);
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
        { name: "voice", description: "Voice transcription and speech" },
        { name: "attention", description: "Event filtering and prioritization" },
        { name: "cognitive", description: "Reasoning, goals, and decision engine" },
      ],
    });
    return;
  }

  if (req.method === "POST" && req.url === "/attention/process") {
    try {
      const body = await parseBody(req);
      const event = JSON.parse(body.toString()) as { source: string; title: string; detail: string };

      if (!event.source || !event.title) {
        sendJson(res, 400, { error: "source and title are required" });
        return;
      }

      const result = flux.processEvent({
        source: event.source as import("@ai-agent/attention").ObservationSource,
        title: event.title,
        detail: event.detail ?? "",
      });

      sendJson(res, 200, result);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/attention/stats") {
    const stats = flux.runtime.attention.getStats();
    sendJson(res, 200, stats);
    return;
  }

  if (req.method === "GET" && req.url === "/cognitive/state") {
    const state = flux.runtime.cognitive.getState();
    sendJson(res, 200, {
      world: state.world,
      activeGoal: state.activeGoal,
      goals: state.goals,
      memoryUtilization: state.memory.utilization,
      reasoningState: state.reasoningState,
      stats: {
        totalCycles: state.totalCycles,
        totalThoughts: state.totalThoughts,
        totalActions: state.totalActions,
        lastCycleDuration: state.lastCycleDuration,
      },
    });
    return;
  }

  if (req.method === "POST" && req.url === "/cognitive/observe") {
    try {
      const body = await parseBody(req);
      const event = JSON.parse(body.toString()) as { source: string; title: string; detail: string };

      if (!event.source || !event.title) {
        sendJson(res, 400, { error: "source and title are required" });
        return;
      }

      const result = flux.processEvent({
        source: event.source as import("@ai-agent/attention").ObservationSource,
        title: event.title,
        detail: event.detail ?? "",
      });

      sendJson(res, 200, { processed: true, action: result.action });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/cognitive/message") {
    try {
      const body = await parseBody(req);
      const { message } = JSON.parse(body.toString()) as { message?: string };

      if (!message || typeof message !== "string") {
        sendJson(res, 400, { error: "message is required" });
        return;
      }

      flux.runtime.cognitive.message(message);
      const state = flux.runtime.cognitive.getState();

      sendJson(res, 200, {
        activeGoal: state.activeGoal,
        goals: state.goals,
        memoryUtilization: state.memory.utilization,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/cognitive/reason") {
    try {
      const result = await flux.runtime.cognitive.forceCycle("user_message");
      sendJson(res, 200, {
        thoughts: result.thoughts,
        recommendedAction: result.recommendedAction,
        confidence: result.confidence,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/cognitive/goals") {
    const state = flux.runtime.cognitive.getState();
    sendJson(res, 200, {
      active: state.activeGoal,
      all: state.goals,
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Flux API server running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  POST /chat                - Send a message`);
  console.log(`  POST /chat/stream         - Send a message (SSE streaming)`);
  console.log(`  POST /voice/transcribe    - Transcribe audio (base64 WAV)`);
  console.log(`  POST /voice/speak         - Text to speech (returns WAV)`);
  console.log(`  POST /attention/process   - Process an observation event`);
  console.log(`  GET  /attention/stats     - Get attention system stats`);
  console.log(`  GET  /cognitive/state     - Get cognitive system state`);
  console.log(`  POST /cognitive/observe   - Feed observation to cognitive system`);
  console.log(`  POST /cognitive/message   - Feed user message to cognitive system`);
  console.log(`  POST /cognitive/reason    - Force a reasoning cycle`);
  console.log(`  GET  /cognitive/goals     - Get current goals`);
  console.log(`  GET  /health              - Health check`);
  console.log(`  GET  /services            - List available services`);
});
