import { exec, execSync } from "node:child_process";
import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

function getPlatform(): "linux" | "win32" | "darwin" {
  return process.platform as "linux" | "win32" | "darwin";
}

async function run(command: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve) => {
    exec(command, { encoding: "utf-8", timeout: timeoutMs }, (err, stdout) => {
      resolve(err ? "" : (stdout ?? "").trim());
    });
  });
}

function runSync(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8", timeout: 10000 }).trim();
  } catch {
    return "";
  }
}

async function runPowerShell(command: string): Promise<string> {
  return run(`powershell -Command "${command}"`);
}

async function runParallel(commands: Record<string, string>): Promise<Record<string, string>> {
  const entries = Object.entries(commands);
  const results = await Promise.all(
    entries.map(async ([key, cmd]) => {
      const result = await run(cmd);
      return [key, result] as const;
    })
  );
  return Object.fromEntries(results);
}

// ─── Natural Language Parsing ───

function cleanInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/^(hey|hi|yo|ok|okay|alright|so|well|please|can you|can u|could you|could u|would you|would u|wouldya|wanna|gonna|gotta|i want to|i'd like to|let's|let me|help me|flux)\s*/i, "")
    .replace(/\s*(please|thanks|thank you|thx|bro|dude|man|buddy|friend|bhai)\s*$/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

interface ParsedIntent {
  action: string;
  target?: string | undefined;
  value?: number | undefined;
  direction?: "up" | "down" | undefined;
}

function parseIntent(input: string): ParsedIntent {
  const raw = input.toLowerCase().trim();
  const clean = cleanInput(raw);

  // ─── WiFi ───
  if (/\b(wifi|wi-fi|wireless|internet\s*(connection|status)|wifi\s*(status|scan|connect|disconnect|on|off|enable|disable))\b/i.test(clean) || /\b(connect|disconnect|join)\s+(?:to\s+)?(?:the\s+)?(?:wifi|wireless|network)\b/i.test(clean) || /\b(turn|switch)\s+(on|off)\s+(?:the\s+)?(?:wifi|wireless)\b/i.test(clean) || /\b(connect|disconnect)\s+\w+\s*(?:wifi|network)?\b/i.test(clean)) {
    if (/\b(turn|switch)\s+(on|off|enable|disable)\b/.test(clean)) {
      return { action: /on|enable/.test(clean) ? "wifi_on" : "wifi_off" };
    }
    if (/\b(scan|search|list|show|available|nearby)\b/.test(clean)) {
      return { action: "wifi_scan" };
    }
    if (/\b(disconnect|disconnect\s+from)\b/.test(clean)) {
      return { action: "wifi_disconnect" };
    }
    if (/\b(connect|join)\b/.test(clean)) {
      const netName = clean.match(/(?:connect|join)\s+(?:to\s+)?(.+?)(?:\s+(?:network|wifi|hotspot)\s*$|\s*$)/)?.[1]?.trim();
      return { action: "wifi_connect", target: netName };
    }
    if (/\b(forget|remove)\s+(network|wifi)\b/.test(clean)) {
      const netName = clean.match(/(?:forget|remove)\s+(?:network|wifi)\s+(.+)/)?.[1]?.trim();
      return { action: "wifi_forget", target: netName };
    }
    // Status check: "wifi", "wifi status", "am i connected"
    return { action: "wifi_status" };
  }

  // ─── Bluetooth ───
  if (/\b(bluetooth|bt|pair|unpair)\b/.test(clean)) {
    if (/\b(turn|switch)\s+(on|off|enable|disable)\b/.test(clean)) {
      return { action: /on|enable/.test(clean) ? "bt_on" : "bt_off" };
    }
    if (/\b(scan|search|list|discover|nearby|available)\b/.test(clean)) {
      return { action: "bt_scan" };
    }
    if (/\b(pair|connect|link)\b/.test(clean)) {
      const device = clean.match(/(?:pair|connect|link)\s+(?:to\s+)?(.+?)(?:\s*$)/)?.[1]?.trim();
      return { action: "bt_pair", target: device };
    }
    if (/\b(unpair|disconnect|remove|forget)\b/.test(clean)) {
      const device = clean.match(/(?:unpair|disconnect|remove|forget)\s+(.+?)(?:\s*$)/)?.[1]?.trim();
      return { action: "bt_disconnect", target: device };
    }
    return { action: "bt_status" };
  }

  // ─── Clipboard ───
  if (/\b(clipboard|copy|paste|copied|what('?s| is)\s+(on\s+)?(my\s+)?clipboard)\b/.test(clean)) {
    if (/\b(clear|empty|wipe|delete)\b/.test(clean)) {
      return { action: "clip_clear" };
    }
    if (/\b(paste|insert)\b/.test(clean)) {
      return { action: "clip_paste" };
    }
    // "copy <text>" or "clipboard"
    const copyMatch = clean.match(/(?:copy|set)\s+(?:the\s+)?(?:clipboard\s+)?(?:to\s+)?(.+)/);
    if (copyMatch?.[1]) {
      return { action: "clip_copy", target: copyMatch[1] };
    }
    return { action: "clip_read" };
  }

  // ─── Process Management ───
  if (/\b(process|processes|task\s*manager|running|apps?\s*(running|open))\b/.test(clean)) {
    if (/\b(kill|end|terminate|force\s*stop)\b/.test(clean)) {
      const proc = clean.match(/(?:kill|end|terminate|force\s*stop)\s+(?:the\s+)?(?:process\s+)?(?:named?\s+)?(.+)/)?.[1]?.trim();
      return { action: "proc_kill", target: proc };
    }
    if (/\b(search|find|look\s*for|which)\b/.test(clean)) {
      const query = clean.match(/(?:search|find|look\s*for|which)\s+(?:process(?:es)?\s+)?(?:named?\s+)?(.+)/)?.[1]?.trim();
      return { action: "proc_search", target: query };
    }
    if (/\b(top|heavy|cpu|memory|resource)\b/.test(clean)) {
      return { action: "proc_top" };
    }
    return { action: "proc_list" };
  }

  // ─── Workspace Management ───
  if (/\b(workspace|desktop|virtual\s*desktop|space|switch\s*(to\s+)?workspace)\b/.test(clean)) {
    const num = clean.match(/(?:workspace|desktop|space)\s*(\d+|left|right|next|prev)/)?.[1];
    if (/left|prev|back/.test(clean)) return { action: "ws_left" };
    if (/right|next/.test(clean)) return { action: "ws_right" };
    if (num && /\d/.test(num)) return { action: "ws_goto", target: num };
    return { action: "ws_list" };
  }

  // ─── Media Control ───
  if (/\b(play|pause|stop|next|prev|previous|forward|rewind|skip|shuffle|repeat|media|music|song|track)\b/.test(clean)) {
    if (/\b(next|skip|forward)\b/.test(clean)) return { action: "media_next" };
    if (/\b(prev|previous|back|rewind)\b/.test(clean)) return { action: "media_prev" };
    if (/\b(shuffle|random)\b/.test(clean)) return { action: "media_shuffle" };
    if (/\b(repeat|loop)\b/.test(clean)) return { action: "media_repeat" };
    if (/\b(pause|stop|halt|freeze)\b/.test(clean)) return { action: "media_pause" };
    if (/\b(play|resume|start|go)\b/.test(clean)) return { action: "media_play" };
    if (/\b(what|which|now|current|playing)\b/.test(clean)) return { action: "media_now" };
    return { action: "media_play" };
  }

  // ─── Keyboard Shortcuts ───
  if (/\b(shortcut|hotkey|key\s*combo|press|keyboard|key)\b/.test(clean)) {
    const combo = clean.match(/(?:press|key|shortcut|hotkey)\s+(?:the\s+)?(?:combo\s+)?(.+)/)?.[1]?.trim();
    return { action: "key_press", target: combo };
  }

  // ─── Night Light / Blue Light ───
  if (/\b(night\s*light|blue\s*light|f\.?l\.?ux\s+(filter|mode|app)|warm\s+(light|mode)|color\s*temp|gamma)\b/.test(clean)) {
    if (/\b(turn|switch)\s+(on|off|enable|disable)\b/.test(clean)) {
      return { action: /on|enable/.test(clean) ? "nightlight_on" : "nightlight_off" };
    }
    return { action: "nightlight_toggle" };
  }

  // ─── Do Not Disturb ───
  if (/\b(dnd|do\s*not\s*disturb|focus\s*mode|quiet\s*mode|notification\s*(off|on|disable|enable|mute))\b/.test(clean)) {
    if (/\b(turn|switch)\s+(on|off|enable|disable)\b/.test(clean)) {
      return { action: /on|enable/.test(clean) ? "dnd_on" : "dnd_off" };
    }
    return { action: "dnd_toggle" };
  }

  // ─── Workspace Management ───
  if (/\b(workspace|desktop|virtual\s*desktop|space|switch\s*(to\s+)?workspace)\b/.test(clean)) {
    const num = clean.match(/(?:workspace|desktop|space)\s*(\d+|left|right|next|prev)/)?.[1];
    if (/left|prev|back/.test(clean)) return { action: "ws_left" };
    if (/right|next/.test(clean)) return { action: "ws_right" };
    if (num && /\d/.test(num)) return { action: "ws_goto", target: num };
    return { action: "ws_list" };
  }

  // ─── Network Info ───
  if (/\b(network|ip\s*(address)?|dns|interfaces?|adapter|wifi\s*ip|my\s*ip|what('?s| is)\s+my\s*(ip|address|network))\b/.test(clean)) {
    if (/\b(dns|nameserver)\b/.test(clean)) return { action: "net_dns" };
    if (/\b(interfaces?|adapter|device)\b/.test(clean)) return { action: "net_interfaces" };
    if (/\b(public|external|wan|outside)\b/.test(clean)) return { action: "net_public_ip" };
    return { action: "net_ip" };
  }

  // ─── Battery ───
  if (/\b(battery|charge|power level|how (much|much juice)|am i (plugged|charging))\b/.test(clean)) {
    return { action: "battery" };
  }

  // ─── Volume ───
  if (/\b(volume|sound|audio|mute|unmute|too (loud|quiet|noisy))\b/.test(clean)) {
    const setMatch = clean.match(/(?:set|change|adjust|make|put)\s+(?:the\s+)?(?:volume\s+)?(?:to\s+)?(\d+)/);
    if (setMatch?.[1]) return { action: "volume_set", value: parseInt(setMatch[1]) };

    if (/\b(mute|shut (up|it)|silent|silence)\b/.test(clean)) {
      return { action: "volume_mute" };
    }
    if (/\b(unmute|turn (on|up)|sound on)\b/.test(clean)) {
      return { action: "volume_mute" };
    }
    if (/\b(up|louder|increase|higher|more|blast|max)\b/.test(clean)) {
      if (/\b(max|full|100|all (the )?way)\b/.test(clean)) return { action: "volume_set", value: 100 };
      return { action: "volume_adjust", direction: "up" };
    }
    if (/\b(down|quieter|decrease|lower|less|softer|min)\b/.test(clean)) {
      if (/\b(min|mute|0|zero)\b/.test(clean)) return { action: "volume_set", value: 0 };
      return { action: "volume_adjust", direction: "down" };
    }
    return { action: "volume_get" };
  }

  // ─── Brightness ───
  if (/\b(brightness|screen (bright|dim)|display|too (bright|dark|dim))\b/.test(clean)) {
    const setMatch = clean.match(/(?:set|change|adjust|make|put)\s+(?:the\s+)?(?:brightness\s+)?(?:to\s+)?(\d+)/);
    if (setMatch?.[1]) return { action: "brightness_set", value: parseInt(setMatch[1]) };

    if (/\b(dim|lower|down|decrease|less|darker|dark)\b/.test(clean)) {
      return { action: "brightness_adjust", direction: "down" };
    }
    if (/\b(bright|up|increase|more|higher|lighter|light)\b/.test(clean)) {
      return { action: "brightness_adjust", direction: "up" };
    }
    return { action: "brightness_get" };
  }

  // ─── System Info ───
  if (/\b(system\s*(info|status|details|specs)|what('?s| is)\s+(my\s+)?(os|system|computer|laptop|machine|setup)|hostname|uptime|cpu|memory|ram|disk|kernel|platform|what am i (running|using))\b/.test(clean)) {
    return { action: "system_info" };
  }

  // ─── Screenshot ───
  if (/\b(screenshot|screen\s*shot|capture|take\s*(a\s+)?(pic|picture|photo|snap)|snip)\b/.test(clean)) {
    return { action: "screenshot" };
  }

  // ─── Power ───
  if (/\b(shutdown|power\s*off|turn\s*(it\s+)?off|shut\s*(it\s+)?down)\b/.test(clean)) return { action: "shutdown" };
  if (/\b(restart|reboot|reload)\b/.test(clean)) return { action: "restart" };
  if (/\b(sleep|suspend|hibernate|nap)\b/.test(clean)) return { action: "suspend" };
  if (/\b(lock|lock\s*screen|secure)\b/.test(clean)) return { action: "lock" };

  // ─── Close app ───
  if (/\b(close|quit|exit|kill|stop|shut)\b/.test(clean)) {
    const app = extractAppName(clean, /\b(close|quit|exit|kill|stop|shut)\b/);
    return { action: "close", target: app };
  }

  // ─── Open app ───
  if (/\b(open|launch|start|run|fire up|boot up|spin up|load|bring up|pull up|show me|switch to)\b/.test(clean)) {
    const app = extractAppName(clean, /\b(open|launch|start|run|fire up|boot up|spin up|load|bring up|pull up|show me|switch to)\b/);
    return { action: "open", target: app };
  }

  // ─── Fuzzy app detection ───
  const knownApps = ["kitty", "firefox", "chrome", "code", "vscode", "spotify", "discord", "slack", "thunar", "nautilus", "alacritty", "wezterm", "terminal", "settings", "calculator", "file manager", "browser", "explorer"];
  for (const app of knownApps) {
    const regex = new RegExp(`\\b${app}\\b`, "i");
    if (regex.test(clean) && !clean.match(/^(what|how|where|when|why|which)/)) {
      return { action: "open", target: app };
    }
  }

  return { action: "unknown" };
}

function extractAppName(input: string, keywordRegex: RegExp): string {
  const afterKeyword = input.split(keywordRegex).pop() ?? "";
  return afterKeyword
    .replace(/\b(the|my|a|an|for me|please|thanks|right now|real quick|real fast)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ═══════════════════════════════════════════════════════════════════
// SYSTEM FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// ─── WiFi ────────────────────────────────────────────────────────

async function getWifiStatus(): Promise<string> {
  const platform = getPlatform();
  const parts = ["**WiFi Status**"];

  if (platform === "linux") {
    // Try nmcli first, then iwctl
    const nmcli = await run("nmcli -t -f NAME,TYPE,DEVICE connection show --active 2>/dev/null");
    const wifiLine = nmcli.split("\n").find((l) => l.includes("802-11-wireless"));

    if (wifiLine) {
      const [name] = wifiLine.split(":");
      parts.push(`Connected: **${name ?? "unknown"}**`);

      const signal = await run("nmcli -t -f SIGNAL device wifi list 2>/dev/null | head -1");
      if (signal) parts.push(`Signal: ${signal}%`);

      const ip = await run("nmcli -t -f IP4.ADDRESS device show $(nmcli -t -f DEVICE connection show --active | grep wifi | cut -d: -f1) 2>/dev/null | head -1 | cut -d: -f2");
      if (ip) parts.push(`IP: ${ip}`);
    } else {
      parts.push("Connected: **No**");
    }

    // Check if WiFi is enabled
    const radio = await run("nmcli -t -f WIFI general 2>/dev/null");
    if (radio) parts.push(`Radio: ${radio}`);

    // Airplane mode
    const airplane = await run("nmcli -t -f AIRPLANE general 2>/dev/null");
    if (airplane) parts.push(`Airplane: ${airplane}`);
  } else if (platform === "win32") {
    const result = await runPowerShell(`
      $wifi = Get-NetAdapter -Name '*Wi-Fi*' -ErrorAction SilentlyContinue;
      if ($wifi) {
        "Status: " + $wifi.Status;
        "SSID: " + (netsh wlan show interfaces 2>$null | Select-String 'SSID\\s*:\\s*(.+)' | ForEach-Object { $_.Matches.Groups[1].Value });
        "Signal: " + (netsh wlan show interfaces 2>$null | Select-String 'Signal\\s*:\\s*(.+)' | ForEach-Object { $_.Matches.Groups[1].Value });
        "IP: " + ($wifi | Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty IPAddress);
      } else { "WiFi adapter not found" }
    `);
    parts.push(result || "WiFi status unavailable");
  }

  return parts.join("\n");
}

async function scanWifi(): Promise<string> {
  const platform = getPlatform();
  const parts = ["**Available WiFi Networks**"];

  if (platform === "linux") {
    // Trigger scan then list
    await run("nmcli device wifi rescan 2>/dev/null");
    await new Promise((r) => setTimeout(r, 2000));
    const networks = await run("nmcli -t -f SSID,SIGNAL,SECURITY device wifi list 2>/dev/null");
    if (networks) {
      const seen = new Set<string>();
      for (const line of networks.split("\n")) {
        const [ssid, signal, security] = line.split(":");
        if (ssid && !seen.has(ssid)) {
          seen.add(ssid);
          const bar = signal ? `${signal}%` : "??%";
          const sec = security && security !== "" ? ` [${security}]` : "";
          parts.push(`  ${ssid} — ${bar}${sec}`);
        }
      }
    } else {
      // Fallback: iwctl
      const iwctl = await run("iwctl station wlan0 scan 2>/dev/null && iwctl station wlan0 get-networks 2>/dev/null");
      if (iwctl) parts.push(iwctl);
      else parts.push("No networks found (try: nmcli device wifi list)");
    }
  } else if (platform === "win32") {
    const result = await runPowerShell(`
      netsh wlan show networks mode=bssid 2>$null | ForEach-Object {
        if ($_ -match 'SSID\\s*\\d+\\s*:\\s*(.+)') { $matches[1] }
        elseif ($_ -match 'Signal\\s*:\\s*(.+)') { "  " + $matches[1] }
      }
    `);
    if (result) {
      const lines = result.split("\n").filter(Boolean);
      for (const line of lines.slice(0, 15)) {
        parts.push(`  ${line.trim()}`);
      }
    } else {
      parts.push("No networks found");
    }
  }

  return parts.join("\n");
}

async function connectWifi(networkName?: string): Promise<string> {
  const platform = getPlatform();
  if (!networkName) return "Which network should I connect to?";

  if (platform === "linux") {
    // Check if already saved
    const saved = await run(`nmcli -t -f NAME connection show 2>/dev/null | grep -x "${networkName}"`);
    if (saved) {
      await run(`nmcli connection up "${networkName}" 2>/dev/null`);
      return `Connected to **${networkName}**`;
    }
    // New connection — will prompt for password in real usage
    await run(`nmcli device wifi connect "${networkName}" 2>/dev/null`);
    return `Connected to **${networkName}** (saved as new profile)`;
  } else if (platform === "win32") {
    await runPowerShell(`netsh wlan connect name="${networkName}"`);
    return `Connecting to **${networkName}**...`;
  }

  return "WiFi connect not available on this platform";
}

async function disconnectWifi(): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    const active = await run("nmcli -t -f NAME,TYPE connection show --active 2>/dev/null | grep 802-11-wireless | cut -d: -f1");
    if (active) {
      await run(`nmcli connection down "${active}" 2>/dev/null`);
      return `Disconnected from **${active}**`;
    }
    return "No active WiFi connection";
  } else if (platform === "win32") {
    await runPowerShell("netsh wlan disconnect");
    return "WiFi disconnected";
  }

  return "WiFi disconnect not available";
}

async function setWifi(on: boolean): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    if (on) {
      await run("nmcli radio wifi on 2>/dev/null");
      return "WiFi **enabled**";
    }
    await run("nmcli radio wifi off 2>/dev/null");
    return "WiFi **disabled**";
  } else if (platform === "win32") {
    if (on) {
      await runPowerShell("Enable-NetAdapter -Name '*Wi-Fi*' -Confirm:$false");
      return "WiFi **enabled**";
    }
    await runPowerShell("Disable-NetAdapter -Name '*Wi-Fi*' -Confirm:$false");
    return "WiFi **disabled**";
  }

  return "WiFi toggle not available";
}

async function forgetWifi(networkName?: string): Promise<string> {
  const platform = getPlatform();
  if (!networkName) return "Which network should I forget?";

  if (platform === "linux") {
    await run(`nmcli connection delete "${networkName}" 2>/dev/null`);
    return `Forgot network **${networkName}**`;
  } else if (platform === "win32") {
    await runPowerShell(`netsh wlan delete profile name="${networkName}"`);
    return `Forgot network **${networkName}**`;
  }

  return "WiFi forget not available";
}

// ─── Bluetooth ───────────────────────────────────────────────────

async function getBluetoothStatus(): Promise<string> {
  const platform = getPlatform();
  const parts = ["**Bluetooth Status**"];

  if (platform === "linux") {
    const results = await runParallel({
      power: "bluetoothctl show 2>/dev/null | grep 'Powered:' | awk '{print $2}'",
      name: "bluetoothctl show 2>/dev/null | grep 'Name:' | cut -d' ' -f2-",
      adapter: "bluetoothctl show 2>/dev/null | grep 'Adapter:' | awk '{print $2}'",
    });
    parts.push(`Powered: ${results.power === "yes" ? "**On**" : "**Off**"}`);
    if (results.name) parts.push(`Name: ${results.name}`);
    if (results.adapter) parts.push(`Adapter: ${results.adapter}`);

    // Connected devices
    const devices = await run("bluetoothctl devices Connected 2>/dev/null");
    if (devices) {
      parts.push("\n**Connected devices:**");
      for (const line of devices.split("\n").slice(0, 5)) {
        const match = line.match(/Device\s+\S+\s+(.+)/);
        if (match?.[1]) parts.push(`  - ${match[1]}`);
      }
    }
  } else if (platform === "win32") {
    const result = await runPowerShell(`
      $bt = Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Select-Object -First 1;
      if ($bt) { "Status: " + $bt.Status + "\\nName: " + $bt.FriendlyName } else { "Bluetooth not found" }
    `);
    parts.push(result || "Bluetooth status unavailable");
  }

  return parts.join("\n");
}

async function scanBluetooth(): Promise<string> {
  const platform = getPlatform();
  const parts = ["**Nearby Bluetooth Devices**"];

  if (platform === "linux") {
    await run("bluetoothctl power on 2>/dev/null");
    await run("bluetoothctl scan on 2>/dev/null");
    await new Promise((r) => setTimeout(r, 5000));
    await run("bluetoothctl scan off 2>/dev/null");

    const devices = await run("bluetoothctl devices 2>/dev/null");
    if (devices) {
      const seen = new Set<string>();
      for (const line of devices.split("\n").slice(0, 15)) {
        const match = line.match(/Device\s+(\S+)\s+(.+)/);
        if (match?.[1] && !seen.has(match[1])) {
          seen.add(match[1]);
          parts.push(`  ${match[2]} (${match[1]})`);
        }
      }
    } else {
      parts.push("No devices found");
    }
  } else if (platform === "win32") {
    const result = await runPowerShell(`
      Get-PnpDevice -Class Bluetooth -Status OK -ErrorAction SilentlyContinue |
      Select-Object -First 10 FriendlyName, InstanceId |
      ForEach-Object { "  " + $_.FriendlyName + " (" + $_.InstanceId + ")" }
    `);
    if (result) result.split("\n").filter(Boolean).forEach((l) => parts.push(l.trim()));
    else parts.push("No devices found");
  }

  return parts.join("\n");
}

async function pairBluetooth(device?: string): Promise<string> {
  const platform = getPlatform();
  if (!device) return "Which device should I pair? You can scan first.";

  if (platform === "linux") {
    const output = await run(`bluetoothctl pair ${device} 2>/dev/null`, 15000);
    if (output.includes("Successful") || output.includes("paired")) {
      return `Paired with **${device}**`;
    }
    // Try by name
    const mac = await run(`bluetoothctl devices 2>/dev/null | grep -i "${device}" | head -1 | awk '{print $2}'`);
    if (mac) {
      await run(`bluetoothctl pair ${mac} 2>/dev/null`, 15000);
      return `Paired with **${device}** (${mac})`;
    }
    return `Could not find device "${device}"`;
  } else if (platform === "win32") {
    await runPowerShell(`
      Add-Type -AssemblyName System.Windows.Forms;
      $dev = Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -like "*${device}*" } | Select-Object -First 1;
      if ($dev) { "Found: " + $dev.FriendlyName } else { "Device not found" }
    `);
    return `Attempting to pair with **${device}**...`;
  }

  return "Bluetooth pair not available";
}

async function disconnectBluetooth(device?: string): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    if (device) {
      await run(`bluetoothctl disconnect ${device} 2>/dev/null`);
      return `Disconnected **${device}**`;
    }
    // Disconnect all
    const connected = await run("bluetoothctl devices Connected 2>/dev/null | awk '{print $2}'");
    for (const mac of connected.split("\n").filter(Boolean)) {
      await run(`bluetoothctl disconnect ${mac} 2>/dev/null`);
    }
    return "Disconnected all Bluetooth devices";
  } else if (platform === "win32") {
    await runPowerShell("Get-PnpDevice -Class Bluetooth -Status OK | Disable-PnpDevice -Confirm:$false");
    return "Bluetooth devices disconnected";
  }

  return "Bluetooth disconnect not available";
}

async function setBluetooth(on: boolean): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    await run(`bluetoothctl power ${on ? "on" : "off"} 2>/dev/null`);
    return `Bluetooth **${on ? "enabled" : "disabled"}**`;
  } else if (platform === "win32") {
    if (on) {
      await runPowerShell("Get-PnpDevice -Class Bluetooth | Enable-PnpDevice -Confirm:$false");
    } else {
      await runPowerShell("Get-PnpDevice -Class Bluetooth | Disable-PnpDevice -Confirm:$false");
    }
    return `Bluetooth **${on ? "enabled" : "disabled"}**`;
  }

  return "Bluetooth toggle not available";
}

// ─── Clipboard ───────────────────────────────────────────────────

async function readClipboard(): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    // Try Wayland first (wl-clipboard), then X11 (xclip)
    let text = await run("wl-paste 2>/dev/null");
    if (!text) text = await run("xclip -selection clipboard -o 2>/dev/null");
    if (text) return `**Clipboard**:\n\`\`\`\n${text.slice(0, 2000)}\n\`\`\``;
    return "Clipboard is empty";
  } else if (platform === "win32") {
    const text = await runPowerShell("Get-Clipboard");
    if (text) return `**Clipboard**:\n\`\`\`\n${text.slice(0, 2000)}\n\`\`\``;
    return "Clipboard is empty";
  }

  return "Clipboard read not available";
}

