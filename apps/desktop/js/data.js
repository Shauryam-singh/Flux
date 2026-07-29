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
  if (cbs) cbs.forEach(cb => cb(data));
}

// ─── State ───
export const state = {
  mode: 'dormant', // dormant | hud | dashboard
  cognition: 'Initializing...',
  goal: { name: 'System Startup', progress: 0, blocker: '' },
  focus: ['packages/flux-runtime', 'Sensors', 'Cognition'],
  prediction: { text: 'Starting up', confidence: 50 },
  tasks: [],
  memories: [],
  sensors: [],
  thoughts: [],
  worldModel: [],
  mood: { icon: '\u{1F3D3}', label: 'Idle', sub: 'Awaiting connection' },
  confidence: { belief: 'Waiting for runtime data', primary: 50, alt: 'Unknown', altValue: 50 },
  time: '',
  cpu: 0,
  model: 'qwen2.5-coder',
  pipelineStage: 0,
  connected: false,
};

// ─── SSE Connection ───
let eventSource = null;
let reconnectTimer = null;
const API_BASE = 'http://localhost:3141';

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
      emit('connection', false);
      eventSource.close();
      eventSource = null;
      // Reconnect after 3s
      reconnectTimer = setTimeout(connectSSE, 3000);
    };

    eventSource.addEventListener('open', () => {
      state.connected = true;
      emit('connection', true);
    });
  } catch {
    // SSE not available (browser doesn't support it or API not running)
    state.connected = false;
    emit('connection', false);
    reconnectTimer = setTimeout(connectSSE, 5000);
  }
}

// ─── Stream Event Handler ───
function handleStreamEvent(data) {
  if (data.type === 'snapshot' || data.type === 'tick') {
    state.connected = true;

    // Update runtime state
    if (data.state) {
      state.cpu = Math.min(100, Math.max(0, Math.round((data.state.memorySize || 0) * 2)));
      state.pipelineStage = data.tickNumber ? ((data.tickNumber % 14) + 1) : state.pipelineStage;
    }

    // Update cognition from pipeline result
    if (data.pipelineResult) {
      updateCognitionFromPipeline(data.pipelineResult);
    }

    // Update goals
    if (data.goals && data.goals.length > 0) {
      const active = data.goals.find(g => g.status === 'active' || g.status === 'in_progress') || data.goals[0];
      state.goal = {
        name: active.title,
        progress: active.progress || 0,
        blocker: '',
      };
      emit('goal', state.goal);
    }

    // Update world model
    if (data.worldState) {
      updateWorldModelFromState(data.worldState);
    }

    // Update sensors from snapshots
    if (data.sensorSnapshots) {
      updateSensorsFromSnapshots(data.sensorSnapshots);
    }

    // Update thoughts from recent pipeline thoughts
    if (data.recentThoughts && data.recentThoughts.length > 0) {
      updateThoughtsFromRuntime(data.recentThoughts);
    }

    // Update memories from pipeline opportunities
    if (data.pipelineResult && data.pipelineResult.opportunities) {
      updateMemoriesFromOpportunities(data.pipelineResult.opportunities);
    }

    // Update prediction from user intent
    if (data.pipelineResult && data.pipelineResult.userIntent) {
      const intent = data.pipelineResult.userIntent;
      state.prediction = {
        text: intent.primaryIntent,
        confidence: Math.round(intent.confidence * 100),
      };
      emit('prediction', state.prediction);
    }

    // Update confidence from pipeline
    if (data.pipelineResult && data.pipelineResult.selectedAction) {
      const action = data.pipelineResult.selectedAction;
      state.confidence = {
        belief: action.reasoning,
        primary: Math.round(action.confidence * 100),
        alt: data.pipelineResult.userIntent?.primaryIntent || 'Unknown',
        altValue: Math.round((1 - action.confidence) * 100),
      };
      emit('confidence', state.confidence);
    }

    // Update mood from pipeline stage and thought count
    if (data.pipelineResult) {
      updateMoodFromPipeline(data.pipelineResult);
    }

    // Update focus from world model paths
    if (data.worldState && data.worldState.project) {
      const project = data.worldState.project;
      if (project.recentFiles && project.recentFiles.length > 0) {
        state.focus = project.recentFiles.slice(0, 3);
        emit('focus', state.focus);
      }
    }

    // Emit all updates
    emit('time', state.time);
    emit('cpu', state.cpu);
    emit('cognition', state.cognition);
    emit('sensors', state.sensors);
    emit('worldModel', state.worldModel);
    emit('mood', state.mood);
    emit('tasks', state.tasks);
    emit('memories', state.memories);
  }
}

