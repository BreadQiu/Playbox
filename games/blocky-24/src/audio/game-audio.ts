import type { StorageLike } from "../core/settings";

export type AudioStyle = "tactile" | "comedy";
export type AudioCue =
  | "lift"
  | "operator"
  | "merge"
  | "invalid"
  | "undo"
  | "hint"
  | "solvable"
  | "unsolvable"
  | "check-success"
  | "check-fail"
  | "new"
  | "retry"
  | "win"
  | "lose"
  | "ui";

export type AudioPreferences = Readonly<{
  muted: boolean;
}>;

type ToneOptions = Readonly<{
  duration: number;
  gain: number;
  delay?: number;
  type?: ToneShape;
  attack?: number;
  endFrequency?: number;
  filterFrequency?: number;
}>;

type ToneShape = OscillatorType | "soft-square";

type NoiseOptions = Readonly<{
  duration: number;
  gain: number;
  delay?: number;
  centerFrequency?: number;
  q?: number;
}>;

export const AUDIO_STORAGE_KEY = "twenty-four.audio.v1";

export function parseAudioStyle(value: string | null): AudioStyle {
  return value === "tactile" || value === "a" ? "tactile" : "comedy";
}

export function loadAudioPreferences(
  storage?: StorageLike,
): AudioPreferences {
  try {
    const raw = storage?.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return { muted: false };
    const parsed: unknown = JSON.parse(raw);
    return {
      muted:
        typeof parsed === "object" &&
        parsed !== null &&
        "muted" in parsed &&
        typeof parsed.muted === "boolean"
          ? parsed.muted
          : false,
    };
  } catch {
    return { muted: false };
  }
}

