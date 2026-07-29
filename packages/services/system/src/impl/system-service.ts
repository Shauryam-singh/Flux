import { execSync } from "node:child_process";
import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

function getPlatform(): "linux" | "win32" | "darwin" {
  return process.platform as "linux" | "win32" | "darwin";
}

function run(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8", timeout: 10000 }).trim();
  } catch {
    return "";
  }
}

function runPowerShell(command: string): string {
  return run(`powershell -Command "${command}"`);
}

// ─── System Info ───

function getSystemInfo(): string {
  const platform = getPlatform();
  const parts: string[] = ["**System Information**"];

  if (platform === "linux") {
    const hostname = run("hostname");
    const uptime = run("uptime -p");
    const cpuModel = run("grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2");
    const cpuCores = run("nproc");
    const memTotal = run("grep MemTotal /proc/meminfo | awk '{print $2}'");
    const memAvail = run("grep MemAvailable /proc/meminfo | awk '{print $2}'");
    const diskUsage = run("df -h / | tail -1 | awk '{print $3\"/\"$2\" (\"$5\" used)\"}'");
    const kernelVersion = run("uname -r");
    const osName = run("cat /etc/os-release 2>/dev/null | grep '^PRETTY_NAME' | cut -d'\"' -f2");
    const desktop = run("echo $XDG_CURRENT_DESKTOP");
    const compositor = run("echo $WAYLAND_DISPLAY");

    if (osName) parts.push(`OS: ${osName}`);
    if (hostname) parts.push(`Hostname: ${hostname}`);
    if (desktop) parts.push(`Desktop: ${desktop}`);
    if (compositor) parts.push(`Wayland: ${compositor}`);
    if (kernelVersion) parts.push(`Kernel: ${kernelVersion}`);
    if (uptime) parts.push(`Uptime: ${uptime}`);
    if (cpuModel) parts.push(`CPU: ${cpuModel.trim()} (${cpuCores} cores)`);
    if (memTotal && memAvail) {
      const totalMB = Math.round(parseInt(memTotal) / 1024);
      const availMB = Math.round(parseInt(memAvail) / 1024);
      const usedMB = totalMB - availMB;
      const pct = Math.round((usedMB / totalMB) * 100);
      parts.push(`Memory: ${usedMB}MB / ${totalMB}MB (${pct}%)`);
    }
    if (diskUsage) parts.push(`Disk: ${diskUsage}`);
  } else if (platform === "win32") {
    const hostname = runPowerShell("$env:COMPUTERNAME");
    const osCaption = runPowerShell("(Get-CimInstance Win32_OperatingSystem).Caption");
    const cpuName = runPowerShell("(Get-CimInstance Win32_Processor).Name");
    const mem = runPowerShell("$os = Get-CimInstance Win32_OperatingSystem; [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory)/1MB, 2)");
    const memTotal = runPowerShell("[math]::Round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize/1MB, 2)");
    const uptime = runPowerShell("(Get-CimInstance Win32_OperatingSystem).LocalDateTime - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime | ForEach-Object { '{0}d {1}h {2}m' -f $_.Days,$_.Hours,$_.Minutes }");

    if (osCaption) parts.push(`OS: ${osCaption}`);
    if (hostname) parts.push(`Hostname: ${hostname}`);
    if (cpuName) parts.push(`CPU: ${cpuName}`);
    if (mem && memTotal) parts.push(`Memory: ${mem}GB / ${memTotal}GB`);
    if (uptime) parts.push(`Uptime: ${uptime}`);
  } else if (platform === "darwin") {
    const hostname = run("hostname");
    const osVers = run("sw_vers -productVersion");
    const uptime = run("uptime -p");
    const memTotal = run("sysctl -n hw.memsize");
    if (hostname) parts.push(`Hostname: ${hostname}`);
    if (osVers) parts.push(`macOS: ${osVers}`);
    if (uptime) parts.push(`Uptime: ${uptime}`);
    if (memTotal) parts.push(`Memory: ${Math.round(parseInt(memTotal) / 1024 / 1024)}MB total`);
  }

  return parts.join("\n");
}

// ─── Battery ───

