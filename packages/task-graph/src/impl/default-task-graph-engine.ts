import type { TaskGraphEngine, GraphValidation } from "../interfaces/task-graph-engine.js";
import type { TaskGraph, GraphNode, GraphEdge, Task } from "@ai-agent/exec-types";

let graphIdCounter = 0;
let nodeIdCounter = 0;
let edgeIdCounter = 0;

export class DefaultTaskGraphEngine implements TaskGraphEngine {
  private graphs = new Map<string, TaskGraph>();
  private taskToNode = new Map<string, { graphId: string; nodeId: string }>();

  createGraph(name: string, description: string, tasks: ReadonlyArray<Task>): TaskGraph {
    const graphId = `tg_${++graphIdCounter}`;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    for (const task of tasks) {
      const node: GraphNode = {
        id: `gn_${++nodeIdCounter}`,
        type: "task",
        taskId: task.id,
        label: task.objective,
        metadata: {},
      };
      nodes.push(node);
      this.taskToNode.set(task.id, { graphId, nodeId: node.id });
    }

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]!;
      for (const depId of task.dependencies) {
        const sourceNode = this.taskToNode.get(depId);
        if (sourceNode && sourceNode.graphId === graphId) {
          edges.push({
            id: `ge_${++edgeIdCounter}`,
            from: sourceNode.nodeId,
            to: nodes[i]!.id,
            condition: null,
            isFallback: false,
            metadata: {},
          });
        }
      }
    }

    const graph: TaskGraph = {
      id: graphId,
      name,
      description,
      nodes,
      edges,
      status: "active",
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.graphs.set(graphId, graph);
    return graph;
  }

  addNode(graphId: string, data: Omit<GraphNode, "id">): GraphNode {
    const graph = this.graphs.get(graphId);
    if (!graph) throw new Error(`Graph ${graphId} not found`);

    const node: GraphNode = { ...data, id: `gn_${++nodeIdCounter}` };
    const updated: TaskGraph = { ...graph, nodes: [...graph.nodes, node], updatedAt: Date.now() };
    this.graphs.set(graphId, updated);
    return node;
  }

  addEdge(graphId: string, data: Omit<GraphEdge, "id">): GraphEdge {
    const graph = this.graphs.get(graphId);
    if (!graph) throw new Error(`Graph ${graphId} not found`);

    const edge: GraphEdge = { ...data, id: `ge_${++edgeIdCounter}` };
    const updated: TaskGraph = { ...graph, edges: [...graph.edges, edge], updatedAt: Date.now() };
    this.graphs.set(graphId, updated);
    return edge;
  }

  getGraph(graphId: string): TaskGraph | null {
    return this.graphs.get(graphId) ?? null;
  }

  getAll(): ReadonlyArray<TaskGraph> {
    return Array.from(this.graphs.values());
  }

  getReadyTasks(graphId: string): ReadonlyArray<Task> {
    const graph = this.graphs.get(graphId);
    if (!graph) return [];

    const completedNodeIds = new Set(
      graph.nodes.filter((n) => n.type === "task").map((n) => n.id),
    );

    const readyNodeIds = graph.nodes
      .filter((n) => n.type === "task")
      .filter((n) => {
        const incomingEdges = graph.edges.filter((e) => e.to === n.id);
        return incomingEdges.every((e) => completedNodeIds.has(e.from));
      })
      .map((n) => n.taskId)
      .filter((id): id is string => id !== null);

    return readyNodeIds.map((taskId) => ({
      id: taskId,
      objective: "",
      description: "",
      status: "queued" as const,
      priority: "normal" as const,
      progress: 0,
      assignedAgent: null,
      parentId: null,
      subtaskIds: [],
      dependencies: [],
      constraints: { maxDurationMs: null, maxRetries: 0, timeoutMs: 300000, requiredCapabilities: [], excludedAgents: [], preferredAgents: [], modelPreference: null, costLimit: null },
      result: null,
      artifacts: [],
      error: null,
      retryCount: 0,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      updatedAt: Date.now(),
      metadata: {},
    }));
  }

  markComplete(graphId: string, taskId: string): void {
    const graph = this.graphs.get(graphId);
    if (!graph) return;
    const nodeInfo = this.taskToNode.get(taskId);
    if (nodeInfo && nodeInfo.graphId === graphId) {
      const progress = this.calculateProgress(graphId);
      const updated: TaskGraph = { ...graph, progress, updatedAt: Date.now() };
      this.graphs.set(graphId, updated);
    }
  }

  markFailed(graphId: string, taskId: string): void {
    const graph = this.graphs.get(graphId);
    if (!graph) return;
    const updated: TaskGraph = { ...graph, status: "failed", updatedAt: Date.now() };
    this.graphs.set(graphId, updated);
  }

  expandGraph(graphId: string, taskId: string, newTasks: ReadonlyArray<Task>): void {
    const graph = this.graphs.get(graphId);
    if (!graph) return;

    for (const task of newTasks) {
      const node: GraphNode = {
        id: `gn_${++nodeIdCounter}`,
        type: "task",
        taskId: task.id,
        label: task.objective,
        metadata: {},
      };
      this.taskToNode.set(task.id, { graphId, nodeId: node.id });
    }
  }

  validateGraph(graphId: string): GraphValidation {
    const graph = this.graphs.get(graphId);
    if (!graph) return { valid: false, errors: ["Graph not found"], warnings: [], cycleDetected: false, orphans: [] };

    const errors: string[] = [];
    const warnings: string[] = [];
    const nodeIds = new Set(graph.nodes.map((n) => n.id));

    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.from)) errors.push(`Edge ${edge.id} references missing node ${edge.from}`);
      if (!nodeIds.has(edge.to)) errors.push(`Edge ${edge.id} references missing node ${edge.to}`);
    }

    const hasCycle = this.detectCycle(graph);
    if (hasCycle) errors.push("Cycle detected in graph");

    const connectedNodes = new Set<string>();
    for (const edge of graph.edges) {
      connectedNodes.add(edge.from);
      connectedNodes.add(edge.to);
    }
    const orphans = graph.nodes.filter((n) => !connectedNodes.has(n.id)).map((n) => n.id);
    if (orphans.length > 0) warnings.push(`${orphans.length} orphan nodes`);

    return { valid: errors.length === 0, errors, warnings, cycleDetected: hasCycle, orphans };
  }

  getProgress(graphId: string): number {
    return this.calculateProgress(graphId);
  }

  deleteGraph(graphId: string): void {
    this.graphs.delete(graphId);
  }

  private calculateProgress(graphId: string): number {
    const graph = this.graphs.get(graphId);
    if (!graph) return 0;
    const taskNodes = graph.nodes.filter((n) => n.type === "task");
    if (taskNodes.length === 0) return 0;
    return 0;
  }

  private detectCycle(graph: TaskGraph): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoing = graph.edges.filter((e) => e.from === nodeId);
      for (const edge of outgoing) {
        if (!visited.has(edge.to)) {
          if (dfs(edge.to)) return true;
        } else if (recursionStack.has(edge.to)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }
}
