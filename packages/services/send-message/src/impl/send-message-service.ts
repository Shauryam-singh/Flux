/**
 * Send Message Service
 *
 * Compose and send messages across platforms:
 *   - Telegram (Bot API)
 *   - Email (SMTP via fetch or system mail)
 *   - Discord (webhooks)
 *   - Slack (webhooks)
 *   - WhatsApp (opens WhatsApp Web in browser)
 *   - SMS (system modem)
 *   - Signal (signal-cli)
 *
 * Config: ~/.flux/messaging.json
 *
 * Voice commands:
 *   "send a telegram to John saying hello"
 *   "email alice@foo.com about the meeting"
 *   "send a discord message to #general: meeting at 3pm"
 *   "whatsapp mom I'll be late"
 *   "text 555-1234 on your way"
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { execSync } from "node:child_process";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Config ─────────────────────────────────────────────────────

export interface MessagingConfig {
  telegram?: {
    botToken: string;
    chatIds?: Record<string, string>; // name -> chatId
    defaultChatId?: string;
  };
  email?: {
    smtp?: string;
    port?: number;
    user: string;
    pass: string;
    from?: string;
    tls?: boolean;
  };
  discord?: {
    webhooks?: Record<string, string>; // channel name -> webhook URL
    defaultWebhook?: string;
  };
  slack?: {
    webhooks?: Record<string, string>; // channel name -> webhook URL
    defaultWebhook?: string;
  };
  whatsapp?: {
    method?: "web" | "cli";
  };
  signal?: {
    number?: string;
  };
  sms?: {
    method?: " gammesg" | "modem" | "at";
    modem?: string;
  };
}

const CONFIG_PATH = `${process.env.HOME ?? "."}/.flux/messaging.json`;

function loadConfig(): MessagingConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveConfig(config: MessagingConfig): void {
  try {
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch {}
}

// ─── Platform Senders ───────────────────────────────────────────

interface SendResult {
  ok: boolean;
  platform: string;
  detail: string;
}

async function sendTelegram(
  config: MessagingConfig,
  recipient: string,
  message: string,
): Promise<SendResult> {
  if (!config.telegram?.botToken) {
    return { ok: false, platform: "telegram", detail: "Telegram bot token not configured. Run: flux setup telegram" };
  }

  // Resolve chat ID
  let chatId = config.telegram.chatIds?.[recipient] ?? recipient;
  if (!chatId && config.telegram.defaultChatId) {
    chatId = config.telegram.defaultChatId;
  }

  if (!chatId) {
    return { ok: false, platform: "telegram", detail: `No chat ID found for "${recipient}". Add it to ${CONFIG_PATH}` };
  }

  try {
    const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json() as { ok?: boolean; description?: string };
    if (data.ok) {
      return { ok: true, platform: "telegram", detail: `Message sent to ${recipient} via Telegram` };
    }
    return { ok: false, platform: "telegram", detail: `Telegram error: ${data.description ?? "unknown"}` };
  } catch (e) {
    return { ok: false, platform: "telegram", detail: `Telegram request failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function sendEmail(
  config: MessagingConfig,
  recipient: string,
  subject: string,
  message: string,
): Promise<SendResult> {
  if (!config.email?.user) {
    return { ok: false, platform: "email", detail: "Email not configured. Run: flux setup email" };
  }

  const from = config.email.from ?? config.email.user;

  // Try system mail commands
  const cmds = [
    // sendmail
    `printf 'Subject: %s\\nFrom: %s\\nTo: %s\\n\\n%s' "${escBash(subject)}" "${escBash(from)}" "${escBash(recipient)}" "${escBash(message)}" | sendmail -t`,
    // mail command
    `echo "${escBash(message)}" | mail -s "${escBash(subject)}" -r "${escBash(from)}" "${escBash(recipient)}"`,
    // mutt
    `echo "${escBash(message)}" | mutt -s "${escBash(subject)}" -e "my_hdr From:${escBash(from)}" -- "${escBash(recipient)}"`,
  ];

  for (const cmd of cmds) {
    try {
      execSync(cmd, { timeout: 15000, stdio: "pipe" });
      return { ok: true, platform: "email", detail: `Email sent to ${recipient}` };
    } catch {
      // Try next
    }
  }

  return { ok: false, platform: "email", detail: "No mail command available (install sendmail, mailutils, or mutt)" };
}

function escBash(s: string): string {
  return s.replace(/'/g, "'\\''").replace(/\\/g, "\\\\");
}

async function sendDiscord(
  config: MessagingConfig,
  channel: string,
  message: string,
): Promise<SendResult> {
  const webhookUrl = config.discord?.webhooks?.[channel] ?? config.discord?.defaultWebhook;
  if (!webhookUrl) {
    return { ok: false, platform: "discord", detail: `No Discord webhook for "${channel}". Add it to ${CONFIG_PATH}` };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok || res.status === 204) {
      return { ok: true, platform: "discord", detail: `Message sent to ${channel} on Discord` };
    }
    return { ok: false, platform: "discord", detail: `Discord error: ${res.status}` };
  } catch (e) {
    return { ok: false, platform: "discord", detail: `Discord request failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function sendSlack(
  config: MessagingConfig,
  channel: string,
  message: string,
): Promise<SendResult> {
  const webhookUrl = config.slack?.webhooks?.[channel] ?? config.slack?.defaultWebhook;
  if (!webhookUrl) {
    return { ok: false, platform: "slack", detail: `No Slack webhook for "${channel}". Add it to ${CONFIG_PATH}` };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      return { ok: true, platform: "slack", detail: `Message sent to ${channel} on Slack` };
    }
    return { ok: false, platform: "slack", detail: `Slack error: ${res.status}` };
  } catch (e) {
    return { ok: false, platform: "slack", detail: `Slack request failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function sendWhatsApp(
  recipient: string,
  message: string,
): SendResult {
  try {
    const encoded = encodeURIComponent(message);
    const url = `https://web.whatsapp.com/send?phone=${recipient}&text=${encoded}`;
    // Open in default browser
    const platform = process.platform;
    if (platform === "linux") {
      execSync(`xdg-open "${url}"`, { timeout: 5000, stdio: "pipe" });
    } else if (platform === "darwin") {
      execSync(`open "${url}"`, { timeout: 5000, stdio: "pipe" });
    } else {
      execSync(`start "" "${url}"`, { timeout: 5000, stdio: "pipe" });
    }
    return { ok: true, platform: "whatsapp", detail: `Opened WhatsApp Web for ${recipient}. Send the message in the browser.` };
  } catch (e) {
    return { ok: false, platform: "whatsapp", detail: `Could not open WhatsApp Web: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function sendSignal(
  config: MessagingConfig,
  recipient: string,
  message: string,
): SendResult {
  if (!config.signal?.number) {
    return { ok: false, platform: "signal", detail: "Signal number not configured. Run: flux setup signal" };
  }
  try {
    execSync(
      `signal-cli -u ${config.signal.number} send -m "${message.replace(/"/g, '\\"')}" ${recipient}`,
      { timeout: 15000, stdio: "pipe" },
    );
    return { ok: true, platform: "signal", detail: `Signal message sent to ${recipient}` };
  } catch (e) {
    return { ok: false, platform: "signal", detail: `Signal failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function sendSms(
  recipient: string,
  message: string,
): SendResult {
  try {
    // Linux: try gammesg or AT modem
    if (process.platform === "linux") {
      try {
        execSync(`gammesg sendsms ${recipient} "${message.replace(/"/g, '\\"')}"`, { timeout: 15000, stdio: "pipe" });
        return { ok: true, platform: "sms", detail: `SMS sent to ${recipient} via gammesg` };
      } catch {}
    }
    return { ok: false, platform: "sms", detail: "SMS not available. Install gammesg or configure a modem." };
  } catch (e) {
    return { ok: false, platform: "sms", detail: `SMS failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ─── Natural Language Parser ────────────────────────────────────

interface MessageIntent {
  platform: "telegram" | "email" | "discord" | "slack" | "whatsapp" | "signal" | "sms" | "auto";
  recipient: string;
  message: string;
  subject?: string;
  channel?: string;
}

function parseMessageIntent(input: string): MessageIntent | null {
  const lower = input.toLowerCase();

  // Platform detection
  let platform: MessageIntent["platform"] = "auto";
  if (/\b(telegram|tg)\b/.test(lower)) platform = "telegram";
  else if (/\b(email|mail|e-mail)\b/.test(lower)) platform = "email";
  else if (/\b(discord|dc)\b/.test(lower)) platform = "discord";
  else if (/\b(slack|sl)\b/.test(lower)) platform = "slack";
  else if (/\b(whatsapp|wa|whats\s*app)\b/.test(lower)) platform = "whatsapp";
  else if (/\b(signal|sig)\b/.test(lower)) platform = "signal";
  else if (/\b(sms|text|message)\b/.test(lower) && /\b\d{3,}/.test(lower)) platform = "sms";

  // Message extraction: "saying X", "that says X", "body X", "message: X", just ": X"
  let message = "";
  let recipient = "";

  // "send/message/email X to Y saying/body/about Z"
  const toSayingMatch = input.match(
    /\b(?:send|message|email|text|write|tell|msg)\s+(?:a\s+)?(?:message\s+)?(?:to\s+)?(.+?)\s+(?:saying|that says|body|message|:|content|about)\s+(.+)/i,
  );
  if (toSayingMatch) {
    recipient = toSayingMatch[1]!.trim();
    message = toSayingMatch[2]!.trim();
  }

  // "send X to Y"
  if (!message) {
    const sendToMatch = input.match(
      /\b(?:send|message|email|text|tell|msg)\s+(.+?)\s+to\s+(.+)/i,
    );
    if (sendToMatch) {
      message = sendToMatch[1]!.trim();
      recipient = sendToMatch[2]!.trim();
    }
  }

  // "email/telegram Y: X" or "email Y subject: X"
  if (!message) {
    const colonMatch = input.match(
      /\b(?:email|telegram|discord|slack|whatsapp|signal|text|send|message)\s+(.+?)[:]\s*(.+)/i,
    );
    if (colonMatch) {
      recipient = colonMatch[1]!.trim();
      message = colonMatch[2]!.trim();
    }
  }

  // "tell Y X"
  if (!message) {
    const tellMatch = input.match(/\b(?:tell|msg|message)\s+(.+?)\s+(?:that\s+|to\s+|said\s+)?(.+)/i);
    if (tellMatch) {
      recipient = tellMatch[1]!.trim();
      message = tellMatch[2]!.trim();
    }
  }

  // Clean recipient
  recipient = recipient
    .replace(/\b(on|via|through|over|using)\s+(telegram|email|discord|slack|whatsapp|signal|sms|tg|dc|wa)\b/gi, "")
    .replace(/\b(a|an|the|me|my|on|in|at|from)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Extract channel for Discord/Slack: "#general" or "general"
  let channel: string | undefined;
  const channelMatch = input.match(/#([\w-]+)/);
  if (channelMatch) channel = channelMatch[1];

  // Subject for email
  let subject: string | undefined;
  const subjectMatch = input.match(/\bsubject:?\s+(.+?)(?:\s+(?:body|message|:|content)\s+)/i);
  if (subjectMatch) {
    subject = subjectMatch[1]!.trim();
    message = message.replace(subjectMatch[0], "").trim();
  }

  if (!message || !recipient) return null;

  // Auto-detect platform based on recipient format
  if (platform === "auto") {
    if (recipient.includes("@") || /\b\w+\.\w+\b/.test(recipient)) platform = "email";
    else if (channel) platform = "discord";
    else if (/\+?\d[\d\s-]{6,}/.test(recipient)) {
      // Phone number — try WhatsApp, fallback SMS
      platform = "whatsapp";
    }
    else platform = "telegram"; // Default
  }

  if (!subject && platform === "email") {
    subject = message.slice(0, 60);
  }

  const result: MessageIntent = { platform, recipient, message };
  if (subject) result.subject = subject;
  if (channel) result.channel = channel;
  return result;
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(send|message|email|text|tell|msg|telegram|whatsapp|discord|slack|signal|sms|list)\b/i;

export function createSendMessageService(): Service {
  return {
    name: "send-message",
    description: "Compose and send messages through WhatsApp, Telegram, Email, Discord, Slack, Signal, SMS",

    canHandle(input: string): boolean {
      return MATCH.test(input);
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const config = loadConfig();

      // Setup commands
      if (/\b(?:setup|configure|config)\b/.test(input.toLowerCase())) {
        return handleSetup(input, config);
      }

      // List platforms
      if (/\b(list|show|what)\b.*\b(platforms?|services?|channels?)\b/.test(input.toLowerCase())) {
        return listPlatforms(config);
      }

      const intent = parseMessageIntent(input);
      if (!intent) {
        return {
          text: [
            "I couldn't parse the message. Try:",
            '- "send a Telegram to John saying hello"',
            '- "email alice@foo.com about the meeting"',
            '- "send a Discord message to #general: meeting at 3pm"',
            '- "whatsapp mom I\'ll be late"',
            '- "text 555-1234 on your way"',
          ].join("\n"),
        };
      }

      let result: SendResult;

      switch (intent.platform) {
        case "telegram":
          result = await sendTelegram(config, intent.recipient, intent.message);
          break;
        case "email":
          result = await sendEmail(config, intent.recipient, intent.subject ?? "Message from Flux", intent.message);
          break;
        case "discord":
          result = await sendDiscord(config, intent.channel ?? intent.recipient, intent.message);
          break;
        case "slack":
          result = await sendSlack(config, intent.channel ?? intent.recipient, intent.message);
          break;
        case "whatsapp":
          result = sendWhatsApp(intent.recipient, intent.message);
          break;
        case "signal":
          result = sendSignal(config, intent.recipient, intent.message);
          break;
        case "sms":
          result = sendSms(intent.recipient, intent.message);
          break;
        default:
          result = { ok: false, platform: "auto", detail: "Could not determine platform." };
      }

      return { text: result.detail };
    },
  };
}

function handleSetup(input: string, config: MessagingConfig): ServiceResponse {
  const lower = input.toLowerCase();

  if (/\btelegram\b/.test(lower)) {
    const tokenMatch = input.match(/token[:\s]+(\w+:\w+)/i);
    if (tokenMatch?.[1]) {
      config.telegram = { ...config.telegram, botToken: tokenMatch[1] };
      saveConfig(config);
      return { text: "Telegram bot token saved." };
    }
    return { text: "To set up Telegram:\n1. Create a bot via @BotFather on Telegram\n2. Copy the bot token\n3. Say: setup telegram token 123456:ABC-DEF" };
  }

  if (/\bemail\b/.test(lower)) {
    const userMatch = input.match(/user[:\s]+(\S+@\S+)/i);
    const passMatch = input.match(/pass(?:word)?[:\s]+(\S+)/i);
    if (userMatch?.[1]) {
      config.email = {
        ...config.email,
        user: userMatch[1],
        pass: passMatch?.[1] ?? config.email?.pass ?? "",
        smtp: config.email?.smtp ?? "smtp.gmail.com",
      };
      saveConfig(config);
      return { text: "Email credentials saved." };
    }
    return { text: "To set up email:\nSay: setup email user you@gmail.com pass your-app-password\n\nFor Gmail, use an App Password (not your main password)." };
  }

  if (/\bdiscord\b/.test(lower)) {
    const webhookMatch = input.match(/webhook[:\s]+(https?:\/\/\S+)/i);
    const channelMatch = input.match(/#?(\w+)\s+webhook/i);
    if (webhookMatch?.[1]) {
      const ch = channelMatch?.[1] ?? "general";
      const webhooks = { ...config.discord?.webhooks, [ch]: webhookMatch[1] };
      config.discord = { ...config.discord, webhooks };
      saveConfig(config);
      return { text: `Discord webhook for #${ch} saved.` };
    }
    return { text: "To set up Discord:\n1. Server Settings > Integrations > Webhooks > New\n2. Copy the webhook URL\n3. Say: setup discord #channel webhook https://discord.com/api/webhooks/..." };
  }

  if (/\bslack\b/.test(lower)) {
    const webhookMatch = input.match(/webhook[:\s]+(https?:\/\/\S+)/i);
    const channelMatch = input.match(/#?(\w+)\s+webhook/i);
    if (webhookMatch?.[1]) {
      const ch = channelMatch?.[1] ?? "general";
      const webhooks = { ...config.slack?.webhooks, [ch]: webhookMatch[1] };
      config.slack = { ...config.slack, webhooks };
      saveConfig(config);
      return { text: `Slack webhook for #${ch} saved.` };
    }
    return { text: "To set up Slack:\n1. Go to https://api.slack.com/apps > Create New App\n2. Add Incoming Webhooks\n3. Say: setup slack #channel webhook https://hooks.slack.com/services/..." };
  }

  if (/\bwhatsapp\b/.test(lower)) {
    return { text: "WhatsApp uses WhatsApp Web in your browser. No setup needed — just say:\n\"whatsapp [phone number] [message]\"\n\nThe browser will open WhatsApp Web with the message pre-filled." };
  }

  if (/\bsignal\b/.test(lower)) {
    const numMatch = input.match(/number[:\s]+(\+?\d+)/i);
    if (numMatch?.[1]) {
      config.signal = { ...config.signal, number: numMatch[1] };
      saveConfig(config);
      return { text: "Signal number saved." };
    }
    return { text: "To set up Signal:\n1. Install signal-cli: https://github.com/AsamK/signal-cli\n2. Register: signal-cli register +YourNumber\n3. Say: setup signal number +1234567890" };
  }

  return { text: "Supported platforms: telegram, email, discord, slack, whatsapp, signal, sms\n\nSay: setup [platform] to configure." };
}

function listPlatforms(config: MessagingConfig): ServiceResponse {
  const platforms = [
    { name: "Telegram", configured: !!config.telegram?.botToken },
    { name: "Email", configured: !!config.email?.user },
    { name: "Discord", configured: !!config.discord?.webhooks && Object.keys(config.discord.webhooks).length > 0 },
    { name: "Slack", configured: !!config.slack?.webhooks && Object.keys(config.slack.webhooks).length > 0 },
    { name: "WhatsApp", configured: true }, // Always available (web fallback)
    { name: "Signal", configured: !!config.signal?.number },
    { name: "SMS", configured: false }, // Needs modem
  ];

  const lines = platforms.map(
    (p) => `${p.configured ? "[x]" : "[ ]"} ${p.name}`,
  );

  return {
    text: `Messaging platforms:\n${lines.join("\n")}\n\nSay: setup [platform] to configure.`,
  };
}
