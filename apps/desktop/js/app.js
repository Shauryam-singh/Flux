// ═══════════════════════════════════════════════════════════════
// FLUX APP — Main entry point, mode switching, voice, command palette
// ═══════════════════════════════════════════════════════════════

import { startGraph, startParticles, stopGraph } from "./animations.js";
import * as UI from "./components.js";
import { on, startDataEngine, state } from "./data.js";

const API = "http://localhost:3141";

// ─── Tauri IPC Helper ───

async function invokeTauri(cmd, args = {}) {
  if (!window.__TAURI_INTERNALS__) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke(cmd, args);
  } catch (e) {
    console.warn(`[Flux] Tauri invoke failed for ${cmd}:`, e);
    return null;
  }
}

// ─── Mode Switching ───

const modes = {
  dormant: document.getElementById("mode-dormant"),
  hud: document.getElementById("mode-hud"),
  dashboard: document.getElementById("mode-dashboard"),
};

function setMode(mode) {
  state.mode = mode;
  Object.entries(modes).forEach(([key, el]) => {
    if (!el) return;
    if (key === mode) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });

  if (mode === "dashboard") {
    startGraph();
    UI.renderSensorsDetail(state.sensors);
    UI.renderMemoryPage();
  } else {
    stopGraph();
  }

  resizeWindow(mode);
}

async function resizeWindow(mode) {
  if (!window.__TAURI_INTERNALS__) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    switch (mode) {
      case "dormant":
        await win.setSize({ width: 120, height: 120 });
        await win.center();
        break;
      case "hud":
        await win.setSize({ width: 340, height: 580 });
        await win.center();
        break;
      case "dashboard":
        await win.setSize({ width: 1200, height: 800 });
        await win.center();
        break;
    }
  } catch {
    // Not in Tauri
  }
}

// ─── Window Dragging (frameless window) ───

function initDrag() {
  let isDragging = false;
  let startX, startY;

  function onMouseDown(e) {
    if (
      e.target.closest(
        "button, input, textarea, .action-btn, .tab, .palette-item",
      )
    )
      return;
    isDragging = true;
    startX = e.screenX;
    startY = e.screenY;
    document.body.style.userSelect = "none";
  }

  async function onMouseMove(e) {
    if (!isDragging || !window.__TAURI_INTERNALS__) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      const dx = e.screenX - startX;
      const dy = e.screenY - startY;
      await win.setPosition({ x: pos.x + dx, y: pos.y + dy });
      startX = e.screenX;
      startY = e.screenY;
    } catch {}
  }

  function onMouseUp() {
    isDragging = false;
    document.body.style.userSelect = "";
  }

  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

// ─── Settings Helpers ───

function getAutoSpeak() {
  return localStorage.getItem("flux-auto-speak") === "true";
}

function setAutoSpeak(val) {
  localStorage.setItem("flux-auto-speak", String(val));
  updateAutoSpeakUI();
}

function updateAutoSpeakUI() {
  const btn = document.getElementById("auto-speak-toggle");
  if (btn) {
    const on = getAutoSpeak();
    btn.classList.toggle("active", on);
    btn.title = on ? "Auto-speak: ON" : "Auto-speak: OFF";
    btn.textContent = on ? "\u{1F50A}" : "\u{1F507}";
  }
}

// ─── Voice (Push-to-Talk) ───

let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];

async function toggleVoice() {
  if (isRecording) {
    await stopVoice();
  } else {
    await startVoice();
  }
}

