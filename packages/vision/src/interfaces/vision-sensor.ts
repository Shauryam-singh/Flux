import type { VisionAnalysis, VisualElement, ScreenRegion } from "@ai-agent/ambient-types";

export interface VisionSensor {
  capture(): Promise<VisionAnalysis | null>;
  analyzeRegion(region: ScreenRegion): Promise<VisualElement[]>;
  getLastAnalysis(): VisionAnalysis | null;
  isAvailable(): boolean;
  setAnalysisMode(mode: "rule_based" | "multimodal"): void;
}

export interface VisionConfig {
  readonly captureIntervalMs: number;
  readonly enabled: boolean;
  readonly analysisMode: "rule_based" | "multimodal";
  readonly maxHistory: number;
  readonly screenshotQuality: number;
}

export interface ScreenContent {
  readonly text: string;
  readonly regions: ReadonlyArray<ScreenRegion>;
  readonly timestamps: number;
}