// ─── Data Mapping Functions ───

function updateCognitionFromPipeline(result) {
  if (result.stages && result.stages.length > 0) {
    const lastStage = result.stages[result.stages.length - 1];
    state.cognition = `Stage ${result.stages.length}/14: ${lastStage.name}`;
    state.pipelineStage = result.stages.length;
  } else if (result.thoughts && result.thoughts.length > 0) {
    const latest = result.thoughts[result.thoughts.length - 1];
    state.cognition = latest.content.slice(0, 80);
  }
  emit('cognition', state.cognition);
}

function updateWorldModelFromState(worldState) {
  const nodes = [];

  // Project state
  if (worldState.project) {
    nodes.push({ name: 'Project', status: worldState.project.buildStatus || 'healthy' });
  }

  // Application state
  if (worldState.application) {
    nodes.push({ name: 'Application', status: worldState.application.status || 'running' });
    if (worldState.application.memoryUsage) {
      nodes.push({ name: 'Memory', status: worldState.application.memoryUsage > 80 ? 'busy' : 'healthy' });
    }
  }

  // System state
  if (worldState.system) {
    nodes.push({ name: 'System', status: worldState.system.load > 0.8 ? 'busy' : 'healthy' });
    nodes.push({ name: 'CPU', status: worldState.system.load > 0.9 ? 'critical' : worldState.system.load > 0.7 ? 'busy' : 'healthy' });
  }

  // Add fixed nodes based on runtime state
  nodes.push({ name: 'Runtime', status: 'healthy' });
  nodes.push({ name: 'Sensors', status: 'healthy' });
  nodes.push({ name: 'Cognition', status: 'busy' });

  state.worldModel = nodes;
  emit('worldModel', state.worldModel);
}

function updateSensorsFromSnapshots(snapshots) {
  const sensorDefs = [
    { name: 'Git', icon: '\u{1F4CC}', id: 'git' },
    { name: 'Filesystem', icon: '\u{1F4C1}', id: 'filesystem' },
    { name: 'Clipboard', icon: '\u{1F4CB}', id: 'clipboard' },
    { name: 'Docker', icon: '\u{1F433}', id: 'docker' },
    { name: 'Battery', icon: '\u{1F50B}', id: 'battery' },
    { name: 'Audio', icon: '\u{1F3B5}', id: 'audio' },
    { name: 'Notifications', icon: '\u{1F514}', id: 'notifications' },
    { name: 'Spotify', icon: '\u{1F3B5}', id: 'spotify' },
    { name: 'Idle', icon: '\u{23F1}', id: 'idle' },
  ];

  state.sensors = sensorDefs.map(def => {
    const snap = snapshots[def.id];
    let status = 'healthy';
    let lastEvent = 'No data';

    if (snap) {
      // Determine status and last event from snapshot
      switch (def.id) {
        case 'git':
          if (snap.branch) {
            lastEvent = `Branch: ${snap.branch}`;
            status = snap.isDirty ? 'busy' : 'healthy';
          }
          break;
        case 'docker':
          if (snap.runningCount !== undefined) {
            lastEvent = `${snap.runningCount} containers running`;
            status = snap.stoppedCount > 0 ? 'busy' : 'healthy';
          }
          break;
        case 'battery':
          if (snap.level !== undefined) {
            lastEvent = `${snap.level}%${snap.isCharging ? ' (charging)' : ''}`;
            status = snap.level < 20 ? 'offline' : 'healthy';
          }
          break;
        case 'clipboard':
          if (snap.text) {
            lastEvent = snap.text.slice(0, 40);
            status = 'healthy';
          }
          break;
        case 'spotify':
          if (snap.isPlaying !== undefined) {
            lastEvent = snap.isPlaying ? `${snap.track || 'Playing'}` : 'Paused';
            status = 'healthy';
          }
          break;
        case 'idle':
          if (snap.isIdle !== undefined) {
            lastEvent = snap.isIdle ? `Idle ${snap.idleSeconds || ''}s` : 'Active';
            status = snap.isIdle ? 'busy' : 'healthy';
          }
          break;
        case 'audio':
          if (snap.outputVolume !== undefined) {
            lastEvent = `Volume ${Math.round(snap.outputVolume * 100)}%`;
            status = snap.isMuted ? 'offline' : 'healthy';
          }
          break;
        case 'notifications':
          if (snap.recentNotifications) {
            lastEvent = `${snap.recentNotifications.length} recent`;
            status = snap.recentNotifications.length > 0 ? 'busy' : 'healthy';
          }
          break;
        default:
          lastEvent = 'Connected';
      }
    }

    return { name: def.name, icon: def.icon, status, lastEvent };
  });

  emit('sensors', state.sensors);
}

