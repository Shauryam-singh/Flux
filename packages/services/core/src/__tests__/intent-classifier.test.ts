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
  });

  it("should return null for ambiguous input", () => {
    expect(classifyIntent("hello")).toBeNull();
    expect(classifyIntent("hi")).toBeNull();
    expect(classifyIntent("okay")).toBeNull();
    expect(classifyIntent("yes")).toBeNull();
  });
});
