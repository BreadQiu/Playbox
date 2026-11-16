import {
  displayOperator,
  formatCardValue,
  mergeCards,
  newGame,
  resetRound,
  undoGame,
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
  "down",
  "left",
  "right",
];

const operatorLabels: Record<Operator, string> = {
  "+": "加",
  "-": "减",
  "×": "乘",
  "÷": "除",
};

type DragTarget = Readonly<{
  targetIndex: number;
  operator: Operator;
}>;

type DragSession = {
  sourceIndex: number;
  sourceCard: Card;
  sourceElement: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  ghost: HTMLDivElement | null;
  ghostWidth: number;
  ghostHeight: number;
  currentTarget: DragTarget | null;
};

export class TwentyFourApp {
  private readonly root: HTMLElement;
  private readonly timer = new GameTimer();
  private settings: GameSettings;
  private initialValues: PuzzleValues;
  private state: GameState;
  private timerInterval: number | undefined;
  private dragSession: DragSession | null = null;

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
    window.addEventListener("beforeunload", () => {
      window.clearInterval(this.timerInterval);
    });
    this.installDebugHooks();
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
    this.root
      .querySelector<HTMLElement>("[data-board]")
      ?.addEventListener("pointerdown", (event) => {
        this.beginPointerDrag(event);
      });
    this.root
      .querySelector<HTMLButtonElement>('[data-action="undo"]')
      ?.addEventListener("click", () => this.undoMove());
    this.root
      .querySelector<HTMLButtonElement>('[data-action="retry"]')
      ?.addEventListener("click", () => this.retryPuzzle());
    this.root
      .querySelector<HTMLButtonElement>('[data-action="new"]')
      ?.addEventListener("click", () => this.beginNewPuzzle());

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

  private retryPuzzle(): void {
    this.state = resetRound(this.state, this.initialValues);
    this.timer.start();
    this.renderBoard();
    this.updateTimer();
  }

  private undoMove(): void {
    const wasLost = this.state.status === "lost";
    const nextState = undoGame(this.state);
    if (nextState === this.state) return;
    this.state = nextState;
    if (wasLost) {
      this.timer.start();
    }
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
            <div
              class="number-card"
              data-card-index="${slotIndex}"
              role="img"
              aria-label="数字 ${formatCardValue(card)}"
              aria-description="按住并拖动到另一张数字牌旁边的运算符"
            >
              <span class="card-value ${formatCardValue(card).length > 3 ? "is-long" : ""}">${formatCardValue(card)}</span>
              ${card.expression === formatCardValue(card) ? "" : `<span class="card-expression">${escapeHtml(card.expression)}</span>`}
            </div>
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

  private beginPointerDrag(event: PointerEvent): void {
    if (this.state.status !== "playing" || event.button !== 0) {
      return;
    }

    const source = (event.target as Element).closest<HTMLElement>(
      "[data-card-index]",
    );
    if (!source) return;

    const sourceIndex = Number(source.dataset.cardIndex);
    const sourceCard = this.state.slots[sourceIndex];
    if (!sourceCard) return;

    event.preventDefault();
    try {
      source.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events cannot establish pointer capture.
    }

    this.dragSession = {
      sourceIndex,
      sourceCard,
      sourceElement: source,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      ghost: null,
      ghostWidth: 0,
      ghostHeight: 0,
      currentTarget: null,
    };
    window.addEventListener("pointermove", this.handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerCancel);
    window.addEventListener("resize", this.handleResize);
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const session = this.dragSession;
    if (!session || event.pointerId !== session.pointerId) return;

    if (!session.moved) {
      const distance = Math.hypot(
        event.clientX - session.startX,
        event.clientY - session.startY,
      );
      if (distance < 7) return;
      this.startVisualDrag(session);
    }

    event.preventDefault();
    if (session.ghost) {
      this.positionDragGhost(session, event.clientX, event.clientY);
    }
    this.updateDragTarget(event.clientX, event.clientY);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const session = this.dragSession;
    if (!session || event.pointerId !== session.pointerId) return;

    const target = session.currentTarget;
    const wasMoved = session.moved;
    const sourceIndex = session.sourceIndex;
    this.finishVisualDrag();

    if (!wasMoved) return;
    if (!target) {
      this.rejectSource(sourceIndex);
      return;
    }

    const result = mergeCards(
      this.state,
      sourceIndex,
      target.targetIndex,
      target.operator,
    );
    if (!result.ok) {
      this.rejectSource(sourceIndex);
      return;
    }

    this.state = result.state;
    if (this.state.status !== "playing") {
      this.timer.stop();
    }
    this.renderBoard();
    this.updateTimer();
    this.flashMergedSlot(target.targetIndex);
  };

  private readonly handlePointerCancel = (): void => {
    const sourceIndex = this.dragSession?.sourceIndex;
    this.finishVisualDrag();
    if (sourceIndex !== undefined) {
      this.rejectSource(sourceIndex);
    }
  };

  private readonly handleResize = (): void => {
    this.finishVisualDrag();
  };

  private startVisualDrag(session: DragSession): void {
    session.moved = true;
    const board = this.root.querySelector<HTMLElement>("[data-board]");
    const sourceSlot = this.root.querySelector<HTMLElement>(
      `[data-slot-index="${session.sourceIndex}"]`,
    );
    const rect = session.sourceElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(session.sourceElement);
    const ghostWidth = Math.min(rect.width * 0.74, 96);
    const ghostHeight = Math.min(rect.height * 0.74, 72);
    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.textContent = formatCardValue(session.sourceCard);
    ghost.style.setProperty("--ghost-width", `${ghostWidth}px`);
    ghost.style.setProperty("--ghost-height", `${ghostHeight}px`);
    ghost.style.setProperty("--ghost-color", computedStyle.backgroundColor);
    document.body.append(ghost);
    session.ghost = ghost;
    session.ghostWidth = ghostWidth;
    session.ghostHeight = ghostHeight;

    board?.classList.add("is-dragging");
    sourceSlot?.classList.add("is-source");
    this.updateOperatorLabels(session);
  }

  private positionDragGhost(
    session: DragSession,
    clientX: number,
    clientY: number,
  ): void {
    if (!session.ghost) return;
    const horizontalMargin = session.ghostWidth / 2 + 8;
    const left = clamp(clientX, horizontalMargin, window.innerWidth - horizontalMargin);
    const top = clamp(clientY, session.ghostHeight + 28, window.innerHeight - 8);
    session.ghost.style.left = `${left}px`;
    session.ghost.style.top = `${top}px`;
  }

  private updateOperatorLabels(session: DragSession): void {
    const sourceValue = formatCardValue(session.sourceCard);
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-target-index][data-operator]")
      .forEach((button) => {
        const targetIndex = Number(button.dataset.targetIndex);
        const targetCard = this.state.slots[targetIndex];
        const operator = button.dataset.operator as Operator;
        if (targetCard) {
          button.setAttribute(
            "aria-label",
            `${sourceValue} ${operatorLabels[operator]} ${formatCardValue(targetCard)}`,
          );
        }
      });
  }

