/**
 * Slack / Discord Automation Service
 *
 * Cross-platform messaging — Slack API + Discord Bot API.
 *
 * Slack commands:
 *   "read slack <channel>" — read channel messages
 *   "send slack <channel> <msg>" — send message
 *   "react slack <channel> <emoji>" — react to last message
 *   "list slack channels" — list channels
 *   "search slack <query>" — search messages
 *   "thread slack <channel> <msg>" — reply in thread
 *
 * Discord commands:
 *   "read discord <channel>" — read channel messages
 *   "send discord <channel> <msg>" — send message
 *   "react discord <emoji>" — react to last message
 *   "list discord channels" — list channels
 *
 * Config at ~/.flux/messaging.json:
 *   {
 *     "slack": { "botToken": "xoxb-...", "appToken": "xapp-..." },
 *     "discord": { "botToken": "...", "guildId": "..." }
 *   }
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Config ─────────────────────────────────────────────────────

interface MessagingConfig {
  slack?: { botToken?: string; appToken?: string };
  discord?: { botToken?: string; guildId?: string };
}

const CONFIG_PATH = join(homedir(), ".flux", "messaging.json");

function loadConfig(): MessagingConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as MessagingConfig;
    }
  } catch { /* ignore */ }
  return {};
}

// ─── Slack API ──────────────────────────────────────────────────

async function slackApi(method: string, path: string, token: string, body?: unknown): Promise<unknown> {
  try {
    const opts: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`https://slack.com/api${path}`, opts);
    const data = await res.json() as Record<string, unknown>;
    if (!data.ok) return { error: data.error };
    return data;
  } catch {
    return { error: "network_error" };
  }
}

async function slackReadChannel(channel: string, token: string): Promise<string> {
  const data = await slackApi("GET", `/conversations.history?channel=${channel}&limit=10`, token) as Record<string, unknown>;
  if ("error" in data) return `Slack error: ${data.error}`;
  const messages = (data.messages as Array<Record<string, unknown>>)?.slice(0, 10) ?? [];
  if (messages.length === 0) return "No recent messages.";
  return messages.map((m) => {
    const user = (m.user as string) ?? "bot";
    const text = (m.text as string) ?? "";
    const ts = new Date(Number(m.ts ?? 0) * 1000).toLocaleTimeString();
    return `[${ts}] ${user}: ${text.slice(0, 200)}`;
  }).join("\n");
}

async function slackSendMessage(channel: string, text: string, token: string): Promise<string> {
  const data = await slackApi("POST", "/chat.postMessage", token, { channel, text }) as Record<string, unknown>;
  if ("error" in data) return `Slack error: ${data.error}`;
  return `Sent to ${channel}: "${text.slice(0, 100)}"`;
}

async function slackReact(channel: string, emoji: string, token: string): Promise<string> {
  const history = await slackApi("GET", `/conversations.history?channel=${channel}&limit=1`, token) as Record<string, unknown>;
  const messages = (history.messages as Array<Record<string, unknown>>) ?? [];
  const lastTs = messages[0]?.ts as string | undefined;
  if (!lastTs) return "No message to react to.";
  const data = await slackApi("POST", "/reactions.add", token, { channel, name: emoji.replace(/^:/, "").replace(/:$/, ""), timestamp: lastTs }) as Record<string, unknown>;
  if ("error" in data) return `Slack error: ${data.error}`;
  return `Reacted :${emoji}: to last message`;
}

async function slackListChannels(token: string): Promise<string> {
  const data = await slackApi("GET", "/conversations.list?types=public_channel,private_channel&limit=30", token) as Record<string, unknown>;
  if ("error" in data) return `Slack error: ${data.error}`;
  const channels = (data.channels as Array<Record<string, unknown>>) ?? [];
  return channels.map((c) => `#${c.name} (${c.id})`).join("\n") || "No channels found.";
}

async function slackSearch(query: string, token: string): Promise<string> {
  const data = await slackApi("GET", `/search.messages?query=${encodeURIComponent(query)}&count=5`, token) as Record<string, unknown>;
  if ("error" in data) return `Slack error: ${data.error}`;
  const matches = (data.messages as Record<string, unknown>)?.matches as Array<Record<string, unknown>> ?? [];
  return matches.map((m) => {
    const channel = (m.channel as Record<string, string>)?.name ?? "";
    const user = (m.username as string) ?? "";
    const text = (m.text as string) ?? "";
    return `#${channel} ${user}: ${text.slice(0, 150)}`;
  }).join("\n") || "No results.";
}

async function slackReplyThread(channel: string, text: string, token: string): Promise<string> {
  const history = await slackApi("GET", `/conversations.history?channel=${channel}&limit=1`, token) as Record<string, unknown>;
  const messages = (history.messages as Array<Record<string, unknown>>) ?? [];
  const lastTs = messages[0]?.ts as string | undefined;
  if (!lastTs) return "No message to reply to.";
  const data = await slackApi("POST", "/chat.postMessage", token, { channel, text, thread_ts: lastTs }) as Record<string, unknown>;
  if ("error" in data) return `Slack error: ${data.error}`;
  return `Replied in thread: "${text.slice(0, 100)}"`;
}

// ─── Discord API ────────────────────────────────────────────────

async function discordApi(method: string, path: string, token: string, body?: unknown): Promise<unknown> {
  try {
    const opts: RequestInit = {
      method,
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`https://discord.com/api/v10${path}`, opts);
    if (!res.ok) return { error: `${res.status} ${res.statusText}` };
    return await res.json();
  } catch {
    return { error: "network_error" };
  }
}

