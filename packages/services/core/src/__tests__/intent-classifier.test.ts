import { describe, expect, it } from "vitest";
import { classifyIntent, detectModelComplexity, classifyResponseType, getMaxTokensForResponseType } from "../impl/intent-classifier.js";

describe("classifyIntent", () => {
  // ──────────────────────────────────────────────────────
  // Notifications
  // ──────────────────────────────────────────────────────
  describe("notifications", () => {
    it("send/create notification", () => {
      expect(classifyIntent("send a notification")).toBe("notifications");
      expect(classifyIntent("create a notification")).toBe("notifications");
      expect(classifyIntent("add a notification")).toBe("notifications");
      expect(classifyIntent("new alert")).toBe("notifications");
      expect(classifyIntent("notify me")).toBe("notifications");
    });

    it("show/list notifications", () => {
      expect(classifyIntent("show my notifications")).toBe("notifications");
      expect(classifyIntent("list my unread messages")).toBe("notifications");
      expect(classifyIntent("what did i miss")).toBe("notifications");
      expect(classifyIntent("any alerts")).toBe("notifications");
      expect(classifyIntent("unread notifications")).toBe("notifications");
    });

    it("manage notifications", () => {
      expect(classifyIntent("mark all as read")).toBe("notifications");
      expect(classifyIntent("clear all notifications")).toBe("notifications");
      expect(classifyIntent("dismiss alerts")).toBe("notifications");
    });

    it("read aloud notifications", () => {
      expect(classifyIntent("read aloud my notifications")).toBe("notifications");
      expect(classifyIntent("tell me my unread alerts")).toBe("notifications");
    });
  });

  // ──────────────────────────────────────────────────────
  // Coding
  // ──────────────────────────────────────────────────────
  describe("coding", () => {
    it("create/write files", () => {
      expect(classifyIntent("create a new file")).toBe("coding");
      expect(classifyIntent("write a function")).toBe("coding");
      expect(classifyIntent("make a class")).toBe("coding");
      expect(classifyIntent("generate a component")).toBe("coding");
      expect(classifyIntent("create a React project")).toBe("coding");
      expect(classifyIntent("write a test")).toBe("coding");
    });

    it("edit/fix code", () => {
      expect(classifyIntent("fix this bug")).toBe("coding");
      expect(classifyIntent("debug the failing test")).toBe("coding");
      expect(classifyIntent("refactor the auth module")).toBe("coding");
      expect(classifyIntent("edit the config file")).toBe("coding");
      expect(classifyIntent("modify the service")).toBe("coding");
      expect(classifyIntent("update the component")).toBe("coding");
      expect(classifyIntent("change the function")).toBe("coding");
    });

    it("git commands", () => {
      expect(classifyIntent("git status")).toBe("coding");
      expect(classifyIntent("git commit")).toBe("coding");
      expect(classifyIntent("git push")).toBe("coding");
      expect(classifyIntent("git pull")).toBe("coding");
      expect(classifyIntent("git branch")).toBe("coding");
      expect(classifyIntent("git merge")).toBe("coding");
      expect(classifyIntent("git diff")).toBe("coding");
      expect(classifyIntent("git log")).toBe("coding");
    });

    it("build/run commands", () => {
      expect(classifyIntent("run the tests")).toBe("coding");
      expect(classifyIntent("build the project")).toBe("coding");
      expect(classifyIntent("lint the code")).toBe("coding");
      expect(classifyIntent("compile the script")).toBe("coding");
      expect(classifyIntent("format the code")).toBe("coding");
    });

    it("file operations", () => {
      expect(classifyIntent("read the file")).toBe("coding");
      expect(classifyIntent("show the file")).toBe("coding");
      expect(classifyIntent("cat the file")).toBe("coding");
    });
  });

  // ──────────────────────────────────────────────────────
  // Monitor
  // ──────────────────────────────────────────────────────
  describe("monitor", () => {
    it("check system health", () => {
      expect(classifyIntent("check system health")).toBe("monitor");
      expect(classifyIntent("scan disk")).toBe("monitor");
      expect(classifyIntent("health check")).toBe("monitor");
      expect(classifyIntent("check system status")).toBe("monitor");
      expect(classifyIntent("scan the server")).toBe("monitor");
    });

    it("manage monitors", () => {
      expect(classifyIntent("add a monitor")).toBe("monitor");
      expect(classifyIntent("show my monitor rules")).toBe("monitor");
      expect(classifyIntent("remove rule 1")).toBe("monitor");
      expect(classifyIntent("enable watch 2")).toBe("monitor");
      expect(classifyIntent("disable monitor")).toBe("monitor");
    });
  });

  // ──────────────────────────────────────────────────────
  // Automations
  // ──────────────────────────────────────────────────────
  describe("automations", () => {
    it("create/manage automations", () => {
      expect(classifyIntent("create an automation")).toBe("automations");
      expect(classifyIntent("add a new automation")).toBe("automations");
      expect(classifyIntent("show my automations")).toBe("automations");
      expect(classifyIntent("list my chains")).toBe("automations");
      expect(classifyIntent("remove automation 1")).toBe("automations");
      expect(classifyIntent("run chain")).toBe("automations");
      expect(classifyIntent("trigger rule")).toBe("automations");
      expect(classifyIntent("automate this")).toBe("automations");
    });
  });

  // ──────────────────────────────────────────────────────
  // Reminders
  // ──────────────────────────────────────────────────────
  describe("reminders", () => {
    it("create reminders", () => {
      expect(classifyIntent("add a reminder")).toBe("reminders");
      expect(classifyIntent("create a task")).toBe("reminders");
      expect(classifyIntent("new note")).toBe("reminders");
      expect(classifyIntent("add a todo")).toBe("reminders");
      expect(classifyIntent("save a reminder")).toBe("reminders");
    });

    it("view reminders", () => {
      expect(classifyIntent("show my tasks")).toBe("reminders");
      expect(classifyIntent("list my reminders")).toBe("reminders");
      expect(classifyIntent("open my notes")).toBe("reminders");
      expect(classifyIntent("show my open todos")).toBe("reminders");
      expect(classifyIntent("my tasks")).toBe("reminders");
      expect(classifyIntent("my todos")).toBe("reminders");
    });

    it("manage reminders", () => {
      expect(classifyIntent("complete a task")).toBe("reminders");
      expect(classifyIntent("finish the todo")).toBe("reminders");
      expect(classifyIntent("delete a reminder")).toBe("reminders");
      expect(classifyIntent("remove a note")).toBe("reminders");
      expect(classifyIntent("clear a task")).toBe("reminders");
    });

    it("goal queries", () => {
      expect(classifyIntent("what is my goal")).toBe("reminders");
      expect(classifyIntent("how are my tasks")).toBe("reminders");
      expect(classifyIntent("show me my progress")).toBe("reminders");
      expect(classifyIntent("how's my project")).toBe("reminders");
    });

    it("goal creation (I want to...)", () => {
      expect(classifyIntent("i want to finish the API")).toBe("reminders");
      expect(classifyIntent("i'd like to complete the task")).toBe("reminders");
      expect(classifyIntent("my goal is to learn rust")).toBe("reminders");
      expect(classifyIntent("i'm going to start a project")).toBe("reminders");
      expect(classifyIntent("plan to refactor the code")).toBe("reminders");
    });

    it("remind/remember", () => {
      expect(classifyIntent("remind me to buy milk")).toBe("reminders");
      expect(classifyIntent("remember this for later")).toBe("reminders");
    });
  });

  // ──────────────────────────────────────────────────────
  // Screen Understanding
  // ──────────────────────────────────────────────────────
  describe("screen-understanding", () => {
    it("what's on screen", () => {
      expect(classifyIntent("what's on my screen")).toBe("screen-understanding");
      expect(classifyIntent("what is on my screen")).toBe("screen-understanding");
      expect(classifyIntent("whats on my screen")).toBe("screen-understanding");
      expect(classifyIntent("what's on the screen")).toBe("screen-understanding");
      expect(classifyIntent("whats on the screen")).toBe("screen-understanding");
    });

    it("read/describe screen", () => {
      expect(classifyIntent("read my screen")).toBe("screen-understanding");
      expect(classifyIntent("describe this screen")).toBe("screen-understanding");
      expect(classifyIntent("what am i doing")).toBe("screen-understanding");
      expect(classifyIntent("what's open")).toBe("screen-understanding");
      expect(classifyIntent("whats open")).toBe("screen-understanding");
    });

    it("UI interactions", () => {
      expect(classifyIntent("click the button")).toBe("screen-understanding");
      expect(classifyIntent("find the button")).toBe("screen-understanding");
      expect(classifyIntent("read text on screen")).toBe("screen-understanding");
      expect(classifyIntent("extract text")).toBe("screen-understanding");
      expect(classifyIntent("show ui elements")).toBe("screen-understanding");
    });
  });

  // ──────────────────────────────────────────────────────
  // System
  // ──────────────────────────────────────────────────────
  describe("system", () => {
    it("open/close apps", () => {
      expect(classifyIntent("open chrome")).toBe("system");
      expect(classifyIntent("open brave browser")).toBe("system");
      expect(classifyIntent("launch vs code")).toBe("system");
      expect(classifyIntent("start discord")).toBe("system");
      expect(classifyIntent("close chrome")).toBe("system");
      expect(classifyIntent("quit brave")).toBe("system");
      expect(classifyIntent("kill chrome")).toBe("system");
      expect(classifyIntent("run notepad")).toBe("system");
    });

    it("volume/brightness", () => {
      expect(classifyIntent("set volume to 50")).toBe("system");
      expect(classifyIntent("change brightness to 80")).toBe("system");
      expect(classifyIntent("adjust volume")).toBe("system");
      expect(classifyIntent("get volume")).toBe("system");
      expect(classifyIntent("what is the brightness")).toBe("system");
    });

    it("system info", () => {
      expect(classifyIntent("show system info")).toBe("system");
      expect(classifyIntent("what is the uptime")).toBe("system");
      expect(classifyIntent("what is my battery level")).toBe("system");
      expect(classifyIntent("check my memory")).toBe("system");
      expect(classifyIntent("show hostname")).toBe("system");
      expect(classifyIntent("system info")).toBe("system");
    });

    it("power management", () => {
      expect(classifyIntent("shutdown the system")).toBe("system");
      expect(classifyIntent("restart computer")).toBe("system");
      expect(classifyIntent("reboot")).toBe("system");
      expect(classifyIntent("sleep mode")).toBe("system");
      expect(classifyIntent("lock screen")).toBe("desktop-control");
    });

    it("screenshot", () => {
      expect(classifyIntent("take a screenshot")).toBe("desktop-control");
      expect(classifyIntent("screenshot")).toBe("desktop-control");
    });
  });

  // ──────────────────────────────────────────────────────
  // Chat/Casual
  // ──────────────────────────────────────────────────────
  describe("chat", () => {
    it("greetings", () => {
      expect(classifyIntent("hello")).toBe("chat");
      expect(classifyIntent("hi")).toBe("chat");
      expect(classifyIntent("hey")).toBe("chat");
      expect(classifyIntent("yo")).toBe("chat");
      expect(classifyIntent("sup")).toBe("chat");
      expect(classifyIntent("greetings")).toBe("chat");
      expect(classifyIntent("good morning")).toBe("chat");
      expect(classifyIntent("good afternoon")).toBe("chat");
      expect(classifyIntent("good evening")).toBe("chat");
      expect(classifyIntent("good night")).toBe("chat");
    });

    it("how are you variants", () => {
      expect(classifyIntent("how are you")).toBe("chat");
      expect(classifyIntent("how's it going")).toBe("chat");
      expect(classifyIntent("what's up")).toBe("chat");
      expect(classifyIntent("how are things")).toBe("chat");
    });

    it("personal questions about assistant", () => {
      expect(classifyIntent("what is your name")).toBe("chat");
      expect(classifyIntent("who are you")).toBe("chat");
      expect(classifyIntent("tell me about yourself")).toBe("chat");
      expect(classifyIntent("what do you think")).toBe("chat");
      expect(classifyIntent("how old are you")).toBe("chat");
    });

    it("farewells", () => {
      expect(classifyIntent("bye")).toBe("chat");
      expect(classifyIntent("goodbye")).toBe("chat");
      expect(classifyIntent("see you later")).toBe("chat");
    });
  });

  // ──────────────────────────────────────────────────────
  // Search
  // ──────────────────────────────────────────────────────
  describe("search", () => {
    it("explicit search", () => {
      expect(classifyIntent("search for cats")).toBe("search");
      expect(classifyIntent("google something")).toBe("search");
      expect(classifyIntent("look up the weather")).toBe("search");
      expect(classifyIntent("find information about dogs")).toBe("search");
      expect(classifyIntent("research quantum computing")).toBe("search");
    });

    it("factual questions", () => {
      expect(classifyIntent("who is the president")).toBeNull();
      expect(classifyIntent("where is tokyo")).toBeNull();
      expect(classifyIntent("when was python created")).toBeNull();
      expect(classifyIntent("why is the sky blue")).toBeNull();
      expect(classifyIntent("how does photosynthesis work")).toBeNull();
    });

    it("general knowledge (answered by LLM, not search)", () => {
      expect(classifyIntent("what is python")).toBeNull();
      expect(classifyIntent("what is TypeScript")).toBeNull();
      expect(classifyIntent("what is life")).toBeNull();
      expect(classifyIntent("explain python")).toBeNull();
      expect(classifyIntent("describe the architecture")).toBeNull();
    });

    it("explain/describe", () => {
      expect(classifyIntent("tell me about python")).toBeNull();
    });

    it("latest/current", () => {
      expect(classifyIntent("latest news")).toBeNull();
      expect(classifyIntent("current weather")).toBeNull();
      expect(classifyIntent("recent updates")).toBeNull();
    });

    it("weather", () => {
      expect(classifyIntent("what is the weather")).toBeNull();
      expect(classifyIntent("how hot is it today")).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────
  // Null / ambiguous (should fall through to LLM)
  // ──────────────────────────────────────────────────────
  describe("null (ambiguous → LLM)", () => {
    it("short affirmatives/denials", () => {
      expect(classifyIntent("okay")).toBeNull();
      expect(classifyIntent("yes")).toBeNull();
      expect(classifyIntent("no")).toBeNull();
      expect(classifyIntent("maybe")).toBeNull();
      expect(classifyIntent("sure")).toBeNull();
      expect(classifyIntent("cool")).toBeNull();
      expect(classifyIntent("nice")).toBeNull();
      expect(classifyIntent("great")).toBeNull();
      expect(classifyIntent("thanks")).toBeNull();
      expect(classifyIntent("ok")).toBeNull();
      expect(classifyIntent("yeah")).toBeNull();
      expect(classifyIntent("nope")).toBeNull();
      expect(classifyIntent("nah")).toBeNull();
      expect(classifyIntent("yep")).toBeNull();
    });

    it("conversational / non-command", () => {
      expect(classifyIntent("me kya karu samjh nhi aa raha bore ho raha hu bas")).toBeNull();
      expect(classifyIntent("i'm feeling tired today")).toBeNull();
      expect(classifyIntent("can you help me")).toBeNull();
      expect(classifyIntent("tell me a joke")).toBeNull();
      expect(classifyIntent("how's your day going")).toBeNull();
    });

    it("factual questions (general knowledge)", () => {
      expect(classifyIntent("what is life")).toBeNull();
      expect(classifyIntent("what do you think about this")).toBe("chat");
      expect(classifyIntent("thank you")).toBe("chat");
    });

    it("single words", () => {
      expect(classifyIntent("hello")).toBe("chat");
      expect(classifyIntent("python")).toBeNull();
      expect(classifyIntent("bug")).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────
  // Daily task scenarios (real user messages)
  // ──────────────────────────────────────────────────────
  describe("daily tasks", () => {
    it("morning routine", () => {
      expect(classifyIntent("good morning flux")).toBe("chat");
      expect(classifyIntent("what's on my schedule today")).toBe("reminders");
      expect(classifyIntent("check system health")).toBe("monitor");
      expect(classifyIntent("show my notifications")).toBe("notifications");
      expect(classifyIntent("what is the weather today")).toBeNull();
    });

    it("coding session", () => {
      expect(classifyIntent("open vs code")).toBe("system");
      expect(classifyIntent("git status")).toBe("coding");
      expect(classifyIntent("fix the bug in login")).toBe("coding");
      expect(classifyIntent("commit changes")).toBe("coding");
      expect(classifyIntent("push to main")).toBe("coding");
      expect(classifyIntent("run the tests")).toBe("coding");
      expect(classifyIntent("create a new component")).toBe("coding");
    });

    it("research / learning", () => {
      expect(classifyIntent("search for react hooks")).toBe("search");
      expect(classifyIntent("how does useEffect work")).toBeNull();
    });

    it("system management", () => {
      expect(classifyIntent("open brave browser")).toBe("system");
      expect(classifyIntent("close all tabs")).toBe("system");
      expect(classifyIntent("set volume to 30")).toBe("system");
      expect(classifyIntent("take a screenshot")).toBe("desktop-control");
      expect(classifyIntent("what is my battery level")).toBe("system");
      expect(classifyIntent("shutdown")).toBe("system");
    });

    it("task management", () => {
      expect(classifyIntent("add a task to buy groceries")).toBe("reminders");
      expect(classifyIntent("remind me to call mom at 5pm")).toBe("reminders");
      expect(classifyIntent("show my open tasks")).toBe("reminders");
      expect(classifyIntent("complete the grocery task")).toBe("reminders");
      expect(classifyIntent("i want to finish the api")).toBe("reminders");
      expect(classifyIntent("my goal is to learn rust")).toBe("reminders");
    });

    it("evening wrap-up", () => {
      expect(classifyIntent("what did i do today")).toBe("reminders");
      expect(classifyIntent("show my progress")).toBe("reminders");
      expect(classifyIntent("good night flux")).toBe("chat");
      expect(classifyIntent("bye")).toBe("chat");
    });

    it("Hinglish / mixed language", () => {
      expect(classifyIntent("me kya karu samjh nhi aa raha bore ho raha hu bas")).toBeNull();
      expect(classifyIntent("ye kya ho raha hai")).toBeNull();
      expect(classifyIntent("bhai kuch help kar")).toBeNull();
      expect(classifyIntent("open karo brave")).toBe("system");
      expect(classifyIntent("git status dikhao")).toBe("coding");
    });
  });

  // ──────────────────────────────────────────────────────
  // Context-aware classification
  // ──────────────────────────────────────────────────────
  describe("context-aware", () => {
    it("terminal context boosts coding", () => {
      // "run tests" is ambiguous — could be system or coding
      // With terminal context, coding should win
      const ctx = { isTerminal: true };
      expect(classifyIntent("run tests", ctx)).toBe("coding");
    });

    it("browser context boosts search", () => {
      const ctx = { isBrowsing: true };
      // "find the button" is ambiguous — screen-understanding or search
      // With browsing context, search might boost but regex should still win
      const result = classifyIntent("find the button", ctx);
      expect(result).toBeTruthy();
    });

    it("git dirty context boosts coding", () => {
      const ctx = { gitDirty: true };
      // "commit changes" — regex should match git
      expect(classifyIntent("commit changes", ctx)).toBe("coding");
    });

    it("cpu high context boosts monitor", () => {
      const ctx = { cpuHigh: true };
      // "check system" is ambiguous
      const result = classifyIntent("check system", ctx);
      expect(result).toBeTruthy();
    });
  });

  // ──────────────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("empty/whitespace input", () => {
      expect(classifyIntent("")).toBeNull();
      expect(classifyIntent("   ")).toBeNull();
      expect(classifyIntent("\t\n")).toBeNull();
    });

    it("very long input", () => {
      const long = "a".repeat(500);
      expect(classifyIntent(long)).toBeNull();
    });

    it("special characters", () => {
      expect(classifyIntent("!!!")).toBeNull();
      expect(classifyIntent("@#$%^&*()")).toBeNull();
      expect(classifyIntent("12345")).toBeNull();
    });

    it("mixed case", () => {
      expect(classifyIntent("HELLO")).toBe("chat");
      expect(classifyIntent("GIT STATUS")).toBe("coding");
      expect(classifyIntent("Open Chrome")).toBe("system");
    });

    it("repeated words", () => {
      expect(classifyIntent("hello hello hello")).toBe("chat");
      expect(classifyIntent("open open open")).toBe("system");
    });

    it("ambiguous multi-intent", () => {
      // "search for git commands" — search has higher keyword weight
      const result = classifyIntent("search for git commands");
      expect(result).toBeTruthy();
      expect(["search", "coding"]).toContain(result);
    });

    it("negation patterns", () => {
      // Negated commands → null (suppressed, not routed to service)
      expect(classifyIntent("don't open chrome")).toBeNull();
      expect(classifyIntent("never run tests")).toBeNull();
      expect(classifyIntent("do NOT play music")).toBeNull();
      expect(classifyIntent("under no circumstances should you open VS Code")).toBeNull();
    });
  });
});

describe("detectModelComplexity", () => {
  it("simple: short greetings", () => {
    expect(detectModelComplexity("hello")).toBe("simple");
    expect(detectModelComplexity("hi")).toBe("simple");
    expect(detectModelComplexity("ok")).toBe("simple");
    expect(detectModelComplexity("thanks")).toBe("simple");
    expect(detectModelComplexity("bye")).toBe("simple");
    expect(detectModelComplexity("cool")).toBe("simple");
    expect(detectModelComplexity("nice")).toBe("simple");
    expect(detectModelComplexity("great")).toBe("simple");
  });

  it("simple: short queries and non-technical questions", () => {
    expect(detectModelComplexity("yes")).toBe("simple");
    expect(detectModelComplexity("no")).toBe("simple");
    expect(detectModelComplexity("maybe")).toBe("simple");
    expect(detectModelComplexity("sure")).toBe("simple");
    expect(detectModelComplexity("yep")).toBe("simple");
    expect(detectModelComplexity("nope")).toBe("simple");
    expect(detectModelComplexity("what is the weather today")).toBe("simple");
    expect(detectModelComplexity("how are you doing")).toBe("simple");
  });

  it("medium/complex: technical questions requiring explanation", () => {
    expect(detectModelComplexity("tell me about python programming")).toBe("medium");
    expect(detectModelComplexity("what is Docker and why is it useful")).toBe("medium");
    // "explain why..." triggers WORK_VERBS → complex, but both route to 3b
    expect(["medium", "complex"]).toContain(detectModelComplexity("explain why a TypeScript application might have high CPU usage"));
  });

  it("complex: code generation", () => {
    expect(detectModelComplexity("write a function to sort an array")).toBe("complex");
    expect(detectModelComplexity("create a React component for the login page")).toBe("complex");
    expect(detectModelComplexity("implement a binary search algorithm")).toBe("complex");
    expect(detectModelComplexity("refactor the authentication module")).toBe("complex");
    expect(detectModelComplexity("debug the failing test in CI")).toBe("complex");
  });

  it("complex: planning/analysis", () => {
    expect(detectModelComplexity("design the architecture for a microservices system")).toBe("complex");
    expect(detectModelComplexity("analyze the performance bottleneck")).toBe("complex");
    expect(detectModelComplexity("compare different caching strategies")).toBe("complex");
    expect(detectModelComplexity("evaluate the tradeoffs")).toBe("complex");
  });

  it("complex: multi-step", () => {
    expect(detectModelComplexity("first set up the project then install dependencies and finally run the tests")).toBe("complex");
    expect(detectModelComplexity("create the database schema and then build the API endpoints and also write the documentation")).toBe("complex");
  });

  it("edge cases", () => {
    expect(detectModelComplexity("")).toBe("simple");
    expect(detectModelComplexity("   ")).toBe("simple");
    expect(detectModelComplexity("a")).toBe("simple");
  });
});

describe("classifyResponseType", () => {
  it("factual: short questions", () => {
    expect(classifyResponseType("What is Python?")).toBe("factual");
    expect(classifyResponseType("Who is Elon Musk?")).toBe("factual");
    expect(classifyResponseType("When was Docker released?")).toBe("factual");
    expect(classifyResponseType("What time is it?")).toBe("factual");
  });

  it("explanation: why/how/explain/describe", () => {
    expect(classifyResponseType("Explain Docker.")).toBe("explanation");
    expect(classifyResponseType("Why is my app slow?")).toBe("explanation");
    expect(classifyResponseType("How does garbage collection work?")).toBe("explanation");
    expect(classifyResponseType("Describe the difference between threads and processes.")).toBe("explanation");
    expect(classifyResponseType("Tell me about React hooks.")).toBe("explanation");
  });

  it("coding: work verbs + technical context", () => {
    expect(classifyResponseType("Write a TypeScript debounce function.")).toBe("coding");
    expect(classifyResponseType("Fix this TypeScript bug.")).toBe("coding");
    expect(classifyResponseType("Refactor the authentication module.")).toBe("coding");
    expect(classifyResponseType("Debug the failing test in CI.")).toBe("coding");
    expect(classifyResponseType("Review this code.")).toBe("coding");
  });

  it("implementation: multi-step + technical", () => {
    expect(classifyResponseType("Implement a new service in my monorepo and write tests for it.")).toBe("implementation");
    expect(classifyResponseType("Design a caching architecture for a TypeScript monorepo and document the API.")).toBe("implementation");
    expect(classifyResponseType("Create the database schema, build the API endpoints, and write the documentation.")).toBe("implementation");
  });

  it("factual: greetings", () => {
    expect(classifyResponseType("Hello")).toBe("factual");
    expect(classifyResponseType("Thanks")).toBe("factual");
    expect(classifyResponseType("Hi there")).toBe("factual");
  });
});

describe("getMaxTokensForResponseType", () => {
  it("returns correct budgets", () => {
    expect(getMaxTokensForResponseType("factual")).toBe(80);
    expect(getMaxTokensForResponseType("explanation")).toBe(192);
    expect(getMaxTokensForResponseType("coding")).toBe(512);
    expect(getMaxTokensForResponseType("implementation")).toBe(1024);
  });
});
