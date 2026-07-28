// ═══════════════════════════════════════════════════════════════
// FLUX DATA ENGINE — Reactive state with simulated live updates
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

// ─── Mock Data Pools ───
const cognitionTexts = [
  'Thinking...', 'Analysing build errors', 'Updating world model',
  'Consolidating memories', 'Waiting for new observations',
  'Planning next action', 'Reviewing code changes', 'Scanning sensors',
  'Evaluating goals', 'Processing git diff', 'Learning user patterns',
  'Optimizing task graph', 'Calibrating confidence', 'Generating hypotheses',
  'Merging observations', 'Strengthening memories', 'Detecting workflows',
  'Predicting user intent', 'Running simulation', 'Researching best practices',
  'Building skill index', 'Evaluating strategies', 'Reflecting on past actions',
  'Monitoring Docker containers', 'Indexing project files',
];

const goalNames = [
  'Executive Intelligence', 'Memory Consolidation', 'Sensor Integration',
  'Background Cognition', 'Workflow Discovery', 'Skill Learning',
  'Knowledge Graph', 'Confidence Calibration', 'Self-Evaluation',
];

const goalBlockers = [
  '', '', '', '', '',
  'Waiting for Docker rebuild',
  'Circular dependency detected',
  'Pending user approval',
];

const focusAreas = [
  ['packages/runtime', 'Docker', 'Git'],
  ['src/executive', 'task-graph', 'API'],
  ['packages/cognitive-memory', 'consolidation'],
  ['packages/sensors', 'filesystem', 'clipboard'],
  ['packages/thought-graph', 'cognition-pipeline'],
  ['apps/cli', 'daemon', 'background'],
  ['packages/self-evolution', 'meta-cognition'],
  ['packages/working-memory', 'goals', 'reasoning'],
];

const predictions = [
  { text: 'Likely preparing commit', confidence: 87 },
  { text: 'Debugging runtime errors', confidence: 72 },
  { text: 'Writing documentation', confidence: 65 },
  { text: 'Reviewing code changes', confidence: 81 },
  { text: 'Taking a break', confidence: 45 },
  { text: 'Starting new feature', confidence: 68 },
  { text: 'Running tests', confidence: 79 },
  { text: 'Refactoring modules', confidence: 73 },
];

const taskTemplates = [
  { text: 'Repository indexed', status: 'done' },
  { text: 'Monitoring Git', status: 'active' },
  { text: 'Docker healthy', status: 'active' },
  { text: 'Watching filesystem', status: 'active' },
  { text: 'Building embeddings', status: 'pending' },
  { text: 'Consolidating memories', status: 'pending' },
  { text: 'Syncing sensors', status: 'active' },
  { text: 'Running diagnostics', status: 'pending' },
];

const memoryTemplates = [
  { badge: 'remember', text: 'User prefers TypeScript' },
  { badge: 'remember', text: 'Project uses Result<T,E>' },
  { badge: 'reflection', text: 'Working on Executive layer' },
  { badge: 'insight', text: 'Circular imports causing issues' },
  { badge: 'remember', text: 'Piper voice installed at /usr/bin' },
  { badge: 'reflection', text: 'Should consolidate similar memories' },
  { badge: 'insight', text: 'Docker compose needs restart' },
  { badge: 'remember', text: 'User likes concise responses' },
];

const thoughtTypes = ['observed', 'thought', 'evidence', 'decision', 'confidence'];
const thoughtTexts = [
  'Modified runtime.ts', 'Dependency graph becoming complex',
  '18 imports detected', 'Wait until user finishes typing',
  '91% confidence', 'New sensor event from Git',
  'Memory access pattern detected', 'Goal progress stalled',
  'Docker container restarted', 'Clipboard content changed',
  'User idle for 5 minutes', 'File watch triggered',
  'Build succeeded after retry', 'Optimization opportunity found',
];

const moodStates = [
  { icon: '\u{1F9E0}', label: 'Focused', sub: 'Deep analysis in progress' },
  { icon: '\u{1F3A8}', label: 'Creative', sub: 'Generating novel solutions' },
  { icon: '\u{1F50D}', label: 'Investigating', sub: 'Tracing root cause' },
  { icon: '\u{1F4DA}', label: 'Learning', sub: 'Acquiring new patterns' },
  { icon: '\u{1F4CB}', label: 'Planning', sub: 'Decomposing objectives' },
  { icon: '\u{1F3D3}', label: 'Idle', sub: 'Awaiting new observations' },
  { icon: '\u{1F504}', label: 'Recovering', sub: 'Restoring from error' },
];

const worldNodes = [
  { name: 'Runtime', statuses: ['healthy', 'healthy', 'healthy', 'busy'] },
  { name: 'Memory', statuses: ['busy', 'healthy', 'busy', 'healthy'] },
  { name: 'Executive', statuses: ['blocked', 'busy', 'healthy', 'blocked'] },
  { name: 'API', statuses: ['running', 'running', 'running', 'healthy'] },
  { name: 'Voice', statuses: ['idle', 'idle', 'busy', 'idle'] },
  { name: 'Sensors', statuses: ['healthy', 'busy', 'healthy', 'healthy'] },
  { name: 'Cognition', statuses: ['busy', 'healthy', 'busy', 'busy'] },
];

