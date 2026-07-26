import { describe, it, expect } from "vitest";
import { classifyIntent } from "../impl/intent-classifier.js";

describe("classifyIntent", () => {
  it("should return 'search' for search-related queries", () => {
    expect(classifyIntent("search for cats")).toBe("search");
    expect(classifyIntent("what is TypeScript")).toBe("search");
    expect(classifyIntent("look up the weather")).toBe("search");
    expect(classifyIntent("find information about dogs")).toBe("search");
    expect(classifyIntent("who is the president")).toBe("search");
  });

  it("should return 'coding' for code-related queries", () => {
    expect(classifyIntent("write a function to sort")).toBe("coding");
    expect(classifyIntent("fix this bug in my code")).toBe("coding");
    expect(classifyIntent("refactor the auth module")).toBe("coding");
    expect(classifyIntent("create a new file")).toBe("coding");
    expect(classifyIntent("debug the failing test")).toBe("coding");
    expect(classifyIntent("create a React project")).toBe("coding");
  });

  it("should return 'system' for system control queries", () => {
    expect(classifyIntent("open vs code")).toBe("system");
    expect(classifyIntent("Set volume to 50%")).toBe("system");
    expect(classifyIntent("what is the uptime")).toBe("system");
    expect(classifyIntent("what is my battery level")).toBe("system");
    expect(classifyIntent("take a screenshot")).toBe("system");
    expect(classifyIntent("shutdown the system")).toBe("system");
    expect(classifyIntent("Show system info")).toBe("system");
  });

  it("should return 'reminders' for task/note queries", () => {
    expect(classifyIntent("add a reminder to buy milk")).toBe("reminders");
    expect(classifyIntent("Show my open tasks")).toBe("reminders");
    expect(classifyIntent("list my reminders")).toBe("reminders");
    expect(classifyIntent("my tasks")).toBe("reminders");
    expect(classifyIntent("delete a reminder")).toBe("reminders");
    expect(classifyIntent("complete a task")).toBe("reminders");
    expect(classifyIntent("add a note about meeting")).toBe("reminders");
  });

  it("should return null for ambiguous input", () => {
    expect(classifyIntent("hello")).toBeNull();
    expect(classifyIntent("hi")).toBeNull();
    expect(classifyIntent("okay")).toBeNull();
    expect(classifyIntent("yes")).toBeNull();
  });
});
