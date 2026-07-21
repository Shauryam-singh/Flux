const reset = "\x1b[0m";
const bold = "\x1b[1m";
const dim = "\x1b[2m";

const colors = {
  keyword: "\x1b[38;5;39m",    // blue
  string: "\x1b[38;5;42m",     // green
  number: "\x1b[38;5;208m",    // orange
  comment: "\x1b[38;5;245m",   // gray
  function: "\x1b[38;5;213m",  // pink
  type: "\x1b[38;5;141m",      // purple
  operator: "\x1b[38;5;252m",  // white
  punctuation: "\x1b[38;5;249m", // light gray
  property: "\x1b[38;5;117m",  // cyan
  tag: "\x1b[38;5;196m",       // red
  attribute: "\x1b[38;5;220m", // yellow
};

const keywords = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "do", "switch", "case", "break", "continue", "new", "this", "class",
  "extends", "import", "export", "default", "from", "async", "await",
  "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of",
  "true", "false", "null", "undefined", "void", "delete", "yield", "static",
  "get", "set", "constructor", "super", "with", "debugger",
]);

const types = new Set([
  "string", "number", "boolean", "any", "void", "never", "object",
  "Array", "Map", "Set", "Promise", "Record", "Partial", "Required",
  "Readonly", "Pick", "Omit", "Exclude", "Extract", "ReturnType",
]);

const builtins = new Set([
  "console", "Math", "JSON", "Date", "RegExp", "Error", "Promise",
  "Array", "Object", "String", "Number", "Boolean", "Symbol", "Map",
  "Set", "WeakMap", "WeakSet", "parseInt", "parseFloat", "isNaN",
  "setTimeout", "setInterval", "clearTimeout", "clearInterval", "fetch",
]);

export function highlightCode(code: string, language?: string): string {
  if (!language) {
    return highlightGeneric(code);
  }
  
  switch (language.toLowerCase()) {
    case "js":
    case "javascript":
    case "jsx":
    case "ts":
    case "typescript":
    case "tsx":
      return highlightTypeScript(code);
    case "py":
    case "python":
      return highlightPython(code);
    case "json":
      return highlightJSON(code);
    case "html":
    case "xml":
      return highlightHTML(code);
    case "css":
      case "css":
      return highlightCSS(code);
    case "bash":
    case "sh":
    case "shell":
      return highlightShell(code);
    default:
      return highlightGeneric(code);
  }
}

function highlightTypeScript(code: string): string {
  let result = "";
  let i = 0;
  
  while (i < code.length) {
    // Single-line comment
    if (code[i] === "/" && code[i + 1] === "/") {
      const end = code.indexOf("\n", i);
      const comment = end === -1 ? code.slice(i) : code.slice(i, end);
      result += `${colors.comment}${comment}${reset}`;
      i += comment.length;
      continue;
    }
    
    // Multi-line comment
    if (code[i] === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      const comment = end === -1 ? code.slice(i) : code.slice(i, end + 2);
      result += `${colors.comment}${comment}${reset}`;
      i += comment.length;
      continue;
    }
    
    // String (single or double quote)
    if (code[i] === '"' || code[i] === "'" || code[i] === "`") {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === "\\") j++;
        j++;
      }
      const str = code.slice(i, j + 1);
      result += `${colors.string}${str}${reset}`;
      i = j + 1;
      continue;
    }
    
    // Number
    if (/\d/.test(code[i] || "") && (i === 0 || /[\s({[,;:=+\-*/<>!&|^~%]/.test(code[i - 1] || ""))) {
      let j = i;
      while (j < code.length && /[\d.xXa-fA-FeE]/.test(code[j] || "")) j++;
      const num = code.slice(i, j);
      result += `${colors.number}${num}${reset}`;
      i = j;
      continue;
    }
    
    // Word (keyword, type, identifier)
    if (/[a-zA-Z_$]/.test(code[i] || "")) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j] || "")) j++;
      const word = code.slice(i, j);
      
      if (keywords.has(word)) {
        result += `${colors.keyword}${word}${reset}`;
      } else if (types.has(word)) {
        result += `${colors.type}${word}${reset}`;
      } else if (builtins.has(word)) {
        result += `${colors.function}${word}${reset}`;
      } else if (code[j] === "(") {
        result += `${colors.function}${word}${reset}`;
      } else {
        result += word;
      }
      i = j;
      continue;
    }
    
    // Operators
    if (/[+\-*/%=<>!&|^~?:]/.test(code[i] || "")) {
      let j = i;
      while (j < code.length && /[+\-*/%=<>!&|^~?:]/.test(code[j] || "")) j++;
      const op = code.slice(i, j);
      result += `${colors.operator}${op}${reset}`;
      i = j;
      continue;
    }
    
    // Punctuation
    if (/[{}()\[\];,.]/.test(code[i] || "")) {
      result += `${colors.punctuation}${code[i]}${reset}`;
      i++;
      continue;
    }
    
    // Whitespace and other
    result += code[i];
    i++;
  }
  
  return result;
}

