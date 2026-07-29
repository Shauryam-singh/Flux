import { exec, execSync } from "node:child_process";
import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

function getPlatform(): "linux" | "win32" | "darwin" {
  return process.platform as "linux" | "win32" | "darwin";
}

async function run(command: string): Promise<string> {
  return new Promise((resolve) => {
    exec(command, { encoding: "utf-8", timeout: 10000 }, (err, stdout) => {
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

// Run multiple commands in parallel
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

// Strip filler words and extract the core intent
function cleanInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/^(hey|hi|yo|ok|okay|alright|so|well|please|can you|could you|would you|wouldya|wanna|gonna|gotta|i want to|i'd like to|let's|let me|help me|flux)\s*/i, "")
    .replace(/\s*(please|thanks|thank you|thx|bro|dude|man|buddy|friend|bhai)\s*$/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

interface ParsedIntent {
  action: string;
  target?: string;
  value?: number;
  direction?: "up" | "down";
}

function parseIntent(input: string): ParsedIntent {
  const raw = input.toLowerCase().trim();
  const clean = cleanInput(raw);

  // ─── Battery ───
  if (/battery|charge|power level|how (much|much juice)|am i (plugged|charging)/.test(clean)) {
    return { action: "battery" };
  }

  // ─── Volume ───
  if (/volume|sound|audio|mute|unmute|too (loud|quiet|noisy)/.test(clean)) {
    const setMatch = clean.match(/(?:set|change|adjust|make|put)\s+(?:the\s+)?(?:volume\s+)?(?:to\s+)?(\d+)/);
    if (setMatch?.[1]) return { action: "volume_set", value: parseInt(setMatch[1]) };

    if (/mute|shut (up|it)|silent|silence/.test(clean)) {
      return { action: "volume_mute" };
    }
    if (/unmute|turn (on|up)|sound on/.test(clean)) {
      return { action: "volume_mute" }; // toggle
    }
    if (/up|louder|increase|higher|more|blast|max/.test(clean)) {
      if (/max|full|100|all (the )?way/.test(clean)) return { action: "volume_set", value: 100 };
      return { action: "volume_adjust", direction: "up" };
    }
    if (/down|quieter|decrease|lower|less|softer|min/.test(clean)) {
      if (/min|mute|0|zero/.test(clean)) return { action: "volume_set", value: 0 };
      return { action: "volume_adjust", direction: "down" };
    }
    // "how's volume", "what's the volume", "volume?"
    return { action: "volume_get" };
  }

  // ─── Brightness ───
  if (/brightness|screen (bright|dim)|display|too (bright|dark|dim)/.test(clean)) {
    const setMatch = clean.match(/(?:set|change|adjust|make|put)\s+(?:the\s+)?(?:brightness\s+)?(?:to\s+)?(\d+)/);
    if (setMatch?.[1]) return { action: "brightness_set", value: parseInt(setMatch[1]) };

    if (/dim|lower|down|decrease|less|darker|dark/.test(clean)) {
      return { action: "brightness_adjust", direction: "down" };
    }
    if (/bright|up|increase|more|higher|lighter|light/.test(clean)) {
      return { action: "brightness_adjust", direction: "up" };
    }
    return { action: "brightness_get" };
  }

  // ─── System Info ───
  if (/system\s*(info|status|details|specs)|what('?s| is)\s+(my\s+)?(os|system|computer|laptop|machine|setup)|hostname|uptime|cpu|memory|ram|disk|kernel|platform|what am i (running|using)/.test(clean)) {
    return { action: "system_info" };
  }

  // ─── Screenshot ───
  if (/screenshot|screen\s*shot|capture|take\s*(a\s+)?(pic|picture|photo|snap)|snip/.test(clean)) {
    return { action: "screenshot" };
  }

  // ─── Power ───
  if (/shutdown|power\s*off|turn\s*(it\s+)?off|shut\s*(it\s+)?down/.test(clean)) return { action: "shutdown" };
  if (/restart|reboot|reload/.test(clean)) return { action: "restart" };
  if (/sleep|suspend|hibernate|nap/.test(clean)) return { action: "suspend" };
  if (/lock|lock\s*screen|secure/.test(clean)) return { action: "lock" };

  // ─── Close app (must check before open) ───
  if (/\b(close|quit|exit|kill|stop|shut)\b/.test(clean)) {
    const app = extractAppName(clean, /\b(close|quit|exit|kill|stop|shut)\b/);
    return { action: "close", target: app };
  }

  // ─── Open app (flexible — "open kitty", "can you open kitty", "launch kitty for me") ───
  if (/\b(open|launch|start|run|fire up|boot up|spin up|load|bring up|pull up|show me|switch to)\b/.test(clean)) {
    const app = extractAppName(clean, /\b(open|launch|start|run|fire up|boot up|spin up|load|bring up|pull up|show me|switch to)\b/);
    return { action: "open", target: app };
  }

  // ─── Fuzzy app detection: "kitty", "firefox", "vscode" as standalone words ───
  const knownApps = ["kitty", "firefox", "chrome", "code", "vscode", "spotify", "discord", "slack", "thunar", "nautilus", "alacritty", "wezterm", "terminal", "settings", "calculator", "file manager", "browser", "explorer"];
  for (const app of knownApps) {
    // Match as whole word (not inside another word)
    const regex = new RegExp(`\\b${app}\\b`, "i");
    if (regex.test(clean) && !clean.match(/^(what|how|where|when|why|which)/)) {
      return { action: "open", target: app };
    }
  }

  return { action: "unknown" };
}

// Extract app name after a keyword, stripping filler words
function extractAppName(input: string, keywordRegex: RegExp): string {
  // Remove everything before and including the keyword
  const afterKeyword = input.split(keywordRegex).pop() ?? "";
  // Strip filler words
  return afterKeyword
    .replace(/\b(the|my|a|an|for me|please|thanks|right now|real quick|real fast)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── System Info (parallel) ───

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

// ─── Battery (parallel probes) ───

async function getBattery(): Promise<string> {
  const platform = getPlatform();

  if (platform === "linux") {
    // Try multiple sources in parallel
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

// ─── Volume (PipeWire / PulseAudio / ALSA) ───

async function getVolume(): Promise<string> {
  const platform = getPlatform();
  if (platform === "linux") {
    // PipeWire first
    const wpctl = await run("wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null");
    if (wpctl) {
      const match = wpctl.match(/Volume:\s+([\d.]+)/);
      const muted = wpctl.includes("[MUTED]");
      if (match?.[1]) {
        return `**Volume**: ${Math.round(parseFloat(match[1]) * 100)}%${muted ? " (muted)" : ""}`;
      }
    }
    // PulseAudio
    const pactl = await run("pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null | grep -oP '\\d+%' | head -1");
    if (pactl) return `**Volume**: ${pactl}`;
    // ALSA
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
    // Run all backends in parallel (only the active one will work)
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
    // Read back actual level
    const wpctl = await run("wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null");
    const match = wpctl.match(/Volume:\s+([\d.]+)/);
    if (match?.[1]) return `Volume: **${Math.round(parseFloat(match[1]) * 100)}%**`;
    return `Volume ${direction === "up" ? "increased" : "decreased"}`;
  }
  return `Volume ${direction} not available`;
}

// ─── Brightness ───

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

// ─── Open / Close Apps ───

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
  };

  const resolved = appMap[appName.toLowerCase()] ?? appName;

  if (platform === "linux") {
    const hyprland = runSync("echo $HYPRLAND_INSTANCE_SIGNATURE 2>/dev/null");
    if (hyprland) {
      // Check if already running, if so focus it
      const existing = runSync(`hyprctl clients -j 2>/dev/null | grep -o '"class":"[^"]*"' | grep -i "${resolved}"`);
      if (existing) {
        run(`hyprctl dispatch focuswindow "class:${resolved}" 2>/dev/null`);
        return `Focused **${appName}** (already running)`;
      }
      run(`hyprctl dispatch exec ${resolved} 2>/dev/null`);
      return `Opened **${appName}**`;
    }
    // Check if exists
    const which = await run(`which ${resolved} 2>/dev/null`);
    if (which) {
      run(`nohup ${resolved} > /dev/null 2>&1 &`);
      return `Opened **${appName}**`;
    }
    // Try as-is
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

// ─── Screenshot ───

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

// ─── Power Actions ───

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

// ─── Service ───

export function createSystemService(): Service {
  return {
    name: "system",
    description: "System control: open/close apps, volume, brightness, battery, WiFi, system info, screenshots, shutdown, restart",

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
      ];
      return keywords.some((k) => clean.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const intent = parseIntent(input);
      let result: string;

      switch (intent.action) {
        case "battery":
          result = await getBattery();
          break;
        case "volume_get":
          result = await getVolume();
          break;
        case "volume_set":
          result = await setVolume(Math.min(100, Math.max(0, intent.value ?? 50)));
          break;
        case "volume_adjust":
          result = await adjustVolume((intent.direction ?? "up") as "up" | "down");
          break;
        case "volume_mute":
          await Promise.all([
            run("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle 2>/dev/null"),
            run("pactl set-sink-mute @DEFAULT_SINK@ toggle 2>/dev/null"),
          ]);
          result = "Volume **toggled**";
          break;
        case "brightness_get":
          result = await getBrightness();
          break;
        case "brightness_set":
          result = await setBrightness(Math.min(100, Math.max(0, intent.value ?? 50)));
          break;
        case "brightness_adjust":
          result = await adjustBrightness((intent.direction ?? "up") as "up" | "down");
          break;
        case "system_info":
          result = await getSystemInfo();
          break;
        case "open":
          result = await openApplication(intent.target ?? "");
          break;
        case "close":
          result = await closeApplication(intent.target ?? "");
          break;
        case "screenshot":
          result = await takeScreenshot();
          break;
        case "shutdown":
          result = await shutdown();
          break;
        case "restart":
          result = await restart();
          break;
        case "suspend":
          result = await suspend();
          break;
        case "lock":
          result = await lockScreen();
          break;
        default:
          result = `I can help with: open/close apps, volume, brightness, battery, system info, screenshots, shutdown/restart/sleep/lock. What would you like to do?`;
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}