async function copyToClipboard(text: string): Promise<string> {
  const platform = getPlatform();
  if (!text) return "What should I copy?";

  if (platform === "linux") {
    await run(`echo -n '${text.replace(/'/g, "'\\''")}' | wl-copy 2>/dev/null || echo -n '${text.replace(/'/g, "'\\''")}' | xclip -selection clipboard 2>/dev/null`);
    return `Copied to clipboard: **${text.slice(0, 50)}${text.length > 50 ? "..." : ""}**`;
  } else if (platform === "win32") {
    await runPowerShell(`Set-Clipboard -Value "${text.replace(/"/g, '`"')}"`);
    return `Copied to clipboard: **${text.slice(0, 50)}${text.length > 50 ? "..." : ""}**`;
  }

  return "Clipboard write not available";
}

async function clearClipboard(): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    await run("wl-copy -c 2>/dev/null || xclip -selection clipboard -i /dev/null 2>/dev/null");
    return "Clipboard **cleared**";
  } else if (platform === "win32") {
    await runPowerShell("Set-Clipboard -Value $null");
    return "Clipboard **cleared**";
  }

  return "Clipboard clear not available";
}

// ─── Process Management ──────────────────────────────────────────

async function listProcesses(): Promise<string> {
  const platform = getPlatform();
  const parts = ["**Running Processes**"];

  if (platform === "linux") {
    const procs = await run("ps aux --sort=-%cpu | head -15 | tail -14 | awk '{printf \"%-8s %5s%%CPU %5s%%MEM  %s\\n\", $1, $3, $4, $11}'");
    if (procs) {
      parts.push("```");
      parts.push("USER     %CPU  %MEM  COMMAND");
      for (const line of procs.split("\n").filter(Boolean)) {
        parts.push(line);
      }
      parts.push("```");
    }
    const total = await run("ps aux | wc -l");
    if (total) parts.push(`\nTotal: ${parseInt(total) - 1} processes`);
  } else if (platform === "win32") {
    const procs = await runPowerShell(`
      Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 Name, CPU, @{N='Mem(MB)';E={[math]::Round($_.WorkingSet64/1MB)}} |
      Format-Table -AutoSize | Out-String
    `);
    if (procs) parts.push(procs);
  }

  return parts.join("\n");
}