function getBattery(): string {
  const platform = getPlatform();

  if (platform === "linux") {
    // Try upower first (works on most systemd systems)
    const upower = run("upower -i /org/freedesktop/UPower/devices/battery_BAT0 2>/dev/null");
    if (upower) {
      const level = upower.match(/percentage:\s+(\d+%)/)?.[1] ?? "";
      const state = upower.match(/state:\s+(\w+)/)?.[1] ?? "";
      const time = upower.match(/time to (?:empty|full):\s+(.+)/)?.[1] ?? "";
      const parts = [`**Battery**`];
      if (level) parts.push(`Level: ${level}`);
      if (state) parts.push(`State: ${state}`);
      if (time) parts.push(`Time to ${state === "charging" ? "full" : "empty"}: ${time}`);
      return parts.join("\n");
    }

    // Try /sys/class/power_supply
    const batPath = "/sys/class/power_supply/BAT0";
    const batNow = run(`cat ${batPath}/capacity 2>/dev/null`);
    const batStatus = run(`cat ${batPath}/status 2>/dev/null`);
    if (batNow) {
      const parts = [`**Battery**`];
      parts.push(`Level: ${batNow}%`);
      if (batStatus) parts.push(`State: ${batStatus}`);
      return parts.join("\n");
    }

    // acpi
    const acpi = run("acpi 2>/dev/null");
    if (acpi) {
      const match = acpi.match(/Battery 0: (.*?), (\d+%), (.*)/);
      if (match) {
        return `**Battery**\nLevel: ${match[2]}%\nState: ${match[3]}`;
      }
    }

    return "No battery detected";
  } else if (platform === "win32") {
    const result = runPowerShell("(Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus) | ForEach-Object { 'Level: ' + $_.EstimatedChargeRemaining + '%'; 'State: ' + (if($_.BatteryStatus -eq 2){'Charging'}elseif($_.BatteryStatus -eq 1){'Discharging'}else{'Unknown'}) }");
    if (result) return `**Battery**\n${result}`;
    return "No battery detected (desktop)";
  } else if (platform === "darwin") {
    const pct = run("pmset -g batt | grep -Eo '\\d+%' | head -1");
    const state = run("pmset -g batt | grep -Eo 'charging|discharging|charged|AC attached'");
    if (pct) return `**Battery**\nLevel: ${pct}\nState: ${state || "unknown"}`;
    return "No battery detected";
  }

  return "Battery info not available";
}

// ─── Volume (PipeWire / PulseAudio / ALSA) ───

function getVolume(): string {
  const platform = getPlatform();
  if (platform === "linux") {
    // PipeWire (wpctl)
    const wpctl = run("wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null");
    if (wpctl) {
      const match = wpctl.match(/Volume:\s+([\d.]+)/);
      const muted = wpctl.includes("[MUTED]");
      if (match?.[1]) {
        const pct = Math.round(parseFloat(match[1]) * 100);
        return `**Volume**: ${pct}%${muted ? " (muted)" : ""}`;
      }
    }
    // PulseAudio (pactl)
    const pactl = run("pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null | grep -oP '\\d+%' | head -1");
    if (pactl) return `**Volume**: ${pactl}`;
    // ALSA fallback
    const amixer = run("amixer get Master 2>/dev/null | grep -o '\\[.*%\\]' | head -1");
    if (amixer) return `**Volume**: ${amixer.replace(/[[\]%]/g, "").trim()}%`;
    return "Could not get volume";
  } else if (platform === "win32") {
    const result = runPowerShell("(Get-AudioDevice -PlaybackVolume 2>$null) ?? (Get-CimInstance -Namespace root\\wmi -ClassName MSAudio_DeviceMute 2>$null)");
    if (result) return `**Volume**: ${result}`;
    return "Volume control not available";
  }
  return "Volume control not available on this platform";
}

