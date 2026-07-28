// ═══════════════════════════════════════════════════════════════
// FLUX APP — Main entry point, mode switching, command palette
// ═══════════════════════════════════════════════════════════════

import { state, on, startDataEngine } from './data.js';
import * as UI from './components.js';
import { startParticles, startGraph, stopGraph } from './animations.js';

// ─── Mode Switching ───

const modes = {
  dormant: document.getElementById('mode-dormant'),
  hud: document.getElementById('mode-hud'),
  dashboard: document.getElementById('mode-dashboard'),
};

function setMode(mode) {
  state.mode = mode;
  Object.entries(modes).forEach(([key, el]) => {
    if (!el) return;
    if (key === mode) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  // Start/stop graph when entering/leaving dashboard
  if (mode === 'dashboard') {
    startGraph();
    UI.renderSensorsDetail(state.sensors);
    UI.renderMemoryPage();
  } else {
    stopGraph();
  }

  // Resize window for Tauri
  resizeWindow(mode);
}

async function resizeWindow(mode) {
  if (!window.__TAURI_INTERNALS__) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    switch (mode) {
      case 'dormant':
        await win.setSize({ width: 120, height: 120 });
        await win.center();
        break;
      case 'hud':
        await win.setSize({ width: 340, height: 580 });
        await win.center();
        break;
      case 'dashboard':
        await win.setSize({ width: 1200, height: 800 });
        await win.center();
        break;
    }
  } catch (e) {
    // Not in Tauri or API not available
  }
}

// ─── Event Listeners ───

function initEventListeners() {
  // Dormant orb click → HUD
  const orb = document.getElementById('orb');
  if (orb) {
    orb.addEventListener('click', () => setMode('hud'));
  }

  // Dashboard close → HUD
  const dashClose = document.getElementById('dash-close');
  if (dashClose) {
    dashClose.addEventListener('click', () => setMode('hud'));
  }

  // HUD action buttons
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      switch (action) {
        case 'dashboard':
          setMode('dashboard');
          break;
        case 'memory':
          setMode('dashboard');
          switchTab('memory');
          break;
        case 'explain':
          showExplain();
          break;
        case 'voice':
          toggleVoice();
          break;
        case 'settings':
          setMode('dashboard');
          switchTab('settings');
          break;
      }
    });
  });

  // Dashboard tabs
  const tabsContainer = document.getElementById('dash-tabs');
  if (tabsContainer) {
    tabsContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (tab) switchTab(tab.dataset.tab);
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+K or Space (when not in input) → Command Palette
    if ((e.ctrlKey && e.key === 'k') || (e.key === ' ' && !isInputFocused())) {
      e.preventDefault();
      toggleCommandPalette();
    }

    // Escape → close palette or go back
    if (e.key === 'Escape') {
      const palette = document.getElementById('command-palette');
      if (palette && !palette.classList.contains('hidden')) {
        toggleCommandPalette();
      } else if (state.mode === 'dashboard') {
        setMode('hud');
      } else if (state.mode === 'hud') {
        setMode('dormant');
      }
    }

    // Number keys for quick mode switch
    if (e.key === '1' && !isInputFocused()) setMode('dormant');
    if (e.key === '2' && !isInputFocused()) setMode('hud');
    if (e.key === '3' && !isInputFocused()) setMode('dashboard');
  });
}

function isInputFocused() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

// ─── Tab Switching ───

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });

  // Update panels
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `panel-${tabName}`);
  });

  // Re-render content for specific tabs
  if (tabName === 'sensors') {
    UI.renderSensorsDetail(state.sensors);
  } else if (tabName === 'memory') {
    UI.renderMemoryPage();
  } else if (tabName === 'graph') {
    startGraph();
  }
}

// ─── Command Palette ───

const commands = [
  { icon: '\u{1F50E}', text: 'Explain current thought', hint: 'Explain' },
  { icon: '\u{1F4CB}', text: 'Summarize today', hint: 'Summary' },
  { icon: '\u{1F914}', text: 'What are you doing', hint: 'Status' },
  { icon: '\u{1F4BE}', text: 'Open memory', hint: 'Memory' },
  { icon: '\u{1F50D}', text: 'Search files', hint: 'Search' },
  { icon: '\u{2699}\uFE0F', text: 'Run planner', hint: 'Planner' },
  { icon: '\u{1F916}', text: 'Start agent', hint: 'Agent' },
  { icon: '\u{1F3AF}', text: 'Open dashboard', hint: 'Dashboard' },
  { icon: '\u{1F504}', text: 'Switch to HUD', hint: 'HUD' },
  { icon: '\u{23F8}\uFE0F', text: 'Switch to dormant', hint: 'Dormant' },
  { icon: '\u{1F399}\uFE0F', text: 'Toggle voice', hint: 'Voice' },
  { icon: '\u{2699}\uFE0F', text: 'Open settings', hint: 'Settings' },
];

