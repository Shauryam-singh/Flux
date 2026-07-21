import { paint, theme } from "./theme.js";

export interface DiffLine {
  type: "added" | "removed" | "context";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export function generateDiff(
  oldContent: string,
  newContent: string,
  filePath: string
): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  
  const diffLines: DiffLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;
  
  // Simple line-by-line diff
  const maxLen = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    
    if (oldLine === undefined) {
      // Added line
      diffLines.push({
        type: "added",
        content: newLine!,
        newLineNum: newLineNum++,
      });
    } else if (newLine === undefined) {
      // Removed line
      diffLines.push({
        type: "removed",
        content: oldLine,
        oldLineNum: oldLineNum++,
      });
    } else if (oldLine !== newLine) {
      // Changed - show as remove + add
      diffLines.push({
        type: "removed",
        content: oldLine,
        oldLineNum: oldLineNum++,
      });
      diffLines.push({
        type: "added",
        content: newLine,
        newLineNum: newLineNum++,
      });
    } else {
      // Context line
      diffLines.push({
        type: "context",
        content: oldLine,
        oldLineNum: oldLineNum++,
        newLineNum: newLineNum++,
      });
    }
  }
  
  return formatDiff(diffLines, filePath);
}

function formatDiff(lines: DiffLine[], filePath: string): string {
  const output: string[] = [];
  
  // Header
  output.push(paint(`\n  Diff for ${filePath}`, theme.accent));
  output.push(paint("  " + "─".repeat(50), theme.dim));
  
  // Diff stats
  const added = lines.filter(l => l.type === "added").length;
  const removed = lines.filter(l => l.type === "removed").length;
  output.push(paint(`  +${added} -${removed} lines\n`, theme.dim));
  
  // Diff lines
  for (const line of lines) {
    const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
    const color = line.type === "added" 
      ? theme.success 
      : line.type === "removed" 
        ? theme.error 
        : theme.dim;
    
    const lineNum = line.type === "removed" 
      ? line.oldLineNum 
      : line.newLineNum;
    
    const numStr = lineNum !== undefined ? String(lineNum).padStart(3) : "   ";
    const content = line.content || "";
    
    output.push(paint(`  ${numStr} ${prefix} `, color) + paint(content, line.type === "context" ? theme.dim : theme.text));
  }
  
  output.push("");
  return output.join("\n");
}

export function formatDiffPreview(
  toolName: string,
  input: Record<string, unknown>,
  oldContent?: string
): string {
  if (toolName === "write_file" && oldContent !== undefined) {
    const newContent = input.content as string || "";
    const filePath = input.path as string || "file";
    return generateDiff(oldContent, newContent, filePath);
  }
  
  if (toolName === "edit_file" && oldContent !== undefined) {
    const filePath = input.path as string || "file";
    const oldText = input.old_text as string || "";
    const newText = input.new_text as string || "";
    
    // Simple preview of what will change
    const output: string[] = [];
    output.push(paint(`\n  Edit preview for ${filePath}`, theme.accent));
    output.push(paint("  " + "─".repeat(50), theme.dim));
    output.push(paint("\n  Remove:", theme.error));
    output.push(paint(`    "${oldText.slice(0, 100)}${oldText.length > 100 ? "..." : ""}"`, theme.text));
    output.push(paint("\n  Add:", theme.success));
    output.push(paint(`    "${newText.slice(0, 100)}${newText.length > 100 ? "..." : ""}"`, theme.text));
    output.push("");
    
    return output.join("\n");
  }
  
  return "";
}