function setVolume(level: number): string {
  const platform = getPlatform();
  if (platform === "linux") {
    // PipeWire
    run(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${level / 100} 2>/dev/null`);
    // PulseAudio fallback
    run(`pactl set-sink-volume @DEFAULT_SINK@ ${level}% 2>/dev/null`);
    // ALSA fallback
    run(`amixer set Master ${level}% 2>/dev/null`);
    return `Volume set to **${level}%**`;
  } else if (platform === "win32") {
    runPowerShell(`$wsh = New-Object -ComObject WScript.Shell; for($i=0;$i -lt 20;$i++){$wsh.SendKeys([char]174)}; for($i=0;$i -lt ${Math.round(level / 5)}; $i++){$wsh.SendKeys([char]175)}`);
    return `Volume set to **${level}%** (approximate)`;
  }
  return "Volume control not available";
}

function adjustVolume(direction: "up" | "down"): string {
  const platform = getPlatform();
  const step = 5;
  if (platform === "linux") {
    if (direction === "up") {
      run("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%+ 2>/dev/null");
      run("pactl set-sink-volume @DEFAULT_SINK@ +5% 2>/dev/null");
    } else {
      run("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%- 2>/dev/null");
      run("pactl set-sink-volume @DEFAULT_SINK@ -5% 2>/dev/null");
    }
    // Read back
    const wpctl = run("wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null");
    const match = wpctl.match(/Volume:\s+([\d.]+)/);
    if (match?.[1]) return `Volume: **${Math.round(parseFloat(match[1]) * 100)}%**`;
    return `Volume ${direction === "up" ? "increased" : "decreased"}`;
  }
  return `Volume ${direction} not available on this platform`;
}

// ─── Brightness ───

function getBrightness(): string {
  const platform = getPlatform();
  if (platform === "linux") {
    const result = run("brightnessctl -m 2>/dev/null | cut -d, -f4");
    if (result) return `**Brightness**: ${result}`;
    // xbacklight fallback (X11)
    const xb = run("xbacklight -get 2>/dev/null");
    if (xb) return `**Brightness**: ${Math.round(parseFloat(xb))}%`;
    return "Could not get brightness";
  } else if (platform === "win32") {
    const result = runPowerShell("(Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorBrightness).CurrentBrightness");
    if (result) return `**Brightness**: ${result}%`;
    return "Brightness not available";
  }
  return "Brightness not available on this platform";
}

function setBrightness(level: number): string {
  const platform = getPlatform();
  if (platform === "linux") {
    run(`brightnessctl set ${level}% 2>/dev/null`);
    run(`xbacklight -set ${level} 2>/dev/null`);
    return `Brightness set to **${level}%**`;
  } else if (platform === "win32") {
    runPowerShell("(Get-CimInstance -Namespace root\\wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${level})");
    return `Brightness set to **${level}%**`;
  }
  return "Brightness control not available";
}

function adjustBrightness(direction: "up" | "down"): string {
  const platform = getPlatform();
  const step = 10;
  if (platform === "linux") {
    if (direction === "up") {
      run(`brightnessctl set +${step}% 2>/dev/null`);
    } else {
      run(`brightnessctl set ${step}%- 2>/dev/null`);
    }
    const current = run("brightnessctl -m 2>/dev/null | cut -d, -f4");
    if (current) return `Brightness: **${current}**`;
    return `Brightness ${direction === "up" ? "increased" : "decreased"}`;
  }
  return `Brightness ${direction} not available`;
}

// ─── Open / Close Apps ───

function openApplication(input: string): string {
  const platform = getPlatform();
  const app = input
    .replace(/^(open|launch|start|run)\s*/i, "")
    .trim();

  if (!app) return "What would you like to open?";

  const appMap: Record<string, string> = {
    "vs code": "code",
    "vscode": "code",
    "visual studio code": "code",
    "chrome": "google-chrome",
    "firefox": "firefox",
    "terminal": "kitty",
    "kitty": "kitty",
    "alacritty": "alacritty",
    "wezterm": "wezterm",
    "nautilus": "nautilus",
    "thunar": "thunar",
    "files": "nautilus",
    "settings": "gnome-control-center",
    "calculator": "gnome-calculator",
    "spotify": "spotify",
    "discord": "discord",
    "slack": "slack",
    "code": "code",
    "browser": "firefox",
    "file manager": "thunar",
    "explorer": "thunar",
  };

  const resolved = appMap[app.toLowerCase()] ?? app;

  if (platform === "linux") {
    // Hyprland: use hyprctl to dispatch
    const hyprland = run("echo $HYPRLAND_INSTANCE_SIGNATURE 2>/dev/null");
    if (hyprland) {
      run(`hyprctl dispatch exec ${resolved} 2>/dev/null`);
      return `Opened **${app}**`;
    }
    const result = run(`which ${resolved} 2>/dev/null`);
    if (result) {
      run(`nohup ${resolved} > /dev/null 2>&1 &`);
      return `Opened **${app}**`;
    }
    run(`nohup ${app} > /dev/null 2>&1 &`);
    return `Attempting to open **${app}**`;
  } else if (platform === "win32") {
    runPowerShell(`Start-Process "${resolved}"`);
    return `Opened **${app}**`;
  } else if (platform === "darwin") {
    run(`open -a "${app}"`);
    return `Opened **${app}**`;
  }

  return `Cannot open ${app} on this platform`;
}

function closeApplication(input: string): string {
  const platform = getPlatform();
  const app = input
    .replace(/^(close|quit|kill)\s*/i, "")
    .trim();

  if (!app) return "What would you like to close?";

  if (platform === "linux") {
    const hyprland = run("echo $HYPRLAND_INSTANCE_SIGNATURE 2>/dev/null");
    if (hyprland) {
      run(`hyprctl dispatch killactive ${app} 2>/dev/null`);
      return `Closed **${app}**`;
    }
    run(`pkill -f "${app}" 2>/dev/null`);
    return `Closed **${app}**`;
  } else if (platform === "win32") {
    runPowerShell(`Get-Process -Name "${app}" -ErrorAction SilentlyContinue | Stop-Process -Force`);
    return `Closed **${app}**`;
  }
  return `Closed **${app}**`;
}

// ─── Screenshot ───

function takeScreenshot(): string {
  const platform = getPlatform();
  const path = `/tmp/flux_screenshot_${Date.now()}.png`;

  if (platform === "linux") {
    const hyprland = run("echo $HYPRLAND_INSTANCE_SIGNATURE 2>/dev/null");
    if (hyprland) {
      run(`grim ${path} 2>/dev/null`);
      if (run(`test -f ${path} && echo ok`) === "ok") {
        return `Screenshot saved to \`${path}\``;
      }
      // grimblast fallback
      run(`grimblast copy area 2>/dev/null`);
      return `Screenshot captured (copied to clipboard)`;
    }
    run(`gnome-screenshot -f ${path} 2>/dev/null || scrot ${path} 2>/dev/null || import -window root ${path} 2>/dev/null`);
    return `Screenshot saved to \`${path}\``;
  } else if (platform === "win32") {
    const winPath = `$env:TEMP\\flux_screenshot_${Date.now()}.png`;
    runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { $bmp = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height); $gfx = [System.Drawing.Graphics]::FromImage($bmp); $gfx.CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size); $bmp.Save('${winPath}') }`);
    return `Screenshot saved`;
  } else if (platform === "darwin") {
    run(`screencapture ${path}`);
    return `Screenshot saved to \`${path}\``;
  }
  return "Screenshot not available";
}