function highlightPython(code: string): string {
  let result = "";
  let i = 0;
  
  while (i < code.length) {
    // Comment
    if (code[i] === "#") {
      const end = code.indexOf("\n", i);
      const comment = end === -1 ? code.slice(i) : code.slice(i, end);
      result += `${colors.comment}${comment}${reset}`;
      i += comment.length;
      continue;
    }
    
    // String
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i]!;
      // Check for triple quote
      if (code.slice(i, i + 3) === quote.repeat(3)) {
        const end = code.indexOf(quote.repeat(3), i + 3);
        const str = end === -1 ? code.slice(i) : code.slice(i, end + 3);
        result += `${colors.string}${str}${reset}`;
        i += str.length;
      } else {
        let j = i + 1;
        while (j < code.length && code[j] !== quote) {
          if (code[j] === "\\") j++;
          j++;
        }
        const str = code.slice(i, j + 1);
        result += `${colors.string}${str}${reset}`;
        i = j + 1;
      }
      continue;
    }
    
    // Number
    if (/\d/.test(code[i] || "")) {
      let j = i;
      while (j < code.length && /[\d._xXoObBeE]/.test(code[j] || "")) j++;
      const num = code.slice(i, j);
      result += `${colors.number}${num}${reset}`;
      i = j;
      continue;
    }
    
    // Word
    if (/[a-zA-Z_]/.test(code[i] || "")) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j] || "")) j++;
      const word = code.slice(i, j);
      
      const pyKeywords = new Set([
        "def", "class", "return", "if", "elif", "else", "for", "while",
        "break", "continue", "pass", "import", "from", "as", "with",
        "try", "except", "finally", "raise", "yield", "lambda", "global",
        "nonlocal", "assert", "del", "in", "not", "and", "or", "is",
        "True", "False", "None", "async", "await",
      ]);
      
      const pyTypes = new Set([
        "int", "float", "str", "bool", "list", "dict", "tuple", "set",
        "None", "True", "False", "type", "object", "range", "len",
      ]);
      
      if (pyKeywords.has(word)) {
        result += `${colors.keyword}${word}${reset}`;
      } else if (pyTypes.has(word)) {
        result += `${colors.type}${word}${reset}`;
      } else if (code[j] === "(") {
        result += `${colors.function}${word}${reset}`;
      } else {
        result += word;
      }
      i = j;
      continue;
    }
    
    result += code[i];
    i++;
  }
  
  return result;
}

function highlightJSON(code: string): string {
  return code
    .replace(/"([^"\\]|\\.)*"\s*:/g, (m) => `${colors.property}${m}${reset}`)
    .replace(/"([^"\\]|\\.)*"/g, (m) => `${colors.string}${m}${reset}`)
    .replace(/\b(true|false|null)\b/g, (m) => `${colors.keyword}${m}${reset}`)
    .replace(/\b(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g, (m) => `${colors.number}${m}${reset}`);
}