const sensors = [
  { name: 'Git', icon: '\u{1F4CC}', events: ['3 commits today', 'Branch: main', 'Clean working tree', 'Last push: 2h ago'] },
  { name: 'Filesystem', icon: '\u{1F4C1}', events: ['2 files modified', 'Watching src/', 'No changes', 'inotify active'] },
  { name: 'Clipboard', icon: '\u{1F4CB}', events: ['Text copied', 'No change', 'Image detected', 'Code snippet'] },
  { name: 'Docker', icon: '\u{1F433}', events: ['2 containers running', 'Healthy', 'Redis: up', 'API: up'] },
  { name: 'Battery', icon: '\u{1F50B}', events: ['87%', 'Charging', '92%', 'Full'] },
  { name: 'Audio', icon: '\u{1F3B5}', events: ['Volume 60%', 'PulseAudio', 'PipeWire', 'Muted'] },
  { name: 'Notifications', icon: '\u{1F514}', events: ['2 unread', 'Slack: 3', 'Email: 1', 'None'] },
  { name: 'Calendar', icon: '\u{1F4C5}', events: ['No meetings', 'Standup 10am', 'Free today', 'Review 3pm'] },
  { name: 'SSH', icon: '\u{1F4BB}', events: ['1 session', 'None', 'Server: prod', 'Connected'] },
  { name: 'Spotify', icon: '\u{1F3B5}', events: ['Paused', 'Playing', 'No device', 'Queue empty'] },
  { name: 'Idle', icon: '\u{23F1}', events: ['Active', 'Idle 2m', 'Screen lock', 'Active'] },
];

// ─── State ───
export const state = {
  mode: 'dormant', // dormant | hud | dashboard
  cognition: cognitionTexts[0],
  goal: { name: goalNames[0], progress: 72, blocker: '' },
  focus: focusAreas[0],
  prediction: predictions[0],
  tasks: taskTemplates.slice(0, 6),
  memories: memoryTemplates.slice(0, 3),
  sensors: sensors.map(s => ({ ...s, status: 'healthy', lastEvent: s.events[0] })),
  thoughts: [],
  worldModel: worldNodes.map(n => ({ name: n.name, status: n.statuses[0] })),
  mood: moodStates[0],
  confidence: { belief: 'Build failure caused by circular dependency', primary: 91, alt: 'Environment issue', altValue: 18 },
  time: '',
  cpu: 7,
  model: 'qwen2.5-coder',
  pipelineStage: 7,
};

// ─── Helpers ───
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ─── Update Functions ───
function updateTime() {
  const now = new Date();
  state.time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  emit('time', state.time);
}

function updateCpu() {
  state.cpu = randInt(3, 24);
  emit('cpu', state.cpu);
}

function updateCognition() {
  state.cognition = pick(cognitionTexts);
  state.pipelineStage = randInt(1, 14);
  emit('cognition', state.cognition);
}

function updateGoal() {
  if (state.goal.progress < 100) {
    state.goal.progress = Math.min(100, state.goal.progress + randInt(1, 3));
  } else {
    state.goal.name = pick(goalNames);
    state.goal.progress = randInt(5, 30);
    state.goal.blocker = pick(goalBlockers);
  }
  emit('goal', state.goal);
}

function updatePrediction() {
  state.prediction = pick(predictions);
  emit('prediction', state.prediction);
}

function updateTasks() {
  const idx = state.tasks.findIndex(t => t.status === 'pending');
  if (idx >= 0 && Math.random() > 0.5) {
    state.tasks[idx] = { ...state.tasks[idx], status: 'active' };
  }
  const activeIdx = state.tasks.findIndex(t => t.status === 'active');
  if (activeIdx >= 0 && Math.random() > 0.7) {
    state.tasks[activeIdx] = { ...state.tasks[activeIdx], status: 'done' };
  }
  emit('tasks', state.tasks);
}

function updateMemories() {
  if (Math.random() > 0.6) {
    const newMem = pick(memoryTemplates);
    state.memories = [newMem, ...state.memories.slice(0, 4)];
    emit('memories', state.memories);
  }
}

function updateSensors() {
  const idx = randInt(0, state.sensors.length - 1);
  const statuses = ['healthy', 'healthy', 'healthy', 'busy', 'offline'];
  state.sensors[idx] = {
    ...state.sensors[idx],
    status: pick(statuses),
    lastEvent: pick(state.sensors[idx].events),
  };
  emit('sensors', state.sensors);
}

function addThought() {
  const type = pick(thoughtTypes);
  const text = pick(thoughtTexts);
  const thought = { type, text, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) };
  state.thoughts = [thought, ...state.thoughts.slice(0, 19)];
  emit('thought', thought);
}

function updateWorldModel() {
  const idx = randInt(0, state.worldModel.length - 1);
  const node = worldNodes[idx];
  state.worldModel[idx] = { name: node.name, status: pick(node.statuses) };
  emit('worldModel', state.worldModel);
}

function updateMood() {
  state.mood = pick(moodStates);
  emit('mood', state.mood);
}

function updateConfidence() {
  state.confidence.primary = Math.min(99, Math.max(50, state.confidence.primary + randInt(-5, 5)));
  state.confidence.altValue = 100 - state.confidence.primary;
  emit('confidence', state.confidence);
}

function updateFocus() {
  state.focus = pick(focusAreas);
  emit('focus', state.focus);
}

// ─── Start Data Engine ───
let intervals = [];

export function startDataEngine() {
  updateTime();
  intervals = [
    setInterval(updateTime, 1000),
    setInterval(updateCpu, 3000),
    setInterval(updateCognition, 4000),
    setInterval(updateGoal, 5000),
    setInterval(updatePrediction, 6000),
    setInterval(updateTasks, 3500),
    setInterval(updateMemories, 7000),
    setInterval(updateSensors, 2500),
    setInterval(addThought, 3000),
    setInterval(updateWorldModel, 5500),
    setInterval(updateMood, 8000),
    setInterval(updateConfidence, 4500),
    setInterval(updateFocus, 6500),
  ];
}

export function stopDataEngine() {
  intervals.forEach(clearInterval);
  intervals = [];
}
