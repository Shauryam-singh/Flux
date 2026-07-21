export type AgentMode = "plan" | "auto" | "normal";

export interface ModeConfig {
  readonly name: AgentMode;
  readonly description: string;
  readonly canExecuteTools: boolean;
  readonly requiresApproval: boolean;
  readonly showPlanOnly: boolean;
}

export const MODES: Record<AgentMode, ModeConfig> = {
  plan: {
    name: "plan",
    description: "Show plan only, no execution",
    canExecuteTools: false,
    requiresApproval: false,
    showPlanOnly: true,
  },
  auto: {
    name: "auto",
    description: "Execute without approval",
    canExecuteTools: true,
    requiresApproval: false,
    showPlanOnly: false,
  },
  normal: {
    name: "normal",
    description: "Ask before file edits",
    canExecuteTools: true,
    requiresApproval: true,
    showPlanOnly: false,
  },
};

export const MODE_ORDER: AgentMode[] = ["normal", "plan", "auto"];

export function getNextMode(current: AgentMode): AgentMode {
  const idx = MODE_ORDER.indexOf(current);
  return MODE_ORDER[(idx + 1) % MODE_ORDER.length]!;
}

export function getModeColor(mode: AgentMode): string {
  switch (mode) {
    case "plan": return "\x1b[38;5;33m";    // blue
    case "auto": return "\x1b[38;5;42m";     // green
    case "normal": return "\x1b[38;5;220m";  // yellow
  }
}

export function getModeSymbol(mode: AgentMode): string {
  switch (mode) {
    case "plan": return "📋";
    case "auto": return "⚡";
    case "normal": return "✏️ ";
  }
}