async function topProcesses(): Promise<string> {
  const platform = getPlatform();
  const parts = ["**Top Processes by Resource**"];

  if (platform === "linux") {
    const cpu = await run("ps aux --sort=-%cpu | head -6 | tail -5 | awk '{printf \"%s: %s%%CPU %s%%MEM\\n\", $11, $3, $4}'");
    const mem = await run("ps aux --sort=-%mem | head -6 | tail -5 | awk '{printf \"%s: %s%%MEM %s%%CPU\\n\", $11, $4, $3}'");
    if (cpu) {
      parts.push("\n**By CPU:**");
      for (const line of cpu.split("\n").filter(Boolean)) parts.push(`  ${line}`);
    }
    if (mem) {
      parts.push("\n**By Memory:**");
      for (const line of mem.split("\n").filter(Boolean)) parts.push(`  ${line}`);
    }
  } else if (platform === "win32") {
    const result = await runPowerShell(`
      "=== CPU ===" ;
      Get-Process | Sort-Object CPU -Desc | Select-Object -First 5 Name, @{N='CPU';E={$_.CPU}}, @{N='Mem(MB)';E={[math]::Round($_.WorkingSet64/1MB)}} | Format-Table -AutoSize | Out-String;
      "=== Memory ===" ;
      Get-Process | Sort-Object WorkingSet64 -Desc | Select-Object -First 5 Name, @{N='Mem(MB)';E={[math]::Round($_.WorkingSet64/1MB)}}, CPU | Format-Table -AutoSize | Out-String
    `);
    if (result) parts.push(result);
  }

  return parts.join("\n");
}

