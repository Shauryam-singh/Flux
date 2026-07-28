// ═══════════════════════════════════════════════════════════════
// FLUX COMPONENTS — Independent DOM update functions
// Each component updates only its own DOM elements
// ═══════════════════════════════════════════════════════════════

// ─── HUD Components ───

export function updateTime(time) {
  const el = document.getElementById('hud-time');
  if (el) el.textContent = time;
}

export function updateCpu(cpu) {
  const el = document.getElementById('hud-cpu');
  if (el) el.textContent = cpu + '%';
}

export function updateCognition(text) {
  const el = document.getElementById('cognition-text');
  if (el) el.innerHTML = text + '<span class="cognition-cursor"></span>';
}

export function updateGoal(goal) {
  const nameEl = document.getElementById('goal-name');
  const progressEl = document.getElementById('goal-progress');
  const percentEl = document.getElementById('goal-percent');
  const blockerEl = document.getElementById('goal-blocker');

  if (nameEl) nameEl.textContent = goal.name;
  if (progressEl) progressEl.style.width = goal.progress + '%';
  if (percentEl) percentEl.textContent = goal.progress + '%';
  if (blockerEl) blockerEl.textContent = goal.blocker ? '\u26A0 ' + goal.blocker : '';
}

export function updatePrediction(pred) {
  const textEl = document.getElementById('prediction-text');
  const fillEl = document.getElementById('prediction-fill');
  const confEl = document.getElementById('prediction-confidence');

  if (textEl) textEl.textContent = pred.text;
  if (fillEl) fillEl.style.width = pred.confidence + '%';
  if (confEl) confEl.textContent = pred.confidence + '%';
}

export function updateFocus(focus) {
  const el = document.getElementById('focus-tags');
  if (el) {
    el.innerHTML = focus.map(f =>
      `<span class="focus-tag">${escapeHtml(f)}</span>`
    ).join('');
  }
}

export function updateTasks(tasks) {
  const el = document.getElementById('tasks-list');
  if (!el) return;

  el.innerHTML = tasks.map(t => {
    const iconClass = t.status === 'done' ? 'done' : t.status === 'active' ? 'active' : 'pending';
    const icon = t.status === 'done' ? '\u2713' : t.status === 'active' ? '\u25CF' : '\u25CB';
    return `<li class="task-item"><span class="task-icon ${iconClass}">${icon}</span> ${escapeHtml(t.text)}</li>`;
  }).join('');
}

export function updateMemories(memories) {
  const el = document.getElementById('memory-list');
  if (!el) return;

  el.innerHTML = memories.map(m =>
    `<li class="memory-item"><span class="memory-badge ${m.badge}">${capitalize(m.badge === 'remember' ? 'Remembered' : m.badge === 'reflection' ? 'Reflection' : 'Insight')}</span> ${escapeHtml(m.text)}</li>`
  ).join('');
}

export function updateSensors(sensors) {
  const grids = [
    document.getElementById('sensors-grid'),
    document.getElementById('dash-sensors'),
  ];

  grids.forEach(el => {
    if (!el) return;
    el.innerHTML = sensors.slice(0, 11).map(s => {
      const activeClass = s.status === 'healthy' || s.status === 'busy' ? 'active' : '';
      return `<div class="sensor-item ${activeClass}" title="${escapeHtml(s.name)}"><span class="sensor-icon">${s.icon}</span><span class="sensor-label">${escapeHtml(s.name)}</span></div>`;
    }).join('');
  });
}

export function updateThought(thought) {
  const el = document.getElementById('dash-thought-stream');
  if (!el) return;

  const entry = document.createElement('div');
  entry.className = 'thought-entry';
  entry.innerHTML = `<span class="thought-type ${thought.type}">${capitalize(thought.type)}</span><span class="thought-text">${escapeHtml(thought.text)}</span>`;

  el.insertBefore(entry, el.firstChild);

  // Keep max 20 entries
  while (el.children.length > 20) {
    el.removeChild(el.lastChild);
  }
}

export function updateWorldModel(nodes) {
  const el = document.getElementById('dash-world-model');
  if (!el) return;

  el.innerHTML = nodes.map(n =>
    `<div class="world-node"><span class="world-node-name">${escapeHtml(n.name)}</span><span class="world-node-status ${n.status}">${capitalize(n.status)}</span></div>`
  ).join('');
}

