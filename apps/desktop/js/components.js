// ═══════════════════════════════════════════════════════════════
// FLUX COMPONENTS — Independent DOM update functions
// Each component updates only its own DOM elements
// ═══════════════════════════════════════════════════════════════

const API = "http://localhost:3141";

// ─── HUD Components ───

export function updateTime(time) {
  const el = document.getElementById("hud-time");
  if (el) el.textContent = time;
}

export function updateCpu(cpu) {
  const el = document.getElementById("hud-cpu");
  if (el) el.textContent = cpu + "%";
}

export function updateCognition(text) {
  const el = document.getElementById("cognition-text");
  if (el) el.innerHTML = text + '<span class="cognition-cursor"></span>';
}

export function updateGoal(goal) {
  const nameEl = document.getElementById("goal-name");
  const progressEl = document.getElementById("goal-progress");
  const percentEl = document.getElementById("goal-percent");
  const blockerEl = document.getElementById("goal-blocker");

  if (nameEl) nameEl.textContent = goal.name;
  if (progressEl) progressEl.style.width = goal.progress + "%";
  if (percentEl) percentEl.textContent = goal.progress + "%";
  if (blockerEl)
    blockerEl.textContent = goal.blocker ? "\u26A0 " + goal.blocker : "";
}

export function updatePrediction(pred) {
  const textEl = document.getElementById("prediction-text");
  const fillEl = document.getElementById("prediction-fill");
  const confEl = document.getElementById("prediction-confidence");

  if (textEl) textEl.textContent = pred.text;
  if (fillEl) fillEl.style.width = pred.confidence + "%";
  if (confEl) confEl.textContent = pred.confidence + "%";
}

export function updateFocus(focus) {
  const el = document.getElementById("focus-tags");
  if (el) {
    el.innerHTML = focus
      .map((f) => `<span class="focus-tag">${escapeHtml(f)}</span>`)
      .join("");
  }
}

export function updateTasks(tasks) {
  const el = document.getElementById("tasks-list");
  if (!el) return;

  el.innerHTML = tasks
    .map((t) => {
      const iconClass =
        t.status === "done"
          ? "done"
          : t.status === "active"
            ? "active"
            : "pending";
      const icon =
        t.status === "done"
          ? "\u2713"
          : t.status === "active"
            ? "\u25CF"
            : "\u25CB";
      return `<li class="task-item"><span class="task-icon ${iconClass}">${icon}</span> ${escapeHtml(t.name || t.text || "")}</li>`;
    })
    .join("");
}

export function updateMemories(memories) {
  const el = document.getElementById("memory-list");
  if (!el) return;

  el.innerHTML = memories
    .map(
      (m) =>
        `<li class="memory-item"><span class="memory-badge ${m.badge}">${capitalize(m.badge === "remember" ? "Remembered" : m.badge === "reflection" ? "Reflection" : "Insight")}</span> ${escapeHtml(m.text)}</li>`,
    )
    .join("");
}

export function updateSensors(sensors) {
  const grids = [
    document.getElementById("sensors-grid"),
    document.getElementById("dash-sensors"),
  ];

  grids.forEach((el) => {
    if (!el) return;
    el.innerHTML = sensors
      .slice(0, 11)
      .map((s) => {
        const activeClass =
          s.status === "healthy" || s.status === "busy" ? "active" : "";
        return `<div class="sensor-item ${activeClass}" title="${escapeHtml(s.name)}"><span class="sensor-icon">${s.icon}</span><span class="sensor-label">${escapeHtml(s.name)}</span></div>`;
      })
      .join("");
  });
}

export function updateThought(thoughts) {
  const el = document.getElementById("dash-thought-stream");
  if (!el) return;

  const list = Array.isArray(thoughts) ? thoughts : [thoughts];

  // Replace entire content with latest thoughts
  el.innerHTML = list
    .slice(0, 10)
    .map(
      (t) =>
        `<div class="thought-entry"><span class="thought-type ${escapeHtml(t.type || "thought")}">${escapeHtml(capitalize(t.type || "thought"))}</span><span class="thought-text">${escapeHtml(t.text || t.content || "")}</span></div>`,
    )
    .join("");
}

export function updateWorldModel(nodes) {
  const el = document.getElementById("dash-world-model");
  if (!el) return;

  el.innerHTML = nodes
    .map(
      (n) =>
        `<div class="world-node"><span class="world-node-name">${escapeHtml(n.name)}</span><span class="world-node-status ${n.status}">${capitalize(n.status)}</span></div>`,
    )
    .join("");
}

export function updateMood(mood) {
  const el = document.getElementById("dash-mood");
  if (!el) return;

  el.innerHTML = `<span class="mood-icon">${mood.icon}</span><div><div class="mood-label">${escapeHtml(mood.label)}</div><div class="mood-sub">${escapeHtml(mood.sub)}</div></div>`;
}

