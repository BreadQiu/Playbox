import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
} from "../../src/core/settings";
import { GameTimer } from "../../src/core/timer";

function createStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
    read: () => value,
  };
}

describe("game timer", () => {
  it("accumulates running time and pauses without drifting", () => {
    let now = 1_000;
    const timer = new GameTimer(() => now);

    timer.start();
    now += 1_200;
    expect(timer.elapsedMs).toBe(1_200);

    timer.pause();
    now += 500;
    expect(timer.elapsedMs).toBe(1_200);

    timer.resume();
    now += 300;
    expect(timer.elapsedMs).toBe(1_500);
  });

  it("keeps accumulated time when restarted after a loss", () => {
    let now = 0;
    const timer = new GameTimer(() => now);
    timer.start();
    now += 2_500;
    timer.stop();

    timer.start();
    now += 750;

    expect(timer.elapsedMs).toBe(3_250);
  });

  it("clears accumulated time for a new puzzle", () => {
    let now = 0;
    const timer = new GameTimer(() => now);
    timer.start();
    now += 4_000;
    timer.reset();
    timer.start();
    now += 1_000;

    expect(timer.elapsedMs).toBe(1_000);
  });

  it("supports deterministic test advancement only while running", () => {
    const timer = new GameTimer(() => 0);
    timer.start();
    timer.advance(2_000);
    timer.pause();
    timer.advance(3_000);

    expect(timer.elapsedMs).toBe(2_000);
  });
});

describe("game settings", () => {
  it("returns defaults when storage is empty", () => {
    expect(loadSettings(createStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it("saves and restores valid settings", () => {
    const storage = createStorage();
    saveSettings({ range: "1-13", allowUnsolvable: true }, storage);

    expect(loadSettings(storage)).toEqual({
      range: "1-13",
      allowUnsolvable: true,
    });
    expect(JSON.parse(storage.read() ?? "{}")).toEqual({
      range: "1-13",
      allowUnsolvable: true,
    });
  });

  it("falls back safely for corrupt or invalid settings", () => {
    expect(loadSettings(createStorage("{broken"))).toEqual(DEFAULT_SETTINGS);
    expect(
      loadSettings(createStorage(JSON.stringify({ range: "1-99" }))),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it("uses the versioned storage key", () => {
    expect(SETTINGS_STORAGE_KEY).toBe("twenty-four.settings.v1");
  });
});
