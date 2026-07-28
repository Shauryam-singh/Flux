import type { VisionSensor, VisionConfig } from "../interfaces/vision-sensor.js";
import type { VisionAnalysis, VisualElement, ScreenRegion } from "@ai-agent/ambient-types";

const DEFAULT_CONFIG: VisionConfig = {
  captureIntervalMs: 5000,
  enabled: true,
  analysisMode: "rule_based",
  maxHistory: 100,
  screenshotQuality: 0.8,
};

export class DefaultVisionSensor implements VisionSensor {
  private config: VisionConfig;
  private history: VisionAnalysis[] = [];
  private idCounter = 0;
  private lastAnalysis: VisionAnalysis | null = null;
  private analysisMode: "rule_based" | "multimodal";

  constructor(config?: Partial<VisionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.analysisMode = this.config.analysisMode;
  }

  async capture(): Promise<VisionAnalysis | null> {
    if (!this.config.enabled) return null;

    const analysis: VisionAnalysis = {
      id: `va_${++this.idCounter}`,
      timestamp: Date.now(),
      screenshotId: `ss_${this.idCounter}`,
      application: "unknown",
      windowTitle: "",
      elements: [],
      semanticSummary: "No visual data available",
      hasErrors: false,
      errorCount: 0,
      activeDialogs: [],
      codeLanguage: null,
      uiState: "normal",
    };

    this.lastAnalysis = analysis;
    this.history.push(analysis);
    if (this.history.length > this.config.maxHistory) {
      this.history = this.history.slice(-this.config.maxHistory);
    }

    return analysis;
  }

  async analyzeRegion(region: ScreenRegion): Promise<VisualElement[]> {
    return [{
      type: "text",
      content: "",
      region,
      confidence: 0.5,
      interactive: false,
    }];
  }

  getLastAnalysis(): VisionAnalysis | null {
    return this.lastAnalysis;
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }

  setAnalysisMode(mode: "rule_based" | "multimodal"): void {
    this.analysisMode = mode;
  }

  getHistory(): ReadonlyArray<VisionAnalysis> {
    return this.history;
  }
}

export class RuleBasedAnalyzer {
  analyze(text: string, application: string): VisionAnalysis {
    const elements = this.extractElements(text, application);
    const hasErrors = elements.some((e) => e.type === "error_indicator");
    const errorCount = elements.filter((e) => e.type === "error_indicator").length;
    const uiState = this.determineUiState(elements, application);
    const semanticSummary = this.generateSummary(elements, application, uiState);

    return {
      id: `rba_${Date.now()}`,
      timestamp: Date.now(),
      screenshotId: "",
      application,
      windowTitle: "",
      elements,
      semanticSummary,
      hasErrors,
      errorCount,
      activeDialogs: elements.filter((e) => e.type === "dialog").map((e) => e.content),
      codeLanguage: this.detectLanguage(elements, application),
      uiState,
    };
  }

  private extractElements(text: string, application: string): VisualElement[] {
    const elements: VisualElement[] = [];
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.match(/error|Error|ERROR|failed|Failed|FAILED/i)) {
        elements.push({
          type: "error_indicator",
          content: line.trim(),
          region: { x: 0, y: 0, width: 0, height: 0 },
          confidence: 0.8,
          interactive: false,
        });
      }
      if (line.match(/warning|Warning|WARN/i)) {
        elements.push({
          type: "text",
          content: line.trim(),
          region: { x: 0, y: 0, width: 0, height: 0 },
          confidence: 0.7,
          interactive: false,
        });
      }
    }

    if (application.toLowerCase().includes("code") || application.toLowerCase().includes("vscode")) {
      elements.push({
        type: "code_block",
        content: text.slice(0, 500),
        region: { x: 0, y: 0, width: 800, height: 600 },
        confidence: 0.6,
        interactive: false,
      });
    }

    return elements;
  }

  private determineUiState(elements: VisualElement[], application: string): VisionAnalysis["uiState"] {
    if (elements.some((e) => e.type === "dialog")) return "input_required";
    if (elements.some((e) => e.type === "error_indicator")) return "error_dialog";
    if (application.toLowerCase().includes("loading") || application.toLowerCase().includes("spinner")) return "loading";
    return "normal";
  }

  private generateSummary(elements: VisualElement[], application: string, uiState: string): string {
    const errorCount = elements.filter((e) => e.type === "error_indicator").length;
    if (errorCount > 0) return `${application} displays ${errorCount} error(s).`;
    if (uiState === "input_required") return `${application} has a dialog requiring input.`;
    return `${application} is in normal state.`;
  }

  private detectLanguage(elements: VisualElement[], application: string): string | null {
    const codeBlocks = elements.filter((e) => e.type === "code_block");
    if (codeBlocks.length === 0) return null;
    const content = codeBlocks[0]!.content;
    if (content.includes("function") || content.includes("const") || content.includes("=>")) return "typescript";
    if (content.includes("def ") || content.includes("import ")) return "python";
    if (content.includes("fn ") || content.includes("let mut")) return "rust";
    return null;
  }
}
