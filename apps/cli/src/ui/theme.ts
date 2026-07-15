export const reset = "\x1b[0m";
export const bold = "\x1b[1m";
export const dim = "\x1b[2m";

export const theme = {
  primary: "\x1b[38;5;39m",
  accent: "\x1b[38;5;213m",
  success: "\x1b[38;5;42m",
  warning: "\x1b[38;5;220m",
  error: "\x1b[38;5;196m",
  muted: "\x1b[38;5;245m",
  text: "\x1b[38;5;255m",
  dim: "\x1b[38;5;240m",
};

export function paint(text: string, color: string): string {
  return `${color}${text}${reset}`;
}

export function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

export function visibleLength(s: string): number {
  return stripAnsi(s).length;
}

export function padLine(text: string, width: number): string {
  const pad = Math.max(0, width - visibleLength(text));
  return text + " ".repeat(pad);
}
