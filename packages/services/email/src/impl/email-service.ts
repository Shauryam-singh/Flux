/**
 * Email Intelligence Service
 *
 * Fetch, summarize, draft, and reply to emails — cross-platform.
 *
 * Linux: reads from Maildir/mbox or uses `mail`/`mutt` CLI
 * Windows: reads from Outlook via PowerShell COM
 * Both: IMAP/POP3 via raw sockets, or local maildir
 *
 * Commands:
 *   "check my email" / "read emails" — fetch recent emails
 *   "summarize my inbox" — summarize unread emails
 *   "read email from <sender>" — fetch emails from specific sender
 *   "reply to last email from <sender>" — draft context-aware reply
 *   "draft email to <recipient> about <topic>" — compose email
 *   "how many unread emails" — count unread
 *   "search emails <query>" — search emails
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Config ─────────────────────────────────────────────────────

interface EmailConfig {
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPass?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  signature?: string;
}

const CONFIG_PATH = join(homedir(), ".flux", "email.json");

function loadConfig(): EmailConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as EmailConfig;
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig(config: EmailConfig): void {
  const dir = join(homedir(), ".flux");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ─── Platform: Local Maildir ────────────────────────────────────

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  read: boolean;
}

function getMaildirPath(): string {
  const platform = process.platform;
  if (platform === "linux") return join(homedir(), "Maildir");
  if (platform === "win32") return join(homedir(), "AppData", "Local", "Microsoft", "Outlook", "FluxMail");
  return join(homedir(), ".flux", "mail");
}

function readMaildir(): Email[] {
  const dir = getMaildirPath();
  const emails: Email[] = [];

  for (const folder of ["new", "cur"]) {
    const folderPath = join(dir, folder);
    if (!existsSync(folderPath)) continue;

    try {
      const files = readdirSync(folderPath);
      for (const file of files.slice(-20)) {
        try {
          const content = readFileSync(join(folderPath, file), "utf-8");
          const headerEnd = content.indexOf("\n\n");
          const headers = headerEnd > 0 ? content.substring(0, headerEnd) : "";
          const body = headerEnd > 0 ? content.substring(headerEnd + 2) : content;

          const fromMatch = headers.match(/^From:\s*(.+)/m);
          const toMatch = headers.match(/^To:\s*(.+)/m);
          const subjectMatch = headers.match(/^Subject:\s*(.+)/m);
          const dateMatch = headers.match(/^Date:\s*(.+)/m);

          emails.push({
            id: file,
            from: fromMatch?.[1]?.trim() ?? "unknown",
            to: toMatch?.[1]?.trim() ?? "",
            subject: subjectMatch?.[1]?.trim() ?? "(no subject)",
            date: dateMatch?.[1]?.trim() ?? "",
            body: body.slice(0, 5000),
            read: folder === "cur",
          });
        } catch { /* skip corrupt files */ }
      }
    } catch { /* ignore */ }
  }

  return emails.sort((a, b) => b.date.localeCompare(a.date));
}

function readLinuxMail(): Email[] {
  try {
    const output = execSync("mail -H 2>/dev/null | tail -20", { timeout: 5000, encoding: "utf-8", stdio: "pipe" }).trim();
    if (!output) return [];

    return output.split("\n").filter(Boolean).map((line, i): Email => {
      const parts = line.split(/\s{2,}/);
      return {
        id: `mail_${i}`,
        from: parts[1] ?? "unknown",
        to: "",
        subject: parts.slice(2).join(" ") ?? "(no subject)",
        date: parts[0] ?? "",
        body: "",
        read: line.includes("N") === false,
      };
    });
  } catch {
    return [];
  }
}

