import {
  displayOperator,
  formatCardValue,
  newGame,
  type Card,
  type GameState,
  type Operator,
  type OperatorPosition,
} from "../core/game";
import { generatePuzzle, type DigitRange, type PuzzleValues } from "../core/puzzle";
import {
  loadSettings,
  saveSettings,
  type GameSettings,
} from "../core/settings";
import { GameTimer } from "../core/timer";

const OPERATORS: readonly Operator[] = ["+", "-", "×", "÷"];
const OPERATOR_POSITIONS: readonly OperatorPosition[] = [
  "up",
  "right",
  "down",
  "left",
];

const operatorLabels: Record<Operator, string> = {
  "+": "加",
  "-": "减",
  "×": "乘",
  "÷": "除",
};

export class TwentyFourApp {
  private readonly root: HTMLElement;
  private readonly timer = new GameTimer();
  private settings: GameSettings;
  private initialValues: PuzzleValues;
  private state: GameState;
  private timerInterval: number | undefined;

  constructor(root: HTMLElement) {
    this.root = root;
    this.settings = loadSettings(window.localStorage);
    this.initialValues = this.createPuzzle();
    this.state = newGame(this.initialValues);
    this.renderShell();
    this.bindEvents();
    this.timer.start();
    this.updateTimer();
    this.timerInterval = window.setInterval(() => this.updateTimer(), 250);
  }

  private createPuzzle(): PuzzleValues {
    const devPuzzle = this.readDevPuzzle();
    return (
      devPuzzle ??
      generatePuzzle(this.settings.range, this.settings.allowUnsolvable)
    );
  }

