import { describe, expect, it } from "vitest";

import {
  AUDIO_STORAGE_KEY,
  loadAudioPreferences,
  parseAudioStyle,
  saveAudioPreferences,
} from "../../src/audio/game-audio";

describe("game audio preferences", () => {
  it("uses comedy as the default while preserving explicit previews", () => {
    expect(parseAudioStyle(null)).toBe("comedy");
    expect(parseAudioStyle("tactile")).toBe("tactile");
    expect(parseAudioStyle("a")).toBe("tactile");
    expect(parseAudioStyle("comedy")).toBe("comedy");
    expect(parseAudioStyle("b")).toBe("comedy");
  });

  it("persists mute state and falls back safely", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(loadAudioPreferences(storage)).toEqual({ muted: false });
    saveAudioPreferences({ muted: true }, storage);
    expect(values.get(AUDIO_STORAGE_KEY)).toBe('{"muted":true}');
    expect(loadAudioPreferences(storage)).toEqual({ muted: true });
    expect(loadAudioPreferences(undefined)).toEqual({ muted: false });
  });
});