export function updateConfidence(conf) {
  const el = document.getElementById("dash-confidence");
  if (!el) return;

  el.innerHTML = `
    <div class="gauge-belief">${escapeHtml(conf.belief)}</div>
    <div class="gauge-bar"><div class="gauge-fill" style="width: ${conf.primary}%"></div></div>
    <div class="gauge-label"><span>Primary</span><span>${conf.primary}%</span></div>
    <div class="gauge-alt">Alternative: ${escapeHtml(conf.alt)} &mdash; ${conf.altValue}%</div>
  `;
}

export function updateDashboardCognition(text, stage, stageName) {
  const textEl = document.getElementById("dash-cog-text");
  const stageEl = document.getElementById("dash-cog-stage");
  if (textEl) textEl.textContent = text || "Waiting for data...";
  if (stageEl) {
    const name = stageName || (stage ? getStageName(stage) : "");
    stageEl.textContent = stage ? `Stage ${stage}/14: ${name}` : "";
  }
}

export function updateStatusText(connected) {
  const el = document.getElementById("status-text");
  const dot = document.getElementById("status-dot");
  if (el) el.textContent = connected ? "Connected" : "Disconnected";
  if (dot) dot.className = "status-dot" + (connected ? " online" : "");
}

export function updateModel(model) {
  const el = document.getElementById("hud-model");
  if (el) el.textContent = model || "";
}

export function updateTimeline(events) {
  const el = document.getElementById("dash-timeline");
  if (!el) return;
  if (!events || events.length === 0) {
    el.innerHTML =
      '<div class="timeline-item" style="opacity:0.5">No events yet</div>';
    return;
  }
  el.innerHTML = events
    .slice(0, 8)
    .map((e) => {
      const status = e.status || "pending";
      const iconClass =
        status === "completed" || status === "done"
          ? "done"
          : status === "active" || status === "in_progress"
            ? "active"
            : "pending";
      const icon =
        iconClass === "done"
          ? "\u2713"
          : iconClass === "active"
            ? "\u25CF"
            : "\u25CB";
      return `<div class="timeline-item"><span class="timeline-icon ${iconClass}">${icon}</span><span class="timeline-text ${iconClass}">${escapeHtml(e.title || e.event || e.name || "")}</span></div>`;
    })
    .join("");
}

export function updateDashMemory(stats) {
  const el = document.getElementById("dash-memory");
  if (!el || !stats) return;
  const items = [];
  if (stats.byType) {
    if (stats.byType.semantic)
      items.push({
        badge: "remember",
        label: "Semantic",
        count: stats.byType.semantic,
      });
    if (stats.byType.episodic)
      items.push({
        badge: "reflection",
        label: "Episodic",
        count: stats.byType.episodic,
      });
    if (stats.byType.procedural)
      items.push({
        badge: "insight",
        label: "Procedural",
        count: stats.byType.procedural,
      });
  }
  if (items.length === 0 && stats.totalMemories) {
    items.push({
      badge: "remember",
      label: "Total",
      count: stats.totalMemories,
    });
  }
  el.innerHTML =
    items.length > 0
      ? `<div class="memory-list">${items.map((i) => `<div class="memory-item"><span class="memory-badge ${i.badge}">${i.label}</span> ${i.count} stored</div>`).join("")}</div>`
      : '<div class="memory-list"><div class="memory-item" style="opacity:0.5">No memories yet</div></div>';
}

// ─── Dashboard Sensors Detail ───

export function renderSensorsDetail(sensors) {
  const el = document.getElementById("sensors-detail");
  if (!el) return;

  el.innerHTML = sensors
    .map((s) => {
      const statusClass =
        s.status === "healthy"
          ? "healthy"
          : s.status === "busy"
            ? "busy"
            : s.status === "error"
              ? "error"
              : "offline";
      return `<div class="sensor-detail-card"><div class="sensor-detail-header"><span class="sensor-detail-name">${s.icon} ${escapeHtml(s.name)}</span><span class="sensor-detail-status ${statusClass}">${capitalize(s.status)}</span></div><div class="sensor-detail-event">Last: ${escapeHtml(s.lastEvent)}</div></div>`;
    })
    .join("");
}

// ─── Dashboard Memory Page ───