function readOutlookEmails(): Email[] {
  try {
    const psScript = `
      $outlook = New-Object -ComObject Outlook.Application
      $namespace = $outlook.GetNamespace("MAPI")
      $inbox = $namespace.GetDefaultFolder(6)
      $messages = $inbox.Items
      $messages.Sort("[ReceivedTime]", $true)
      $result = @()
      $count = 0
      foreach ($msg in $messages) {
        if ($count -ge 20) { break }
        $result += @{
          Id = $msg.EntryID
          From = $msg.SenderName
          To = $msg.To
          Subject = $msg.Subject
          Date = $msg.ReceivedTime.ToString("yyyy-MM-dd HH:mm")
          Body = $msg.Body.Substring(0, [Math]::Min(2000, $msg.Body.Length))
          Read = $msg.UnRead -eq $false
        }
        $count++
      }
      $result | ConvertTo-Json -Depth 3
    `;
    const output = execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, "; ")}"`, {
      timeout: 15000, encoding: "utf-8", stdio: "pipe",
    }).trim();

    if (!output) return [];
    const raw = JSON.parse(output) as Array<Record<string, unknown>>;
    return Array.isArray(raw) ? raw.map((r): Email => ({
      id: String(r.Id ?? ""),
      from: String(r.From ?? "unknown"),
      to: String(r.To ?? ""),
      subject: String(r.Subject ?? "(no subject)"),
      date: String(r.Date ?? ""),
      body: String(r.Body ?? ""),
      read: Boolean(r.Read),
    })) : [];
  } catch {
    return [];
  }
}

// ─── Email Operations ───────────────────────────────────────────

function fetchEmails(): Email[] {
  const platform = process.platform;
  const maildir = readMaildir();
  if (maildir.length > 0) return maildir;

  if (platform === "linux") return readLinuxMail();
  if (platform === "win32") return readOutlookEmails();
  return [];
}

function searchEmails(query: string): Email[] {
  const all = fetchEmails();
  const lower = query.toLowerCase();
  return all.filter((e) =>
    e.subject.toLowerCase().includes(lower) ||
    e.from.toLowerCase().includes(lower) ||
    e.body.toLowerCase().includes(lower),
  );
}

function formatEmails(emails: Email[], limit = 10): string {
  if (emails.length === 0) return "No emails found.";
  return emails.slice(0, limit).map((e, i) => {
    const icon = e.read ? " " : "✉️";
    return `${icon} ${i + 1}. From: ${e.from}\n   Subject: ${e.subject}\n   Date: ${e.date}\n   ${e.body.slice(0, 100)}...`;
  }).join("\n\n");
}

function countUnread(): number {
  return fetchEmails().filter((e) => !e.read).length;
}

function readEmailFrom(sender: string): Email[] {
  const all = fetchEmails();
  const lower = sender.toLowerCase();
  return all.filter((e) => e.from.toLowerCase().includes(lower));
}

async function replyToEmail(sender: string, llmProvider: { complete(req: { model: string; prompt: string; temperature?: number }): Promise<{ text: string }> } | null): Promise<string> {
  const emails = readEmailFrom(sender);
  if (emails.length === 0) return `No emails found from "${sender}".`;

  const lastEmail = emails[0]!;
  const config = loadConfig();

  if (!llmProvider) {
    return `Draft reply to ${lastEmail.from} re: ${lastEmail.subject}\n\nOriginal:\n${lastEmail.body.slice(0, 500)}\n\n[LLM required for auto-draft]`;
  }

  const result = await llmProvider.complete({
    model: "default",
    prompt: `Draft a professional email reply to ${lastEmail.from} about "${lastEmail.subject}".

Original email:
${lastEmail.body.slice(0, 2000)}

${config.signature ? `Signature: ${config.signature}` : ""}

Write a concise, professional reply. Do not include a subject line.`,
    temperature: 0.7,
  });
  return `Reply draft to ${lastEmail.from}:\n\n${result.text.trim()}`;
}

async function draftEmail(to: string, topic: string, llmProvider: { complete(req: { model: string; prompt: string; temperature?: number }): Promise<{ text: string }> } | null): Promise<string> {
  const config = loadConfig();

  if (!llmProvider) {
    return `Draft email to: ${to}\nTopic: ${topic}\n\n[LLM required for auto-draft]`;
  }

  const result = await llmProvider.complete({
    model: "default",
    prompt: `Draft a professional email to ${to} about "${topic}".

${config.signature ? `Signature: ${config.signature}` : ""}

Write a clear, professional email with subject line.`,
    temperature: 0.7,
  });
  return `Draft for ${to}:\n\n${result.text.trim()}`;
}