function highlightHTML(code: string): string {
  return code
    .replace(/(&lt;|<)(\/?)(\w+)/g, (_, open, slash, tag) => 
      `${colors.punctuation}${open}${slash}${reset}${colors.tag}${tag}${reset}`)
    .replace(/(\/?&gt;|\/?>)/g, (m) => `${colors.punctuation}${m}${reset}`)
    .replace(/(\w+)(=)/g, (_, attr, eq) => `${colors.attribute}${attr}${reset}${colors.operator}${eq}${reset}`)
    .replace(/"([^"]*)"/g, (m) => `${colors.string}${m}${reset}`);
}

function highlightCSS(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => `${colors.comment}${m}${reset}`)
    .replace(/([\w-]+)\s*:/g, (_, prop) => `${colors.property}${prop}${reset}:`)
    .replace(/#([0-9a-fA-F]{3,8})\b/g, (m) => `${colors.number}${m}${reset}`)
    .replace(/(\d+)(px|em|rem|%|vh|vw|s|ms)/g, (_, num, unit) => `${colors.number}${num}${reset}${colors.type}${unit}${reset}`);
}

function highlightShell(code: string): string {
  const shellKeywords = new Set([
    "if", "then", "else", "elif", "fi", "for", "while", "do", "done",
    "case", "esac", "function", "return", "exit", "export", "source",
    "alias", "unalias", "cd", "pwd", "echo", "printf", "read",
    "test", "[", "[[", "exec", "eval", "set", "unset", "shift",
  ]);
  
  let result = "";
  let i = 0;
  
  while (i < code.length) {
    // Comment
    if (code[i] === "#") {
      const end = code.indexOf("\n", i);
      const comment = end === -1 ? code.slice(i) : code.slice(i, end);
      result += `${colors.comment}${comment}${reset}`;
      i += comment.length;
      continue;
    }
    
    // String
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === "\\") j++;
        j++;
      }
      const str = code.slice(i, j + 1);
      result += `${colors.string}${str}${reset}`;
      i = j + 1;
      continue;
    }
    
    // Variable
    if (code[i] === "$") {
      let j = i + 1;
      if (code[j] === "{") {
        j = code.indexOf("}", i) + 1;
      } else {
        while (j < code.length && /[a-zA-Z0-9_]/.test(code[j] || "")) j++;
      }
      const v = code.slice(i, j);
      result += `${colors.type}${v}${reset}`;
      i = j;
      continue;
    }
    
    // Word
    if (/[a-zA-Z_]/.test(code[i] || "")) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_\-]/.test(code[j] || "")) j++;
      const word = code.slice(i, j);
      
      if (shellKeywords.has(word)) {
        result += `${colors.keyword}${word}${reset}`;
      } else if (code[j] === "(" || code[j] === "[") {
        result += `${colors.function}${word}${reset}`;
      } else {
        result += word;
      }
      i = j;
      continue;
    }
    
    result += code[i];
    i++;
  }
  
  return result;
}

function highlightGeneric(code: string): string {
  // Basic highlighting for unknown languages
  let result = "";
  let i = 0;
  
  while (i < code.length) {
    // Comment
    if (code[i] === "/" && code[i + 1] === "/") {
      const end = code.indexOf("\n", i);
      const comment = end === -1 ? code.slice(i) : code.slice(i, end);
      result += `${colors.comment}${comment}${reset}`;
      i += comment.length;
      continue;
    }
    
    // String
    if (code[i] === '"' || code[i] === "'" || code[i] === "`") {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === "\\") j++;
        j++;
      }
      const str = code.slice(i, j + 1);
      result += `${colors.string}${str}${reset}`;
      i = j + 1;
      continue;
    }
    
    // Number
    if (/\d/.test(code[i] || "")) {
      let j = i;
      while (j < code.length && /[\d.xXa-fA-F]/.test(code[j] || "")) j++;
      const num = code.slice(i, j);
      result += `${colors.number}${num}${reset}`;
      i = j;
      continue;
    }
    
    result += code[i];
    i++;
  }
  
  return result;
}

export function highlightMarkdown(text: string): string {
  // Process code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  
  return text.replace(codeBlockRegex, (_, lang, code) => {
    const highlighted = highlightCode(code.trimEnd(), lang);
    return `\`\`\`${lang || ""}\n${highlighted}\n\`\`\``;
  });
}
