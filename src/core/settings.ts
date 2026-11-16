import type { DigitRange } from "./puzzle";

export type GameSettings = Readonly<{
  range: DigitRange;
  allowUnsolvable: boolean;
}>;

export type StorageLike = Readonly<{
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}>;

export const SETTINGS_STORAGE_KEY = "twenty-four.settings.v1";

export const DEFAULT_SETTINGS: GameSettings = {
  range: "1-9",
  allowUnsolvable: false,
};

export function loadSettings(storage?: StorageLike): GameSettings {
  if (!storage) {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return DEFAULT_SETTINGS;
    }

    if (
      (parsed.range !== "1-9" && parsed.range !== "1-13") ||
      typeof parsed.allowUnsolvable !== "boolean"
    ) {
      return DEFAULT_SETTINGS;
    }

    return {
      range: parsed.range,
      allowUnsolvable: parsed.allowUnsolvable,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(
  settings: GameSettings,
  storage?: StorageLike,
): void {
  storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