function updateThoughtsFromRuntime(thoughts) {
  // Take the most recent 10 and convert to UI format
  const recent = thoughts.slice(-10).reverse();
  state.thoughts = recent.map(t => ({
    type: t.type || 'thought',
    text: t.content.slice(0, 80),
    time: new Date(t.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  }));
  emit('thought', state.thoughts);
}

function updateMemoriesFromOpportunities(opportunities) {
  if (opportunities.length === 0) return;

  const newMems = opportunities.slice(-3).map(o => ({
    badge: o.type === 'learning' ? 'insight' : o.type === 'automation' ? 'reflection' : 'remember',
    text: o.description.slice(0, 60),
  }));

  state.memories = [...newMems, ...state.memories].slice(0, 8);
  emit('memories', state.memories);
}

function updateMoodFromPipeline(result) {
  if (!result.stages || result.stages.length === 0) return;

  const stageCount = result.stages.length;
  const thoughtCount = result.thoughts?.length || 0;

  if (stageCount <= 3) {
    state.mood = { icon: '\u{1F50D}', label: 'Observing', sub: 'Gathering data' };
  } else if (stageCount <= 7) {
    state.mood = { icon: '\u{1F9E0}', label: 'Thinking', sub: 'Processing observations' };
  } else if (stageCount <= 10) {
    state.mood = { icon: '\u{1F4CB}', label: 'Planning', sub: 'Evaluating options' };
  } else if (stageCount <= 13) {
    state.mood = { icon: '\u{2699}\uFE0F', label: 'Deciding', sub: 'Selecting action' };
  } else {
    state.mood = { icon: '\u{1F4AA}', label: 'Executing', sub: 'Running pipeline' };
  }

  if (thoughtCount > 5) {
    state.mood = { icon: '\u{1F3A8}', label: 'Creative', sub: 'Multiple ideas generated' };
  }

  emit('mood', state.mood);
}

// ─── Time Update (always real) ───
function updateTime() {
  const now = new Date();
  state.time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  emit('time', state.time);
}

// ─── Start Data Engine ───
let intervals = [];

export function startDataEngine() {
  updateTime();
  intervals = [
    setInterval(updateTime, 1000),
  ];

  // Connect to SSE stream
  connectSSE();

  // If no connection after 2s, populate with minimal defaults
  setTimeout(() => {
    if (!state.connected) {
      state.cognition = 'Awaiting runtime connection...';
      state.mood = { icon: '\u{1F4E1}', label: 'Connecting', sub: 'Waiting for API server' };
      emit('cognition', state.cognition);
      emit('mood', state.mood);
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
