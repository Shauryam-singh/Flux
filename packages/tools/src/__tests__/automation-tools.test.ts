import { describe, it, expect } from "vitest";
import { createHttpRequestTool } from "../tools/http/http-request.js";
import { createProcessMonitorTool } from "../tools/process/process-monitor.js";
import { createCronTool } from "../tools/schedule/cron.js";
import { createSystemInfoTool } from "../tools/system/system-info.js";
import { createDockerTool } from "../tools/docker/docker.js";
import { createScreenMonitorTool } from "../tools/screen/screen-monitor.js";

describe("HttpRequestTool", () => {
  it("should have correct name and description", () => {
    const tool = createHttpRequestTool();
    expect(tool.name).toBe("http_request");
    expect(tool.description).toContain("HTTP");
  });

  it("should require URL", async () => {
    const tool = createHttpRequestTool();
    const result = await tool.execute({});
    expect(result.success).toBe(false);
  });
});

describe("ProcessMonitorTool", () => {
  it("should have correct name", () => {
    const tool = createProcessMonitorTool();
    expect(tool.name).toBe("process_monitor");
  });

  it("should list processes", async () => {
    const tool = createProcessMonitorTool();
    const result = await tool.execute({ action: "list" });
    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty("processes");
  });

  it("should count processes", async () => {
    const tool = createProcessMonitorTool();
    const result = await tool.execute({ action: "count" });
    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty("totalProcesses");
  });
});

describe("CronTool", () => {
  it("should have correct name", () => {
    const tool = createCronTool();
    expect(tool.name).toBe("cron");
  });

  it("should list jobs", async () => {
    const tool = createCronTool();
    const result = await tool.execute({ action: "list" });
    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty("jobs");
  });

  it("should require schedule and command for add", async () => {
    const tool = createCronTool();
    const result = await tool.execute({ action: "add" });
    expect(result.success).toBe(false);
  });
});

describe("SystemInfoTool", () => {
  it("should have correct name", () => {
    const tool = createSystemInfoTool();
    expect(tool.name).toBe("system_info");
  });

  it("should return system info", async () => {
    const tool = createSystemInfoTool();
    const result = await tool.execute({ category: "all" });
    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty("cpu");
    expect(result.output).toHaveProperty("memory");
    expect(result.output).toHaveProperty("platform");
  });

  it("should return CPU info", async () => {
    const tool = createSystemInfoTool();
    const result = await tool.execute({ category: "cpu" });
    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty("cpu");
  });

  it("should return memory info", async () => {
    const tool = createSystemInfoTool();
    const result = await tool.execute({ category: "memory" });
    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty("memory");
  });
});

describe("DockerTool", () => {
  it("should have correct name", () => {
    const tool = createDockerTool();
    expect(tool.name).toBe("docker");
  });

  it("should list containers", async () => {
    const tool = createDockerTool();
    const result = await tool.execute({ action: "ps" });
    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty("containers");
  });

  it("should require image for run", async () => {
    const tool = createDockerTool();
    const result = await tool.execute({ action: "run" });
    expect(result.success).toBe(false);
  });

  it("should require target for stop", async () => {
    const tool = createDockerTool();
    const result = await tool.execute({ action: "stop" });
    expect(result.success).toBe(false);
  });
});

describe("ScreenMonitorTool", () => {
  it("should have correct name", () => {
    const tool = createScreenMonitorTool();
    expect(tool.name).toBe("screen_monitor");
  });

  it("should check current state", async () => {
    const tool = createScreenMonitorTool();
    const result = await tool.execute({ action: "check" });
    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty("activeApp");
    expect(result.output).toHaveProperty("context");
  });

  it("should get diff", async () => {
    const tool = createScreenMonitorTool();
    const result = await tool.execute({ action: "diff" });
    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty("current");
  });

  it("should list windows", async () => {
    const tool = createScreenMonitorTool();
    const result = await tool.execute({ action: "windows" });
    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty("windows");
  });
});