async function startVoice() {
  isRecording = true;
  UI.setVoiceRecording(true);
  UI.showToast("Recording... speak now", "info", 2000);

  // Try Tauri first (native arecord)
  const tauriResult = await invokeTauri("start_recording");
  if (tauriResult === "recording_started") {
    UI.showToast("Recording via system audio", "info", 2000);
    return;
  }

  // Fallback: browser MediaRecorder API
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      for (const t of stream.getTracks()) t.stop();
      if (audioChunks.length === 0) return;

      UI.showToast("Processing audio...", "info", 2000);
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(",")[1];
        try {
          const resp = await fetch(`${API}/voice/transcribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: base64, sampleRate: 48000 }),
          });
          const data = await resp.json();
          if (data.text) {
            UI.showToast(`You said: "${data.text}"`, "success", 3000);
            await sendChatMessageDirect(data.text, true);
          } else {
            UI.showToast("No speech detected", "warning", 3000);
          }
        } catch {
          UI.showToast("Transcription unavailable", "warning", 3000);
        }
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorder.start();
  } catch {
    UI.showToast("Microphone access denied", "error", 3000);
    isRecording = false;
    UI.setVoiceRecording(false);
  }
}

async function stopVoice() {
  isRecording = false;
  UI.setVoiceRecording(false);

  try {
    const tauriResult = await Promise.race([
      invokeTauri("stop_recording"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 8000),
      ),
    ]);
    if (tauriResult) {
      UI.showToast(`You said: "${tauriResult}"`, "success", 3000);
      await sendChatMessageDirect(tauriResult, true);
      return;
    }
  } catch {}

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

// ─── Wake Word Listener ───

let wakeRecognition = null;
let wakeListening = false;
let wakeCommandRecording = false;
let wakeCommandRecorder = null;
let wakeCommandChunks = [];

function isWakeWordEnabled() {
  return localStorage.getItem("flux-wake-word") === "true";
}

function setWakeWordEnabled(val) {
  localStorage.setItem("flux-wake-word", String(val));
  if (val) startWakeWord();
  else stopWakeWord();
  updateWakeWordUI();
}

function updateWakeWordUI() {
  const btn = document.getElementById("wake-word-toggle");
  if (btn) {
    const on = isWakeWordEnabled();
    btn.classList.toggle("active", on);
    btn.title = on ? 'Wake word: Listening for "Flux"' : "Wake word: OFF";
    btn.textContent = on ? "\u{1F399}\uFE0F" : "\u{1F515}";
  }
}

function startWakeWord() {
  if (wakeListening) return;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    UI.showToast(
      "Speech recognition not supported in this browser",
      "warning",
      3000,
    );
    setWakeWordEnabled(false);
    return;
  }

  wakeRecognition = new SpeechRecognition();
  wakeRecognition.continuous = true;
  wakeRecognition.interimResults = true;
  wakeRecognition.lang = "en-US";

  wakeRecognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.toLowerCase().trim();

      // Check for wake word "flux"
      if (transcript.includes("flux") && !wakeCommandRecording) {
        console.log("[Flux] Wake word detected!");
        UI.showToast(
          "Wake word detected! Listening for command...",
          "success",
          2000,
        );
        startWakeCommandRecording();
        return;
      }
    }
  };

  wakeRecognition.onerror = (event) => {
    if (event.error !== "no-speech" && event.error !== "aborted") {
      console.warn("[Flux] Wake word error:", event.error);
    }
  };

  wakeRecognition.onend = () => {
    // Restart if still enabled
    if (isWakeWordEnabled() && wakeListening) {
      try {
        wakeRecognition.start();
      } catch {}
    }
  };

  try {
    wakeRecognition.start();
    wakeListening = true;
    UI.showToast('Wake word active — say "Flux"', "info", 3000);
  } catch (e) {
    console.warn("[Flux] Could not start wake word:", e);
  }
}

function stopWakeWord() {
  wakeListening = false;
  if (wakeRecognition) {
    try {
      wakeRecognition.stop();
    } catch {}
    wakeRecognition = null;
  }
}

function startWakeCommandRecording() {
  wakeCommandRecording = true;

  // Pause wake word recognition while recording command
  if (wakeRecognition) {
    try {
      wakeRecognition.stop();
    } catch {}
  }

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      wakeCommandRecorder = new MediaRecorder(stream);
      wakeCommandChunks = [];

      wakeCommandRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) wakeCommandChunks.push(e.data);
      };

      wakeCommandRecorder.onstop = async () => {
        for (const t of stream.getTracks()) t.stop();
        wakeCommandRecording = false;

        if (wakeCommandChunks.length === 0) {
          restartWakeWord();
          return;
        }

        UI.showToast("Processing command...", "info", 2000);
        const blob = new Blob(wakeCommandChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(",")[1];
          try {
            const resp = await fetch(`${API}/voice/transcribe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64, sampleRate: 48000 }),
            });
            const data = await resp.json();
            if (data.text) {
              UI.showToast(`Command: "${data.text}"`, "success", 3000);
              await sendChatMessageDirect(data.text, true);
            } else {
              UI.showToast("No command detected", "warning", 3000);
            }
          } catch {
            UI.showToast("Transcription unavailable", "warning", 3000);
          }
          restartWakeWord();
        };
        reader.readAsDataURL(blob);
      };

      wakeCommandRecorder.start();

      // Auto-stop after 8 seconds of command recording
      setTimeout(() => {
        if (wakeCommandRecorder && wakeCommandRecorder.state !== "inactive") {
          wakeCommandRecorder.stop();
        }
      }, 8000);
    })
    .catch(() => {
      wakeCommandRecording = false;
      restartWakeWord();
    });
}