export async function renderMemoryPage() {
  // Show loading state
  const sections = [
    "mem-working",
    "mem-semantic",
    "mem-episodic",
    "mem-procedural",
    "mem-project",
    "mem-relationship",
    "mem-timeline",
    "mem-reflection",
  ];
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.innerHTML =
        '<div class="memory-empty">Loading...</div>';
  });

  let data;
  try {
    const resp = await fetch(`${API}/memory/all`);
    if (!resp.ok) throw new Error("API error");
    data = await resp.json();
  } catch {
    // API not running — show fallback
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el)
        el.innerHTML =
          '<div class="memory-empty">API not running</div>';
    });
    return;
  }

  const { memories = {}, chatHistory = [] } = data;

  // Render each memory type
  renderMemorySection(
    "mem-semantic",
    memories.semantic,
    (m) => m.content || m.description || JSON.stringify(m).slice(0, 100),
  );
  renderMemorySection("mem-episodic", memories.episodic, (m) => {
    if (m.content) return m.content.split("\n")[0]; // First line of Q&A
    return m.event || m.context || "";
  });
  renderMemorySection(
    "mem-procedural",
    memories.procedural,
    (m) => m.content || m.description || "",
  );
  renderMemorySection(
    "mem-project",
    memories.project,
    (m) => m.content || m.projectName || "",
  );
  renderMemorySection(
    "mem-relationship",
    memories.relationship,
    (m) => m.content || `${m.entityName}: ${m.interactionSummary || ""}`,
  );
  renderMemorySection(
    "mem-timeline",
    memories.timeline,
    (m) => m.content || m.event || "",
  );
  renderMemorySection(
    "mem-reflection",
    memories.reflection,
    (m) => m.content || m.insight || "",
  );

  // Working memory — show recent chat as working context
  const workingEl = document.getElementById("mem-working");
  if (workingEl && chatHistory.length > 0) {
    // Deduplicate consecutive identical messages
    const deduped = [];
    for (const m of chatHistory) {
      const prev = deduped[deduped.length - 1];
      if (prev && prev.role === m.role && prev.content === m.content) continue;
      deduped.push(m);
    }
    const recent = deduped.slice(-8);
    workingEl.innerHTML = recent
      .map((m) => {
        const icon = m.role === "user" ? "\u{1F464}" : "\u{1F916}";
        const text =
          m.content.length > 120 ? m.content.slice(0, 120) + "..." : m.content;
        return `<div class="memory-card">${escapeHtml(icon + " " + text)}<div class="memory-card-time">${m.role}</div></div>`;
      })
      .join("");
  } else if (workingEl) {
    workingEl.innerHTML =
      '<div class="memory-empty">No recent conversations</div>';
  }

  // Update stats
  const statsEl = document.getElementById("memory-stats");
  if (statsEl && data.stats) {
    const s = data.stats;
    statsEl.textContent = `${s.totalMemories || 0} memories | ${s.consolidationEvents || 0} consolidations`;
  }
}

function renderMemorySection(elementId, memories, formatFn) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (!memories || memories.length === 0) {
    el.innerHTML =
      '<div class="memory-empty">No memories yet</div>';
    return;
  }

  el.innerHTML = memories
    .slice(0, 10)
    .map((m) => {
      const text = formatFn(m);
      if (!text) return "";
      const timeAgo = m.timestamp ? getTimeAgo(m.timestamp) : "";
      return `<div class="memory-card">${escapeHtml(text)}<div class="memory-card-time">${escapeHtml(timeAgo)}</div></div>`;
    })
    .filter(Boolean)
    .join("");
}

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── Dashboard Goals Detail ───

export function renderGoalsDetail(goals) {
  const el = document.getElementById("goals-detail");
  if (!el) return;

  if (!goals || goals.length === 0) {
    el.innerHTML =
      '<div class="empty-state">No goals yet. Flux will create goals as it observes your work.</div>';
    return;
  }

  el.innerHTML = goals
    .map((g) => {
      const statusClass =
        g.status === "completed"
          ? "success"
          : g.status === "blocked"
            ? "error"
            : g.status === "active" || g.status === "in_progress"
              ? "accent"
              : "muted";
      const progress = g.progress || 0;
      const blockers = (g.blockers || []).filter((b) => !b.resolvedAt);
      return `
      <div class="goal-card">
        <div class="goal-card-header">
          <span class="goal-card-title">${escapeHtml(g.title || g.name || "Untitled")}</span>
          <span class="goal-card-status ${statusClass}">${escapeHtml(g.status)}</span>
        </div>
        ${g.description ? `<div class="goal-card-desc">${escapeHtml(g.description)}</div>` : ""}
        <div class="goal-card-progress">
          <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
          <span class="goal-card-percent">${progress}%</span>
        </div>
        ${blockers.length > 0 ? `<div class="goal-card-blockers">${blockers.map((b) => `<span class="blocker-tag">\u26A0 ${escapeHtml(b.description)}</span>`).join("")}</div>` : ""}
        <div class="goal-card-meta">
          <span>Priority: ${g.priority || "normal"}</span>
          <span>Source: ${escapeHtml(g.source || "unknown")}</span>
        </div>
      </div>
    `;
    })
    .join("");
}

// ─── Dashboard Projects Detail ───

