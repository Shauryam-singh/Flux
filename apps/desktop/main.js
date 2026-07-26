function invoke(cmd, args) {
  return window.__TAURI_INTERNALS__.invoke(cmd, args);
}

const API_URL = "http://localhost:3141";
const chatArea = document.getElementById("chat-area");
const welcome = document.getElementById("welcome");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");

let isLoading = false;
let isRecording = false;

// Web Speech API TTS
const synth = window.speechSynthesis;

function speakText(text) {
  if (!synth) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  const voices = synth.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith("en"));
  if (enVoice) utter.voice = enVoice;
  synth.speak(utter);
}

if (synth) {
  synth.getVoices();
  synth.onvoiceschanged = () => synth.getVoices();
}

function addMessage(role, text) {
  if (welcome) welcome.remove();

  const msg = document.createElement("div");
  msg.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "⚡";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

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
  avatar.textContent = "⚡";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
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
  el.innerHTML = "<span></span><span></span><span></span>";
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
          bubble.textContent = `Error: ${data.error}`;
          break;
        }

        if (!data.done) {
          fullText += data.token;
          bubble.textContent = fullText;
          chatArea.scrollTop = chatArea.scrollHeight;
        } else {
          bubble.textContent = data.text || fullText;
          speakText(data.text || fullText);
        }
      }
    }
  } catch (err) {
    removeTyping();
    // Fallback to non-streaming
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      addMessage("assistant", data.reply || data.error || "Unknown error");
      speakText(data.reply || "");
    } catch (fallbackErr) {
      addMessage("assistant", `Error: ${err}`);
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
  } catch (err) {
    addMessage("assistant", `Recording error: ${err}`);
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
      await sendMessage(`[Voice] ${transcript}`);
    } else {
      removeTyping();
      addMessage("assistant", "No speech detected. Try again.");
    }
  } catch (err) {
    removeTyping();
    addMessage("assistant", `Voice error: ${err}`);
  }
}

// Send button
sendBtn.addEventListener("click", handleSend);

// Text input
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// Mic button — push to talk
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

input.focus();
