// ═══════════════════════════════════════════════════════════════
// FLUX DATA ENGINE — Reactive state with real runtime data via SSE
// ═══════════════════════════════════════════════════════════════

// ─── Event System ───
const listeners = new Map();

export function on(event, callback) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(callback);
}

export function emit(event, data) {
  const cbs = listeners.get(event);
  if (cbs) {
    for (const cb of cbs) cb(data);
  }
}

// ─── State ───
export const state = {
  mode: "dormant", // dormant | hud | dashboard
  cognition: "",
  goal: { name: "", progress: 0, blocker: "" },
  focus: [],
  prediction: { text: "", confidence: 0 },
  tasks: [],
  memories: [],
  sensors: [],
  thoughts: [],
  worldModel: [],
  mood: { icon: "\u{1F4E1}", label: "Connecting", sub: "Waiting for API" },
  confidence: { belief: "", primary: 0, alt: "", altValue: 0 },
  time: "",
  cpu: 0,
  model: "",
  pipelineStage: 0,
  pipelineStageName: "",
  connected: false,
};

// ─── SSE Connection ───
let eventSource = null;
let reconnectTimer = null;
const API_BASE = "http://localhost:3141";

function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  try {
    eventSource = new EventSource(`${API_BASE}/events`);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handleStreamEvent(data);
      } catch {
        // Ignore parse errors (heartbeat comments, etc.)
      }
    };

    eventSource.onerror = () => {
      state.connected = false;
      emit("connection", false);
      eventSource.close();
      eventSource = null;
      // Reconnect after 3s
      reconnectTimer = setTimeout(connectSSE, 3000);
    };

    eventSource.addEventListener("open", () => {
      state.connected = true;
      emit("connection", true);
    });
  } catch {
    // SSE not available (browser doesn't support it or API not running)
    state.connected = false;
    emit("connection", false);
    reconnectTimer = setTimeout(connectSSE, 5000);
  }
}

// ─── Stream Event Handler ───
function handleStreamEvent(data) {
  if (data.type === "snapshot" || data.type === "tick") {
    state.connected = true;

    // Update runtime state
    if (data.state) {
      state.cpu = Math.min(
        100,
        Math.max(0, Math.round((data.state.memorySize || 0) * 2)),
      );
      if (data.state.model) {
        state.model = data.state.model;
        emit("model", state.model);
      }
    }

    // Update tasks from sensor running state
    if (data.sensorSnapshots) {
      const newTasks = [];
      for (const [id, snap] of Object.entries(data.sensorSnapshots)) {
        if (!snap) continue;
        if (id === "git" && snap.branch) {
          newTasks.push({
            name: `Git: ${snap.branch}`,
            status: snap.isDirty ? "active" : "done",
          });
        }
        if (id === "docker" && snap.runningCount !== undefined) {
          newTasks.push({
            name: `Docker: ${snap.runningCount} containers`,
            status: snap.stoppedCount > 0 ? "active" : "done",
          });
        }
        if (id === "filesystem" && snap.recentChanges) {
          newTasks.push({
            name: `Files: ${snap.recentChanges.length} changes`,
            status: "active",
          });
        }
      }
      if (newTasks.length > 0) state.tasks = newTasks;
    }

    // Update cognition from pipeline result
    if (data.pipelineResult) {
      updateCognitionFromPipeline(data.pipelineResult);
    }

    // Update goals
    if (data.goals && data.goals.length > 0) {
      const active =
        data.goals.find(
          (g) => g.status === "active" || g.status === "in_progress",
        ) || data.goals[0];
      state.goal = {
        name: active.title,
        progress: active.progress || 0,
        blocker: "",
      };
      emit("goal", state.goal);
    }

    // Update world model
    if (data.worldState) {
      updateWorldModelFromState(data.worldState);
    }

    // Update sensors from snapshots
    if (data.sensorSnapshots) {
      updateSensorsFromSnapshots(data.sensorSnapshots);
    }

    // Update focus from world model paths
    if (data.worldState && data.worldState.project) {
      const project = data.worldState.project;
      if (project.recentFiles && project.recentFiles.length > 0) {
        state.focus = project.recentFiles.slice(0, 3);
        emit("focus", state.focus);
      }
    }

    // Emit all updates
    emit("time", state.time);
    emit("cpu", state.cpu);
    emit("sensors", state.sensors);
    emit("worldModel", state.worldModel);
    emit("tasks", state.tasks);

    // Fetch supplementary data periodically (not every tick)
    if (data.tickNumber && data.tickNumber % 5 === 0) {
      fetchTimeline();
      fetchMemoryStats();
    }
  }
}