// ─── Power Actions ───

function shutdown(): string {
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

function restart(): string {
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

function suspend(): string {
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

function lockScreen(): string {
  const platform = getPlatform();
  if (platform === "linux") {
    // Hyprland
    const hyprland = run("echo $HYPRLAND_INSTANCE_SIGNATURE 2>/dev/null");
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

// ─── Natural Language Intent Matching ───

interface ParsedIntent {
  action: string;
  target?: string;
  value?: number;
  direction?: "up" | "down";
}

function parseIntent(input: string): ParsedIntent {
  const lower = input.toLowerCase();

  // Battery
  if (/battery|charge|power level/.test(lower)) {
    return { action: "battery" };
  }

  // Volume
  if (/volume|sound|audio|mute|unmute/.test(lower)) {
    const setMatch = lower.match(/(?:set|change|adjust|make)\s+(?:volume\s+)?(?:to\s+)?(\d+)/);
    if (setMatch?.[1]) return { action: "volume_set", value: parseInt(setMatch[1]) };

    if (/mute|unmute/.test(lower)) {
      return { action: "volume_mute" };
    }
    if (/up|louder|increase|higher|more/.test(lower)) {
      return { action: "volume_adjust", direction: "up" };
    }
    if (/down|quieter|decrease|lower|less/.test(lower)) {
      return { action: "volume_adjust", direction: "down" };
    }
    return { action: "volume_get" };
  }

  // Brightness
  if (/brightness|screen brightness|display brightness|dim|brighten/.test(lower)) {
    const setMatch = lower.match(/(?:set|change|adjust|make)\s+(?:brightness\s+)?(?:to\s+)?(\d+)/);
    if (setMatch?.[1]) return { action: "brightness_set", value: parseInt(setMatch[1]) };

    if (/dim|lower|down|decrease|less|darker/.test(lower)) {
      return { action: "brightness_adjust", direction: "down" };
    }
    if (/bright|up|increase|more|higher/.test(lower)) {
      return { action: "brightness_adjust", direction: "up" };
    }
    return { action: "brightness_get" };
  }

  // System info
  if (/system\s*info|what('?s| is)\s+(my\s+)?(os|system|computer|laptop|machine)|hostname|uptime|cpu|memory|ram|disk|kernel|platform/.test(lower)) {
    return { action: "system_info" };
  }

  // Open app
  if (/^(open|launch|start|run)\s+/i.test(lower)) {
    return { action: "open", target: input.replace(/^(open|launch|start|run)\s*/i, "").trim() };
  }

  // Close app
  if (/^(close|quit|kill)\s+/i.test(lower)) {
    return { action: "close", target: input.replace(/^(close|quit|kill)\s*/i, "").trim() };
  }

  // Screenshot
  if (/screenshot|screen\s*shot|capture\s*screen|take\s*(a\s+)?pic/.test(lower)) {
    return { action: "screenshot" };
  }

  // Power
  if (/shutdown|power\s*off|turn\s*off/.test(lower)) return { action: "shutdown" };
  if (/restart|reboot/.test(lower)) return { action: "restart" };
  if (/sleep|suspend|hibernate/.test(lower)) return { action: "suspend" };
  if (/lock|lock\s*screen/.test(lower)) return { action: "lock" };

  return { action: "unknown" };
}

// ─── Service ───

export function createSystemService(): Service {
  return {
    name: "system",
    description: "System control: open/close apps, volume, brightness, battery, WiFi, system info, screenshots, shutdown, restart",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "open ", "close ", "launch ", "start ", "run ",
        "volume", "brightness", "battery", "wifi", "bluetooth",
        "shutdown", "restart", "reboot", "sleep", "lock", "suspend",
        "screenshot", "system info", "hostname", "uptime",
        "cpu", "memory", "disk", "platform", "kernel",
        "mute", "unmute", "dim", "brighten", "charge",
        "what's my", "what is my", "how much", "power off",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const intent = parseIntent(input);
      let result: string;

      switch (intent.action) {
        case "battery":
          result = getBattery();
          break;
        case "volume_get":
          result = getVolume();
          break;
        case "volume_set":
          result = setVolume(Math.min(100, Math.max(0, intent.value ?? 50)));
          break;
        case "volume_adjust":
          result = adjustVolume(intent.direction ?? "up");
          break;
        case "volume_mute":
          run("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle 2>/dev/null");
          run("pactl set-sink-mute @DEFAULT_SINK@ toggle 2>/dev/null");
          result = "Volume **toggled**";
          break;
        case "brightness_get":
          result = getBrightness();
          break;
        case "brightness_set":
          result = setBrightness(Math.min(100, Math.max(0, intent.value ?? 50)));
          break;
        case "brightness_adjust":
          result = adjustBrightness(intent.direction ?? "up");
          break;
        case "system_info":
          result = getSystemInfo();
          break;
        case "open":
          result = openApplication(`open ${intent.target ?? ""}`);
          break;
        case "close":
          result = closeApplication(`close ${intent.target ?? ""}`);
          break;
        case "screenshot":
          result = takeScreenshot();
          break;
        case "shutdown":
          result = shutdown();
          break;
        case "restart":
          result = restart();
          break;
        case "suspend":
          result = suspend();
          break;
        case "lock":
          result = lockScreen();
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