async function searchProcess(query?: string): Promise<string> {
  const platform = getPlatform();
  if (!query) return "What process should I search for?";

  const parts = [`**Processes matching "${query}"**`];

  if (platform === "linux") {
    const procs = await run(`ps aux | grep -i "${query}" | grep -v grep | awk '{printf "PID:%-7s CPU:%5s%% MEM:%5s%%  %s\\n", $2, $3, $4, $11}'`);
    if (procs) {
      for (const line of procs.split("\n").filter(Boolean)) parts.push(`  ${line}`);
    } else {
      parts.push("No matching processes found");
    }
  } else if (platform === "win32") {
    const procs = await runPowerShell(`Get-Process -Name "*${query}*" -ErrorAction SilentlyContinue | ForEach-Object { "PID:" + $_.Id + " CPU:" + $_.CPU + " Mem:" + [math]::Round($_.WorkingSet64/1MB) + "MB  " + $_.Name }`);
    if (procs) {
      for (const line of procs.split("\n").filter(Boolean)) parts.push(`  ${line}`);
    } else {
      parts.push("No matching processes found");
    }
  }

  return parts.join("\n");
}

async function killProcess(target?: string): Promise<string> {
  const platform = getPlatform();
  if (!target) return "What process should I kill?";

  if (platform === "linux") {
    // Try PID first
    if (/^\d+$/.test(target)) {
      await run(`kill -9 ${target} 2>/dev/null`);
      return `Killed process **${target}**`;
    }
    // Kill by name
    await run(`pkill -9 -f "${target}" 2>/dev/null`);
    return `Killed processes matching **${target}**`;
  } else if (platform === "win32") {
    if (/^\d+$/.test(target)) {
      await runPowerShell(`Stop-Process -Id ${target} -Force -ErrorAction SilentlyContinue`);
      return `Killed process **${target}**`;
    }
    await runPowerShell(`Get-Process -Name "*${target}*" -ErrorAction SilentlyContinue | Stop-Process -Force`);
    return `Killed processes matching **${target}**`;
  }

  return "Kill not available";
}

// ─── Media Control ───────────────────────────────────────────────

async function mediaControl(action: string): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    // playerctl (works with Spotify, Firefox, Chrome, mpv, etc.)
    const cmd = await (async () => {
      switch (action) {
        case "play": return "play-pause";
        case "pause": return "play-pause";
        case "next": return "next";
        case "prev": return "previous";
        case "shuffle": return "shuffle";
        case "repeat": return "loop";
        case "now": return "metadata --format '{{artist}} - {{title}} ({{album}})'";
        default: return "status";
      }
    })();

    if (action === "now") {
      const info = await run(`playerctl ${cmd} 2>/dev/null`);
      if (info && !info.includes("No players")) return `**Now Playing**: ${info}`;
      return "No media playing";
    }

    if (action === "shuffle" || action === "repeat") {
      await run(`playerctl ${cmd} 2>/dev/null`);
      return `${action === "shuffle" ? "Shuffle" : "Repeat"} **toggled**`;
    }

    if (action === "next" || action === "prev") {
      await run(`playerctl ${cmd} 2>/dev/null`);
      return action === "next" ? "Skipped to **next** track" : "Skipped to **previous** track";
    }

    if (action === "play" || action === "pause") {
      await run(`playerctl ${cmd} 2>/dev/null`);
      const status = await run("playerctl status 2>/dev/null");
      const state = status === "Playing" ? "playing" : status === "Paused" ? "paused" : "toggled";
      return `Media **${state}**`;
    }

    const statusBefore = await run("playerctl status 2>/dev/null");
    if (!statusBefore || statusBefore.includes("No players")) {
      // Try to start Spotify
      if (action === "play") {
        run("nohup spotify >/dev/null 2>&1 &");
        return "Starting **Spotify**...";
      }
      return "No media player running";
    }

    await run(`playerctl ${cmd} 2>/dev/null`);
    const statusAfter = await run("playerctl status 2>/dev/null");
    const state = statusAfter === "Playing" ? "playing" : statusAfter === "Paused" ? "paused" : "stopped";
    return `Media **${state}**`;
  } else if (platform === "win32") {
    // PowerShell media keys
    switch (action) {
      case "play":
        await runPowerShell("$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]0xB3)");
        return "Media **playing**";
      case "pause":
        await runPowerShell("$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]0xB3)");
        return "Media **paused**";
      case "next":
        await runPowerShell("$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]0xB0)");
        return "Skipped to **next**";
      case "prev":
        await runPowerShell("$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]0xB1)");
        return "Skipped to **previous**";
      case "now":
        return "Now playing info not available via shell on Windows";
      default:
        return "Media action not supported on Windows";
    }
  }

  return "Media control not available";
}

