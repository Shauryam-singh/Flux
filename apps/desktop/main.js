function invoke(cmd, args) {
  return window.__TAURI_INTERNALS__.invoke(cmd, args);
}

const chatArea = document.getElementById("chat-area");
const welcome = document.getElementById("welcome");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");

let isLoading = false;
let isRecording = false;

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

  return msg;
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

  if (!window.__TAURI_INTERNALS__) {
    addMessage("assistant", "Error: Tauri IPC not available. Run with `npx tauri dev` or `npx tauri build`.");
    return;
  }

  input.value = "";
  isLoading = true;
  sendBtn.disabled = true;

  addMessage("user", text);
  showTyping();

  try {
    const reply = await invoke("send_message", { message: text });
    removeTyping();
    addMessage("assistant", reply);
  } catch (err) {
    removeTyping();
    addMessage("assistant", `Error: ${err}`);
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
      addMessage("user", `[Voice] ${transcript}`);
      showTyping();

      const reply = await invoke("send_message", { message: transcript });
      removeTyping();
      addMessage("assistant", reply);

      // Speak the reply
      try {
        await invoke("speak", { text: reply });
      } catch {
        // TTS failed silently — reply was still shown
      }
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
  if (isRecording) {
    stopRecording();
  }
});

// Touch support
micBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  startRecording();
});

micBtn.addEventListener("touchend", (e) => {
  e.preventDefault();
  stopRecording();
});

input.focus();