// ─── Fetch supplementary data from API ───

async function fetchTimeline() {
  try {
    const resp = await fetch(`${API_BASE}/timeline?limit=8`);
    if (!resp.ok) return;
    const data = await resp.json();
    emit("timeline", data.events || []);
  } catch {}
}

async function fetchMemoryStats() {
  try {
    const resp = await fetch(`${API_BASE}/memory/stats`);
    if (!resp.ok) return;
    const stats = await resp.json();
    emit("dashMemory", stats);
  } catch {}
}

// ─── Data Mapping Functions ───

function updateCognitionFromPipeline(result) {
  // Show the latest thought as the cognition text
  if (result.thoughts && result.thoughts.length > 0) {
    const latest = result.thoughts[result.thoughts.length - 1];
    state.cognition = latest.content.slice(0, 100);
  } else if (result.stages && result.stages.length > 0) {
    state.cognition = `Pipeline complete (${result.stages.length} stages)`;
  }

  // Track pipeline stage for dashboard display
  if (result.stages && result.stages.length > 0) {
    state.pipelineStage = result.stages.length;
    state.pipelineStageName =
      result.stages[result.stages.length - 1]?.name ?? "";
  }

  // Update thoughts from pipeline
  if (result.thoughts && result.thoughts.length > 0) {
    updateThoughtsFromRuntime(result.thoughts);
  }

  // Update confidence — use selectedAction or fall back to latest thought
  if (result.selectedAction) {
    state.confidence = {
      belief: result.selectedAction.reasoning,
      primary: Math.round(result.selectedAction.confidence * 100),
      alt: result.userIntent?.primaryIntent || "None",
      altValue: Math.round((1 - result.selectedAction.confidence) * 100),
    };
  } else if (result.thoughts && result.thoughts.length > 0) {
    const latest = result.thoughts[result.thoughts.length - 1];
    state.confidence = {
      belief: latest.reasoning || latest.content.slice(0, 60),
      primary: Math.round((latest.confidence?.value ?? 0.5) * 100),
      alt: result.userIntent?.primaryIntent || "None",
      altValue: Math.round((1 - (latest.confidence?.value ?? 0.5)) * 100),
    };
  }
  emit("confidence", state.confidence);

  // Update prediction from user intent
  if (result.userIntent) {
    state.prediction = {
      text: result.userIntent.primaryIntent,
      confidence: Math.round(result.userIntent.confidence * 100),
    };
    emit("prediction", state.prediction);
  }

  // Update mood based on thought content and count
  updateMoodFromPipeline(result);

  // Update memories from opportunities
  if (result.opportunities) {
    updateMemoriesFromOpportunities(result.opportunities);
  }

  emit("cognition", state.cognition);
}

function updateWorldModelFromState(worldState) {
  const nodes = [];

  // Project state
  if (worldState.project) {
    nodes.push({
      name: "Project",
      status: worldState.project.buildStatus || "healthy",
    });
  }

  // Application state
  if (worldState.application) {
    nodes.push({
      name: "Application",
      status: worldState.application.status || "running",
    });
    if (worldState.application.memoryUsage) {
      nodes.push({
        name: "Memory",
        status: worldState.application.memoryUsage > 80 ? "busy" : "healthy",
      });
    }
  }

  // System state
  if (worldState.system) {
    nodes.push({
      name: "System",
      status: worldState.system.load > 0.8 ? "busy" : "healthy",
    });
    nodes.push({
      name: "CPU",
      status:
        worldState.system.load > 0.9
          ? "critical"
          : worldState.system.load > 0.7
            ? "busy"
            : "healthy",
    });
  }

  state.worldModel = nodes;
  emit("worldModel", state.worldModel);
}