function restartWakeWord() {
  if (isWakeWordEnabled()) {
    setTimeout(() => {
      if (isWakeWordEnabled() && !wakeListening) {
        startWakeWord();
      }
    }, 500);
  }
}

// ─── TTS ───

async function speakText(text) {
  if (!text) return;

  const clean = text
    .replace(/```[\s\S]*?```/g, "code block")
    .replace(/`[^`]+`/g, "code")
    .replace(/[#*_~>]/g, "")
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
    .replace(/[\u{2B50}-\u{2B55}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!clean) return;

  const settings = getVoiceSettings();

  // Try API TTS
  try {
    const resp = await fetch(`${API}/voice/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: clean,
        voice: settings.voice,
        speed: settings.speed,
        pitch: settings.pitch,
      }),
    });
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob.size > 100) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = settings.volume;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            const retryPlay = () => {
              audio.play().catch(() => {});
              document.removeEventListener("click", retryPlay);
              document.removeEventListener("keydown", retryPlay);
            };
            document.addEventListener("click", retryPlay, { once: true });
            document.addEventListener("keydown", retryPlay, { once: true });
          });
        }
        audio.onended = () => URL.revokeObjectURL(url);
        return;
      }
    }
  } catch {}

  // Fallback: Tauri
  const tauriResult = await invokeTauri("speak", { text: clean });
  if (tauriResult === "spoken") return;

  // Last resort: Web Speech
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = settings.speed;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    utterance.lang = "en-US";
    const voices = speechSynthesis.getVoices();
    const english = voices.filter((v) => v.lang.startsWith("en"));
    if (english.length > 0) utterance.voice = english[0];
    speechSynthesis.speak(utterance);
  }
}

function getVoiceSettings() {
  const defaults = { voice: "en-us+m3", speed: 1.0, pitch: 0.9, volume: 1.0 };
  try {
    const saved = JSON.parse(
      localStorage.getItem("flux-voice-settings") || "{}",
    );
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

// ─── Chat Message Sending ───

async function sendChatMessage() {
  const input = document.getElementById("chat-input");
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;

  input.value = "";
  const shouldSpeak = getAutoSpeak();
  await sendChatMessageDirect(message, shouldSpeak);
}

async function sendChatMessageDirect(message, speak = false) {
  // Add user message to conversation thread
  addChatMessage("user", message);

  let reply = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const errMsg = errData.error || `Server error (${resp.status})`;
      UI.showToast(`Error: ${errMsg}`, "error", 5000);
      addChatMessage("system", `Error: ${errMsg}`);
      return;
    }

    const data = await resp.json();
    reply = data.reply || null;
  } catch (e) {
    const msg = e?.name === "AbortError" ? "Request timed out (15s)" : "API not reachable";
    UI.showToast(`Error: ${msg}`, "error", 5000);
    addChatMessage("system", `Error: ${msg}`);

    // Try Tauri fallback
    try {
      const tauriResult = await Promise.race([
        invokeTauri("send_message", { message }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 10000),
        ),
      ]);
      if (tauriResult) reply = tauriResult;
    } catch {}
  }

  if (reply) {
    addChatMessage("assistant", reply);
    if (speak) {
      try {
        await speakText(reply);
        // Multi-turn: after speaking, listen for follow-up
        if (getWakeWordEnabled()) {
          setTimeout(() => {
            if (isWakeWordRunning()) return; // Already listening
            startFollowUpListen();
          }, 500);
        }
      } catch (e) {
        console.warn("[Flux] speakText failed:", e);
      }
    }
  }
}

