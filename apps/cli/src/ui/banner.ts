import { paint, padLine, theme, bold, reset } from "./theme.js";

// Fixed width FLUX ASCII icon
const FLUX_ART = [
  " ╭──╮ ",
  " ╰╮╭╯ ",
  "  ╰╯  ",
  " ╭╯╰╮ ",
  " ╰──╯ "
];
const FLUX_WIDTH = 6;

export function fluxBlock(): string[] {
  return FLUX_ART.map((line) => paint(line, theme.accent));
}

export function boxLines(
  lines: string[],
  borderColor: string,
  width: number,
): string[] {
  const top = `${borderColor}╭${"─".repeat(width)}╮${reset}`;
  const bottom = `${borderColor}╰${"─".repeat(width)}╯${reset}`;
  const body = lines.map(
    (l) =>
      `${borderColor}│${reset} ${padLine(l, width - 2)} ${borderColor}│${reset}`,
  );
  return [top, ...body, bottom];
}

export function printBox(
  lines: string[],
  borderColor: string,
  width = 45,
  outputFn?: (text: string) => void,
): void {
  const rows = boxLines(lines, borderColor, width);
  const result = rows.join("\n");
  if (outputFn) {
    outputFn(result);
  } else {
    process.stdout.write(result + "\n");
  }
}

export function printHeader(
  provider: string,
  model: string,
  cwd: string,
  branch: string,
): void {
  const cols = process.stdout.columns || 80;
  const gap = 3;
  const boxWidth = Math.max(30, Math.min(45, cols - FLUX_WIDTH - gap - 4));

  const infoLines = [
    `${paint(`Flux v0.1.0`, `${bold}${theme.primary}`)}`,
    `${paint(provider, theme.muted)} ${paint("·", theme.dim)} ${paint(model, theme.text)}`,
    paint(cwd.length > boxWidth - 4 ? "…" + cwd.slice(-(boxWidth - 5)) : cwd, theme.text),
    `${paint("git:(" + branch + ")", theme.success)}`,
  ];

  const flux = fluxBlock();
  const box = boxLines(infoLines, theme.primary, boxWidth);

  const height = Math.max(flux.length, box.length);

  for (let i = 0; i < height; i++) {
    const artLine = flux[i] ?? " ".repeat(FLUX_WIDTH);
    const boxLine = box[i] ?? "";
    process.stdout.write(`  ${artLine}${" ".repeat(gap)}${boxLine}\n`);
  }
  process.stdout.write(paint("─".repeat(cols), theme.muted) + "\n");
}