function updateSensorsFromSnapshots(snapshots) {
  const sensorDefs = [
    { name: "Git", icon: "\u{1F4CC}", id: "git" },
    { name: "Filesystem", icon: "\u{1F4C1}", id: "filesystem" },
    { name: "Clipboard", icon: "\u{1F4CB}", id: "clipboard" },
    { name: "Docker", icon: "\u{1F433}", id: "docker" },
    { name: "Battery", icon: "\u{1F50B}", id: "battery" },
    { name: "Audio", icon: "\u{1F3B5}", id: "audio" },
    { name: "Notifications", icon: "\u{1F514}", id: "notifications" },
    { name: "Spotify", icon: "\u{1F3B5}", id: "spotify" },
    { name: "Idle", icon: "\u{23F1}", id: "idle" },
  ];

  state.sensors = sensorDefs.map((def) => {
    const snap = snapshots[def.id];
    let status = "healthy";
    let lastEvent = "No data";

    if (snap) {
      // Determine status and last event from snapshot
      switch (def.id) {
        case "git":
          if (snap.branch) {
            lastEvent = `Branch: ${snap.branch}${snap.isDirty ? " (dirty)" : ""}`;
            status = snap.isDirty ? "busy" : "healthy";
          } else if (snap.status) {
            lastEvent =
              snap.status === "running" ? "Running" : capitalize(snap.status);
          }
          break;
        case "docker":
          if (snap.runningCount !== undefined) {
            lastEvent = `${snap.runningCount} containers running`;
            status = snap.stoppedCount > 0 ? "busy" : "healthy";
          } else if (snap.status) {
            lastEvent =
              snap.status === "running" ? "Running" : capitalize(snap.status);
          }
          break;
        case "battery":
          if (snap.level !== undefined) {
            lastEvent = `${snap.level}%${snap.isCharging ? " (charging)" : ""}`;
            status = snap.level < 20 ? "offline" : "healthy";
          } else if (snap.status) {
            lastEvent =
              snap.status === "unavailable"
                ? "No battery"
                : capitalize(snap.status);
          }
          break;
        case "clipboard":
          if (snap.text) {
            lastEvent = snap.text.slice(0, 40);
            status = "healthy";
          } else if (snap.status) {
            lastEvent =
              snap.status === "running" ? "Running" : capitalize(snap.status);
          }
          break;
        case "spotify":
          if (snap.isPlaying !== undefined) {
            lastEvent = snap.isPlaying
              ? `${snap.track || "Playing"}`
              : "Paused";
            status = "healthy";
          } else if (snap.status) {
            lastEvent =
              snap.status === "running" ? "Running" : capitalize(snap.status);
          }
          break;
        case "idle":
          if (snap.isIdle !== undefined) {
            lastEvent = snap.isIdle
              ? `Idle ${snap.idleSeconds || ""}s`
              : "Active";
            status = snap.isIdle ? "busy" : "healthy";
          } else if (snap.status) {
            lastEvent =
              snap.status === "running" ? "Running" : capitalize(snap.status);
          }
          break;
        case "audio":
          if (snap.outputVolume !== undefined) {
            lastEvent = `Volume ${Math.round(snap.outputVolume)}%`;
            status = snap.isMuted ? "offline" : "healthy";
          } else if (snap.status) {
            lastEvent =
              snap.status === "running" ? "Running" : capitalize(snap.status);
          }
          break;
        case "notifications":
          if (snap.recentNotifications) {
            lastEvent = `${snap.recentNotifications.length} recent`;
            status = snap.recentNotifications.length > 0 ? "busy" : "healthy";
          } else if (snap.status) {
            lastEvent =
              snap.status === "running" ? "Running" : capitalize(snap.status);
          }
          break;
        case "filesystem":
          if (snap.recentChanges) {
            lastEvent = `${snap.recentChanges.length} changes`;
            status = snap.recentChanges.length > 0 ? "busy" : "healthy";
          } else if (snap.status) {
            lastEvent =
              snap.status === "running" ? "Running" : capitalize(snap.status);
          }
          break;
        default:
          lastEvent = snap.status ? capitalize(snap.status) : "Connected";
      }
    }

    return { name: def.name, icon: def.icon, status, lastEvent };
  });

  emit("sensors", state.sensors);
}

