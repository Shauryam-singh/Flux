import type { Thought } from "@ai-agent/cognitive-types";
import type { WorldState } from "@ai-agent/world-model";
import {
  DEFAULT_APPLICATION_STATE,
  DEFAULT_SYSTEM_STATE,
} from "@ai-agent/world-model";
import { describe, expect, it, vi } from "vitest";
import { DefaultReasoningEngine } from "../impl/default-reasoning-engine.js";
import type { ReasoningContext } from "../interfaces/reasoning-engine.js";
import type { ThoughtGenerator } from "../interfaces/thought-generator.js";

function makeContext(overrides?: Partial<ReasoningContext>): ReasoningContext {
  return {
    worldState: {
      project: null,
      application: DEFAULT_APPLICATION_STATE,
      system: DEFAULT_SYSTEM_STATE,
      timestamp: Date.now(),
      version: 0,
    },
    memory: {
      entries: [],
      totalWeight: 0,
      capacity: 50,
      utilization: 0,
      timestamp: Date.now(),
    },
    goals: [],
    recentObservations: [],
    recentThoughts: [],
    ...overrides,
  };
}

const mockGenerator: ThoughtGenerator = {
  generate: async () => [],
  needsLlm: () => false,
};

describe("DefaultReasoningEngine", () => {
  it("should not reason when no triggers and has history", () => {
    const engine = new DefaultReasoningEngine(mockGenerator);
    // First cycle always runs (empty history), but after that it should not
    // Seed the thought history by running a cycle
    engine["thoughtHistory"] = [
      {
        id: "t1",
        type: "concern",
        content: "seed",
        confidence: 0.5,
        reasoning: "",
        timestamp: Date.now(),
        relatedGoalId: null,
        relatedObservationIds: [],
        suggestedAction: null,
      },
    ];
    expect(
      engine.shouldReason(
        {
          project: null,
          application: DEFAULT_APPLICATION_STATE,
          system: DEFAULT_SYSTEM_STATE,
          timestamp: Date.now(),
          version: 0,
        },
        {
          entries: [],
          totalWeight: 0,
          capacity: 50,
          utilization: 0,
          timestamp: Date.now(),
        },
        [],
      ),
    ).toBe(false);
  });

  it("should reason when errors present", () => {
    const engine = new DefaultReasoningEngine(mockGenerator);
    expect(
      engine.shouldReason(
        {
          project: null,
          application: DEFAULT_APPLICATION_STATE,
          system: {
            ...DEFAULT_SYSTEM_STATE,
            openErrors: [
              { source: "build", message: "fail", timestamp: Date.now() },
            ],
          },
          timestamp: Date.now(),
          version: 0,
        },
        {
          entries: [],
          totalWeight: 0,
          capacity: 50,
          utilization: 0,
          timestamp: Date.now(),
        },
        [],
      ),
    ).toBe(true);
  });

  it("should reason when goals are blocked", () => {
    const engine = new DefaultReasoningEngine(mockGenerator);
    expect(
      engine.shouldReason(
        {
          project: null,
          application: DEFAULT_APPLICATION_STATE,
          system: DEFAULT_SYSTEM_STATE,
          timestamp: Date.now(),
          version: 0,
        },
        {
          entries: [],
          totalWeight: 0,
          capacity: 50,
          utilization: 0,
          timestamp: Date.now(),
        },
        [
          {
            id: "g1",
            title: "Test",
            description: "",
            status: "blocked",
            priority: 80,
            progress: 50,
            source: "user_request",
            parentGoalId: null,
            subGoalIds: [],
            blockers: [],
            dependencies: [],
            estimatedCompletion: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            completedAt: null,
          },
        ],
      ),
    ).toBe(true);
  });

  it("should generate rule-based thoughts for errors", async () => {
    const engine = new DefaultReasoningEngine(mockGenerator);
    const result = await engine.cycle(
      makeContext({
        worldState: {
          project: null,
          application: DEFAULT_APPLICATION_STATE,
          system: {
            ...DEFAULT_SYSTEM_STATE,
            openErrors: [
              { source: "build", message: "TS2345", timestamp: Date.now() },
            ],
          },
          timestamp: Date.now(),
          version: 0,
        },
      }),
    );
    expect(result.thoughts.length).toBeGreaterThan(0);
    expect(result.thoughts[0]!.type).toBe("concern");
  });

  it("should generate pattern recognition for multiple observations", async () => {
    const engine = new DefaultReasoningEngine(mockGenerator);
    const result = await engine.cycle(
      makeContext({
        recentObservations: [
          {
            id: "1",
            source: "terminal",
            title: "cmd1",
            detail: "",
            priority: "low",
            score: 10,
            timestamp: Date.now(),
            mergeable: false,
            consumed: false,
          },
          {
            id: "2",
            source: "terminal",
            title: "cmd2",
            detail: "",
            priority: "low",
            score: 10,
            timestamp: Date.now(),
            mergeable: false,
            consumed: false,
          },
          {
            id: "3",
            source: "terminal",
            title: "cmd3",
            detail: "",
            priority: "low",
            score: 10,
            timestamp: Date.now(),
            mergeable: false,
            consumed: false,
          },
        ],
      }),
    );
    const patterns = result.thoughts.filter(
      (t) => t.type === "pattern_recognition",
    );
    expect(patterns.length).toBeGreaterThan(0);
  });

  it("should emit thoughts via handler", async () => {
    const engine = new DefaultReasoningEngine(mockGenerator);
    const handler = vi.fn();
    engine.onThought(handler);
    await engine.cycle(
      makeContext({
        worldState: {
          project: null,
          application: DEFAULT_APPLICATION_STATE,
          system: {
            ...DEFAULT_SYSTEM_STATE,
            openErrors: [
              { source: "build", message: "fail", timestamp: Date.now() },
            ],
          },
          timestamp: Date.now(),
          version: 0,
        },
      }),
    );
    expect(handler).toHaveBeenCalled();
  });

  it("should return idle state by default", () => {
    const engine = new DefaultReasoningEngine(mockGenerator);
    expect(engine.getState()).toBe("idle");
  });
});