export function renderProjectsDetail(projects) {
  const el = document.getElementById("projects-detail");
  if (!el) return;

  if (!projects || projects.length === 0) {
    el.innerHTML = '<div class="empty-state">No projects tracked yet.</div>';
    return;
  }

  el.innerHTML = projects
    .map(
      (p) => `
    <div class="project-card">
      <div class="project-card-header">
        <span class="project-card-name">${escapeHtml(p.name)}</span>
        <span class="project-card-status ${p.status === "active" ? "accent" : "muted"}">${escapeHtml(p.status)}</span>
      </div>
      <div class="project-card-desc">${escapeHtml(p.description || "")}</div>
      <div class="project-card-meta">
        ${p.packages ? `<span>${p.packages} packages</span>` : ""}
        <span>Last: ${timeAgo(p.lastActivity)}</span>
      </div>
    </div>
  `,
    )
    .join("");
}

// ─── Dashboard Agents Detail ───

const ROLE_COLORS = {
  coder: "#55D6FF",
  researcher: "#7C8BFF",
  reviewer: "#49E38A",
  planner: "#FFC857",
  designer: "#FF6B9D",
  devops: "#A78BFA",
  writer: "#F472B6",
  analyst: "#38BDF8",
  custom: "#A0AEC0",
};

export function renderAgentsDetail(agents) {
  const el = document.getElementById("agents-detail");
  if (!el) return;

  el.innerHTML = `
    <div class="agents-toolbar">
      <button class="agents-create-btn" id="agents-create-btn">+ Create Agent</button>
      <span class="agents-count">${agents?.length || 0} agents</span>
    </div>
    <div class="agents-list" id="agents-list">
      ${(!agents || agents.length === 0)
        ? '<div class="empty-state">No agents registered. Create one to get started.</div>'
        : agents.map(renderAgentCard).join("")}
    </div>
    <div class="agents-create-modal" id="agents-create-modal" style="display:none">
      <div class="agents-modal-backdrop" id="agents-modal-backdrop"></div>
      <div class="agents-modal-content">
        <h3>Create Agent</h3>
        <div class="agents-modal-tabs">
          <button class="agents-modal-tab active" data-tab="manual">Manual</button>
          <button class="agents-modal-tab" data-tab="ai">AI Generate</button>
        </div>
        <div class="agents-modal-pane active" id="agents-pane-manual">
          <input type="text" id="agent-name" placeholder="Agent name" class="agents-input" />
          <input type="text" id="agent-description" placeholder="Description" class="agents-input" />
          <select id="agent-role" class="agents-input">
            <option value="coder">Coder</option>
            <option value="researcher">Researcher</option>
            <option value="reviewer">Reviewer</option>
            <option value="planner">Planner</option>
            <option value="designer">Designer</option>
            <option value="devops">DevOps</option>
            <option value="writer">Writer</option>
            <option value="analyst">Analyst</option>
            <option value="custom">Custom</option>
          </select>
          <input type="text" id="agent-domain" placeholder="Domain (e.g., backend, frontend)" class="agents-input" />
          <textarea id="agent-prompt" placeholder="System prompt" class="agents-textarea" rows="4"></textarea>
          <input type="text" id="agent-caps" placeholder="Capabilities (comma-separated)" class="agents-input" />
          <button class="agents-modal-submit" id="agents-submit-manual">Create</button>
        </div>
        <div class="agents-modal-pane" id="agents-pane-ai">
          <textarea id="agent-ai-desc" placeholder="Describe what this agent should do..." class="agents-textarea" rows="4"></textarea>
          <button class="agents-modal-submit" id="agents-submit-ai">Generate & Create</button>
        </div>
        <button class="agents-modal-close" id="agents-modal-close">Cancel</button>
      </div>
    </div>
  `;

  // Bind events
  document.getElementById("agents-create-btn")?.addEventListener("click", () => {
    document.getElementById("agents-create-modal").style.display = "flex";
  });
  document.getElementById("agents-modal-backdrop")?.addEventListener("click", closeAgentModal);
  document.getElementById("agents-modal-close")?.addEventListener("click", closeAgentModal);

  // Tab switching
  el.querySelectorAll(".agents-modal-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      el.querySelectorAll(".agents-modal-tab").forEach((t) => t.classList.remove("active"));
      el.querySelectorAll(".agents-modal-pane").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`agents-pane-${tab.dataset.tab}`).classList.add("active");
    });
  });

  // Manual create
  document.getElementById("agents-submit-manual")?.addEventListener("click", async () => {
    const spec = {
      name: document.getElementById("agent-name").value.trim(),
      description: document.getElementById("agent-description").value.trim(),
      role: document.getElementById("agent-role").value,
      domain: document.getElementById("agent-domain").value.trim(),
      systemPrompt: document.getElementById("agent-prompt").value.trim(),
      capabilities: document.getElementById("agent-caps").value.split(",").map((s) => s.trim()).filter(Boolean),
    };
    if (!spec.name) return;
    await window.__agentActions?.create(spec);
    closeAgentModal();
  });

  // AI generate
  document.getElementById("agents-submit-ai")?.addEventListener("click", async () => {
    const desc = document.getElementById("agent-ai-desc").value.trim();
    if (!desc) return;
    await window.__agentActions?.createAI(desc);
    closeAgentModal();
  });

  // Bind action buttons
  el.querySelectorAll("[data-agent-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.agentAction;
      const id = btn.dataset.agentId;
      if (action === "toggle") await window.__agentActions?.toggle(id);
      else if (action === "delete") await window.__agentActions?.delete(id);
    });
  });
}