export function updateMood(mood) {
  const el = document.getElementById('dash-mood');
  if (!el) return;

  el.innerHTML = `<span class="mood-icon">${mood.icon}</span><div><div class="mood-label">${escapeHtml(mood.label)}</div><div class="mood-sub">${escapeHtml(mood.sub)}</div></div>`;
}

export function updateConfidence(conf) {
  const el = document.getElementById('dash-confidence');
  if (!el) return;

  el.innerHTML = `
    <div class="gauge-belief">${escapeHtml(conf.belief)}</div>
    <div class="gauge-bar"><div class="gauge-fill" style="width: ${conf.primary}%"></div></div>
    <div class="gauge-label"><span>Primary</span><span>${conf.primary}%</span></div>
    <div class="gauge-alt">Alternative: ${escapeHtml(conf.alt)} &mdash; ${conf.altValue}%</div>
  `;
}

export function updateDashboardCognition(text, stage) {
  const textEl = document.getElementById('dash-cog-text');
  const stageEl = document.getElementById('dash-cog-stage');
  if (textEl) textEl.textContent = text;
  if (stageEl) stageEl.textContent = `Stage ${stage}/14: ${getStageName(stage)}`;
}

// ─── Dashboard Sensors Detail ───

export function renderSensorsDetail(sensors) {
  const el = document.getElementById('sensors-detail');
  if (!el) return;

  el.innerHTML = sensors.map(s => {
    const statusClass = s.status === 'healthy' ? 'healthy' : s.status === 'busy' ? 'busy' : s.status === 'error' ? 'error' : 'offline';
    return `<div class="sensor-detail-card"><div class="sensor-detail-header"><span class="sensor-detail-name">${s.icon} ${escapeHtml(s.name)}</span><span class="sensor-detail-status ${statusClass}">${capitalize(s.status)}</span></div><div class="sensor-detail-event">Last: ${escapeHtml(s.lastEvent)}</div></div>`;
  }).join('');
}

// ─── Dashboard Memory Page ───

export function renderMemoryPage() {
  const sections = {
    'mem-working': [
      'Current goal: Executive Intelligence',
      'Active pipeline stage: 7/14',
      'User idle for 2 minutes',
    ],
    'mem-semantic': [
      'User prefers TypeScript over JavaScript',
      'Project uses Result<T,E> pattern',
      'Docker compose file at project root',
      'Piper TTS installed at /usr/bin/piper',
      'Default model: qwen2.5-coder:7b',
    ],
    'mem-episodic': [
      'Yesterday: Fixed circular import in runtime',
      'Today: Implemented 14-stage cognition pipeline',
      'Last week: Added 11 real-world sensors',
      'Earlier: Built cognitive memory system',
    ],
    'mem-project': [
      'Flux has 80+ packages in monorepo',
      'Tauri v2 for desktop app',
      'Vite for frontend bundling',
      'pnpm workspaces + Turborepo',
    ],
    'mem-relationship': [
      'User likes concise responses',
      'Prefers dark theme',
      'Uses Linux (Ubuntu)',
      'Working on AI operating system',
    ],
    'mem-timeline': [
      'Phase 1: Sensory Layer completed',
      'Phase 2: Cognitive Layer completed',
      'Phase 3: Companion Layer completed',
      'Phase 4: Ambient Intelligence completed',
      'Phase 5: Executive Intelligence completed',
      'Phase 6: Self-Evolution completed',
    ],
    'mem-reflection': [
      'Should consolidate similar memories more aggressively',
      'Sensor polling interval could be adaptive',
      'Confidence calibration needs more data points',
    ],
  };

  Object.entries(sections).forEach(([id, items]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.map(text =>
      `<div class="memory-card">${escapeHtml(text)}<div class="memory-card-time">Recent</div></div>`
    ).join('');
  });
}

// ─── Helpers ───

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getStageName(stage) {
  const stages = [
    'Observe', 'Merge', 'World Model', 'Working Memory',
    'Goal Eval', 'Intent Predict', 'Generate', 'Compare',
    'Opportunities', 'Interrupt Eval', 'Choose Action',
    'Store', 'Explain', 'Sleep',
  ];
  return stages[stage - 1] || 'Unknown';
}