export function saveAudioPreferences(
  preferences: AudioPreferences,
  storage?: StorageLike,
): void {
  try {
    storage?.setItem(AUDIO_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Audio preferences are optional; gameplay must remain available.
  }
}

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean;
  private lastCue: AudioCue | null = null;
  private cueCount = 0;

  constructor(
    readonly style: AudioStyle,
    private readonly storage?: StorageLike,
  ) {
    this.muted = loadAudioPreferences(storage).muted;
  }

  play(cue: AudioCue, variant = 0): void {
    this.lastCue = cue;
    this.cueCount += 1;
    if (this.muted) return;

    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    if (this.style === "tactile") {
      this.playTactile(cue, variant);
    } else {
      this.playComedy(cue, variant);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    saveAudioPreferences({ muted: this.muted }, this.storage);
    return this.muted;
  }

  getDebugState(): Readonly<{
    style: AudioStyle;
    muted: boolean;
    supported: boolean;
    contextState: AudioContextState | null;
    lastCue: AudioCue | null;
    cueCount: number;
  }> {
    return {
      style: this.style,
      muted: this.muted,
      supported: typeof window.AudioContext === "function",
      contextState: this.context?.state ?? null,
      lastCue: this.lastCue,
      cueCount: this.cueCount,
    };
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof window.AudioContext !== "function") return null;

    try {
      this.context = new window.AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.72;
      this.master.connect(this.context.destination);
      return this.context;
    } catch {
      return null;
    }
  }

  private setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.master || !this.context) return;
    this.master.gain.setValueAtTime(muted ? 0 : 0.72, this.context.currentTime);
  }

  private playTactile(cue: AudioCue, variant: number): void {
    switch (cue) {
      case "lift":
        this.noise({
          duration: 0.16,
          gain: 0.055,
          centerFrequency: 1350,
          q: 0.75,
        });
        this.tone(178, {
          duration: 0.065,
          gain: 0.045,
          type: "triangle",
          filterFrequency: 1400,
        });
        break;
      case "operator":
        this.woodClick(820 + variant * 45, 0.11);
        break;
      case "merge":
        this.woodClick(610 + variant * 55, 0.12);
        this.tone(165 + variant * 18, {
          duration: 0.23,
          gain: 0.12,
          type: "triangle",
          endFrequency: 430 + variant * 28,
          filterFrequency: 1800,
        });
        this.noise({
          duration: 0.075,
          gain: 0.045,
          delay: 0.015,
          centerFrequency: 850,
          q: 0.8,
        });
        break;
      case "invalid":
        this.tone(310, {
          duration: 0.13,
          gain: 0.09,
          type: "sine",
          endFrequency: 275,
        });
        this.tone(235, {
          duration: 0.18,
          gain: 0.075,
          delay: 0.13,
          type: "sine",
          endFrequency: 215,
        });
        break;
      case "undo":
        this.noise({
          duration: 0.12,
          gain: 0.045,
          centerFrequency: 1700,
          q: 0.6,
        });
        this.tone(520, {
          duration: 0.14,
          gain: 0.065,
          type: "triangle",
          endFrequency: 310,
        });
        break;
      case "hint":
        this.bell(1046.5, 0.32, 0.1);
        this.bell(1568, 0.24, 0.045, 0.012);
        break;
      case "solvable":
        this.noteSequence([659.25, 880], "sine", 0.09, 0.2, 0.075);
        break;
      case "unsolvable":
        this.noteSequence([260, 196], "triangle", 0.13, 0.24, 0.065);
        break;
      case "check-success":
        this.noteSequence(
          [659.25, 880, 1046.5],
          "triangle",
          0.08,
          0.22,
          0.08,
        );
        break;
      case "check-fail":
        this.noteSequence([330, 262, 220], "triangle", 0.11, 0.2, 0.075);
        break;
      case "new":
      case "retry":
        this.noise({
          duration: cue === "new" ? 0.21 : 0.16,
          gain: 0.06,
          centerFrequency: cue === "new" ? 1650 : 1150,
          q: 0.55,
        });
        this.tone(cue === "new" ? 330 : 280, {
          duration: 0.13,
          gain: 0.055,
          type: "triangle",
          endFrequency: cue === "new" ? 620 : 430,
        });
        break;
      case "win":
        this.noteSequence(
          [523.25, 659.25, 783.99, 1046.5],
          "triangle",
          0.095,
          0.38,
          0.085,
          0.17,
        );
        this.bell(1318.5, 0.28, 0.04, 0.47);
        break;
      case "lose":
        this.noteSequence(
          [392, 294, 220],
          "triangle",
          0.13,
          0.26,
          0.07,
          0.16,
        );
        break;
      case "ui":
        this.tone(523.25, {
          duration: 0.065,
          gain: 0.055,
          type: "sine",
          filterFrequency: 4200,
        });
        break;
    }
  }

  private playComedy(cue: AudioCue, variant: number): void {
    switch (cue) {
      case "lift":
        this.tone(320, {
          duration: 0.19,
          gain: 0.12,
          type: "triangle",
          endFrequency: 1180,
          filterFrequency: 3600,
        });
        this.noise({
          duration: 0.09,
          gain: 0.035,
          centerFrequency: 2200,
          q: 0.6,
        });
        break;
      case "operator":
        this.tone(610 + variant * 65, {
          duration: 0.11,
          gain: 0.11,
          type: "triangle",
          endFrequency: 880 + variant * 55,
          filterFrequency: 4200,
        });
        break;
      case "merge":
        this.tone(155 + variant * 20, {
          duration: 0.32,
          gain: 0.16,
          type: "triangle",
          endFrequency: 720 + variant * 45,
          filterFrequency: 3000,
        });
        this.tone(920, {
          duration: 0.075,
          gain: 0.07,
          delay: 0.035,
          type: "triangle",
          filterFrequency: 4200,
        });
        break;
      case "invalid":
        this.tone(1050, {
          duration: 0.46,
          gain: 0.12,
          type: "sine",
          endFrequency: 255,
          filterFrequency: 3200,
        });
        break;
      case "undo":
        this.tone(350, {
          duration: 0.16,
          gain: 0.09,
          type: "triangle",
          endFrequency: 790,
          filterFrequency: 3400,
        });
        break;
      case "hint":
        this.tone(760, {
          duration: 0.3,
          gain: 0.11,
          type: "triangle",
          endFrequency: 1540,
          filterFrequency: 4800,
        });
        this.bell(2093, 0.16, 0.045, 0.16);
        break;
      case "solvable":
        this.noteSequence(
          [659.25, 880, 1318.5],
          "soft-square",
          0.07,
          0.14,
          0.075,
        );
        break;
      case "unsolvable":
        this.noteSequence(
          [380, 260],
          "soft-square",
          0.11,
          0.2,
          0.065,
        );
        break;
      case "check-success":
        this.noteSequence(
          [659.25, 880, 1046.5, 1318.5],
          "soft-square",
          0.075,
          0.2,
          0.075,
        );
        this.tone(990, {
          duration: 0.34,
          gain: 0.05,
          delay: 0.22,
          type: "triangle",
          endFrequency: 1680,
          filterFrequency: 4200,
        });
        break;
      case "check-fail":
        this.tone(610, {
          duration: 0.28,
          gain: 0.09,
          type: "soft-square",
          endFrequency: 330,
          filterFrequency: 2100,
        });
        this.tone(300, {
          duration: 0.42,
          gain: 0.09,
          delay: 0.16,
          type: "soft-square",
          endFrequency: 145,
          filterFrequency: 1500,
        });
        break;
      case "new":
      case "retry":
        this.tone(cue === "new" ? 280 : 360, {
          duration: 0.2,
          gain: 0.085,
          type: "triangle",
          endFrequency: cue === "new" ? 1050 : 690,
          filterFrequency: 3800,
        });
        break;
      case "win":
        this.noteSequence(
          [523.25, 659.25, 783.99, 1046.5],
          "soft-square",
          0.1,
          0.3,
          0.07,
          0.17,
        );
        this.tone(780, {
          duration: 0.48,
          gain: 0.06,
          delay: 0.46,
          type: "triangle",
          endFrequency: 1560,
          filterFrequency: 3600,
        });
        break;
      case "lose":
        this.tone(520, {
          duration: 0.25,
          gain: 0.08,
          type: "soft-square",
          endFrequency: 300,
          filterFrequency: 1800,
        });
        this.tone(260, {
          duration: 0.4,
          gain: 0.085,
          delay: 0.22,
          type: "soft-square",
          endFrequency: 145,
          filterFrequency: 1450,
        });
        break;
      case "ui":
        this.tone(720, {
          duration: 0.065,
          gain: 0.06,
          type: "triangle",
          endFrequency: 930,
          filterFrequency: 4200,
        });
        break;
    }
  }

  private woodClick(frequency: number, gain: number): void {
    this.tone(frequency, {
      duration: 0.08,
      gain,
      type: "sine",
      attack: 0.001,
      endFrequency: frequency * 0.78,
      filterFrequency: 2600,
    });
    this.tone(frequency * 1.72, {
      duration: 0.045,
      gain: gain * 0.35,
      type: "sine",
      attack: 0.001,
      filterFrequency: 3200,
    });
  }

  private bell(
    frequency: number,
    duration: number,
    gain: number,
    delay = 0,
  ): void {
    this.tone(frequency, {
      duration,
      gain,
      delay,
      type: "sine",
      filterFrequency: 5200,
    });
    this.tone(frequency * 1.5, {
      duration: duration * 0.72,
      gain: gain * 0.35,
      delay,
      type: "sine",
      filterFrequency: 5600,
    });
  }

  private noteSequence(
    frequencies: readonly number[],
    type: ToneShape,
    spacing: number,
    duration: number,
    gain: number,
    initialDelay = 0,
  ): void {
    frequencies.forEach((frequency, index) => {
      this.tone(frequency, {
        duration,
        gain,
        delay: initialDelay + index * spacing,
        type,
        filterFrequency: type === "soft-square" ? 3200 : 4800,
      });
    });
  }

  private tone(frequency: number, options: ToneOptions): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;

    const start = context.currentTime + (options.delay ?? 0) + 0.005;
    const end = start + options.duration;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();

    oscillator.type =
      options.type === "soft-square" ? "square" : (options.type ?? "sine");
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, options.endFrequency),
        end,
      );
    }

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(
      options.filterFrequency ?? 4200,
      start,
    );

    const attack = Math.min(options.attack ?? 0.006, options.duration * 0.3);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, options.gain),
      start + attack,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(filter).connect(envelope).connect(master);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  private noise(options: NoiseOptions): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;

    const frameCount = Math.max(1, round(context.sampleRate * options.duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    const start = context.currentTime + (options.delay ?? 0) + 0.005;
    const end = start + options.duration;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();

    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(options.centerFrequency ?? 1600, start);
    filter.Q.setValueAtTime(options.q ?? 0.7, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, options.gain),
      start + Math.min(0.025, options.duration * 0.35),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter).connect(envelope).connect(master);
    source.start(start);
    source.stop(end + 0.01);
  }
}

function round(value: number): number {
  return Math.max(1, Math.floor(value));
}