function closeAgentModal() {
  const modal = document.getElementById("agents-create-modal");
  if (modal) modal.style.display = "none";
  // Reset fields
  ["agent-name", "agent-description", "agent-domain", "agent-prompt", "agent-caps", "agent-ai-desc"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function renderAgentCard(a) {
  const statusClass = a.status === "active" ? "success" : a.status === "busy" ? "warning" : "muted";
  const roleColor = ROLE_COLORS[a.role] || ROLE_COLORS.custom;
  const timeAgo = a.lastUsedAt ? formatTimeAgo(new Date(a.lastUsedAt)) : "never";

  return `
    <div class="agent-card" data-agent-id="${escapeHtml(a.id)}">
      <div class="agent-card-header">
        <div class="agent-card-title">
          <span class="agent-role-dot" style="background:${roleColor}"></span>
          <span class="agent-card-name">${escapeHtml(a.name)}</span>
        </div>
        <span class="agent-card-status ${statusClass}">${escapeHtml(a.status)}</span>
      </div>
      <div class="agent-card-desc">${escapeHtml(a.description || "")}</div>
      <div class="agent-card-role">
        <span class="agent-role-badge" style="color:${roleColor};border-color:${roleColor}">${escapeHtml(a.role)}</span>
        <span class="agent-card-domain">${escapeHtml(a.domain)}</span>
      </div>
      <div class="agent-card-caps">
        ${(a.capabilities || []).slice(0, 5).map((c) => `<span class="cap-tag">${escapeHtml(c)}</span>`).join("")}
        ${(a.capabilities || []).length > 5 ? `<span class="cap-tag cap-more">+${a.capabilities.length - 5}</span>` : ""}
      </div>
      <div class="agent-card-meta">
        <span title="Tasks completed">Tasks: ${a.tasksCompleted || 0}</span>
        <span title="Success rate">Success: ${Math.round((a.successRate || 0) * 100)}%</span>
        <span title="Last used">Last: ${timeAgo}</span>
      </div>
      <div class="agent-card-actions">
        <button class="agent-action-btn agent-toggle-btn" data-agent-action="toggle" data-agent-id="${escapeHtml(a.id)}">${a.status === "active" ? "Disable" : "Enable"}</button>
        <button class="agent-action-btn agent-delete-btn" data-agent-action="delete" data-agent-id="${escapeHtml(a.id)}">Delete</button>
      </div>
    </div>
  `;
}

function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── Dashboard Timeline Detail ───

export function renderTimelineDetail(events) {
  const el = document.getElementById("timeline-detail");
  if (!el) return;

  if (!events || events.length === 0) {
    el.innerHTML =
      '<div class="empty-state">No timeline events yet. Flux will record events as it runs.</div>';
    return;
  }

  el.innerHTML = `<div class="timeline-list">${events
    .map((e) => {
      const icon = getTimelineIcon(e.type || e.category);
      return `
      <div class="timeline-entry">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-title">${icon} ${escapeHtml(e.event || e.content || e.title || "")}</div>
          <div class="timeline-detail">${escapeHtml(e.context || e.detail || "")}</div>
          <div class="timeline-time">${timeAgo(e.timestamp)}</div>
        </div>
      </div>
    `;
    })
    .join("")}</div>`;
}

// ─── Dashboard Settings Detail ───

export function renderSettingsDetail() {
  const el = document.getElementById("settings-detail");
  if (!el) return;

  const settings = getStoredSettings();

  el.innerHTML = `
    <div class="settings-grid">
      <div class="settings-section">
        <h3 class="settings-section-title">Voice</h3>
        <div class="settings-row">
          <label class="settings-label">Auto-speak replies</label>
          <label class="settings-toggle">
            <input type="checkbox" id="setting-voice-autospeak" ${settings.autoSpeak ? "checked" : ""}>
            <span class="settings-toggle-slider"></span>
          </label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Voice</label>
          <select id="setting-voice" class="settings-select">
            <option value="en-us+m3" ${settings.voice === "en-us+m3" ? "selected" : ""}>Male 1 (Default)</option>
            <option value="en-us+f2" ${settings.voice === "en-us+f2" ? "selected" : ""}>Female 1</option>
            <option value="en-us+f3" ${settings.voice === "en-us+f3" ? "selected" : ""}>Female 2</option>
            <option value="en-us+f4" ${settings.voice === "en-us+f4" ? "selected" : ""}>Female 3</option>
            <option value="en-us+m7" ${settings.voice === "en-us+m7" ? "selected" : ""}>Male 2</option>
            <option value="en-gb+x-rp" ${settings.voice === "en-gb+x-rp" ? "selected" : ""}>British RP</option>
            <option value="en-gb-scotland" ${settings.voice === "en-gb-scotland" ? "selected" : ""}>Scottish</option>
            <option value="en-us+nrc" ${settings.voice === "en-us+nrc" ? "selected" : ""}>Whispery</option>
          </select>
        </div>
        <div class="settings-row">
          <label class="settings-label">Speed</label>
          <input type="range" id="setting-speech-rate" class="settings-range" min="0.6" max="1.8" step="0.05" value="${settings.speed}">
          <span id="setting-speech-rate-val" class="settings-range-val">${settings.speed.toFixed(1)}x</span>
        </div>
        <div class="settings-row">
          <label class="settings-label">Pitch</label>
          <input type="range" id="setting-speech-pitch" class="settings-range" min="0.3" max="1.5" step="0.05" value="${settings.pitch}">
          <span id="setting-speech-pitch-val" class="settings-range-val">${settings.pitch.toFixed(1)}</span>
        </div>
        <div class="settings-row">
          <label class="settings-label">Volume</label>
          <input type="range" id="setting-speech-volume" class="settings-range" min="0.1" max="1.0" step="0.05" value="${settings.volume}">
          <span id="setting-speech-volume-val" class="settings-range-val">${Math.round(settings.volume * 100)}%</span>
        </div>
        <div class="settings-row">
          <button id="settings-voice-test" class="settings-btn primary" style="margin-top:8px">Test Voice</button>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Model</h3>
        <div class="settings-row">
          <label class="settings-label">LLM Model</label>
          <select id="setting-model" class="settings-select">
            <option value="qwen2.5-coder:7b" ${settings.model === "qwen2.5-coder:7b" ? "selected" : ""}>qwen2.5-coder:7b</option>
            <option value="qwen2.5-coder:14b" ${settings.model === "qwen2.5-coder:14b" ? "selected" : ""}>qwen2.5-coder:14b</option>
            <option value="qwen2.5-coder:32b" ${settings.model === "qwen2.5-coder:32b" ? "selected" : ""}>qwen2.5-coder:32b</option>
            <option value="llama3.1:8b" ${settings.model === "llama3.1:8b" ? "selected" : ""}>llama3.1:8b</option>
            <option value="llama3.1:70b" ${settings.model === "llama3.1:70b" ? "selected" : ""}>llama3.1:70b</option>
            <option value="deepseek-coder:6.7b" ${settings.model === "deepseek-coder:6.7b" ? "selected" : ""}>deepseek-coder:6.7b</option>
          </select>
        </div>
        <div class="settings-row">
          <label class="settings-label">Ollama URL</label>
          <input type="text" id="setting-ollama-url" class="settings-input" value="${settings.ollamaUrl}" />
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Cognition</h3>
        <div class="settings-row">
          <label class="settings-label">Background tick interval</label>
          <select id="setting-tick-interval" class="settings-select">
            <option value="2000" ${settings.tickInterval === "2000" ? "selected" : ""}>2s (fast)</option>
            <option value="5000" ${settings.tickInterval === "5000" ? "selected" : ""}>5s (normal)</option>
            <option value="10000" ${settings.tickInterval === "10000" ? "selected" : ""}>10s (slow)</option>
            <option value="30000" ${settings.tickInterval === "30000" ? "selected" : ""}>30s (minimal)</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Speech Behavior</h3>
        <div class="settings-row">
          <label class="settings-label">Verbosity</label>
          <select id="setting-verbosity" class="settings-select">
            <option value="minimal" ${settings.verbosity === "minimal" ? "selected" : ""}>Minimal — only when asked</option>
            <option value="normal" ${settings.verbosity === "normal" ? "selected" : ""}>Normal — balanced</option>
            <option value="verbose" ${settings.verbosity === "verbose" ? "selected" : ""}>Verbose — explain everything</option>
          </select>
        </div>
        <div class="settings-row">
          <label class="settings-label">Proactive speech</label>
          <label class="settings-toggle"><input type="checkbox" id="setting-proactive-speech" ${settings.proactiveSpeech ? "checked" : ""}><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Proactive frequency</label>
          <select id="setting-proactive-freq" class="settings-select">
            <option value="low" ${settings.proactiveFrequency === "low" ? "selected" : ""}>Low — only important</option>
            <option value="medium" ${settings.proactiveFrequency === "medium" ? "selected" : ""}>Medium — suggestions welcome</option>
            <option value="high" ${settings.proactiveFrequency === "high" ? "selected" : ""}>High — talk to me often</option>
          </select>
        </div>
        <div class="settings-row">
          <label class="settings-label">Max proactive messages/hr</label>
          <input type="number" id="setting-max-proactive" class="settings-input" min="0" max="20" value="${settings.maxProactivePerHour}">
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Sensors</h3>
        ${[
          ["Git", "sensor-git"],
          ["Filesystem", "sensor-fs"],
          ["Clipboard", "sensor-clipboard"],
          ["Docker", "sensor-docker"],
          ["Battery", "sensor-battery"],
          ["Audio", "sensor-audio"],
          ["Notifications", "sensor-notif"],
          ["Spotify", "sensor-spotify"],
          ["Idle", "sensor-idle"],
        ]
          .map(
            ([name, id]) => `
          <div class="settings-row">
            <label class="settings-label">${name}</label>
            <label class="settings-toggle"><input type="checkbox" id="${id}" ${(settings.sensors || {})[id] !== false ? "checked" : ""}><span class="settings-toggle-slider"></span></label>
          </div>
        `,
          )
          .join("")}
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Appearance</h3>
        <div class="settings-row">
          <label class="settings-label">Particle effects</label>
          <label class="settings-toggle"><input type="checkbox" id="setting-particles" ${settings.particles ? "checked" : ""}><span class="settings-toggle-slider"></span></label>
        </div>
        <div class="settings-row">
          <label class="settings-label">Always on top</label>
          <label class="settings-toggle"><input type="checkbox" id="setting-always-top" ${settings.alwaysOnTop ? "checked" : ""}><span class="settings-toggle-slider"></span></label>
        </div>
      </div>
    </div>
    <div class="settings-actions">
      <button id="settings-save" class="settings-btn primary">Save Settings</button>
      <button id="settings-reset" class="settings-btn">Reset to Defaults</button>
    </div>
  `;

  // Wire up range sliders
  const rateSlider = document.getElementById("setting-speech-rate");
  const rateVal = document.getElementById("setting-speech-rate-val");
  if (rateSlider && rateVal)
    rateSlider.addEventListener("input", () => {
      rateVal.textContent = parseFloat(rateSlider.value).toFixed(1) + "x";
    });

  const pitchSlider = document.getElementById("setting-speech-pitch");
  const pitchVal = document.getElementById("setting-speech-pitch-val");
  if (pitchSlider && pitchVal)
    pitchSlider.addEventListener("input", () => {
      pitchVal.textContent = parseFloat(pitchSlider.value).toFixed(1);
    });

  const volSlider = document.getElementById("setting-speech-volume");
  const volVal = document.getElementById("setting-speech-volume-val");
  if (volSlider && volVal)
    volSlider.addEventListener("input", () => {
      volVal.textContent = Math.round(parseFloat(volSlider.value) * 100) + "%";
    });

  // Voice test button
  const testBtn = document.getElementById("settings-voice-test");
  if (testBtn) {
    testBtn.addEventListener("click", () => {
      const voice =
        document.getElementById("setting-voice")?.value || "en-us+m3";
      const speed = parseFloat(
        document.getElementById("setting-speech-rate")?.value || "1",
      );
      const pitch = parseFloat(
        document.getElementById("setting-speech-pitch")?.value || "0.9",
      );
      const volume = parseFloat(
        document.getElementById("setting-speech-volume")?.value || "1",
      );
      const testText =
        "Hello! I am Flux, your AI assistant. How can I help you today?";
      fetch(`${API}/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testText, voice, speed, pitch, volume }),
      })
        .then((r) => r.blob())
        .then((blob) => {
          if (blob.size > 100) {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.volume = volume;
            audio.onended = () => URL.revokeObjectURL(url);
            audio.play();
          }
        })
        .catch(() => {});
    });
  }

  // Save button
  const saveBtn = document.getElementById("settings-save");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const newSettings = {
        autoSpeak:
          document.getElementById("setting-voice-autospeak")?.checked ?? true,
        voice: document.getElementById("setting-voice")?.value || "en-us+m3",
        speed: parseFloat(
          document.getElementById("setting-speech-rate")?.value || "1",
        ),
        pitch: parseFloat(
          document.getElementById("setting-speech-pitch")?.value || "0.9",
        ),
        volume: parseFloat(
          document.getElementById("setting-speech-volume")?.value || "1",
        ),
        model:
          document.getElementById("setting-model")?.value || "qwen2.5-coder:7b",
        ollamaUrl:
          document.getElementById("setting-ollama-url")?.value ||
          "http://localhost:11434",
        tickInterval:
          document.getElementById("setting-tick-interval")?.value || "5000",
        particles:
          document.getElementById("setting-particles")?.checked ?? true,
        alwaysOnTop:
          document.getElementById("setting-always-top")?.checked ?? true,
        sensors: {},
        // Speech behavior
        verbosity: document.getElementById("setting-verbosity")?.value || "normal",
        proactiveSpeech: document.getElementById("setting-proactive-speech")?.checked ?? true,
        proactiveFrequency: document.getElementById("setting-proactive-freq")?.value || "low",
        maxProactivePerHour: parseInt(document.getElementById("setting-max-proactive")?.value || "3", 10),
      };
      [
        "sensor-git",
        "sensor-fs",
        "sensor-clipboard",
        "sensor-docker",
        "sensor-battery",
        "sensor-audio",
        "sensor-notif",
        "sensor-spotify",
        "sensor-idle",
      ].forEach((id) => {
        newSettings.sensors[id] = document.getElementById(id)?.checked ?? true;
      });
      localStorage.setItem("flux-settings", JSON.stringify(newSettings));
      // Also sync voice settings for speakText
      localStorage.setItem(
        "flux-voice-settings",
        JSON.stringify({
          voice: newSettings.voice,
          speed: newSettings.speed,
          pitch: newSettings.pitch,
          volume: newSettings.volume,
        }),
      );
      showToast("Settings saved", "success", 2000);
    });
  }

  // Reset button
  const resetBtn = document.getElementById("settings-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      localStorage.removeItem("flux-settings");
      localStorage.removeItem("flux-voice-settings");
      renderSettingsDetail();
      showToast("Settings reset to defaults", "info", 2000);
    });
  }
}

function getStoredSettings() {
  const defaults = {
    autoSpeak: true,
    voice: "en-us+m3",
    speed: 1.0,
    pitch: 0.9,
    volume: 1.0,
    model: "qwen2.5-coder:7b",
    ollamaUrl: "http://localhost:11434",
    tickInterval: "5000",
    particles: true,
    alwaysOnTop: true,
    sensors: {},
    // Speech behavior settings
    verbosity: "normal", // minimal | normal | verbose
    proactiveSpeech: true, // Flux speaks unprompted (suggestions, alerts)
    proactiveFrequency: "low", // low | medium | high — how often Flux initiates
    maxProactivePerHour: 3, // max unprompted messages per hour
  };
  try {
    const saved = JSON.parse(localStorage.getItem("flux-settings") || "{}");
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

// ─── Voice Recording Indicator ───

export function setVoiceRecording(recording) {
  // Update voice button visual state
  const voiceBtn = document.querySelector('.action-btn[data-action="voice"]');
  if (voiceBtn) {
    if (recording) {
      voiceBtn.classList.add("recording");
      voiceBtn.textContent = "Stop";
    } else {
      voiceBtn.classList.remove("recording");
      voiceBtn.textContent = "Voice";
    }
  }

  // Update status indicator
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  if (recording) {
    if (statusDot) statusDot.style.background = "var(--error)";
    if (statusText) statusText.textContent = "Recording";
  } else {
    if (statusDot) statusDot.style.background = "";
    if (statusText) statusText.textContent = "Watching";
  }
}

// ─── Toast Notifications ───

export function showToast(message, type = "info", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText =
      "position:fixed;top:12px;right:12px;z-index:9999;display:flex;flex-direction:column;gap:6px;pointer-events:none;";
    document.body.appendChild(container);
  }

  const colors = {
    info: "var(--accent)",
    success: "var(--success)",
    warning: "var(--warning)",
    error: "var(--error)",
  };

  const toast = document.createElement("div");
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
    toast.style.animation = "fade-out 0.2s ease forwards";
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// ─── Helpers ───

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getStageName(stage) {
  const stages = [
    "Observe",
    "Merge",
    "World Model",
    "Working Memory",
    "Goal Eval",
    "Intent Predict",
    "Generate",
    "Compare",
    "Opportunities",
    "Interrupt Eval",
    "Choose Action",
    "Store",
    "Explain",
    "Sleep",
  ];
  return stages[stage - 1] || "Unknown";
}

function timeAgo(ts) {
  if (!ts) return "Unknown";
  const diff = Date.now() - ts;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function getTimelineIcon(type) {
  const icons = {
    interaction: "\u{1F4AC}",
    observation: "\u{1F441}",
    reflection: "\u{1F914}",
    milestone: "\u{1F3C6}",
    suggestion: "\u{1F4A1}",
    error: "\u{26A0}",
    commit: "\u{1F4DD}",
    goal: "\u{1F3AF}",
    conversation: "\u{1F5E3}",
    build: "\u{1F527}",
    test: "\u{2705}",
  };
  return icons[type] || "\u{2022}";
}