// ─── Conversation Thread ───

function addChatMessage(role, content, proactiveMsg) {
  const container = document.getElementById("chat-messages");
  if (!container) return;

  const div = document.createElement("div");
  div.className = `chat-msg chat-${role}`;

  let icon = "⚠️";
  if (role === "user") icon = "👤";
  else if (role === "assistant") icon = "🤖";
  else if (role === "proactive") icon = "💡";
  else if (role === "system") icon = "⚙️";

  const text = content.length > 2000 ? content.slice(0, 2000) + "..." : content;

  let actionHtml = "";
  if (role === "proactive" && proactiveMsg?.actionLabel) {
    const msgId = proactiveMsg.id ?? "";
    actionHtml = `<div class="chat-proactive-actions">
      <button class="chat-action-btn" onclick="handleProactiveAction('${msgId}', 'act')">${proactiveMsg.actionLabel}</button>
      <button class="chat-action-btn chat-action-dismiss" onclick="handleProactiveAction('${msgId}', 'dismiss')">Dismiss</button>
    </div>`;
  }

  div.innerHTML = `<span class="chat-icon">${icon}</span><span class="chat-text">${escapeHtmlSimple(text)}</span>${actionHtml}`;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // Keep only last 50 messages in DOM
  while (container.children.length > 50) {
    container.removeChild(container.firstChild);
  }
}