// ─── Keyboard Shortcuts ──────────────────────────────────────────

async function pressKey(combo?: string): Promise<string> {
  const platform = getPlatform();
  if (!combo) return "What key combination should I press? (e.g., Ctrl+C, Alt+Tab, Super+L)";

  const normalized = combo
    .replace(/\bctrl\b/gi, "Ctrl")
    .replace(/\balt\b/gi, "Alt")
    .replace(/\bshift\b/gi, "Shift")
    .replace(/\bsuper\b/gi, "Super")
    .replace(/\bwin\b/gi, "Super")
    .replace(/\bcmd\b/gi, "Super")
    .replace(/\bmeta\b/gi, "Super")
    .replace(/\benter\b/gi, "Return")
    .replace(/\breturn\b/gi, "Return")
    .replace(/\bescape\b/gi, "Escape")
    .replace(/\btab\b/gi, "Tab")
    .replace(/\bspace\b/gi, "space")
    .replace(/\bbackspace\b/gi, "BackSpace")
    .replace(/\bdelete\b/gi, "Delete")
    .replace(/\bup\b/gi, "Up")
    .replace(/\bdown\b/gi, "Down")
    .replace(/\bleft\b/gi, "Left")
    .replace(/\bright\b/gi, "Right");

  if (platform === "linux") {
    // Try ydotool (Wayland), then xdotool (X11)
    const xdoCombo = normalized
      .replace(/\+/g, "+")
      .replace(/\bCtrl\b/g, "ctrl")
      .replace(/\bAlt\b/g, "alt")
      .replace(/\bShift\b/g, "shift")
      .replace(/\bSuper\b/g, "super");

    const ydotool = await run(`ydotool key ${xdoCombo} 2>/dev/null`);
    if (!ydotool && ydotool !== undefined) {
      await run(`xdotool key ${xdoCombo} 2>/dev/null`);
    }
    return `Pressed **${combo}**`;
  } else if (platform === "win32") {
    // Convert to SendKeys format
    const sendKeys = normalized
      .replace(/\bCtrl\b/g, "^")
      .replace(/\bAlt\b/g, "%")
      .replace(/\bShift\b/g, "+");
    await runPowerShell(`$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys("${sendKeys}")`);
    return `Pressed **${combo}**`;
  }

  return "Key press not available";
}

// ─── Night Light ─────────────────────────────────────────────────

async function nightLightToggle(): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    // Try gammastep (Wayland), then redshift (X11)
    const running = await run("pgrep -x gammastep 2>/dev/null || pgrep -x redshift 2>/dev/null");
    if (running) {
      await run("pkill -x gammastep 2>/dev/null || pkill -x redshift 2>/dev/null");
      return "Night light **off**";
    }
    // Start it
    await run("nohup gammastep -m wayland &>/dev/null & disown 2>/dev/null || nohup redshift -m wayland &>/dev/null & disown 2>/dev/null");
    return "Night light **on**";
  } else if (platform === "win32") {
    await runPowerShell(`
      $key = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\DefaultAccount\\Current\\default$windows.data.bluelightreduction.settings\\windows.data.bluelightreduction.settings";
      $val = (Get-ItemProperty -Path $key -ErrorAction SilentlyContinue).Data;
      if ($val -and $val[18] -eq 0) {
        Set-ItemProperty -Path $key -Name Data -Value ([byte[]](...$val[0..17],1,$val[19..($val.Length-1)]));
        "Night light on"
      } else {
        "Night light toggle requires Settings app"
      }
    `);
    return "Night light **toggled** (check Settings > Display > Night light)";
  }

  return "Night light not available";
}

// ─── Do Not Disturb ──────────────────────────────────────────────

async function dndToggle(): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    // mako (Wayland notification daemon)
    const running = await run("pgrep -x mako 2>/dev/null");
    if (running) {
      await run("makoctl mode 2>/dev/null | grep -q dnd && makoctl mode -r dnd 2>/dev/null || makoctl mode -a dnd 2>/dev/null");
      return "DND **toggled**";
    }
    // dunst
    await run("dunstctl set-paused toggle 2>/dev/null");
    return "DND **toggled** (dunst)";
  } else if (platform === "win32") {
    await runPowerShell(`
      $key = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\DefaultAccount\\Current\\default$windows.data.notifications.quiethourssettings\\windows.data.notifications.quiet_hours_settings";
      Get-ItemProperty -Path $key -ErrorAction SilentlyContinue | Out-Null;
      Focus Assist is managed via Action Center
    `);
    return "DND — use **Win+A** to open Action Center and toggle Focus Assist";
  }

  return "DND not available";
}

async function dndSet(on: boolean): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    if (on) {
      await run("makoctl mode -a dnd 2>/dev/null || dunstctl set-paused true 2>/dev/null");
      return "DND **enabled**";
    }
    await run("makoctl mode -r dnd 2>/dev/null || dunstctl set-paused false 2>/dev/null");
    return "DND **disabled**";
  } else if (platform === "win32") {
    return on
      ? "DND — open **Win+A** > Focus Assist > Priority only"
      : "DND — open **Win+A** > Focus Assist > Off";
  }

  return "DND not available";
}

// ─── Workspace Management ────────────────────────────────────────

async function workspaceAction(action: string, target?: string): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    const hyprland = runSync("echo $HYPRLAND_INSTANCE_SIGNATURE 2>/dev/null");
    if (hyprland) {
      switch (action) {
        case "ws_left":
          await run("hyprctl dispatch workspace -1 2>/dev/null");
          return "Workspace **left**";
        case "ws_right":
          await run("hyprctl dispatch workspace +1 2>/dev/null");
          return "Workspace **right**";
        case "ws_goto":
          if (target && /^\d+$/.test(target)) {
            await run(`hyprctl dispatch workspace ${target} 2>/dev/null`);
            return `Switched to workspace **${target}**`;
          }
          return "Which workspace number?";
        case "ws_list": {
          const active = await run("hyprctl activeworkspace -j 2>/dev/null | grep -o '\"id\":[0-9]*' | cut -d: -f2");
          const total = await run("hyprctl workspaces -j 2>/dev/null | grep -o '\"id\":[0-9]*' | wc -l");
          return `Workspace **${active ?? "?"}** of **${total ?? "?"}**`;
        }
        default:
          return "Workspace action not recognized";
      }
    }
    // i3/sway fallback
    const sway = runSync("echo $SWAYSOCK 2>/dev/null");
    if (sway) {
      switch (action) {
        case "ws_left": await run("swaymsg workspace prev 2>/dev/null"); return "Workspace **left**";
        case "ws_right": await run("swaymsg workspace next 2>/dev/null"); return "Workspace **right**";
        case "ws_goto": if (target) { await run(`swaymsg workspace ${target} 2>/dev/null`); return `Switched to workspace **${target}**`; }
        default: return "Workspace action not recognized";
      }
    }
    return "No supported window manager detected (need Hyprland or Sway)";
  } else if (platform === "win32") {
    // Virtual desktops via keyboard shortcut
    const key = action === "ws_left" ? "%{LEFT}" : action === "ws_right" ? "%{RIGHT}" : target;
    await runPowerShell(`$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys("^%${action === "ws_left" ? "{LEFT}" : "{RIGHT}"}")`);
    return `Workspace **${action === "ws_left" ? "left" : "right"}**`;
  }

  return "Workspace management not available";
}

// ─── Network Info ────────────────────────────────────────────────