function updateThoughtsFromRuntime(thoughts) {
  // Take the most recent 10 and convert to UI format
  const recent = thoughts.slice(-10).reverse();
  state.thoughts = recent.map((t) => ({
    type: t.type || "thought",
    text: t.content.slice(0, 80),
    time: new Date(t.timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  }));
  emit("thought", state.thoughts);
}

function updateMemoriesFromOpportunities(opportunities) {
  if (opportunities.length === 0) return;

  const newMems = opportunities.slice(-3).map((o) => ({
    badge:
      o.type === "learning"
        ? "insight"
        : o.type === "automation"
          ? "reflection"
          : "remember",
    text: o.description.slice(0, 60),
  }));

  state.memories = [...newMems, ...state.memories].slice(0, 8);
  emit("memories", state.memories);
}

function updateMoodFromPipeline(result) {
  const thoughts = result.thoughts || [];
  const thoughtCount = thoughts.length;

  // Base mood on thought types
  const typeCounts = {};
  for (const t of thoughts) {
    const type = t.type || "unknown";
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  if (typeCounts.concern > 0) {
    state.mood = {
      icon: "\u26A0\uFE0F",
      label: "Concerned",
      sub: `${typeCounts.concern} issue(s) detected`,
    };
  } else if (typeCounts.pattern_recognition > 1) {
    state.mood = {
      icon: "\u{1F3A8}",
      label: "Insightful",
      sub: "Patterns recognized",
    };
  } else if (typeCounts.user_intent > 0) {
    state.mood = {
      icon: "\u{1F50D}",
      label: "Focused",
      sub: "Predicting user needs",
    };
  } else if (typeCounts.observation_interpretation > 2) {
    state.mood = {
      icon: "\u{1F9E0}",
      label: "Thinking",
      sub: `Processing ${thoughtCount} observations`,
    };
  } else if (thoughtCount > 3) {
    state.mood = {
      icon: "\u{1F4AA}",
      label: "Active",
      sub: `${thoughtCount} thoughts generated`,
    };
  } else if (thoughtCount > 0) {
    state.mood = {
      icon: "\u{1F4E1}",
      label: "Observing",
      sub: "Gathering context",
    };
  } else {
    state.mood = {
      icon: "\u{1F4A4}",
      label: "Idle",
      sub: "Waiting for activity",
    };
  }

  emit("mood", state.mood);
}

// ─── Time Update (always real) ───
function updateTime() {
  const now = new Date();
  state.time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  emit("time", state.time);
}

// ─── Start Data Engine ───
let intervals = [];

export function startDataEngine() {
  updateTime();
  intervals = [setInterval(updateTime, 1000)];

  // Connect to SSE stream
  connectSSE();

  // If no connection after 2s, populate with minimal defaults
  setTimeout(() => {
    if (!state.connected) {
      state.cognition = "Awaiting runtime connection...";
      state.mood = {
        icon: "\u{1F4E1}",
        label: "Connecting",
        sub: "Waiting for API server",
      };
      emit("cognition", state.cognition);
      emit("mood", state.mood);
    }
  }, 2000);
}

export function stopDataEngine() {
  intervals.forEach(clearInterval);
  intervals = [];
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}
