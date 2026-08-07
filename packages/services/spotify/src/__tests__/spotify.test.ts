import { describe, it, expect } from "vitest";
import { createSpotifyService } from "../impl/spotify-service.js";

describe("SpotifyService", () => {
  const svc = createSpotifyService();

  it("has correct name", () => {
    expect(svc.name).toBe("spotify");
  });

  it("can handle spotify commands", () => {
    expect(svc.canHandle("play")).toBe(true);
    expect(svc.canHandle("pause")).toBe(true);
    expect(svc.canHandle("next track")).toBe(true);
    expect(svc.canHandle("skip song")).toBe(true);
    expect(svc.canHandle("previous track")).toBe(true);
    expect(svc.canHandle("what song is playing")).toBe(true);
    expect(svc.canHandle("now playing")).toBe(true);
    expect(svc.canHandle("shuffle on")).toBe(true);
    expect(svc.canHandle("repeat off")).toBe(true);
    expect(svc.canHandle("set volume 50")).toBe(true);
  });

  it("can handle play playlist", () => {
    expect(svc.canHandle("play playlist chill vibes")).toBe(true);
    expect(svc.canHandle("create playlist workout")).toBe(true);
  });

  it("can handle search and play", () => {
    expect(svc.canHandle("play bohemian rhapsody")).toBe(true);
    expect(svc.canHandle("play some jazz")).toBe(true);
  });

  it("rejects unrelated input", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("open firefox")).toBe(false);
    expect(svc.canHandle("what time is it")).toBe(false);
  });

  it("returns help for unrecognized spotify command", async () => {
    const ctx = { sessionId: "test", memory: { add: async () => {}, history: async () => [], clear: () => {} } as never, provider: null, reply: () => {}, speak: () => {}, emit: () => {} };
    const result = await svc.execute("spotify help", ctx);
    expect(result.text).toBeDefined();
  });
});
