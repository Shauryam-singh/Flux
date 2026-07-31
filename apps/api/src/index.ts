import { createServer } from "node:http";
import { createFlux, type FluxConfig } from "@ai-agent/cli/flux";
import { WhisperEngine } from "@ai-agent/voice-stt";
import { PiperEngine } from "@ai-agent/voice-tts";

const PORT = parseInt(process.env.FLUX_API_PORT ?? "3141", 10);

const fluxConfig: FluxConfig = {
  provider: "ollama",
  model: "qwen2.5-coder:7b",
  providerConfigs: {
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    },
  },
};

const flux = createFlux(fluxConfig);

// Start background cognition loop (observe → think → update → sleep → repeat)
flux.runtime.start();

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

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  data: unknown,
) {
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
        Connection: "keep-alive",
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
              res.write(
                `data: ${JSON.stringify({ token: "", done: true, text: fullText })}\n\n`,
              );
              res.end();
            },
            onError: (error: Error) => {
              res.write(
                `data: ${JSON.stringify({ error: error.message })}\n\n`,
              );
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
        res.write(
          `data: ${JSON.stringify({ token: fullText, done: false })}\n\n`,
        );
        res.write(
          `data: ${JSON.stringify({ token: "", done: true, text: fullText })}\n\n`,
        );
        res.end();
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ error })}\n\n`);
      res.end();
    }
    return;
  }

  // ─── SSE Event Stream ──────────────────────────────────────────
  if (req.method === "GET" && req.url === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial snapshot
    try {
      const snapshot = await flux.runtime.getStreamingSnapshot();
      res.write(
        `data: ${JSON.stringify({ type: "snapshot", ...snapshot })}\n\n`,
      );
    } catch {
      // Best-effort
    }

    // Subscribe to tick events
    const unsubscribeTick = flux.runtime.onTick(async (event) => {
      try {
        const snapshot = await flux.runtime.getStreamingSnapshot();
        res.write(
          `data: ${JSON.stringify({ type: "tick", tickNumber: event.tickNumber, timestamp: event.timestamp, duration: event.duration, observations: event.observations, ...snapshot })}\n\n`,
        );
      } catch {
        // Best-effort — send minimal tick data
        res.write(
          `data: ${JSON.stringify({ type: "tick", tickNumber: event.tickNumber, timestamp: event.timestamp, duration: event.duration, observations: event.observations })}\n\n`,
        );
      }
    });

    // Subscribe to proactive messages — forward as SSE events
    const unsubscribeProactive = flux.runtime.onProactiveMessage((msgJson) => {
      try {
        res.write(`data: ${JSON.stringify({ type: "proactive_message", ...JSON.parse(msgJson) })}\n\n`);
      } catch {
        // Best-effort
      }
    });

    // Subscribe to proactive speech — forward as SSE event with TTS URL
    const unsubscribeSpeak = flux.runtime.onProactiveSpeak((text: string) => {
      try {
        res.write(`data: ${JSON.stringify({ type: "proactive_speak", text, timestamp: Date.now() })}\n\n`);
      } catch {
        // Best-effort
      }
    });

    // Heartbeat every 15s to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 15000);

    // Cleanup on disconnect
    req.on("close", () => {
      unsubscribeTick();
      unsubscribeProactive();
      unsubscribeSpeak();
      clearInterval(heartbeat);
    });

    return;
  }

  // ─── One-shot state fetch ──────────────────────────────────────
  if (req.method === "GET" && req.url === "/state") {
    try {
      const snapshot = await flux.runtime.getStreamingSnapshot();
      sendJson(res, 200, snapshot);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error });
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

  // ─── Chat History ────────────────────────────────────────────────
  if (req.method === "GET" && req.url?.startsWith("/chat/history")) {
    try {
      const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
      const limit = parseInt(url.searchParams.get("limit") ?? "40", 10);
      const history = await flux.session.memory.history();
      const recent = history.slice(-limit);
      sendJson(res, 200, { messages: recent });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/voice/transcribe") {
    try {
      const body = await parseBody(req);
      const json = JSON.parse(body.toString()) as {
        audio?: string;
        sampleRate?: number;
      };

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
      const json = JSON.parse(body.toString()) as {
        text?: string;
        voice?: string;
        speed?: number;
        pitch?: number;
        volume?: number;
      };

      if (!json.text || typeof json.text !== "string") {
        sendJson(res, 400, { error: "text is required" });
        return;
      }

      await tts.initialize();

      // Strip emoji from text before TTS
      const cleanText = json.text
        .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
        .replace(/[\u{2600}-\u{26FF}]/gu, "")
        .replace(/[\u{2700}-\u{27BF}]/gu, "")
        .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
        .replace(/[\u{200D}]/gu, "")
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
        .replace(/[\u{1FA00}-\u{1FAFF}]/gu, "")
        .replace(/[\u{2300}-\u{23FF}]/gu, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      const audio = await tts.synthesize(cleanText, {
        ...(json.voice != null ? { voice: json.voice } : {}),
        ...(json.speed != null ? { speed: json.speed } : {}),
        ...(json.pitch != null ? { pitch: json.pitch } : {}),
        ...(json.volume != null ? { volume: json.volume } : {}),
      });

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

  // ─── Proactive Messages ───────────────────────────────────────
  if (req.method === "GET" && req.url?.startsWith("/proactive/messages")) {
    try {
      const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
      const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
      const messages = flux.runtime.getProactiveMessages(limit);
      sendJson(res, 200, { messages });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error });
    }
    return;
  }

  // ─── Auto-Response Trigger ────────────────────────────────────
  if (req.method === "POST" && req.url === "/proactive/trigger") {
    try {
      const body = await parseBody(req);
      const json = JSON.parse(body.toString()) as {
        source?: string;
        event?: string;
        context?: Record<string, unknown>;
      };

      if (!json.source || !json.event) {
        sendJson(res, 400, { error: "source and event are required" });
        return;
      }

      // Fire and forget — don't block the response
      void flux.runtime.triggerAutoResponse({
        source: json.source,
        event: json.event,
        ...(json.context != null ? { context: json.context } : {}),
      });

      sendJson(res, 202, { accepted: true });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error });
    }
    return;
  }

  // ─── Suggestion Action ────────────────────────────────────────
  if (req.method === "POST" && req.url?.startsWith("/suggestions/")) {
    try {
      const suggestionId = req.url.split("/suggestions/")[1]?.split("?")[0];
      const body = await parseBody(req);
      const json = JSON.parse(body.toString()) as {
        action?: string;
      };

      if (!suggestionId) {
        sendJson(res, 400, { error: "suggestion id is required" });
        return;
      }

      // Find the suggestion and trigger a conversation about it
      const suggestions = flux.runtime.getProactiveMessages(50);
      const suggestion = suggestions.find((s: { id: string }) => s.id === suggestionId);

      if (!suggestion) {
        sendJson(res, 404, { error: "suggestion not found" });
        return;
      }

      // Process the suggestion as a user message to get an intelligent response
      const response = await flux.process(
        json.action === "dismiss"
          ? `User dismissed suggestion: "${suggestion.content}"`
          : `User asked about: "${suggestion.content}". Provide a helpful, actionable response.`,
      );

      // Track dismissal for learning (Tier 3)
      if (json.action === "dismiss") {
        flux.runtime.recordSuggestionDismissal(suggestionId, suggestion.content);
      }

      sendJson(res, 200, { reply: response, suggestionId });
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
        {
          name: "attention",
          description: "Event filtering and prioritization",
        },
        {
          name: "cognitive",
          description: "Reasoning, goals, and decision engine",
        },
      ],
    });
    return;
  }

  if (req.method === "POST" && req.url === "/attention/process") {
    try {
      const body = await parseBody(req);
      const event = JSON.parse(body.toString()) as {
        source: string;
        title: string;
        detail: string;
      };

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
      const event = JSON.parse(body.toString()) as {
        source: string;
        title: string;
        detail: string;
      };

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

  // ─── Goals (full detail) ────────────────────────────────────────
  if (req.method === "GET" && req.url === "/goals") {
    const goals = flux.runtime.goalManager.getAll();
    sendJson(res, 200, { goals });
    return;
  }

  // ─── Memory stats ──────────────────────────────────────────────
  if (req.method === "GET" && req.url === "/memory/stats") {
    const stats = flux.runtime.memory.getStats();
    sendJson(res, 200, stats);
    return;
  }

  // ─── All memories (for memory page UI) ─────────────────────────
  if (req.method === "GET" && req.url === "/memory/all") {
    const limit = parseInt(
      new URL(req.url ?? "/", `http://localhost:${PORT}`).searchParams.get(
        "limit",
      ) ?? "50",
      10,
    );
    const allTypes: Array<
      | "semantic"
      | "episodic"
      | "procedural"
      | "relationship"
      | "project"
      | "timeline"
      | "reflection"
    > = [
      "semantic",
      "episodic",
      "procedural",
      "relationship",
      "project",
      "timeline",
      "reflection",
    ];
    const memories: Record<string, unknown[]> = {};
    for (const type of allTypes) {
      const result = flux.runtime.memory.query({
        types: [type],
        sortBy: "recency",
        limit,
      });
      memories[type] = [...result.memories];
    }
    // Also include chat history from session memory
    const chatHistory = await flux.session.memory.history();
    sendJson(res, 200, {
      memories,
      chatHistory,
      stats: flux.runtime.memory.getStats(),
    });
    return;
  }

  // ─── Episodic memories (for briefing) ──────────────────────────
  if (req.method === "GET" && req.url === "/memory/episodic") {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const maxAgeMs = parseInt(
      url.searchParams.get("maxAge") ?? String(24 * 60 * 60 * 1000),
      10,
    );
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const result = flux.runtime.memory.query({
      types: ["episodic"],
      maxAge: maxAgeMs,
      sortBy: "recency",
      limit,
    });
    sendJson(res, 200, {
      memories: result.memories,
      total: result.totalMatches,
    });
    return;
  }

  // ─── Timeline (from memory) ────────────────────────────────────
  if (req.method === "GET" && req.url === "/timeline") {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const limit = parseInt(url.searchParams.get("limit") ?? "30", 10);
    const timelineMems = flux.runtime.memory.getTimeline();
    sendJson(res, 200, { events: timelineMems.slice(0, limit) });
    return;
  }

  // ─── Habits ────────────────────────────────────────────────────
  if (req.method === "GET" && req.url === "/habits") {
    const habits = flux.runtime.habits.getAll();
    sendJson(res, 200, { habits });
    return;
  }

  // ─── Experiences ───────────────────────────────────────────────
  if (req.method === "GET" && req.url === "/experiences") {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const experiences = flux.runtime.experienceDb.getRecent(limit);
    sendJson(res, 200, { experiences });
    return;
  }

  // ─── Agents (built-in agent definitions) ───────────────────────
  if (req.method === "GET" && req.url === "/agents") {
    const agents = [
      {
        id: "coder",
        name: "Code Agent",
        status: "active",
        capabilities: ["code_generation", "refactoring", "debugging"],
        priority: 1,
        successRate: 0.85,
        tasks: 0,
        maxTasks: 3,
      },
      {
        id: "researcher",
        name: "Research Agent",
        status: "active",
        capabilities: ["web_search", "documentation", "analysis"],
        priority: 2,
        successRate: 0.8,
        tasks: 0,
        maxTasks: 2,
      },
      {
        id: "reviewer",
        name: "Review Agent",
        status: "idle",
        capabilities: ["code_review", "security_audit", "performance"],
        priority: 3,
        successRate: 0.9,
        tasks: 0,
        maxTasks: 2,
      },
      {
        id: "planner",
        name: "Planning Agent",
        status: "active",
        capabilities: ["task_decomposition", "scheduling", "prioritization"],
        priority: 1,
        successRate: 0.88,
        tasks: 0,
        maxTasks: 1,
      },
      {
        id: "monitor",
        name: "Monitor Agent",
        status: "active",
        capabilities: ["system_monitoring", "alerting", "diagnostics"],
        priority: 2,
        successRate: 0.92,
        tasks: 0,
        maxTasks: 5,
      },
    ];
    sendJson(res, 200, { agents });
    return;
  }

  // ─── Projects ──────────────────────────────────────────────────
  if (req.method === "GET" && req.url === "/projects") {
    const projectMems = flux.runtime.memory.getProject();
    const projects = [
      {
        name: "Flux AI OS",
        description: "AI operating system with 6 architectural phases",
        status: "active",
        packages: 86,
        lastActivity: Date.now(),
      },
      ...projectMems.map((m) => ({
        name: m.projectName || "Unknown",
        description: m.content?.slice(0, 100) || "",
        status: "active" as const,
        packages: 0,
        lastActivity: m.timestamp,
      })),
    ];
    // Deduplicate by name
    const seen = new Set<string>();
    const unique = projects.filter((p) => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
    sendJson(res, 200, { projects: unique.slice(0, 10) });
    return;
  }

  // ─── Briefing (yesterday's summary) ────────────────────────────
  if (req.method === "GET" && req.url === "/briefing") {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const episodic = flux.runtime.memory.query({
      types: ["episodic"],
      maxAge: oneDayMs,
      sortBy: "recency",
      limit: 15,
    });
    const reflections = flux.runtime.memory.query({
      types: ["reflection"],
      maxAge: oneDayMs,
      sortBy: "recency",
      limit: 5,
    });
    const goals = flux.runtime.goalManager.getAll();
    const experiences = flux.runtime.experienceDb.getRecent(10);
    const stats = flux.runtime.memory.getStats();

    sendJson(res, 200, {
      episodic: episodic.memories,
      reflections: reflections.memories,
      goals,
      experiences,
      memoryStats: stats,
      uptime: Date.now() - flux.runtime.getState().uptime,
    });
    return;
  }

  // ─── Tier 3: Cross-Sensor Correlations ────────────────────────
  if (req.method === "GET" && req.url === "/correlations") {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const limit = parseInt(url.searchParams.get("limit") ?? "10", 10);
    const correlations = flux.runtime.getCorrelations(limit);
    sendJson(res, 200, { correlations });
    return;
  }

  // ─── Tier 3: Dismissal Stats ─────────────────────────────────
  if (req.method === "GET" && req.url === "/dismissals/stats") {
    const stats = flux.runtime.getDismissalStats();
    sendJson(res, 200, stats);
    return;
  }

  // ─── Tier 3: Record Dismissal ────────────────────────────────
  if (req.method === "POST" && req.url === "/dismissals") {
    try {
      const body = await parseBody(req);
      const { suggestionId, message } = JSON.parse(body.toString()) as {
        suggestionId?: string;
        message?: string;
      };
      if (!suggestionId) {
        sendJson(res, 400, { error: "suggestionId is required" });
        return;
      }
      flux.runtime.recordSuggestionDismissal(suggestionId, message ?? "");
      sendJson(res, 200, { recorded: true });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Flux API server running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  POST /chat                - Send a message`);
  console.log(`  POST /chat/stream         - Send a message (SSE streaming)`);
  console.log(
    `  GET  /events              - SSE event stream (runtime events)`,
  );
  console.log(`  GET  /state               - One-shot state snapshot`);
  console.log(`  GET  /goals               - All goals`);
  console.log(`  GET  /agents              - Agent definitions`);
  console.log(`  GET  /projects            - Project data`);
  console.log(`  GET  /timeline            - Timeline events`);
  console.log(`  GET  /memory/stats        - Memory statistics`);
  console.log(`  GET  /memory/episodic     - Recent episodic memories`);
  console.log(`  GET  /habits              - Detected habits`);
  console.log(`  GET  /experiences         - Past experiences`);
  console.log(`  GET  /briefing            - Yesterday's summary`);
  console.log(`  POST /voice/transcribe    - Transcribe audio (base64 WAV)`);
  console.log(`  POST /voice/speak         - Text to speech (returns WAV)`);
  console.log(`  POST /attention/process   - Process an observation event`);
  console.log(`  GET  /attention/stats     - Get attention system stats`);
  console.log(`  GET  /cognitive/state     - Get cognitive system state`);
  console.log(
    `  POST /cognitive/observe   - Feed observation to cognitive system`,
  );
  console.log(
    `  POST /cognitive/message   - Feed user message to cognitive system`,
  );
  console.log(`  POST /cognitive/reason    - Force a reasoning cycle`);
  console.log(`  GET  /cognitive/goals     - Get current goals`);
  console.log(`  GET  /health              - Health check`);
  console.log(`  GET  /services            - List available services`);
  console.log(`  GET  /correlations        - Cross-sensor correlations`);
  console.log(`  GET  /dismissals/stats    - Suggestion dismissal stats`);
  console.log(`  POST /dismissals          - Record suggestion dismissal`);
});
