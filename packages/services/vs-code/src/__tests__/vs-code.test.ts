import { describe, it, expect } from "vitest";
import { createVsCodeService } from "../impl/vs-code-service.js";

describe("VsCodeService", () => {
  const svc = createVsCodeService();

  it("has correct name", () => {
    expect(svc.name).toBe("vs-code");
  });

  it("can handle vs code commands", () => {
    expect(svc.canHandle("open file src/index.ts")).toBe(true);
    expect(svc.canHandle("open folder projects/my-app")).toBe(true);
    expect(svc.canHandle("run tests")).toBe(true);
    expect(svc.canHandle("run test auth.test")).toBe(true);
    expect(svc.canHandle("install extension eamodio.gitlens")).toBe(true);
    expect(svc.canHandle("remove extension some.ext")).toBe(true);
    expect(svc.canHandle("list extensions")).toBe(true);
    expect(svc.canHandle("change theme monokai")).toBe(true);
    expect(svc.canHandle("format document")).toBe(true);
    expect(svc.canHandle("toggle sidebar")).toBe(true);
    expect(svc.canHandle("search in files")).toBe(true);
    expect(svc.canHandle("go to line 42")).toBe(true);
    expect(svc.canHandle("rename symbol")).toBe(true);
    expect(svc.canHandle("organize imports")).toBe(true);
  });

  it("can handle vscode variant", () => {
    expect(svc.canHandle("vscode open file test.ts")).toBe(true);
  });

  it("rejects unrelated input", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("play music")).toBe(false);
    expect(svc.canHandle("what time is it")).toBe(false);
  });
});