  private readDevPuzzle(): PuzzleValues | null {
    if (!import.meta.env.DEV) {
      return null;
    }

    const values = new URLSearchParams(window.location.search)
      .get("puzzle")
      ?.split(",")
      .map(Number);

    if (
      values?.length === 4 &&
      values.every((value) => Number.isInteger(value) && value >= 0)
    ) {
      return values as unknown as PuzzleValues;
    }
    return null;
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <main class="app-shell">
        <header class="topbar">
          <h1 class="brand">24点</h1>
          <div class="topbar-actions">
            <output class="timer" aria-label="本题用时" data-testid="timer">00:00</output>
            <button class="icon-button" type="button" aria-label="设置" data-action="settings">
              ${gearIcon()}
            </button>
          </div>
        </header>

        <section class="game-frame" aria-label="24点游戏">
          <div class="frame-top">
            <p class="instruction" aria-live="polite">按住一张牌，拖到另一张牌旁边的运算符</p>
            <span class="step-marks" aria-hidden="true"><i></i><i></i><i></i></span>
          </div>
          <div class="board-grid" data-board></div>
          <div class="result-panel" data-result hidden aria-live="assertive"></div>
        </section>

        <nav class="game-controls" aria-label="游戏操作">
          <button class="control-button control-quiet" type="button" data-action="undo" disabled>
            <span aria-hidden="true">↶</span> 撤销
          </button>
          <button class="control-button control-quiet" type="button" data-action="retry">
            重来本题
          </button>
          <button class="control-button control-primary" type="button" data-action="new">
            换一题
          </button>
        </nav>

        <dialog class="settings-dialog" aria-labelledby="settings-title">
          <form method="dialog" class="settings-form">
            <header class="settings-heading">
              <p class="settings-kicker">出题方式</p>
              <h2 id="settings-title">游戏设置</h2>
              <button class="dialog-close" type="button" aria-label="关闭设置" data-action="close-settings">×</button>
            </header>

            <fieldset class="setting-group">
              <legend>数字范围</legend>
              <label class="choice-card">
                <input type="radio" name="range" value="1-9" aria-label="1-9" />
                <span class="choice-title">1–9</span>
                <span class="choice-copy">节奏更快</span>
              </label>
              <label class="choice-card">
                <input type="radio" name="range" value="1-13" aria-label="1-13" />
                <span class="choice-title">1–13</span>
                <span class="choice-copy">组合更多</span>
              </label>
            </fieldset>

            <label class="toggle-row">
              <span>
                <strong>允许出现无解题目</strong>
                <small>开启后，随机题目可能无法组成 24</small>
              </span>
              <input type="checkbox" name="allowUnsolvable" aria-label="允许出现无解题目" />
              <span class="toggle-ui" aria-hidden="true"></span>
            </label>

            <button class="apply-button" type="submit">应用并换题</button>
          </form>
        </dialog>
      </main>
    `;

    this.syncSettingsForm();
    this.renderBoard();
  }

  private bindEvents(): void {
    this.root
      .querySelector<HTMLButtonElement>('[data-action="settings"]')
      ?.addEventListener("click", () => this.openSettings());
    this.root
      .querySelector<HTMLButtonElement>('[data-action="close-settings"]')
      ?.addEventListener("click", () => this.closeSettings());
    this.root
      .querySelector<HTMLFormElement>(".settings-form")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        this.applySettings();
      });

    document.addEventListener("visibilitychange", () => {
      if (this.state.status !== "playing") return;
      if (document.hidden) {
        this.timer.pause();
      } else {
        this.timer.resume();
        this.updateTimer();
      }
    });
  }

  private syncSettingsForm(): void {
    const range = this.root.querySelector<HTMLInputElement>(
      `input[name="range"][value="${this.settings.range}"]`,
    );
    const allowUnsolvable = this.root.querySelector<HTMLInputElement>(
      'input[name="allowUnsolvable"]',
    );
    if (range) range.checked = true;
    if (allowUnsolvable) allowUnsolvable.checked = this.settings.allowUnsolvable;
  }

  private openSettings(): void {
    const dialog = this.root.querySelector<HTMLDialogElement>(".settings-dialog");
    this.syncSettingsForm();
    dialog?.showModal();
  }

  private closeSettings(): void {
    this.root.querySelector<HTMLDialogElement>(".settings-dialog")?.close();
  }

  private applySettings(): void {
    const form = this.root.querySelector<HTMLFormElement>(".settings-form");
    if (!form) return;

    const data = new FormData(form);
    const range = data.get("range") === "1-13" ? "1-13" : "1-9";
    this.settings = {
      range: range as DigitRange,
      allowUnsolvable: data.get("allowUnsolvable") === "on",
    };
    saveSettings(this.settings, window.localStorage);
    this.closeSettings();
    this.beginNewPuzzle();
  }

  private beginNewPuzzle(): void {
    this.initialValues = this.createPuzzle();
    this.state = newGame(this.initialValues);
    this.timer.reset();
    this.timer.start();
    this.renderBoard();
    this.updateTimer();
  }

  private renderBoard(): void {
    const board = this.root.querySelector<HTMLElement>("[data-board]");
    if (!board) return;

    board.innerHTML = this.state.slots
      .map((card, slotIndex) => {
        if (!card) {
          return `
            <div class="card-slot is-empty" data-slot-index="${slotIndex}">
              <div class="slot-placeholder" aria-hidden="true"></div>
            </div>
          `;
        }

        return `
          <div class="card-slot slot-${slotIndex}" data-slot-index="${slotIndex}">
            <button
              class="number-card"
              type="button"
              data-card-index="${slotIndex}"
              aria-label="数字 ${formatCardValue(card)}"
            >
              <span class="card-value">${formatCardValue(card)}</span>
              ${card.expression === formatCardValue(card) ? "" : `<span class="card-expression">${escapeHtml(card.expression)}</span>`}
            </button>
            ${this.renderOperators(card, slotIndex)}
          </div>
        `;
      })
      .join("");

    const undo = this.root.querySelector<HTMLButtonElement>('[data-action="undo"]');
    if (undo) {
      undo.disabled =
        this.state.history.length === 0 || this.state.status === "won";
    }

    this.renderResult();
  }

  private renderOperators(card: Card, slotIndex: number): string {
    return `
      <div class="operator-ring" aria-hidden="true">
        ${OPERATORS.map((operator, index) => {
          const position = OPERATOR_POSITIONS[index];
          const disabled = operator === "÷" && card.value.numerator === 0;
          return `
            <button
              class="operator operator-${position}"
              type="button"
              tabindex="-1"
              data-target-index="${slotIndex}"
              data-operator="${operator}"
              aria-label="${operatorLabels[operator]}"
              ${disabled ? "disabled" : ""}
            >
              ${displayOperator(operator)}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  private renderResult(): void {
    const panel = this.root.querySelector<HTMLElement>("[data-result]");
    const board = this.root.querySelector<HTMLElement>(".game-frame");
    if (!panel || !board) return;

    board.classList.toggle("is-won", this.state.status === "won");
    board.classList.toggle("is-lost", this.state.status === "lost");

    if (this.state.status === "playing") {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }

    const finalCard = this.state.slots.find((card): card is Card => card !== null);
    if (!finalCard) return;
    const finalValue = formatCardValue(finalCard);
    panel.hidden = false;
    panel.innerHTML =
      this.state.status === "won"
        ? `<strong>漂亮，刚好 24！</strong><span>用了 ${this.formatTime(this.timer.elapsedMs)}</span>`
        : `<strong>最后是 ${finalValue}</strong><span>撤销一步再试，或重新开始本题</span>`;
  }

  private updateTimer(): void {
    const timer = this.root.querySelector<HTMLOutputElement>('[data-testid="timer"]');
    if (!timer) return;
    timer.textContent = this.formatTime(this.timer.elapsedMs);
  }

  private formatTime(elapsedMs: number): string {
    const totalSeconds = Math.floor(elapsedMs / 1_000);
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    const paddedMinutes = String(minutes).padStart(2, "0");
    const paddedSeconds = String(seconds).padStart(2, "0");
    return hours > 0
      ? `${hours}:${paddedMinutes}:${paddedSeconds}`
      : `${paddedMinutes}:${paddedSeconds}`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function gearIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.6 3.2h4.8l.6 2.1c.5.2 1 .5 1.5.8l2.1-.6 2.4 4.1-1.5 1.6v1.6l1.5 1.6-2.4 4.1-2.1-.6c-.5.3-1 .6-1.5.8l-.6 2.1H9.6L9 20.7c-.5-.2-1-.5-1.5-.8l-2.1.6L3 16.4 4.5 14.8v-1.6L3 11.6l2.4-4.1 2.1.6c.5-.3 1-.6 1.5-.8l.6-2.1Z"></path>
      <circle cx="12" cy="13" r="3.1"></circle>
    </svg>
  `;
}
