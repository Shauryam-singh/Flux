function invoke(cmd, args) {
  return window.__TAURI_INTERNALS__.invoke(cmd, args);
}

const API_URL = "http://localhost:3141";
const chatArea = document.getElementById("chat-area");
const welcome = document.getElementById("welcome");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const toastContainer = document.getElementById("toast-container");

let isLoading = false;
let isRecording = false;

// ── Toast Notifications ──
function showToast(message, type = "info", duration = 4000) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Markdown Renderer ──
function renderMarkdown(text) {
  let html = text;

  // Code blocks with language tag
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const label = lang ? `<span class="lang-label">${lang}</span>` : "";
    return `<pre>${label}<code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr>");

  // Blockquote
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Unordered list
  html = html.replace(/^[*-] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Line breaks (preserve paragraphs)
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p>(<h[123]>)/g, "$1");
  html = html.replace(/(<\/h[123]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");
  html = html.replace(/<p>(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p>(<blockquote>)/g, "$1");
  html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");
  html = html.replace(/<p>(<hr>)/g, "$1");

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Web Speech API TTS ──
const synth = window.speechSynthesis;

function speakText(text) {
  if (!synth) return;
  synth.cancel();
  const clean = text.replace(/[#*`_~\[\]()>]/g, "").replace(/\n+/g, ". ");
  const utter = new SpeechSynthesisUtterance(clean);
  utter.rate = 1;
  utter.pitch = 0.9;
  const voices = synth.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith("en"));
  if (enVoice) utter.voice = enVoice;
  synth.speak(utter);
}

if (synth) {
  synth.getVoices();
  synth.onvoiceschanged = () => synth.getVoices();
}

// ── Chat Functions ──
function addMessage(role, text, isMarkdown = false) {
  if (welcome) welcome.remove();

  const msg = document.createElement("div");
  msg.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "YOU" : "FX";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = isMarkdown ? renderMarkdown(text) : escapeHtml(text);

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;

  return bubble;
}

function addStreamingBubble() {
  if (welcome) welcome.remove();

  const msg = document.createElement("div");
  msg.className = "message assistant";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = "FX";

  const bubble = document.createElement("div");
  bubble.className = "bubble streaming-cursor";
  bubble.id = "streaming-bubble";

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;

  return bubble;
}

function showTyping() {
  const el = document.createElement("div");
  el.className = "typing";
  el.id = "typing";
  el.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <span class="typing-label">PROCESSING</span>
  `;
  chatArea.appendChild(el);
  chatArea.scrollTop = chatArea.scrollHeight;
  return el;
}

function removeTyping() {
  const el = document.getElementById("typing");
  if (el) el.remove();
}

async function sendMessage(text) {
  if (!text || isLoading) return;

  input.value = "";
  isLoading = true;
  sendBtn.disabled = true;

  addMessage("user", text);
  showTyping();

  try {
    const res = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    removeTyping();
    const bubble = addStreamingBubble();
    let fullText = "";

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = JSON.parse(line.slice(6));

        if (data.error) {
          bubble.classList.remove("streaming-cursor");
          bubble.innerHTML = renderMarkdown(`**Error:** ${data.error}`);
          showToast(`Stream error: ${data.error}`, "error");
          break;
        }

        if (!data.done) {
          fullText += data.token;
          bubble.innerHTML = renderMarkdown(fullText);
          chatArea.scrollTop = chatArea.scrollHeight;
        } else {
          bubble.classList.remove("streaming-cursor");
          const finalText = data.text || fullText;
          bubble.innerHTML = renderMarkdown(finalText);
          speakText(finalText);
        }
      }
    }
  } catch (err) {
    removeTyping();
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.reply) {
        addMessage("assistant", data.reply, true);
        speakText(data.reply);
      } else {
        showToast(data.error || "Unknown error", "error");
        addMessage("assistant", `**Error:** ${data.error || "Unknown error"}`, true);
      }
    } catch (fallbackErr) {
      showToast(`Connection failed: ${err.message}`, "error");
      addMessage("assistant", `**System:** Connection to Flux API failed. Ensure the API server is running on port 3141.`, true);
    }
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

async function handleSend() {
  const text = input.value.trim();
  await sendMessage(text);
}

async function startRecording() {
  if (isRecording || isLoading) return;

  try {
    await invoke("start_recording");
    isRecording = true;
    micBtn.classList.add("recording");
    showToast("Recording started — hold to speak", "info", 2000);
  } catch (err) {
    showToast(`Recording error: ${err}`, "error");
  }
}

async function stopRecording() {
  if (!isRecording) return;

  isRecording = false;
  micBtn.classList.remove("recording");

  try {
    showTyping();
    const transcript = await invoke("stop_recording");
    removeTyping();

    if (transcript && transcript.trim()) {
      showToast("Transcription received", "success", 2000);
      await sendMessage(transcript);
    } else {
      showToast("No speech detected", "warning", 2000);
    }
  } catch (err) {
    removeTyping();
    showToast(`Voice error: ${err}`, "error");
  }
}

// ── Event Listeners ──
sendBtn.addEventListener("click", handleSend);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

micBtn.addEventListener("mousedown", (e) => {
  e.preventDefault();
  startRecording();
});

micBtn.addEventListener("mouseup", (e) => {
  e.preventDefault();
  stopRecording();
});

micBtn.addEventListener("mouseleave", () => {
  if (isRecording) stopRecording();
});

micBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  startRecording();
});

micBtn.addEventListener("touchend", (e) => {
  e.preventDefault();
  stopRecording();
});

// ── Init ──
input.focus();
showToast("Flux neural interface initialized", "success", 3000);