  private updateDragTarget(clientX: number, clientY: number): void {
    const session = this.dragSession;
    if (!session) return;

    const element = document.elementFromPoint(clientX, clientY);
    const operatorButton = element?.closest<HTMLButtonElement>(
      "[data-target-index][data-operator]",
    );
    const nextTarget =
      operatorButton && !operatorButton.disabled
        ? {
            targetIndex: Number(operatorButton.dataset.targetIndex),
            operator: operatorButton.dataset.operator as Operator,
          }
        : null;

    if (
      session.currentTarget?.targetIndex === nextTarget?.targetIndex &&
      session.currentTarget?.operator === nextTarget?.operator
    ) {
      return;
    }

    session.currentTarget = nextTarget;
    this.root
      .querySelectorAll(".operator.is-targeted")
      .forEach((button) => button.classList.remove("is-targeted"));
    this.root
      .querySelectorAll(".card-slot.is-target")
      .forEach((slot) => slot.classList.remove("is-target"));
    this.root.querySelector(".merge-preview")?.remove();

    if (!nextTarget) return;
    const targetSlot = this.root.querySelector<HTMLElement>(
      `[data-slot-index="${nextTarget.targetIndex}"]`,
    );
    const targetOperator = this.root.querySelector<HTMLElement>(
      `[data-target-index="${nextTarget.targetIndex}"][data-operator="${nextTarget.operator}"]`,
    );
    targetSlot?.classList.add("is-target");
    targetOperator?.classList.add("is-targeted");

    const preview = mergeCards(
      this.state,
      session.sourceIndex,
      nextTarget.targetIndex,
      nextTarget.operator,
    );
    const previewCard = preview.ok
      ? preview.state.slots[nextTarget.targetIndex]
      : null;
    if (previewCard && targetSlot) {
      const label = document.createElement("span");
      label.className = "merge-preview";
      label.textContent = `= ${formatCardValue(previewCard)}`;
      targetSlot.append(label);
    }
  }

  private finishVisualDrag(): void {
    if (!this.dragSession) return;
    this.dragSession.ghost?.remove();
    this.root.querySelector(".merge-preview")?.remove();
    this.root.querySelector<HTMLElement>("[data-board]")?.classList.remove(
      "is-dragging",
    );
    this.root
      .querySelectorAll(".card-slot.is-source, .card-slot.is-target")
      .forEach((slot) => slot.classList.remove("is-source", "is-target"));
    this.root
      .querySelectorAll(".operator.is-targeted")
      .forEach((button) => button.classList.remove("is-targeted"));
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerCancel);
    window.removeEventListener("resize", this.handleResize);
    this.dragSession = null;
  }

  private rejectSource(sourceIndex: number): void {
    const slot = this.root.querySelector<HTMLElement>(
      `[data-slot-index="${sourceIndex}"]`,
    );
    slot?.classList.add("is-rejected");
    window.setTimeout(() => slot?.classList.remove("is-rejected"), 300);
  }

  private flashMergedSlot(targetIndex: number): void {
    const slot = this.root.querySelector<HTMLElement>(
      `[data-slot-index="${targetIndex}"]`,
    );
    slot?.classList.add("is-merged");
    window.setTimeout(() => slot?.classList.remove("is-merged"), 280);
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

  private installDebugHooks(): void {
    window.render_game_to_text = () =>
      JSON.stringify({
        status: this.state.status,
        timer: {
          elapsedMs: Math.floor(this.timer.elapsedMs),
          display: this.formatTime(this.timer.elapsedMs),
          running: this.timer.isRunning,
        },
        settings: this.settings,
        slots: this.state.slots.map((card, index) =>
          card
            ? {
                index,
                value: formatCardValue(card),
                expression: card.expression,
              }
            : null,
        ),
        drag: this.dragSession?.moved
          ? {
              source: this.dragSession.sourceIndex,
              target: this.dragSession.currentTarget,
            }
          : null,
      });

    window.advanceTime = (milliseconds: number) => {
      this.timer.advance(milliseconds);
      this.updateTimer();
    };
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (milliseconds: number) => void;
  }
}