async function getNetworkInfo(): Promise<string> {
  const platform = getPlatform();
  const parts = ["**Network Info**"];

  if (platform === "linux") {
    const results = await runParallel({
      ip: "ip -4 addr show scope global 2>/dev/null | grep inet | awk '{print $2}' | head -3",
      gateway: "ip route show default 2>/dev/null | awk '{print $3}' | head -1",
      dns: "cat /etc/resolv.conf 2>/dev/null | grep nameserver | awk '{print $2}' | head -3",
      interfaces: "ip -o link show 2>/dev/null | awk -F': ' '{print $2}' | grep -v lo | head -5",
    });
    if (results.ip) {
      parts.push("\n**IP Addresses:**");
      for (const ip of results.ip.split("\n").filter(Boolean)) parts.push(`  ${ip}`);
    }
    if (results.gateway) parts.push(`\nGateway: ${results.gateway}`);
    if (results.dns) {
      parts.push("\n**DNS Servers:**");
      for (const dns of results.dns.split("\n").filter(Boolean)) parts.push(`  ${dns}`);
    }
    if (results.interfaces) {
      parts.push("\n**Interfaces:**");
      for (const iface of results.interfaces.split("\n").filter(Boolean)) parts.push(`  ${iface}`);
    }
  } else if (platform === "win32") {
    const result = await runPowerShell(`
      Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' } | Select-Object IPAddress, InterfaceAlias, PrefixLength | Format-Table -AutoSize | Out-String;
      "---DNS---";
      Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object ServerAddresses | ForEach-Object { $_.ServerAddresses -join ', ' }
    `);
    if (result) parts.push(result);
  }

  return parts.join("\n");
}

async function getPublicIp(): Promise<string> {
  const ip = await run("curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null");
  if (ip) return `**Public IP**: ${ip}`;
  return "Could not determine public IP";
}

async function getDns(): Promise<string> {
  const platform = getPlatform();
  const parts = ["**DNS Configuration**"];

  if (platform === "linux") {
    const dns = await run("cat /etc/resolv.conf 2>/dev/null | grep -E 'nameserver|search' | head -10");
    if (dns) {
      for (const line of dns.split("\n").filter(Boolean)) parts.push(`  ${line.trim()}`);
    }
    // Active DNS via resolvectl
    const active = await run("resolvectl status 2>/dev/null | grep 'DNS Servers' -A 5 | head -6");
    if (active) {
      parts.push("\n**Active DNS:**");
      for (const line of active.split("\n").filter(Boolean)) parts.push(`  ${line.trim()}`);
    }
  } else if (platform === "win32") {
    const result = await runPowerShell("Get-DnsClientServerAddress -AddressFamily IPv4 | ForEach-Object { $_.InterfaceAlias + ': ' + ($_.ServerAddresses -join ', ') }");
    if (result) {
      for (const line of result.split("\n").filter(Boolean)) parts.push(`  ${line.trim()}`);
    }
  }

  return parts.join("\n");
}

async function getNetworkInterfaces(): Promise<string> {
  const platform = getPlatform();
  const parts = ["**Network Interfaces**"];

  if (platform === "linux") {
    const result = await run("ip -o link show 2>/dev/null | awk -F': ' '{print $2, $3}' | grep -v lo");
    if (result) {
      for (const line of result.split("\n").filter(Boolean)) {
        const [name, state] = line.split(" ");
        const icon = state === "UP" ? "[+]" : "[-]";
        parts.push(`  ${icon} ${name}`);
      }
    }
  } else if (platform === "win32") {
    const result = await runPowerShell("Get-NetAdapter | Select-Object Name, Status, LinkSpeed | Format-Table -AutoSize | Out-String");
    if (result) parts.push(result);
  }

  return parts.join("\n");
}

// ─── Battery (parallel probes) ───────────────────────────────────

async function getBattery(): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    const results = await runParallel({
      upower: "upower -i /org/freedesktop/UPower/devices/battery_BAT0 2>/dev/null",
      sysfs: "cat /sys/class/power_supply/BAT0/capacity 2>/dev/null",
      sysfsStatus: "cat /sys/class/power_supply/BAT0/status 2>/dev/null",
      acpi: "acpi 2>/dev/null",
    });

    if (results.upower) {
      const level = results.upower.match(/percentage:\s+(\d+%)/)?.[1] ?? "";
      const state = results.upower.match(/state:\s+(\w+)/)?.[1] ?? "";
      const time = results.upower.match(/time to (?:empty|full):\s+(.+)/)?.[1] ?? "";
      const parts = ["**Battery**"];
      if (level) parts.push(`Level: ${level}`);
      if (state) parts.push(`State: ${state}`);
      if (time) parts.push(`Time to ${state === "charging" ? "full" : "empty"}: ${time}`);
      return parts.join("\n");
    }

    if (results.sysfs) {
      const parts = ["**Battery**"];
      parts.push(`Level: ${results.sysfs}%`);
      if (results.sysfsStatus) parts.push(`State: ${results.sysfsStatus}`);
      return parts.join("\n");
    }

    if (results.acpi) {
      const match = results.acpi.match(/Battery 0: (.*?), (\d+%), (.*)/);
      if (match?.[2] && match?.[3]) {
        return `**Battery**\nLevel: ${match[2]}%\nState: ${match[3]}`;
      }
    }

    return "No battery detected";
  } else if (platform === "win32") {
    const result = await runPowerShell("(Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus) | ForEach-Object { 'Level: ' + $_.EstimatedChargeRemaining + '%'; 'State: ' + (if($_.BatteryStatus -eq 2){'Charging'}elseif($_.BatteryStatus -eq 1){'Discharging'}else{'Unknown'}) }");
    if (result) return `**Battery**\n${result}`;
    return "No battery detected (desktop)";
  } else if (platform === "darwin") {
    const results = await runParallel({
      pct: "pmset -g batt | grep -Eo '\\d+%' | head -1",
      state: "pmset -g batt | grep -Eo 'charging|discharging|charged|AC attached'",
    });
    if (results.pct) return `**Battery**\nLevel: ${results.pct}\nState: ${results.state || "unknown"}`;
    return "No battery detected";
  }

  return "Battery info not available";
}

// ─── Volume ──────────────────────────────────────────────────────

async function getVolume(): Promise<string> {
  const platform = getPlatform();
  if (platform === "linux") {
    const wpctl = await run("wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null");
    if (wpctl) {
      const match = wpctl.match(/Volume:\s+([\d.]+)/);
      const muted = wpctl.includes("[MUTED]");
      if (match?.[1]) return `**Volume**: ${Math.round(parseFloat(match[1]) * 100)}%${muted ? " (muted)" : ""}`;
    }
    const pactl = await run("pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null | grep -oP '\\d+%' | head -1");
    if (pactl) return `**Volume**: ${pactl}`;
    const amixer = await run("amixer get Master 2>/dev/null | grep -o '\\[.*%\\]' | head -1");
    if (amixer) return `**Volume**: ${amixer.replace(/[[\]%]/g, "").trim()}%`;
    return "Could not get volume";
  } else if (platform === "win32") {
    const result = await runPowerShell("(Get-AudioDevice -PlaybackVolume 2>$null) ?? 'N/A'");
    return `**Volume**: ${result || "not available"}`;
  }
  return "Volume control not available";
}