let paletteSelectedIndex = 0;

function toggleCommandPalette() {
  const palette = document.getElementById('command-palette');
  if (!palette) return;

  if (palette.classList.contains('hidden')) {
    palette.classList.remove('hidden');
    const input = document.getElementById('palette-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    renderPaletteResults('');
    paletteSelectedIndex = 0;
  } else {
    palette.classList.add('hidden');
  }
}

function renderPaletteResults(query) {
  const results = document.getElementById('palette-results');
  if (!results) return;

  const q = query.toLowerCase();
  const filtered = commands.filter(c =>
    c.text.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)
  );

  results.innerHTML = filtered.map((c, i) =>
    `<div class="palette-item ${i === paletteSelectedIndex ? 'selected' : ''}" data-index="${i}">
      <span class="palette-item-icon">${c.icon}</span>
      <span class="palette-item-text">${c.text}</span>
      <span class="palette-item-hint">${c.hint}</span>
    </div>`
  ).join('');

  // Click handlers
  results.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      executeCommand(filtered[idx]);
    });
  });
}

function executeCommand(cmd) {
  if (!cmd) return;
  toggleCommandPalette();

  const text = cmd.text.toLowerCase();
  if (text.includes('dashboard')) setMode('dashboard');
  else if (text.includes('hud')) setMode('hud');
  else if (text.includes('dormant')) setMode('dormant');
  else if (text.includes('memory')) { setMode('dashboard'); switchTab('memory'); }
  else if (text.includes('settings')) { setMode('dashboard'); switchTab('settings'); }
  else if (text.includes('explain')) showExplain();
  else if (text.includes('voice')) toggleVoice();
}

// ─── Explain Current Thought ───

function showExplain() {
  const modal = document.createElement('div');
  modal.className = 'hidden';
  modal.id = 'explain-modal';
  modal.innerHTML = `
    <div class="palette-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:999;"></div>
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;max-height:70vh;overflow-y:auto;background:rgba(25,30,40,0.95);backdrop-filter:blur(24px);border:1px solid rgba(85,214,255,0.15);border-radius:16px;padding:24px;z-index:1000;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
      <h2 style="font-size:16px;font-weight:600;color:#55D6FF;margin-bottom:16px;">Current Thought</h2>
      <div style="font-size:13px;color:#F5F7FA;line-height:1.6;margin-bottom:12px;">
        <strong style="color:#55D6FF;">Thought:</strong> ${state.cognition}<br><br>
        <strong style="color:#7C8BFF;">Evidence:</strong><br>
        - Goal "${state.goal.name}" at ${state.goal.progress}%<br>
        - ${state.sensors.filter(s => s.status === 'healthy').length} sensors active<br>
        - ${state.thoughts.length} thoughts in graph<br><br>
        <strong style="color:#49E38A;">Confidence:</strong> ${state.confidence.primary}%<br>
        <strong style="color:#A0AEC0;">Alternative:</strong> ${state.confidence.alt} (${state.confidence.altValue}%)
      </div>
      <button onclick="this.closest('#explain-modal').remove()" style="width:100%;padding:10px;border-radius:8px;background:rgba(85,214,255,0.1);border:1px solid rgba(85,214,255,0.2);color:#55D6FF;font-size:12px;cursor:pointer;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.classList.remove('hidden');
}

// ─── Voice Toggle (placeholder) ───

function toggleVoice() {
  // Placeholder for voice integration
  console.log('[Flux] Voice toggle');
}

// ─── Subscribe to Data Events ───

function bindDataEvents() {
  on('time', UI.updateTime);
  on('cpu', UI.updateCpu);
  on('cognition', (text) => {
    UI.updateCognition(text);
    UI.updateDashboardCognition(text, state.pipelineStage);
  });
  on('goal', UI.updateGoal);
  on('prediction', UI.updatePrediction);
  on('focus', UI.updateFocus);
  on('tasks', UI.updateTasks);
  on('memories', UI.updateMemories);
  on('sensors', UI.updateSensors);
  on('thought', UI.updateThought);
  on('worldModel', UI.updateWorldModel);
  on('mood', UI.updateMood);
  on('confidence', UI.updateConfidence);
}

// ─── Initialize ───

function init() {
  bindDataEvents();
  initEventListeners();
  startDataEngine();
  startParticles();

  // Start in dormant mode
  setMode('dormant');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