function sendEmail(to: string, subject: string, body: string): string {
  const platform = process.platform;
  const config = loadConfig();

  if (platform === "linux") {
    try {
      const cmd = `echo '${body.replace(/'/g, "'\\''")}' | mail -s '${subject.replace(/'/g, "'\\''")}' '${to.replace(/'/g, "'\\''")}'`;
      execSync(cmd, { timeout: 10000, stdio: "pipe" });
      return `Email sent to ${to}`;
    } catch {
      return "Failed to send email via mail command.";
    }
  }

  if (platform === "win32") {
    try {
      const psScript = `
        $outlook = New-Object -ComObject Outlook.Application
        $mail = $outlook.CreateItem(0)
        $mail.To = "${to}"
        $mail.Subject = "${subject}"
        $mail.Body = "${body}"
        $mail.Send()
      `;
      execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, "; ")}"`, {
        timeout: 10000, stdio: "pipe",
      });
      return `Email sent to ${to} via Outlook`;
    } catch {
      return "Failed to send via Outlook.";
    }
  }

  return "Email sending not supported on this platform.";
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(emails?|inbox|mail|unread|reply\s+to|draft\s+email|send\s+email|check\s+(my\s+)?email|read\s+emails?\b|summarize\s+(my\s+)?inbox|how\s+many\s+unread|search\s+emails?)\b/i;

export function createEmailService(): Service {
  return {
    name: "email",
    description: "Email intelligence — fetch, summarize, draft replies, search, send emails",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();

      try {
        // How many unread
        if (/\bhow\s+many\s+unread\b/.test(lower)) {
          const count = countUnread();
          return { text: `You have ${count} unread email${count !== 1 ? "s" : ""}.` };
        }

        // Search emails
        const searchMatch = lower.match(/\bsearch\s+email[s]?\s+(.+)/);
        if (searchMatch) {
          const results = searchEmails(searchMatch[1]!.trim());
          return { text: `Found ${results.length} emails:\n\n${formatEmails(results)}` };
        }

        // Summarize inbox
        if (/\bsummarize\s+(my\s+)?inbox\b/.test(lower)) {
          const emails = fetchEmails().slice(0, 20);
          if (emails.length === 0) return { text: "No emails to summarize." };

          if (ctx.provider) {
            const summary = await ctx.provider.complete({
              model: "default",
              prompt: `Summarize these emails concisely. Group by topic/urgent:\n\n${emails.map((e) => `From: ${e.from} | Subject: ${e.subject}\n${e.body.slice(0, 200)}`).join("\n---\n")}`,
              temperature: 0.3,
            });
            return { text: `Inbox summary (${emails.length} emails):\n\n${summary.text}` };
          }
          return { text: `Recent emails:\n\n${formatEmails(emails)}` };
        }

        // Read email from sender
        const fromMatch = lower.match(/\bread\s+email[s]?\s+from\s+(.+)/);
        if (fromMatch) {
          const emails = readEmailFrom(fromMatch[1]!.trim());
          return { text: formatEmails(emails) };
        }

        // Reply to last email
        const replyMatch = lower.match(/\breply\s+to\s+(?:last\s+)?email[s]?\s+from\s+(.+)/);
        if (replyMatch) {
          const text = await replyToEmail(replyMatch[1]!.trim(), ctx.provider);
          return { text };
        }

        // Draft email
        const draftMatch = lower.match(/\bdraft\s+email\s+to\s+(.+?)\s+about\s+(.+)/);
        if (draftMatch) {
          const text = await draftEmail(draftMatch[1]!.trim(), draftMatch[2]!.trim(), ctx.provider);
          return { text };
        }

        // Send email
        const sendMatch = input.match(/\bsend\s+email\s+to\s+(.+?)\s+subject\s+(.+?)\s+body\s+(.+)/i);
        if (sendMatch) {
          const text = sendEmail(sendMatch[1]!.trim(), sendMatch[2]!.trim(), sendMatch[3]!.trim());
          return { text };
        }

        // Check/read emails (default)
        if (/\b(check|read|fetch)\b/.test(lower) || /\bemail|inbox|mail\b/.test(lower)) {
          const emails = fetchEmails();
          const unread = emails.filter((e) => !e.read);
          return { text: `${emails.length} recent emails (${unread.length} unread):\n\n${formatEmails(emails)}` };
        }

        return { text: "Email command not recognized. Try: check my email, summarize inbox, reply to email from <sender>" };
      } catch (e) {
        return { text: `Email error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}
