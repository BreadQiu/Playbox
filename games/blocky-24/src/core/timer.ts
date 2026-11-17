export type Clock = () => number;

export class GameTimer {
  private accumulatedMs = 0;
  private startedAt: number | null = null;

  constructor(private readonly now: Clock = () => performance.now()) {}

  get elapsedMs(): number {
    const runningMs =
      this.startedAt === null ? 0 : Math.max(0, this.now() - this.startedAt);
    return Math.max(0, this.accumulatedMs + runningMs);
  }

  get isRunning(): boolean {
    return this.startedAt !== null;
  }

  start(): void {
    if (this.startedAt === null) {
      this.startedAt = this.now();
    }
  }

  pause(): void {
    if (this.startedAt === null) {
      return;
    }
    this.accumulatedMs += Math.max(0, this.now() - this.startedAt);
    this.startedAt = null;
  }

  resume(): void {
    this.start();
  }

  stop(): void {
    this.pause();
  }

  reset(): void {
    this.accumulatedMs = 0;
    if (this.startedAt !== null) {
      this.startedAt = this.now();
    }
  }

  advance(ms: number): void {
    if (this.startedAt !== null && Number.isFinite(ms) && ms > 0) {
      this.accumulatedMs += ms;
    }
  }
}
