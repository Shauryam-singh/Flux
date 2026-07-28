import type { TaskGraph, GraphNode, GraphEdge, Task } from "@ai-agent/exec-types";

export interface TaskGraphEngine {
  createGraph(name: string, description: string, tasks: ReadonlyArray<Task>): TaskGraph;
  addNode(graphId: string, node: Omit<GraphNode, "id">): GraphNode;
  addEdge(graphId: string, edge: Omit<GraphEdge, "id">): GraphEdge;
  getGraph(graphId: string): TaskGraph | null;
  getAll(): ReadonlyArray<TaskGraph>;
  getReadyTasks(graphId: string): ReadonlyArray<Task>;
  markComplete(graphId: string, taskId: string): void;
  markFailed(graphId: string, taskId: string): void;
  expandGraph(graphId: string, taskId: string, newTasks: ReadonlyArray<Task>): void;
  validateGraph(graphId: string): GraphValidation;
  getProgress(graphId: string): number;
  deleteGraph(graphId: string): void;
}

export interface GraphValidation {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly cycleDetected: boolean;
  readonly orphans: ReadonlyArray<string>;
}
