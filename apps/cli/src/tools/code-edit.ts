import * as fs from "node:fs";
import { paint, theme } from "../ui/theme.js";

interface CodeBlock {
  startLine: number;
  endLine: number;
  content: string;
}

export function findCodeBlock(
  fileContent: string,
  searchPattern: string | RegExp
): CodeBlock | null {
  const lines = fileContent.split("\n");
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    
    const matches = typeof searchPattern === "string"
      ? line.includes(searchPattern)
      : searchPattern.test(line);
    
    if (matches) {
      const block = extractBlock(lines, i);
      return block;
    }
  }
  
  return null;
}

function extractBlock(lines: string[], startIndex: number): CodeBlock {
  let braceCount = 0;
  let started = false;
  let endIndex = startIndex;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    
    for (const char of line) {
      if (char === "{") {
        braceCount++;
        started = true;
      } else if (char === "}") {
        braceCount--;
      }
    }
    
    if (started && braceCount === 0) {
      endIndex = i;
      break;
    }
  }
  
  return {
    startLine: startIndex,
    endLine: endIndex,
    content: lines.slice(startIndex, endIndex + 1).join("\n"),
  };
}

export function replaceCodeBlock(
  fileContent: string,
  block: CodeBlock,
  newContent: string
): string {
  const lines = fileContent.split("\n");
  const before = lines.slice(0, block.startLine);
  const after = lines.slice(block.endLine + 1);
  
  return [...before, newContent, ...after].join("\n");
}

export function insertAfterFunction(
  fileContent: string,
  functionName: string,
  newCode: string
): string | null {
  const block = findCodeBlock(fileContent, new RegExp(`function\\s+${functionName}|${functionName}\\s*\\(|const\\s+${functionName}\\s*=`, "i"));
  
  if (!block) return null;
  
  const lines = fileContent.split("\n");
  const insertAt = block.endLine + 1;
  const newLines = newCode.split("\n");
  
  lines.splice(insertAt, 0, ...newLines);
  return lines.join("\n");
}

export function replaceFunction(
  fileContent: string,
  functionName: string,
  newFunctionCode: string
): string | null {
  const block = findCodeBlock(fileContent, new RegExp(`function\\s+${functionName}|${functionName}\\s*\\(|const\\s+${functionName}\\s*=`, "i"));
  
  if (!block) return null;
  
  return replaceCodeBlock(fileContent, block, newFunctionCode);
}

export function addImport(
  fileContent: string,
  importStatement: string
): string {
  const lines = fileContent.split("\n");
  const lastImportIndex = lines.findLastIndex(line => line.trim().startsWith("import "));
  
  if (lastImportIndex === -1) {
    return importStatement + "\n" + fileContent;
  }
  
  lines.splice(lastImportIndex + 1, 0, importStatement);
  return lines.join("\n");
}

export function removeImport(
  fileContent: string,
  moduleName: string
): string {
  const lines = fileContent.split("\n");
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    return !trimmed.includes(`from '${moduleName}'`) && 
           !trimmed.includes(`from "${moduleName}"`) &&
           !trimmed.includes(`require('${moduleName}')`) &&
           !trimmed.includes(`require("${moduleName}")`);
  });
  
  return filteredLines.join("\n");
}

export function previewEdit(
  oldContent: string,
  newContent: string,
  contextLines: number = 3
): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const output: string[] = [];
  
  let oldIdx = 0;
  let newIdx = 0;
  
  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];
    
    if (oldLine === newLine) {
      output.push(paint(`  ${oldLine}`, theme.dim));
      oldIdx++;
      newIdx++;
    } else if (oldLine !== undefined && newLine !== undefined) {
      output.push(paint(`- ${oldLine}`, theme.error));
      output.push(paint(`+ ${newLine}`, theme.success));
      oldIdx++;
      newIdx++;
    } else if (oldLine !== undefined) {
      output.push(paint(`- ${oldLine}`, theme.error));
      oldIdx++;
    } else {
      output.push(paint(`+ ${newLine}`, theme.success));
      newIdx++;
    }
  }
  
  return output.join("\n");
}
