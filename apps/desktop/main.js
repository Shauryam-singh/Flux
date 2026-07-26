function invoke(cmd, args) {
  return window.__TAURI_INTERNALS__.invoke(cmd, args);
}

const chatArea = document.getElementById("chat-area");
const welcome = document.getElementById("welcome");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");

let isLoading = false;

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

async function handleSend() {
  const text = input.value.trim();
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

sendBtn.addEventListener("click", handleSend);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

input.focus();
