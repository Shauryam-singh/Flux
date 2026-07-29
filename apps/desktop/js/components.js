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

// ─── Dashboard Goals Detail ───

export function renderGoalsDetail(goals) {
  const el = document.getElementById('goals-detail');
  if (!el) return;

  if (!goals || goals.length === 0) {
    el.innerHTML = '<div class="empty-state">No goals yet. Flux will create goals as it observes your work.</div>';
    return;
  }

  el.innerHTML = goals.map(g => {
    const statusClass = g.status === 'completed' ? 'success' : g.status === 'blocked' ? 'error' : g.status === 'active' || g.status === 'in_progress' ? 'accent' : 'muted';
    const progress = g.progress || 0;
    const blockers = (g.blockers || []).filter(b => !b.resolvedAt);
    return `
      <div class="goal-card">
        <div class="goal-card-header">
          <span class="goal-card-title">${escapeHtml(g.title || g.name || 'Untitled')}</span>
          <span class="goal-card-status ${statusClass}">${escapeHtml(g.status)}</span>
        </div>
        ${g.description ? `<div class="goal-card-desc">${escapeHtml(g.description)}</div>` : ''}
        <div class="goal-card-progress">
          <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
          <span class="goal-card-percent">${progress}%</span>
        </div>
        ${blockers.length > 0 ? `<div class="goal-card-blockers">${blockers.map(b => `<span class="blocker-tag">\u26A0 ${escapeHtml(b.description)}</span>`).join('')}</div>` : ''}
        <div class="goal-card-meta">
          <span>Priority: ${g.priority || 'normal'}</span>
          <span>Source: ${escapeHtml(g.source || 'unknown')}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Dashboard Projects Detail ───

export function renderProjectsDetail(projects) {
  const el = document.getElementById('projects-detail');
  if (!el) return;

  if (!projects || projects.length === 0) {
    el.innerHTML = '<div class="empty-state">No projects tracked yet.</div>';
    return;
  }

  el.innerHTML = projects.map(p => `
    <div class="project-card">
      <div class="project-card-header">
        <span class="project-card-name">${escapeHtml(p.name)}</span>
        <span class="project-card-status ${p.status === 'active' ? 'accent' : 'muted'}">${escapeHtml(p.status)}</span>
      </div>
      <div class="project-card-desc">${escapeHtml(p.description || '')}</div>
      <div class="project-card-meta">
        ${p.packages ? `<span>${p.packages} packages</span>` : ''}
        <span>Last: ${timeAgo(p.lastActivity)}</span>
      </div>
    </div>
  `).join('');
}

// ─── Dashboard Agents Detail ───

export function renderAgentsDetail(agents) {
  const el = document.getElementById('agents-detail');
  if (!el) return;

  if (!agents || agents.length === 0) {
    el.innerHTML = '<div class="empty-state">No agents registered.</div>';
    return;
  }

  el.innerHTML = agents.map(a => {
    const statusClass = a.status === 'active' ? 'success' : a.status === 'idle' ? 'accent' : 'muted';
    return `
      <div class="agent-card">
        <div class="agent-card-header">
          <span class="agent-card-name">${escapeHtml(a.name)}</span>
          <span class="agent-card-status ${statusClass}">${escapeHtml(a.status)}</span>
        </div>
        <div class="agent-card-caps">${(a.capabilities || []).map(c => `<span class="cap-tag">${escapeHtml(c)}</span>`).join('')}</div>
        <div class="agent-card-meta">
          <span>Tasks: ${a.tasks || 0}/${a.maxTasks || 1}</span>
          <span>Success: ${Math.round((a.successRate || 0) * 100)}%</span>
          <span>Priority: ${a.priority || '-'}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Dashboard Timeline Detail ───

export function renderTimelineDetail(events) {
  const el = document.getElementById('timeline-detail');
  if (!el) return;

  if (!events || events.length === 0) {
    el.innerHTML = '<div class="empty-state">No timeline events yet. Flux will record events as it runs.</div>';
    return;
  }

  el.innerHTML = `<div class="timeline-list">${events.map(e => {
    const icon = getTimelineIcon(e.type || e.category);
    return `
      <div class="timeline-entry">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-title">${icon} ${escapeHtml(e.event || e.content || e.title || '')}</div>
          <div class="timeline-detail">${escapeHtml(e.context || e.detail || '')}</div>
          <div class="timeline-time">${timeAgo(e.timestamp)}</div>
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

// ─── Dashboard Settings Detail ───

export function renderSettingsDetail() {
  const el = document.getElementById('settings-detail');
  if (!el) return;

  el.innerHTML = `
    <div class="settings-grid">
      <div class="settings-section">
        <h3 class="settings-section-title">Model</h3>
        <div class="settings-row">
          <label class="settings-label">LLM Model</label>
          <select id="setting-model" class="settings-select">
            <option value="qwen2.5-coder:7b" selected>qwen2.5-coder:7b</option>
            <option value="qwen2.5-coder:14b">qwen2.5-coder:14b</option>
            <option value="qwen2.5-coder:32b">qwen2.5-coder:32b</option>
            <option value="llama3.1:8b">llama3.1:8b</option>
            <option value="llama3.1:70b">llama3.1:70b</option>
            <option value="deepseek-coder:6.7b">deepseek-coder:6.7b</option>
            <option value="codellama:13b">codellama:13b</option>
          </select>
        </div>
        <div class="settings-row">
          <label class="settings-label">Ollama URL</label>
          <input type="text" id="setting-ollama-url" class="settings-input" value="http://localhost:11434" />
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Voice</h3>
        <div class="settings-row">
          <label class="settings-label">Auto-speak replies</label>
          <label class="settings-toggle">
            <input type="checkbox" id="setting-voice-autospeak" checked>
            <span class="settings-toggle-slider"></span>
          </label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Voice wake word</label>
          <label class="settings-toggle">
            <input type="checkbox" id="setting-voice-wake" checked>
            <span class="settings-toggle-slider"></span>
          </label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Speech rate</label>
          <input type="range" id="setting-speech-rate" class="settings-range" min="0.5" max="2" step="0.1" value="1">
          <span id="setting-speech-rate-val" class="settings-range-val">1.0x</span>
        </div>
        <div class="settings-row">
          <label class="settings-label">Speech pitch</label>
          <input type="range" id="setting-speech-pitch" class="settings-range" min="0.5" max="1.5" step="0.1" value="0.9">
          <span id="setting-speech-pitch-val" class="settings-range-val">0.9</span>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Cognition</h3>
        <div class="settings-row">
          <label class="settings-label">Background tick interval</label>
          <select id="setting-tick-interval" class="settings-select">
            <option value="2000">2s (fast)</option>
            <option value="5000" selected>5s (normal)</option>
            <option value="10000">10s (slow)</option>
            <option value="30000">30s (minimal)</option>
          </select>
        </div>
        <div class="settings-row">
          <label class="settings-label">Max memory capacity</label>
          <select id="setting-memory-cap" class="settings-select">
            <option value="50">50 entries</option>
            <option value="100" selected>100 entries</option>
            <option value="500">500 entries</option>
            <option value="1000">1000 entries</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Sensors</h3>
        <div class="settings-row">
          <label class="settings-label">Git</label>
          <label class="settings-toggle"><input type="checkbox" id="sensor-git" checked><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Filesystem</label>
          <label class="settings-toggle"><input type="checkbox" id="sensor-fs" checked><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Clipboard</label>
          <label class="settings-toggle"><input type="checkbox" id="sensor-clipboard" checked><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Docker</label>
          <label class="settings-toggle"><input type="checkbox" id="sensor-docker" checked><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Battery</label>
          <label class="settings-toggle"><input type="checkbox" id="sensor-battery" checked><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Audio</label>
          <label class="settings-toggle"><input type="checkbox" id="sensor-audio" checked><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Notifications</label>
          <label class="settings-toggle"><input type="checkbox" id="sensor-notif" checked><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Spotify</label>
          <label class="settings-toggle"><input type="checkbox" id="sensor-spotify" checked><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Idle detection</label>
          <label class="settings-toggle"><input type="checkbox" id="sensor-idle" checked><span class="settings-toggle-slider"></span></label>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Appearance</h3>
        <div class="settings-row">
          <label class="settings-label">Particle effects</label>
          <label class="settings-toggle"><input type="checkbox" id="setting-particles" checked><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Always on top</label>
          <label class="settings-toggle"><input type="checkbox" id="setting-always-top" checked><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Start minimized</label>
          <label class="settings-toggle"><input type="checkbox" id="setting-start-min"><span class="settings-toggle-slider"></span></label>
        </div>
      </div>
    </div>
    <div class="settings-actions">
      <button id="settings-save" class="settings-btn primary">Save Settings</button>
      <button id="settings-reset" class="settings-btn">Reset to Defaults</button>
    </div>
  `;

  // Wire up range sliders
  const rateSlider = document.getElementById('setting-speech-rate');
  const rateVal = document.getElementById('setting-speech-rate-val');
  if (rateSlider && rateVal) {
    rateSlider.addEventListener('input', () => { rateVal.textContent = rateSlider.value + 'x'; });
  }
  const pitchSlider = document.getElementById('setting-speech-pitch');
  const pitchVal = document.getElementById('setting-speech-pitch-val');
  if (pitchSlider && pitchVal) {
    pitchSlider.addEventListener('input', () => { pitchVal.textContent = pitchSlider.value; });
  }
}

// ─── Voice Recording Indicator ───

export function setVoiceRecording(recording) {
  // Update voice button visual state
  const voiceBtn = document.querySelector('.action-btn[data-action="voice"]');
  if (voiceBtn) {
    if (recording) {
      voiceBtn.classList.add('recording');
      voiceBtn.textContent = 'Stop';
    } else {
      voiceBtn.classList.remove('recording');
      voiceBtn.textContent = 'Voice';
    }
  }

  // Update status indicator
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  if (recording) {
    if (statusDot) statusDot.style.background = 'var(--error)';
    if (statusText) statusText.textContent = 'Recording';
  } else {
    if (statusDot) statusDot.style.background = '';
    if (statusText) statusText.textContent = 'Watching';
  }
}

// ─── Toast Notifications ───

export function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;display:flex;flex-direction:column;gap:6px;pointer-events:none;';
    document.body.appendChild(container);
  }

  const colors = {
    info: 'var(--accent)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    error: 'var(--error)',
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(25, 30, 40, 0.9);
    backdrop-filter: blur(12px);
    border: 1px solid ${colors[type] || colors.info}33;
    border-left: 3px solid ${colors[type] || colors.info};
    color: var(--text);
    font-size: 11px;
    font-family: var(--font-sans);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slide-in-right 0.2s ease;
    pointer-events: auto;
    max-width: 280px;
  `;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fade-out 0.2s ease forwards';
    setTimeout(() => toast.remove(), 200);
  }, duration);
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

function timeAgo(ts) {
  if (!ts) return 'Unknown';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function getTimelineIcon(type) {
  const icons = {
    interaction: '\u{1F4AC}',
    observation: '\u{1F441}',
    reflection: '\u{1F914}',
    milestone: '\u{1F3C6}',
    suggestion: '\u{1F4A1}',
    error: '\u{26A0}',
    commit: '\u{1F4DD}',
    goal: '\u{1F3AF}',
    conversation: '\u{1F5E3}',
    build: '\u{1F527}',
    test: '\u{2705}',
  };
  return icons[type] || '\u{2022}';
}