async function setVolume(level: number): Promise<string> {
  const platform = getPlatform();
  if (platform === "linux") {
    await Promise.all([
      run(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${level / 100} 2>/dev/null`),
      run(`pactl set-sink-volume @DEFAULT_SINK@ ${level}% 2>/dev/null`),
      run(`amixer set Master ${level}% 2>/dev/null`),
    ]);
    return `Volume set to **${level}%**`;
  } else if (platform === "win32") {
    await runPowerShell(`$wsh = New-Object -ComObject WScript.Shell; for($i=0;$i -lt 20;$i++){$wsh.SendKeys([char]174)}; for($i=0;$i -lt ${Math.round(level / 5)}; $i++){$wsh.SendKeys([char]175)}`);
    return `Volume set to **${level}%** (approximate)`;
  }
  return "Volume control not available";
}

async function adjustVolume(direction: "up" | "down"): Promise<string> {
  const platform = getPlatform();
  if (platform === "linux") {
    const sign = direction === "up" ? "+" : "-";
    await Promise.all([
      run(`wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%${sign} 2>/dev/null`),
      run(`pactl set-sink-volume @DEFAULT_SINK@ 5%${sign} 2>/dev/null`),
    ]);
    const wpctl = await run("wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null");
    const match = wpctl.match(/Volume:\s+([\d.]+)/);
    if (match?.[1]) return `Volume: **${Math.round(parseFloat(match[1]) * 100)}%**`;
    return `Volume ${direction === "up" ? "increased" : "decreased"}`;
  }
  return `Volume ${direction} not available`;
}

// ─── Brightness ──────────────────────────────────────────────────

async function getBrightness(): Promise<string> {
  const platform = getPlatform();
  if (platform === "linux") {
    const results = await runParallel({
      bctl: "brightnessctl -m 2>/dev/null | cut -d, -f4",
      xbacklight: "xbacklight -get 2>/dev/null",
    });
    if (results.bctl) return `**Brightness**: ${results.bctl}`;
    if (results.xbacklight) return `**Brightness**: ${Math.round(parseFloat(results.xbacklight))}%`;
    return "Could not get brightness";
  } else if (platform === "win32") {
    const result = await runPowerShell("(Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorBrightness).CurrentBrightness");
    if (result) return `**Brightness**: ${result}%`;
    return "Brightness not available";
  }
  return "Brightness not available";
}

async function setBrightness(level: number): Promise<string> {
  const platform = getPlatform();
  if (platform === "linux") {
    await Promise.all([
      run(`brightnessctl set ${level}% 2>/dev/null`),
      run(`xbacklight -set ${level} 2>/dev/null`),
    ]);
    return `Brightness set to **${level}%**`;
  } else if (platform === "win32") {
    await runPowerShell("(Get-CimInstance -Namespace root\\wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${level})");
    return `Brightness set to **${level}%**`;
  }
  return "Brightness control not available";
}

async function adjustBrightness(direction: "up" | "down"): Promise<string> {
  const platform = getPlatform();
  const step = 10;
  if (platform === "linux") {
    const sign = direction === "up" ? "+" : "-";
    await run(`brightnessctl set ${step}%${sign} 2>/dev/null`);
    const current = await run("brightnessctl -m 2>/dev/null | cut -d, -f4");
    if (current) return `Brightness: **${current}**`;
    return `Brightness ${direction === "up" ? "increased" : "decreased"}`;
  }
  return `Brightness ${direction} not available`;
}

// ─── Open / Close Apps ───────────────────────────────────────────

async function openApplication(appName: string): Promise<string> {
  const platform = getPlatform();
  if (!appName) return "What would you like to open?";

  const appMap: Record<string, string> = {
    "vs code": "code", "vscode": "code", "visual studio code": "code",
    "chrome": "google-chrome", "google chrome": "google-chrome",
    "firefox": "firefox", "mozilla": "firefox",
    "terminal": "kitty", "kitty": "kitty",
    "alacritty": "alacritty", "wezterm": "wezterm",
    "nautilus": "nautilus", "thunar": "thunar",
    "files": "thunar", "file manager": "thunar", "explorer": "thunar",
    "settings": "gnome-control-center", "preferences": "gnome-control-center",
    "calculator": "gnome-calculator",
    "spotify": "spotify", "music": "spotify",
    "discord": "discord", "chat": "discord",
    "slack": "slack", "code": "code",
    "browser": "firefox", "web": "firefox", "internet": "firefox",
    "obsidian": "obsidian", "notion": "notion",
    "codeium": "codeium", "zed": "zed",
    "brave": "brave-browser", "brave browser": "brave-browser",
    "thunderbird": "thunderbird", "email": "thunderbird",
    "dolphin": "dolphin", "konsole": "konsole",
    "hyprland": "kitty", "foot": "foot", "warp": "warp",
    "libreoffice": "libreoffice", "office": "libreoffice",
    "gimp": "gimp", "blender": "blender", "vim": "kitty",
    "neovim": "kitty", "nvim": "kitty", "htop": "kitty",
  };

  const resolved = appMap[appName.toLowerCase()] ?? appName;

  if (platform === "linux") {
    const hyprland = runSync("echo $HYPRLAND_INSTANCE_SIGNATURE 2>/dev/null");
    if (hyprland) {
      const existing = runSync(`hyprctl clients -j 2>/dev/null | grep -o '"class":"[^"]*"' | grep -i "${resolved}"`);
      if (existing) {
        run(`hyprctl dispatch focuswindow "class:${resolved}" 2>/dev/null`);
        return `Focused **${appName}** (already running)`;
      }
      run(`hyprctl dispatch exec ${resolved} 2>/dev/null`);
      return `Opened **${appName}**`;
    }
    const which = await run(`which ${resolved} 2>/dev/null`);
    if (which) {
      run(`nohup ${resolved} > /dev/null 2>&1 &`);
      return `Opened **${appName}**`;
    }
    run(`nohup ${appName} > /dev/null 2>&1 &`);
    return `Attempting to open **${appName}**`;
  } else if (platform === "win32") {
    runPowerShell(`Start-Process "${resolved}"`);
    return `Opened **${appName}**`;
  } else if (platform === "darwin") {
    run(`open -a "${appName}"`);
    return `Opened **${appName}**`;
  }

  return `Cannot open ${appName} on this platform`;
}

async function closeApplication(appName: string): Promise<string> {
  const platform = getPlatform();
  if (!appName) return "What would you like to close?";

  if (platform === "linux") {
    const hyprland = runSync("echo $HYPRLAND_INSTANCE_SIGNATURE 2>/dev/null");
    if (hyprland) {
      run(`hyprctl dispatch killactive "class:${appName}" 2>/dev/null`);
      return `Closed **${appName}**`;
    }
    run(`pkill -f "${appName}" 2>/dev/null`);
    return `Closed **${appName}**`;
  } else if (platform === "win32") {
    runPowerShell(`Get-Process -Name "${appName}" -ErrorAction SilentlyContinue | Stop-Process -Force`);
    return `Closed **${appName}**`;
  }
  return `Closed **${appName}**`;
}

// ─── Screenshot ──────────────────────────────────────────────────

async function takeScreenshot(): Promise<string> {
  const platform = getPlatform();
  const path = `/tmp/flux_screenshot_${Date.now()}.png`;

  if (platform === "linux") {
    const hyprland = runSync("echo $HYPRLAND_INSTANCE_SIGNATURE 2>/dev/null");
    if (hyprland) {
      await run(`grim ${path} 2>/dev/null`);
      const exists = await run(`test -f ${path} && echo ok`);
      if (exists === "ok") return `Screenshot saved to \`${path}\``;
      await run(`grimblast copy area 2>/dev/null`);
      return `Screenshot captured (copied to clipboard)`;
    }
    await run(`gnome-screenshot -f ${path} 2>/dev/null || scrot ${path} 2>/dev/null || import -window root ${path} 2>/dev/null`);
    return `Screenshot saved to \`${path}\``;
  } else if (platform === "win32") {
    await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { $bmp = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height); $gfx = [System.Drawing.Graphics]::FromImage($bmp); $gfx.CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size); $bmp.Save('$env:TEMP\\flux_screenshot.png') }`);
    return `Screenshot saved`;
  } else if (platform === "darwin") {
    await run(`screencapture ${path}`);
    return `Screenshot saved to \`${path}\``;
  }
  return "Screenshot not available";
}

// ─── Power Actions ───────────────────────────────────────────────

async function shutdown(): Promise<string> {
  const platform = getPlatform();
  if (platform === "linux") {
    run("systemctl poweroff 2>/dev/null");
    return "Shutting down...";
  } else if (platform === "win32") {
    runPowerShell("Stop-Computer -Force");
    return "Shutting down...";
  }
  return "Shutdown not available";
}

async function restart(): Promise<string> {
  const platform = getPlatform();
  if (platform === "linux") {
    run("systemctl reboot 2>/dev/null");
    return "Restarting...";
  } else if (platform === "win32") {
    runPowerShell("Restart-Computer -Force");
    return "Restarting...";
  }
  return "Restart not available";
}

async function suspend(): Promise<string> {
  const platform = getPlatform();
  if (platform === "linux") {
    run("systemctl suspend 2>/dev/null");
    return "System **suspending**...";
  } else if (platform === "win32") {
    runPowerShell("rundll32.exe powrprof.dll,SetSuspendState 0,1,0");
    return "System **suspending**...";
  }
  return "Suspend not available";
}

async function lockScreen(): Promise<string> {
  const platform = getPlatform();
  if (platform === "linux") {
    const hyprland = runSync("echo $HYPRLAND_INSTANCE_SIGNATURE 2>/dev/null");
    if (hyprland) {
      run("hyprlock 2>/dev/null || loginctl lock-session 2>/dev/null");
      return "Screen **locked**";
    }
    run("loginctl lock-session 2>/dev/null || gnome-screensaver-command -l 2>/dev/null || xdg-screensaver lock 2>/dev/null");
    return "Screen **locked**";
  } else if (platform === "win32") {
    runPowerShell("rundll32.exe user32.dll,LockWorkStation");
    return "Screen **locked**";
  } else if (platform === "darwin") {
    run("/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend");
    return "Screen **locked**";
  }
  return "Lock not available";
}

// ─── System Info ─────────────────────────────────────────────────