// Handle proactive suggestion actions
async function handleProactiveAction(suggestionId, action) {
  try {
    const resp = await fetch(`${API}/suggestions/${suggestionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.reply) {
        addChatMessage("assistant", data.reply);
        // Also speak the reply if auto-speak is on
        const settings = getStoredSettings();
        if (settings.autoSpeak) {
          speakText(data.reply);
        }
      }
    }
  } catch {
    // Best-effort
  }
}

function escapeHtmlSimple(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Multi-turn Voice ───

let followUpTimer = null;

function startFollowUpListen() {
  // Listen for 5 seconds after speaking
  clearFollowUpTimer();
  if (typeof startVoice === "function") {
    startVoice();
    followUpTimer = setTimeout(() => {
      if (typeof stopVoice === "function") stopVoice();
    }, 5000);
  }
}

function clearFollowUpTimer() {
  if (followUpTimer) {
    clearTimeout(followUpTimer);
    followUpTimer = null;
  }
}

// ─── Event Listeners ───

function initEventListeners() {
  // Dormant orb click → HUD
  const orb = document.getElementById("orb");
  if (orb) {
    orb.addEventListener("click", () => setMode("hud"));
  }

  // Dashboard close → HUD
  const dashClose = document.getElementById("dash-close");
  if (dashClose) {
    dashClose.addEventListener("click", () => setMode("hud"));
  }

  // HUD action buttons
  document.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      switch (action) {
        case "dashboard":
          setMode("dashboard");
          break;
        case "memory":
          setMode("dashboard");
          switchTab("memory");
          break;
        case "explain":
          showExplain();
          break;
        case "voice":
          toggleVoice();
          break;
        case "wake-word":
          setWakeWordEnabled(!isWakeWordEnabled());
          break;
        case "auto-speak":
          setAutoSpeak(!getAutoSpeak());
          break;
        case "settings":
          setMode("dashboard");
          switchTab("settings");
          break;
      }
    });
  });

  // Dashboard tabs
  const tabsContainer = document.getElementById("dash-tabs");
  if (tabsContainer) {
    tabsContainer.addEventListener("click", (e) => {
      const tab = e.target.closest(".tab");
      if (tab) switchTab(tab.dataset.tab);
    });
  }

  // Command palette input
  const paletteInput = document.getElementById("palette-input");
  if (paletteInput) {
    paletteInput.addEventListener("input", (e) => {
      paletteSelectedIndex = 0;
      renderPaletteResults(e.target.value);
    });

    paletteInput.addEventListener("keydown", (e) => {
      const results = document.querySelectorAll(".palette-item");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        paletteSelectedIndex = Math.min(
          paletteSelectedIndex + 1,
          results.length - 1,
        );
        updatePaletteSelection(results);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        paletteSelectedIndex = Math.max(paletteSelectedIndex - 1, 0);
        updatePaletteSelection(results);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[paletteSelectedIndex];
        if (selected) {
          selected.click();
        } else if (paletteInput.value.trim()) {
          const msg = paletteInput.value.trim();
          toggleCommandPalette();
          sendChatMessageDirect(msg, getAutoSpeak());
        }
      }
    });
  }

  const backdrop = document.getElementById("palette-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", toggleCommandPalette);
  }

  // Chat input
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  if (chatInput && chatSend) {
    chatSend.addEventListener("click", () => sendChatMessage());
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ctrl+K → Command Palette
    if (e.ctrlKey && e.key === "k") {
      e.preventDefault();
      toggleCommandPalette();
      return;
    }

    // Ctrl+Shift+V → Push-to-talk voice
    if (e.ctrlKey && e.shiftKey && e.key === "V") {
      e.preventDefault();
      toggleVoice();
      return;
    }

    // Escape → close palette or navigate back
    if (e.key === "Escape") {
      const palette = document.getElementById("command-palette");
      if (palette && !palette.classList.contains("hidden")) {
        toggleCommandPalette();
      } else if (state.mode === "dashboard") {
        setMode("hud");
      } else if (state.mode === "hud") {
        setMode("dormant");
      }
      return;
    }

    // Number keys for quick mode switch
    if (!isInputFocused()) {
      if (e.key === "1") setMode("dormant");
      if (e.key === "2") setMode("hud");
      if (e.key === "3") setMode("dashboard");
    }
  });
}

function isInputFocused() {
  const el = document.activeElement;
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
}

// ─── Tab Switching ───

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("active", p.id === `panel-${tabName}`);
  });

  if (tabName === "sensors") {
    UI.renderSensorsDetail(state.sensors);
  } else if (tabName === "memory") {
    UI.renderMemoryPage();
  } else if (tabName === "graph") {
    startGraph();
  } else if (tabName === "goals") {
    fetchAndRenderGoals();
  } else if (tabName === "projects") {
    fetchAndRenderProjects();
  } else if (tabName === "agents") {
    fetchAndRenderAgents();
  } else if (tabName === "timeline") {
    fetchAndRenderTimeline();
  } else if (tabName === "settings") {
    UI.renderSettingsDetail();
  }
}

async function fetchAndRenderGoals() {
  try {
    const resp = await fetch(`${API}/goals`);
    const data = await resp.json();
    UI.renderGoalsDetail(data.goals || []);
  } catch {
    UI.renderGoalsDetail([]);
  }
}

async function fetchAndRenderProjects() {
  try {
    const resp = await fetch(`${API}/projects`);
    const data = await resp.json();
    UI.renderProjectsDetail(data.projects || []);
  } catch {
    UI.renderProjectsDetail([]);
  }
}

async function fetchAndRenderAgents() {
  try {
    const resp = await fetch(`${API}/agents`);
    const data = await resp.json();
    UI.renderAgentsDetail(data.agents || []);

    // Wire agent actions
    window.__agentActions = {
      async create(spec) {
        await fetch(`${API}/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spec }),
        });
        fetchAndRenderAgents();
      },
      async createAI(description) {
        await fetch(`${API}/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        });
        fetchAndRenderAgents();
      },
      async toggle(id) {
        await fetch(`${API}/agents/${id}/toggle`, { method: "POST" });
        fetchAndRenderAgents();
      },
      async delete(id) {
        if (!confirm("Delete this agent?")) return;
        await fetch(`${API}/agents/${id}`, { method: "DELETE" });
        fetchAndRenderAgents();
      },
    };
  } catch {
    UI.renderAgentsDetail([]);
  }
}

async function fetchAndRenderTimeline() {
  try {
    const resp = await fetch(`${API}/timeline?limit=30`);
    const data = await resp.json();
    UI.renderTimelineDetail(data.events || []);
  } catch {
    UI.renderTimelineDetail([]);
  }
}

// ─── Command Palette ───

const commands = [
  {
    icon: "\u{1F50E}",
    text: "Explain current thought",
    hint: "Explain",
    action: "explain",
  },
  {
    icon: "\u{1F4CB}",
    text: "Summarize today",
    hint: "Summary",
    action: "summary",
  },
  {
    icon: "\u{1F914}",
    text: "What are you doing",
    hint: "Status",
    action: "status",
  },
  { icon: "\u{1F4BE}", text: "Open memory", hint: "Memory", action: "memory" },
  { icon: "\u{1F50D}", text: "Search files", hint: "Search", action: "search" },
  {
    icon: "\u{2699}\uFE0F",
    text: "Run planner",
    hint: "Planner",
    action: "planner",
  },
  { icon: "\u{1F916}", text: "Start agent", hint: "Agent", action: "agent" },
  {
    icon: "\u{1F3AF}",
    text: "Open dashboard",
    hint: "Dashboard",
    action: "dashboard",
  },
  { icon: "\u{1F504}", text: "Switch to HUD", hint: "HUD", action: "hud" },
  {
    icon: "\u{23F8}\uFE0F",
    text: "Switch to dormant",
    hint: "Dormant",
    action: "dormant",
  },
  {
    icon: "\u{1F399}\uFE0F",
    text: "Toggle voice",
    hint: "Voice",
    action: "voice",
  },
  {
    icon: "\u{2699}\uFE0F",
    text: "Open settings",
    hint: "Settings",
    action: "settings",
  },
];

let paletteSelectedIndex = 0;

function toggleCommandPalette() {
  const palette = document.getElementById("command-palette");
  if (!palette) return;

  if (palette.classList.contains("hidden")) {
    palette.classList.remove("hidden");
    const input = document.getElementById("palette-input");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 50);
    }
    paletteSelectedIndex = 0;
    renderPaletteResults("");
  } else {
    palette.classList.add("hidden");
  }
}

function renderPaletteResults(query) {
  const results = document.getElementById("palette-results");
  if (!results) return;

  const q = query.toLowerCase();
  const filtered = commands.filter(
    (c) => c.text.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q),
  );

  results.innerHTML = filtered
    .map(
      (c, i) =>
        `<div class="palette-item ${i === paletteSelectedIndex ? "selected" : ""}" data-index="${i}">
      <span class="palette-item-icon">${c.icon}</span>
      <span class="palette-item-text">${c.text}</span>
      <span class="palette-item-hint">${c.hint}</span>
    </div>`,
    )
    .join("");

  results.querySelectorAll(".palette-item").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.dataset.index);
      executeCommand(filtered[idx]);
    });
  });
}

function updatePaletteSelection(results) {
  results.forEach((el, i) => {
    el.classList.toggle("selected", i === paletteSelectedIndex);
  });
  const selected = results[paletteSelectedIndex];
  if (selected) selected.scrollIntoView({ block: "nearest" });
}

function executeCommand(cmd) {
  if (!cmd) return;
  toggleCommandPalette();

  switch (cmd.action) {
    case "dashboard":
      setMode("dashboard");
      break;
    case "hud":
      setMode("hud");
      break;
    case "dormant":
      setMode("dormant");
      break;
    case "memory":
      setMode("dashboard");
      switchTab("memory");
      break;
    case "settings":
      setMode("dashboard");
      switchTab("settings");
      break;
    case "explain":
      showExplain();
      break;
    case "voice":
      toggleVoice();
      break;
    default:
      console.log(`[Flux] Command: ${cmd.action}`);
  }
}

// ─── Explain Current Thought ───

function showExplain() {
  const existing = document.getElementById("explain-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "explain-modal";
  modal.innerHTML = `
    <div class="palette-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:999;"></div>
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;max-height:70vh;overflow-y:auto;background:rgba(25,30,40,0.95);backdrop-filter:blur(24px);border:1px solid rgba(85,214,255,0.15);border-radius:16px;padding:24px;z-index:1000;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
      <h2 style="font-size:16px;font-weight:600;color:#55D6FF;margin-bottom:16px;">Current Thought</h2>
      <div style="font-size:13px;color:#F5F7FA;line-height:1.6;margin-bottom:12px;">
        <strong style="color:#55D6FF;">Thought:</strong> ${escapeHtml(state.cognition)}<br><br>
        <strong style="color:#7C8BFF;">Evidence:</strong><br>
        - Goal "${escapeHtml(state.goal.name)}" at ${state.goal.progress}%<br>
        - ${state.sensors.filter((s) => s.status === "healthy").length} sensors active<br>
        - ${state.thoughts.length} thoughts in graph<br><br>
        <strong style="color:#49E38A;">Confidence:</strong> ${state.confidence.primary}%<br>
        <strong style="color:#A0AEC0;">Alternative:</strong> ${escapeHtml(state.confidence.alt)} (${state.confidence.altValue}%)
      </div>
      <button id="explain-close-btn" style="width:100%;padding:10px;border-radius:8px;background:rgba(85,214,255,0.1);border:1px solid rgba(85,214,255,0.2);color:#55D6FF;font-size:12px;cursor:pointer;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);

  document
    .getElementById("explain-close-btn")
    .addEventListener("click", () => modal.remove());
  modal
    .querySelector(".palette-backdrop")
    .addEventListener("click", () => modal.remove());
}

// ─── Helpers ───

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Settings helper (defined here, also in components.js) ───

function getStoredSettings() {
  try {
    const raw = localStorage.getItem("flux-settings");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    voice: "en-us+m3",
    speed: 1.0,
    pitch: 0.9,
    volume: 1.0,
    model: "qwen2.5-coder:7b",
    autoSpeak: false,
  };
}

// ─── Wake word state check ───

function isWakeWordRunning() {
  return wakeListening;
}

// ─── Subscribe to Data Events ───

function bindDataEvents() {
  on("time", UI.updateTime);
  on("cpu", UI.updateCpu);
  on("connection", UI.updateStatusText);
  on("cognition", (text) => {
    UI.updateCognition(text);
    UI.updateDashboardCognition(
      text,
      state.pipelineStage,
      state.pipelineStageName,
    );
  });
  on("goal", UI.updateGoal);
  on("prediction", UI.updatePrediction);
  on("focus", UI.updateFocus);
  on("tasks", UI.updateTasks);
  on("memories", UI.updateMemories);
  on("sensors", UI.updateSensors);
  on("thought", UI.updateThought);
  on("worldModel", UI.updateWorldModel);
  on("mood", UI.updateMood);
  on("confidence", UI.updateConfidence);
  on("model", UI.updateModel);
  on("timeline", UI.updateTimeline);
  on("dashMemory", UI.updateDashMemory);
  on("suggestions", (suggestions) => {
    if (suggestions && suggestions.length > 0) {
      const latest = suggestions[0];
      UI.showToast(`💡 ${latest.message}`, latest.priority === "high" ? "warning" : "info", 6000);
    }
  });

  // Handle proactive messages from runtime — show in conversation thread
  on("proactiveMessage", (msg) => {
    // Add to conversation as a system message with action button
    addChatMessage("proactive", msg.content, msg);

    // Also show toast for high-priority
    if (msg.priority === "high" || msg.priority === "warning") {
      const icon = msg.type === "alert" ? "⚠️" : "💡";
      UI.showToast(`${icon} ${msg.content}`, msg.priority === "high" ? "warning" : "info", 8000);
    }
  });

  // Handle proactive speech — speak when auto-speak is ON
  on("proactiveSpeak", (data) => {
    const settings = getStoredSettings();
    if (settings.autoSpeak && data.text) {
      speakText(data.text);
    }
  });

  on("chatHistory", (messages) => {
    // Populate conversation thread from history
    const container = document.getElementById("chat-messages");
    if (container && container.children.length === 0 && messages.length > 0) {
      const recent = messages.slice(-20);
      for (const m of recent) {
        addChatMessage(m.role, m.content);
      }
    }
  });
}

// ─── Initialize ───

function init() {
  bindDataEvents();
  initEventListeners();
  initDrag();
  startDataEngine();
  startParticles();
  setMode("dormant");

  // Update toggle states
  updateAutoSpeakUI();
  updateWakeWordUI();

  // Start wake word if enabled
  if (isWakeWordEnabled()) {
    startWakeWord();
  }

  // Show startup briefing — switch to HUD first so modal is visible
  setTimeout(async () => {
    setMode("hud");
    await showStartupBriefing();
  }, 2500);
}

// ─── Startup Briefing ───

async function showStartupBriefing() {
  let briefingData;
  try {
    const resp = await fetch(`${API}/boot/briefing`);
    if (!resp.ok) return;
    briefingData = await resp.json();
  } catch {
    return;
  }

  const {
    greeting = "",
    timeString = "",
    markdown = "",
    news = [],
    goals = [],
    systemStatus = {},
    spokenText = "",
  } = briefingData;

  // If no markdown, build a basic one
  const displayHtml = markdown || buildFallbackBriefing(briefingData);

  const modal = document.createElement("div");
  modal.id = "briefing-modal";
  modal.innerHTML = `
    <div class="palette-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:999;"></div>
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:520px;max-height:75vh;overflow-y:auto;background:rgba(25,30,40,0.95);backdrop-filter:blur(24px);border:1px solid rgba(85,214,255,0.15);border-radius:16px;padding:24px;z-index:1000;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
      <div class="briefing-container">${displayHtml}</div>
      <button id="briefing-close-btn" style="width:100%;padding:10px;margin-top:16px;border-radius:8px;background:rgba(85,214,255,0.1);border:1px solid rgba(85,214,255,0.2);color:#55D6FF;font-size:12px;cursor:pointer;">Got it</button>
    </div>
  `;
  document.body.appendChild(modal);

  document
    .getElementById("briefing-close-btn")
    .addEventListener("click", () => modal.remove());
  modal
    .querySelector(".palette-backdrop")
    .addEventListener("click", () => modal.remove());
  setTimeout(() => {
    if (modal.parentNode) modal.remove();
  }, 20000);

  // Speak the briefing
  if (spokenText) {
    try {
      await speakText(spokenText);
    } catch {}
  }
}

function buildFallbackBriefing(data) {
  const lines = [];
  lines.push(`<h2 style="font-size:16px;font-weight:600;color:#55D6FF;margin-bottom:16px;">\u{1F44B} ${escapeHtml(data.greeting || "Hello!")}</h2>`);

  if (data.recap) {
    lines.push(`<div style="margin-bottom:12px;"><strong style="color:#7C8BFF;">Yesterday</strong>`);
    const recapLines = data.recap.split("\n").filter(l => l.trim());
    recapLines.forEach(l => {
      if (l.startsWith("- ")) lines.push(`<div style="font-size:12px;color:#F5F7FA;margin:2px 0;">\u2022 ${escapeHtml(l.slice(2))}</div>`);
    });
    lines.push(`</div>`);
  }

  if (data.news && data.news.length > 0) {
    lines.push(`<div style="margin-bottom:12px;"><strong style="color:#7C8BFF;">\u{1F4F0} Headlines</strong>`);
    data.news.forEach(n => {
      const link = n.url ? `<a href="${n.url}" target="_blank" style="color:#55D6FF;text-decoration:none;">${escapeHtml(n.title)}</a>` : escapeHtml(n.title);
      lines.push(`<div style="font-size:12px;color:#F5F7FA;margin:2px 0;">\u2022 ${link}</div>`);
    });
    lines.push(`</div>`);
  }

  if (data.goals && data.goals.length > 0) {
    lines.push(`<div style="margin-bottom:12px;"><strong style="color:#7C8BFF;">\u{1F3AF} Goals</strong>`);
    data.goals.forEach(g => {
      lines.push(`<div style="font-size:12px;color:#F5F7FA;margin:2px 0;">\u2022 ${escapeHtml(g.name)} — ${g.progress}%</div>`);
    });
    lines.push(`</div>`);
  }

  if (data.systemStatus) {
    const s = data.systemStatus;
    lines.push(`<div style="font-size:10px;color:#A0AEC0;margin-top:8px;">\u{1F4BB} ${s.cpu || "?"} CPU \u00B7 ${s.memory || "?"} RAM \u00B7 \u{1F50B} ${s.battery || "?"} \u00B7 \u{1F4C8} ${s.git || "?"} \u00B7 \u23F1 ${s.uptime || "?"}</div>`);
  }

  return lines.join("\n");
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
