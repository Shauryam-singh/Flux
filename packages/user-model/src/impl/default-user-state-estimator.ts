import type { UserStateEstimator } from "../interfaces/user-state-estimator.js";
import type { UserState, UserStateType } from "../types/user-state.js";
import type { WorldState } from "@ai-agent/world-model";
import type { Observation } from "@ai-agent/attention";

export class DefaultUserStateEstimator implements UserStateEstimator {
  private history: UserState[] = [];
  private currentState: UserState = {
    current: "idle",
    confidence: 0.9,
    since: Date.now(),
    factors: ["initial state"],
    previousState: null,
  };

  estimate(worldState: WorldState, recentObservations: ReadonlyArray<Observation>): UserState {
    const factors: string[] = [];
    let state: UserStateType = "idle";
    let confidence = 0.5;

    const openErrors = worldState.system.openErrors.length;
    const sameApp = this.countSameApp(recentObservations);
    const appSwitches = this.countAppSwitches(recentObservations);
    const terminalActive = recentObservations.some((o) => o.source === "terminal");
    const browserActive = worldState.application.activeApp.toLowerCase().includes("browser") ||
      worldState.application.activeApp.toLowerCase().includes("chrome");
    const videoApp = worldState.application.activeApp.toLowerCase().includes("zoom") ||
      worldState.application.activeApp.toLowerCase().includes("teams") ||
      worldState.application.activeApp.toLowerCase().includes("meet");
    const timeSinceLastObs = recentObservations.length > 0
      ? Date.now() - recentObservations[recentObservations.length - 1]!.timestamp
      : Infinity;

    if (videoApp) {
      state = "meeting";
      confidence = 0.9;
      factors.push("video app active");
    } else if (timeSinceLastObs > 300000) {
      state = "idle";
      confidence = 0.9;
      factors.push("no activity for 5+ minutes");
    } else if (openErrors > 3 && terminalActive) {
      state = "frustrated";
      confidence = 0.7;
      factors.push(`${openErrors} open errors, terminal active`);
    } else if (openErrors > 0 && terminalActive) {
      state = "debugging";
      confidence = 0.75;
      factors.push("errors present, terminal active");
    } else if (sameApp > 10 && openErrors === 0) {
      state = "deep_work";
      confidence = 0.85;
      factors.push(`same app for ${sameApp} observations, no errors`);
    } else if (sameApp > 5 && openErrors === 0) {
      state = "focused";
      confidence = 0.8;
      factors.push(`consistent app usage, no errors`);
    } else if (appSwitches > 5) {
      state = "distracted";
      confidence = 0.6;
      factors.push(`${appSwitches} app switches`);
    } else if (browserActive && !terminalActive) {
      state = "researching";
      confidence = 0.7;
      factors.push("browser active, no terminal");
    } else {
      state = "focused";
      confidence = 0.5;
      factors.push("default estimate");
    }

    const newState: UserState = {
      current: state,
      confidence,
      since: this.currentState.current === state ? this.currentState.since : Date.now(),
      factors,
      previousState: this.currentState.current,
    };

    this.currentState = newState;
    this.history.push(newState);
    if (this.history.length > 50) {
      this.history = this.history.slice(-50);
    }

    return newState;
  }

  getHistory(): ReadonlyArray<UserState> {
    return this.history;
  }

  getTimeInState(): number {
    return Date.now() - this.currentState.since;
  }

  isAvailableForInterruption(): boolean {
    if (this.currentState.current === "meeting") return false;
    if (this.currentState.current === "deep_work" && this.currentState.confidence > 0.8) return false;
    if (this.currentState.current === "frustrated") return false;
    return true;
  }

  private countSameApp(observations: ReadonlyArray<Observation>): number {
    if (observations.length === 0) return 0;
    const last = observations[observations.length - 1]!;
    const app = last.context?.["app"] ?? last.context?.["window"] ?? "";
    let count = 0;
    for (let i = observations.length - 1; i >= 0; i--) {
      const o = observations[i]!;
      if ((o.context?.["app"] ?? o.context?.["window"] ?? "") === app) count++;
      else break;
    }
    return count;
  }

  private countAppSwitches(observations: ReadonlyArray<Observation>): number {
    let switches = 0;
    let lastApp = "";
    for (const o of observations) {
      const app = o.context?.["app"] ?? o.context?.["window"] ?? "";
      if (app && app !== lastApp) {
        switches++;
        lastApp = app;
      }
    }
    return switches;
  }
}