async function getSystemInfo(): Promise<string> {
  const platform = getPlatform();
  const parts: string[] = ["**System Information**"];

  if (platform === "linux") {
    const results = await runParallel({
      hostname: "hostname",
      uptime: "uptime -p",
      cpuModel: "grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2",
      cpuCores: "nproc",
      memTotal: "grep MemTotal /proc/meminfo | awk '{print $2}'",
      memAvail: "grep MemAvailable /proc/meminfo | awk '{print $2}'",
      disk: "df -h / | tail -1 | awk '{print $3\"/\"$2\" (\"$5\" used)\"}'",
      kernel: "uname -r",
      osName: "cat /etc/os-release 2>/dev/null | grep '^PRETTY_NAME' | cut -d'\"' -f2",
      desktop: "echo $XDG_CURRENT_DESKTOP",
      wayland: "echo $WAYLAND_DISPLAY",
      de: "echo $DESKTOP_SESSION",
    });

    if (results.osName) parts.push(`OS: ${results.osName}`);
    if (results.hostname) parts.push(`Hostname: ${results.hostname}`);
    if (results.desktop) parts.push(`Desktop: ${results.desktop}`);
    if (results.wayland) parts.push(`Wayland: ${results.wayland}`);
    if (results.de) parts.push(`Session: ${results.de}`);
    if (results.kernel) parts.push(`Kernel: ${results.kernel}`);
    if (results.uptime) parts.push(`Uptime: ${results.uptime}`);
    if (results.cpuModel) parts.push(`CPU: ${results.cpuModel.trim()} (${results.cpuCores} cores)`);
    if (results.memTotal && results.memAvail) {
      const totalMB = Math.round(parseInt(results.memTotal) / 1024);
      const availMB = Math.round(parseInt(results.memAvail) / 1024);
      const usedMB = totalMB - availMB;
      const pct = Math.round((usedMB / totalMB) * 100);
      parts.push(`Memory: ${usedMB}MB / ${totalMB}MB (${pct}%)`);
    }
    if (results.disk) parts.push(`Disk: ${results.disk}`);
  } else if (platform === "win32") {
    const results = await runParallel({
      hostname: '$env:COMPUTERNAME',
      os: "(Get-CimInstance Win32_OperatingSystem).Caption",
      cpu: "(Get-CimInstance Win32_Processor).Name",
      mem: "$os = Get-CimInstance Win32_OperatingSystem; [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory)/1MB, 2)",
      memTotal: "[math]::Round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize/1MB, 2)",
      uptime: "(Get-CimInstance Win32_OperatingSystem).LocalDateTime - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime | ForEach-Object { '{0}d {1}h {2}m' -f $_.Days,$_.Hours,$_.Minutes }",
    });

    if (results.os) parts.push(`OS: ${results.os}`);
    if (results.hostname) parts.push(`Hostname: ${results.hostname}`);
    if (results.cpu) parts.push(`CPU: ${results.cpu}`);
    if (results.mem && results.memTotal) parts.push(`Memory: ${results.mem}GB / ${results.memTotal}GB`);
    if (results.uptime) parts.push(`Uptime: ${results.uptime}`);
  } else if (platform === "darwin") {
    const results = await runParallel({
      hostname: "hostname",
      os: "sw_vers -productVersion",
      uptime: "uptime -p",
      memTotal: "sysctl -n hw.memsize",
    });
    if (results.hostname) parts.push(`Hostname: ${results.hostname}`);
    if (results.os) parts.push(`macOS: ${results.os}`);
    if (results.uptime) parts.push(`Uptime: ${results.uptime}`);
    if (results.memTotal) parts.push(`Memory: ${Math.round(parseInt(results.memTotal) / 1024 / 1024)}MB total`);
  }

  return parts.join("\n");
}

// ─── Service ─────────────────────────────────────────────────────

export function createSystemService(): Service {
  return {
    name: "system",
    description: "Advanced system control: apps, volume, brightness, WiFi, Bluetooth, clipboard, processes, media, shortcuts, night light, DND, workspaces, network, screenshots, power",

    async canHandle(input: string): Promise<boolean> {
      const clean = cleanInput(input);
      const keywords = [
        "open", "close", "launch", "start", "run",
        "volume", "brightness", "battery", "wifi", "bluetooth",
        "shutdown", "restart", "reboot", "sleep", "lock", "suspend",
        "screenshot", "system info", "hostname", "uptime",
        "cpu", "memory", "disk", "platform", "kernel",
        "mute", "unmute", "dim", "brighten", "charge",
        "what's my", "what is my", "how much", "power off",
        "screen", "display", "sound", "audio",
        "clipboard", "copy", "paste",
        "process", "kill", "task manager",
        "play", "pause", "next", "prev", "media", "music", "song",
        "shortcut", "hotkey", "press", "key",
        "night light", "blue light", "dnd", "do not disturb",
        "workspace", "desktop", "virtual desktop",
        "network", "ip address", "dns", "interface",
        "scan", "pair", "connect", "disconnect",
      ];
      return keywords.some((k) => clean.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const intent = parseIntent(input);
      let result: string;

      switch (intent.action) {
        // ── WiFi ──
        case "wifi_status": result = await getWifiStatus(); break;
        case "wifi_scan": result = await scanWifi(); break;
        case "wifi_connect": result = await connectWifi(intent.target); break;
        case "wifi_disconnect": result = await disconnectWifi(); break;
        case "wifi_on": result = await setWifi(true); break;
        case "wifi_off": result = await setWifi(false); break;
        case "wifi_forget": result = await forgetWifi(intent.target); break;

        // ── Bluetooth ──
        case "bt_status": result = await getBluetoothStatus(); break;
        case "bt_scan": result = await scanBluetooth(); break;
        case "bt_pair": result = await pairBluetooth(intent.target); break;
        case "bt_disconnect": result = await disconnectBluetooth(intent.target); break;
        case "bt_on": result = await setBluetooth(true); break;
        case "bt_off": result = await setBluetooth(false); break;

        // ── Clipboard ──
        case "clip_read": result = await readClipboard(); break;
        case "clip_copy": result = await copyToClipboard(intent.target ?? ""); break;
        case "clip_paste": result = await readClipboard(); break;
        case "clip_clear": result = await clearClipboard(); break;

        // ── Process Management ──
        case "proc_list": result = await listProcesses(); break;
        case "proc_top": result = await topProcesses(); break;
        case "proc_search": result = await searchProcess(intent.target); break;
        case "proc_kill": result = await killProcess(intent.target); break;

        // ── Media ──
        case "media_play":
        case "media_pause":
        case "media_next":
        case "media_prev":
        case "media_shuffle":
        case "media_repeat":
        case "media_now":
          result = await mediaControl(intent.action.replace("media_", "")); break;

        // ── Keyboard ──
        case "key_press": result = await pressKey(intent.target); break;

        // ── Night Light ──
        case "nightlight_toggle":
        case "nightlight_on":
        case "nightlight_off":
          result = await nightLightToggle(); break;

        // ── DND ──
        case "dnd_toggle": result = await dndToggle(); break;
        case "dnd_on": result = await dndSet(true); break;
        case "dnd_off": result = await dndSet(false); break;

        // ── Workspace ──
        case "ws_left":
        case "ws_right":
        case "ws_goto":
        case "ws_list":
          result = await workspaceAction(intent.action, intent.target); break;

        // ── Network ──
        case "net_ip": result = await getNetworkInfo(); break;
        case "net_public_ip": result = await getPublicIp(); break;
        case "net_dns": result = await getDns(); break;
        case "net_interfaces": result = await getNetworkInterfaces(); break;

        // ── Existing features ──
        case "battery": result = await getBattery(); break;
        case "volume_get": result = await getVolume(); break;
        case "volume_set": result = await setVolume(Math.min(100, Math.max(0, intent.value ?? 50))); break;
        case "volume_adjust": result = await adjustVolume((intent.direction ?? "up") as "up" | "down"); break;
        case "volume_mute":
          await Promise.all([
            run("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle 2>/dev/null"),
            run("pactl set-sink-mute @DEFAULT_SINK@ toggle 2>/dev/null"),
          ]);
          result = "Volume **toggled**";
          break;
        case "brightness_get": result = await getBrightness(); break;
        case "brightness_set": result = await setBrightness(Math.min(100, Math.max(0, intent.value ?? 50))); break;
        case "brightness_adjust": result = await adjustBrightness((intent.direction ?? "up") as "up" | "down"); break;
        case "system_info": result = await getSystemInfo(); break;
        case "open": result = await openApplication(intent.target ?? ""); break;
        case "close": result = await closeApplication(intent.target ?? ""); break;
        case "screenshot": result = await takeScreenshot(); break;
        case "shutdown": result = await shutdown(); break;
        case "restart": result = await restart(); break;
        case "suspend": result = await suspend(); break;
        case "lock": result = await lockScreen(); break;
        default:
          result = `I can help with:\n• **Apps**: open/close/launch\n• **Audio**: volume, mute, media play/pause/next/prev\n• **Display**: brightness, night light\n• **WiFi**: scan, connect, disconnect, on/off\n• **Bluetooth**: scan, pair, connect, on/off\n• **Clipboard**: read, copy, paste, clear\n• **Processes**: list, top, search, kill\n• **Keyboard**: shortcuts (Ctrl+C, Alt+Tab, etc.)\n• **Workspaces**: switch left/right/goto\n• **Network**: IP, DNS, interfaces\n• **DND**: do not disturb toggle\n• **System**: info, screenshot, battery\n• **Power**: shutdown, restart, sleep, lock\n\nWhat would you like to do?`;
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}