async function discordReadChannel(channelId: string, token: string): Promise<string> {
  const data = await discordApi("GET", `/channels/${channelId}/messages?limit=10`, token) as Array<Record<string, unknown>> | { error: string };
  if (!Array.isArray(data)) return `Discord error: ${data.error}`;
  if (data.length === 0) return "No recent messages.";
  return data.map((m) => {
    const author = (m.author as Record<string, string>)?.username ?? "unknown";
    const content = (m.content as string) ?? "";
    const ts = new Date(m.timestamp as string).toLocaleTimeString();
    return `[${ts}] ${author}: ${content.slice(0, 200)}`;
  }).join("\n");
}

async function discordSendMessage(channelId: string, content: string, token: string): Promise<string> {
  const data = await discordApi("POST", `/channels/${channelId}/messages`, token, { content }) as Record<string, unknown>;
  if ("error" in data) return `Discord error: ${data.error}`;
  return `Sent to channel: "${content.slice(0, 100)}"`;
}

async function discordReact(channelId: string, emoji: string, token: string): Promise<string> {
  const data = await discordApi("GET", `/channels/${channelId}/messages?limit=1`, token) as Array<Record<string, unknown>> | { error: string };
  if (!Array.isArray(data) || data.length === 0) return "No message to react to.";
  const msgId = data[0]!.id as string;
  const encoded = encodeURIComponent(emoji);
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msgId}/reactions/${encoded}/@me`, {
    method: "PUT",
    headers: { Authorization: `Bot ${token}` },
  });
  return res.ok ? `Reacted ${emoji} to last message` : "Failed to react";
}

async function discordListChannels(token: string, guildId: string): Promise<string> {
  const data = await discordApi("GET", `/guilds/${guildId}/channels`, token) as Array<Record<string, unknown>> | { error: string };
  if (!Array.isArray(data)) return `Discord error: ${data.error}`;
  const textChannels = data.filter((c) => c.type === 0);
  return textChannels.map((c) => `#${c.name} (${c.id})`).join("\n") || "No channels found.";
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(slack|discord)\b/i;

export function createSlackDiscordService(): Service {
  return {
    name: "slack-discord",
    description: "Slack and Discord integration — read/send messages, react, search, thread replies",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const config = loadConfig();
      const lower = input.toLowerCase();

      try {
        // ─── Slack ──
        if (/\bslack\b/.test(lower)) {
          const token = config.slack?.botToken;
          if (!token) return { text: "Slack bot token not configured. Set it in ~/.flux/messaging.json" };

          if (/\bread\s+slack\s+(\S+)/.test(lower)) {
            const m = lower.match(/\bread\s+slack\s+(\S+)/);
            return { text: await slackReadChannel(m?.[1] ?? "general", token) };
          }
          if (/\bsend\s+slack\s+(\S+)\s+(.+)/.test(lower)) {
            const m = lower.match(/\bsend\s+slack\s+(\S+)\s+(.+)/);
            return { text: await slackSendMessage(m?.[1] ?? "general", m?.[2]?.trim() ?? "", token) };
          }
          if (/\breact\s+slack\s+(\S+)\s+(\S+)/.test(lower)) {
            const m = lower.match(/\breact\s+slack\s+(\S+)\s+(\S+)/);
            return { text: await slackReact(m?.[1] ?? "general", m?.[2] ?? "+1", token) };
          }
          if (/\blist\s+slack\s+channels?\b/.test(lower)) return { text: await slackListChannels(token) };
          if (/\bsearch\s+slack\s+(.+)/.test(lower)) {
            const m = lower.match(/\bsearch\s+slack\s+(.+)/);
            return { text: await slackSearch(m?.[1]?.trim() ?? "", token) };
          }
          if (/\bthread\s+slack\s+(\S+)\s+(.+)/.test(lower)) {
            const m = lower.match(/\bthread\s+slack\s+(\S+)\s+(.+)/);
            return { text: await slackReplyThread(m?.[1] ?? "general", m?.[2]?.trim() ?? "", token) };
          }
          return { text: "Slack command not recognized. Try: read slack <channel>, send slack <channel> <msg>" };
        }

        // ─── Discord ──
        if (/\bdiscord\b/.test(lower)) {
          const token = config.discord?.botToken;
          const guildId = config.discord?.guildId;
          if (!token) return { text: "Discord bot token not configured. Set it in ~/.flux/messaging.json" };

          if (/\bread\s+discord\s+(\S+)/.test(lower)) {
            const m = lower.match(/\bread\s+discord\s+(\S+)/);
            return { text: await discordReadChannel(m?.[1] ?? "", token) };
          }
          if (/\bsend\s+discord\s+(\S+)\s+(.+)/.test(lower)) {
            const m = lower.match(/\bsend\s+discord\s+(\S+)\s+(.+)/);
            return { text: await discordSendMessage(m?.[1] ?? "", m?.[2]?.trim() ?? "", token) };
          }
          if (/\breact\s+discord\s+(\S+)/.test(lower)) {
            const m = lower.match(/\breact\s+discord\s+(\S+)/);
            return { text: await discordReact("", m?.[1] ?? "+1", token) };
          }
          if (/\blist\s+discord\s+channels?\b/.test(lower)) {
            if (!guildId) return { text: "Discord guild ID not configured." };
            return { text: await discordListChannels(token, guildId) };
          }
          return { text: "Discord command not recognized. Try: read discord <channel>, send discord <channel> <msg>" };
        }

        return { text: "Please specify slack or discord. Example: read slack general" };
      } catch (e) {
        return { text: `Messaging error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}
