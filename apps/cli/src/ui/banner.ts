import { paint, padLine, theme, bold, reset } from "./theme.js";

const FLUX_ART = ["╭──╮ ", "╰╮╭╯", " ╰╯ ", "╭╯╰╮", "╰──╯"];
const FLUX_WIDTH = 11;

export function fluxBlock(): string[] {
  return FLUX_ART.map((line) => paint(padLine(line, FLUX_WIDTH), theme.accent));
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
): void {
  const rows = boxLines(lines, borderColor, width);
  for (const row of rows) {
    process.stdout.write(row + "\n");
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
    paint(cwd, theme.text),
    `${paint(branch, theme.success)}`,
  ];

  const flux = fluxBlock();
  const box = boxLines(infoLines, theme.primary, boxWidth);

  const height = Math.max(flux.length, box.length);
  const lPad = Math.floor((height - flux.length) / 2);
  const rPad = Math.floor((height - box.length) / 2);

  const lFlux = [...Array(lPad).fill(" ".repeat(FLUX_WIDTH)), ...flux, ...Array(Math.max(0, height - flux.length - lPad)).fill(" ".repeat(FLUX_WIDTH))];
  const rBox = [...Array(rPad).fill(""), ...box, ...Array(Math.max(0, height - box.length - rPad)).fill("")];

  const gapStr = " ".repeat(gap);
  for (let i = 0; i < height; i++) {
    process.stdout.write((lFlux[i] ?? "") + gapStr + (rBox[i] ?? "") + "\n");
  }
  process.stdout.write(paint("─".repeat(cols), theme.muted) + "\n");
}
