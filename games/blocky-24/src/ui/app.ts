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
import { GameAudio, parseAudioStyle } from "../audio/game-audio";
import {
  findSolutionStep,
  generatePuzzle,
  type DigitRange,
  type PuzzleValues,
  type SolutionStep,
} from "../core/puzzle";
import {
  loadSettings,
  saveSettings,
  type GameSettings,
  type StorageLike,
} from "../core/settings";
import { GameTimer } from "../core/timer";

const OPERATORS: readonly Operator[] = ["+", "-", "×", "÷"];
const OPERATOR_POSITIONS: readonly OperatorPosition[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];
const REGULAR_CARD_COLORS = [
  "#ffe49b",
  "#a9d8ff",
  "#f3c0e2",
  "#d7c7ff",
] as const;
const WIN_CARD_COLOR = "#aee8cb";
const LOSS_CARD_COLOR = "#ffb29b";
const NEARBY_TARGET_DISTANCE = 44;
const MIN_OPERATOR_OVERLAP_RATIO = 0.25;

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

type RectLike = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

type CardAppearance = Readonly<{
  color: (typeof REGULAR_CARD_COLORS)[number];
  tilt: number;
}>;

type SolutionCheckState =
  | "idle"
  | "hint-solvable"
  | "solvable"
  | "unsolvable";

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
  nearTargetIndex: number | null;
  currentTarget: DragTarget | null;
};

export class TwentyFourApp {
  private readonly root: HTMLElement;
  private readonly timer = new GameTimer();
  private readonly audio: GameAudio;
  private settings: GameSettings;
  private initialValues: PuzzleValues;
  private solutionStep: SolutionStep | null;
  private solutionCheckState: SolutionCheckState = "idle";
  private hintOpen = false;
  private hintLockedByCheck = false;
  private hasWonThisRound = false;
  private state: GameState;
  private timerInterval: number | undefined;
  private dragSession: DragSession | null = null;
  private readonly cardAppearances = new Map<string, CardAppearance>();

  constructor(root: HTMLElement) {
    this.root = root;
    const storage = getBrowserStorage();
    const parameters = new URLSearchParams(window.location.search);
    this.settings = loadSettings(storage);
    if (
      import.meta.env.DEV &&
      parameters.get("allowUnsolvable") === "1"
    ) {
      this.settings = {
        ...this.settings,
        allowUnsolvable: true,
      };
    }
    this.audio = new GameAudio(
      parseAudioStyle(parameters.get("sound")),
      storage,
    );
    document.title =
      this.audio.style === "tactile"
        ? "Blocky 24 · 积木音色"
        : "Blocky 24 · 喜剧音色";
    this.initialValues = this.createPuzzle();
    this.solutionStep = findSolutionStep(this.initialValues);
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
          <h1 class="brand">Blocky 24</h1>
          <div class="topbar-actions">
            <output class="timer" aria-label="本题用时" data-testid="timer">00:00</output>
            <button class="icon-button" type="button" aria-label="静音" data-action="audio">
              ${audioIcon(false)}
            </button>
            <button class="icon-button" type="button" aria-label="设置" data-action="settings">
              ${gearIcon()}
            </button>
          </div>
        </header>

        <section class="game-frame" aria-label="Blocky 24 游戏">
          <div class="frame-tools">
            <button class="frame-tool" type="button" aria-label="撤销" data-action="undo" disabled>
              ${undoIcon()}
            </button>
            <div class="hint-tool">
              <button
                class="frame-tool"
                type="button"
                aria-label="提示"
                aria-controls="hint-bubble"
                aria-expanded="false"
                data-action="hint"
              >
                ${bulbIcon()}
              </button>
              <p class="hint-bubble" id="hint-bubble" data-hint-bubble hidden aria-live="polite"></p>
            </div>
          </div>
          <div class="board-grid" data-board></div>
          <p class="sr-only" data-status role="status" aria-live="polite"></p>
        </section>

        <nav class="game-controls" aria-label="游戏操作">
          <button class="control-button solution-button is-neutral" type="button" data-action="solution" disabled>
            此题有解
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
              <h2 id="settings-title">游戏设置</h2>
              <button class="dialog-close" type="button" aria-label="关闭设置" data-action="close-settings">×</button>
            </header>

            <fieldset class="setting-group">
              <legend>数字范围</legend>
              <label class="choice-card">
                <input type="radio" name="range" value="1-9" aria-label="1-9" />
                <span class="choice-title">1–9</span>
                <span class="choice-copy">简单</span>
              </label>
              <label class="choice-card">
                <input type="radio" name="range" value="1-13" aria-label="1-13" />
                <span class="choice-title">1–13</span>
                <span class="choice-copy">困难</span>
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
    this.renderAudioControl();
    this.renderBoard();
  }

  private bindEvents(): void {
    this.root
      .querySelector<HTMLButtonElement>('[data-action="settings"]')
      ?.addEventListener("click", () => {
        this.audio.play("ui");
        this.openSettings();
      });
    this.root
      .querySelector<HTMLButtonElement>('[data-action="close-settings"]')
      ?.addEventListener("click", () => {
        this.audio.play("ui");
        this.closeSettings();
      });
    this.root
      .querySelector<HTMLButtonElement>('[data-action="audio"]')
      ?.addEventListener("click", () => {
        this.audio.toggleMuted();
        this.renderAudioControl();
      });
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
      .querySelector<HTMLButtonElement>('[data-action="hint"]')
      ?.addEventListener("click", () => this.toggleHint());
    this.root
      .querySelector<HTMLButtonElement>('[data-action="solution"]')
      ?.addEventListener("click", () => this.checkSolution());
    this.root
      .querySelector<HTMLButtonElement>('[data-action="retry"]')
      ?.addEventListener("click", () => this.retryPuzzle());
    this.root
      .querySelector<HTMLButtonElement>('[data-action="new"]')
      ?.addEventListener("click", () => this.beginNewPuzzle());

    document.addEventListener("pointerdown", this.handleDismissHint, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", this.handleDismissHint);
    document.addEventListener("wheel", this.handleDismissHint, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchmove", this.handleDismissHint, {
      capture: true,
      passive: true,
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

  private readonly handleDismissHint = (event: Event): void => {
    if (!this.hintOpen) return;
    if (
      event.type === "pointerdown" &&
      event.target instanceof Element &&
      event.target.closest('[data-action="hint"]')
    ) {
      return;
    }
    this.hideHint();
  };

  private renderAudioControl(): void {
    const button = this.root.querySelector<HTMLButtonElement>(
      '[data-action="audio"]',
    );
    if (!button) return;
    const audio = this.audio.getDebugState();
    button.innerHTML = audioIcon(audio.muted);
    button.setAttribute("aria-label", audio.muted ? "开启音效" : "静音");
    button.title =
      audio.style === "tactile"
        ? "积木实体版音效"
        : "喜剧卡通版音效";
    button.classList.toggle("is-muted", audio.muted);
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
    saveSettings(this.settings, getBrowserStorage());
    this.closeSettings();
    this.beginNewPuzzle();
  }

  private resetPuzzleAids(): void {
    this.solutionStep = findSolutionStep(this.initialValues);
    this.solutionCheckState = "idle";
    this.hintLockedByCheck = false;
    this.hideHint();
    this.renderHintControl();
  }

  private hideHint(): void {
    this.hintOpen = false;
    const bubble = this.root.querySelector<HTMLElement>("[data-hint-bubble]");
    const hint = this.root.querySelector<HTMLButtonElement>(
      '[data-action="hint"]',
    );
    if (bubble) {
      bubble.hidden = true;
      bubble.textContent = "";
    }
    hint?.setAttribute("aria-expanded", "false");
  }

  private renderHintControl(): void {
    const hint = this.root.querySelector<HTMLButtonElement>(
      '[data-action="hint"]',
    );
    if (!hint) return;
    hint.disabled = this.hintLockedByCheck;
    hint.classList.toggle("is-spent", this.hintLockedByCheck);
  }

  private toggleHint(): void {
    if (this.hintOpen) {
      this.hideHint();
      return;
    }

    const bubble = this.root.querySelector<HTMLElement>("[data-hint-bubble]");
    const hint = this.root.querySelector<HTMLButtonElement>(
      '[data-action="hint"]',
    );
    if (!bubble) return;

    this.hintOpen = true;
    bubble.textContent = this.solutionStep
      ? `${this.solutionStep.left} ${displayOperator(this.solutionStep.operator)} ${this.solutionStep.right}`
      : "此题无解";
    bubble.hidden = false;
    hint?.setAttribute("aria-expanded", "true");

    if (!this.solutionStep) {
      this.audio.play("unsolvable");
      this.markUnsolvable();
    } else {
      this.audio.play("hint");
      if (
        this.settings.allowUnsolvable &&
        this.solutionCheckState === "idle"
      ) {
        this.solutionCheckState = "hint-solvable";
        this.renderResult();
      }
    }
  }

  private checkSolution(): void {
    if (
      !this.settings.allowUnsolvable ||
      this.solutionCheckState !== "idle"
    ) {
      return;
    }

    if (this.solutionStep) {
      this.audio.play("check-fail");
      this.flashGuessWrong();
      this.solutionCheckState = "solvable";
      this.renderResult();
      this.hintLockedByCheck = false;
    } else {
      this.audio.play("check-success");
      this.markUnsolvable();
      this.hintLockedByCheck = true;
    }
    this.renderHintControl();
  }

  private markUnsolvable(): void {
    this.solutionCheckState = "unsolvable";
    this.timer.stop();
    this.renderResult();
    this.updateTimer();
  }

  private beginNewPuzzle(): void {
    this.audio.play("new");
    this.cardAppearances.clear();
    this.hasWonThisRound = false;
    this.initialValues = this.createPuzzle();
    this.state = newGame(this.initialValues);
    this.resetPuzzleAids();
    this.timer.reset();
    this.timer.start();
    this.renderBoard();
    this.updateTimer();
  }

  private retryPuzzle(): void {
    this.audio.play("retry");
    const previousSolutionState = this.solutionCheckState;
    const previousHintLocks = this.hintLockedByCheck;
    this.cardAppearances.clear();
    this.state = resetRound(this.state, this.initialValues);
    this.solutionStep = findSolutionStep(this.initialValues);
    this.hideHint();
    this.solutionCheckState = previousSolutionState;
    this.hintLockedByCheck = previousHintLocks;
    this.renderHintControl();
    if (
      !this.hasWonThisRound &&
      this.solutionCheckState !== "unsolvable"
    ) {
      this.timer.start();
    }
    this.renderBoard();
    this.updateTimer();
  }

  private undoMove(): void {
    const wasLost = this.state.status === "lost";
    const nextState = undoGame(this.state);
    if (nextState === this.state) return;
    this.state = nextState;
    this.audio.play("undo");
    if (wasLost) {
      this.timer.start();
    }
    this.hideHint();
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
            <div class="card-slot is-empty" data-slot-index="${slotIndex}" aria-hidden="true"></div>
          `;
        }

        const appearance = this.getCardAppearance(card);
        const isFinalCard =
          this.state.slots.filter((slotCard) => slotCard !== null).length === 1;
        const cardColor = isFinalCard
          ? this.state.status === "won"
            ? WIN_CARD_COLOR
            : LOSS_CARD_COLOR
          : appearance.color;
        return `
          <div class="card-slot slot-${slotIndex}" data-slot-index="${slotIndex}">
            <div
              class="number-card"
              data-card-index="${slotIndex}"
              role="img"
              aria-label="数字 ${formatCardValue(card)}"
              aria-description="按住并拖动到另一张数字牌旁边的运算符"
              style="--card-color: ${cardColor}; --card-tilt: ${appearance.tilt}deg"
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
      undo.disabled = this.state.history.length === 0;
    }

    this.renderResult();
  }

  private getCardAppearance(card: Card): CardAppearance {
    const existing = this.cardAppearances.get(card.id);
    if (existing) return existing;

    const usedColors = new Set(
      this.state.slots
        .filter((otherCard): otherCard is Card => Boolean(otherCard))
        .filter((otherCard) => otherCard.id !== card.id)
        .map((otherCard) => this.cardAppearances.get(otherCard.id)?.color)
        .filter((color) => color !== undefined),
    );
    const availableColors = REGULAR_CARD_COLORS.filter(
      (color) => !usedColors.has(color),
    );
    const colorPool =
      availableColors.length > 0 ? availableColors : REGULAR_CARD_COLORS;
    const appearance: CardAppearance = {
      color: colorPool[Math.floor(Math.random() * colorPool.length)],
      tilt: Math.round((Math.random() * 6.4 - 3.2) * 10) / 10,
    };
    this.cardAppearances.set(card.id, appearance);
    return appearance;
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
              <span class="operator-visual" aria-hidden="true">${displayOperator(operator)}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  private renderResult(): void {
    const board = this.root.querySelector<HTMLElement>(".game-frame");
    const status = this.root.querySelector<HTMLElement>("[data-status]");
    const newButton = this.root.querySelector<HTMLButtonElement>(
      '[data-action="new"]',
    );
    if (!board) return;

    const won = this.state.status === "won";
    const confirmedUnsolvable =
      this.solutionCheckState === "unsolvable";
    const showNext = won || this.hasWonThisRound || confirmedUnsolvable;
    board.classList.toggle("is-won", won);
    board.classList.toggle("is-lost", this.state.status === "lost");
    if (newButton) {
      newButton.textContent = showNext ? "下一题" : "换一题";
      newButton.classList.toggle("is-next", showNext);
    }
    this.renderSolutionButton();
    if (status) {
      status.textContent =
        this.state.status === "won"
          ? "刚好组成 24，计时已暂停"
          : confirmedUnsolvable
            ? "此题无解，计时已暂停"
          : this.state.status === "lost"
            ? "本题未得到 24，可以撤销或重来本题"
            : this.solutionCheckState === "solvable" ||
                this.solutionCheckState === "hint-solvable"
              ? "此题有解"
            : "";
    }
  }

  private renderSolutionButton(): void {
    const button = this.root.querySelector<HTMLButtonElement>(
      '[data-action="solution"]',
    );
    if (!button) return;

    button.classList.remove(
      "is-neutral",
      "is-checkable",
      "is-solvable",
      "is-unsolvable",
    );

    if (this.state.status === "won" || this.hasWonThisRound) {
      button.textContent = "此题有解";
      button.classList.add("is-neutral");
      button.disabled = true;
      button.setAttribute("aria-label", "此题有解");
      return;
    }

    if (this.solutionCheckState === "unsolvable") {
      button.textContent = "此题无解";
      button.classList.add("is-unsolvable");
      button.disabled = true;
      button.setAttribute("aria-label", "此题无解");
      return;
    }

    if (this.solutionCheckState === "solvable") {
      button.textContent = "此题有解";
      button.classList.add("is-solvable");
      button.disabled = true;
      button.setAttribute("aria-label", "此题有解");
      return;
    }

    if (this.solutionCheckState === "hint-solvable") {
      button.textContent = "此题有解";
      button.classList.add("is-neutral");
      button.disabled = true;
      button.setAttribute("aria-label", "此题有解");
      return;
    }

    if (!this.settings.allowUnsolvable) {
      button.textContent = "此题有解";
      button.classList.add("is-neutral");
      button.disabled = true;
      button.setAttribute("aria-label", "此题保证有解");
      return;
    }

    button.textContent = "无解";
    button.classList.add("is-checkable");
    button.disabled = false;
    button.setAttribute("aria-label", "检查本题是否有解");
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
      nearTargetIndex: null,
      currentTarget: null,
    };
    window.addEventListener("pointermove", this.handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerCancel);
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("blur", this.handlePointerCancel);
    source.addEventListener(
      "lostpointercapture",
      this.handleLostPointerCapture,
    );
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
    this.audio.play("merge", Math.max(0, this.state.history.length - 1));
    if (this.state.status === "won") {
      this.hasWonThisRound = true;
      this.timer.stop();
      this.audio.play("win");
    } else if (this.state.status === "lost") {
      this.audio.play("lose");
    }
    this.hideHint();
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

  private readonly handleLostPointerCapture = (): void => {
    this.handlePointerCancel();
  };

  private startVisualDrag(session: DragSession): void {
    session.moved = true;
    this.audio.play("lift");
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
    ghost.style.setProperty(
      "--ghost-tilt",
      `${this.getCardAppearance(session.sourceCard).tilt - 2}deg`,
    );
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

    const nearTargetIndex = this.findNearbyTarget(
      clientX,
      clientY,
      session,
    );
    this.updateNearbyTarget(session, nearTargetIndex);

    const operatorButton =
      this.findOperatorFromGhost(session, nearTargetIndex) ??
      this.findOperatorAtPoint(clientX, clientY, nearTargetIndex);
    const nextTarget =
      operatorButton && nearTargetIndex !== null
        ? {
            targetIndex: nearTargetIndex,
            operator: operatorButton.dataset.operator as Operator,
          }
        : null;

    this.updateCurrentTarget(session, nextTarget);
  }

  private findNearbyTarget(
    clientX: number,
    clientY: number,
    session: DragSession,
  ): number | null {
    if (session.ghost) {
      const ghostRect = session.ghost.getBoundingClientRect();
      const ghostTarget = this.findOverlappingCard(
        ghostRect,
        session.sourceIndex,
      );
      if (ghostTarget !== null) return ghostTarget;
    }

    return this.findNearbyCard(clientX, clientY, session.sourceIndex);
  }

  private findOverlappingCard(
    ghostRect: DOMRect,
    sourceIndex: number,
  ): number | null {
    let overlappingIndex: number | null = null;
    let largestOverlap = 0;

    for (const cardElement of this.root.querySelectorAll<HTMLElement>(
      "[data-card-index]",
    )) {
      const targetIndex = Number(cardElement.dataset.cardIndex);
      if (targetIndex === sourceIndex || !this.state.slots[targetIndex]) {
        continue;
      }

      const overlap = intersectionArea(
        ghostRect,
        cardElement.getBoundingClientRect(),
      );
      if (overlap > largestOverlap) {
        largestOverlap = overlap;
        overlappingIndex = targetIndex;
      }
    }

    return overlappingIndex;
  }

  private findNearbyCard(
    clientX: number,
    clientY: number,
    sourceIndex: number,
  ): number | null {
    let nearestIndex: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const cardElement of this.root.querySelectorAll<HTMLElement>(
      "[data-card-index]",
    )) {
      const targetIndex = Number(cardElement.dataset.cardIndex);
      if (targetIndex === sourceIndex || !this.state.slots[targetIndex]) {
        continue;
      }

      const cardRect = cardElement.getBoundingClientRect();
      const distance = distanceToRect(clientX, clientY, cardRect);
      if (distance <= NEARBY_TARGET_DISTANCE && distance < nearestDistance) {
        nearestIndex = targetIndex;
        nearestDistance = distance;
      }
    }

    return nearestIndex;
  }

  private findOperatorAtPoint(
    clientX: number,
    clientY: number,
    targetIndex: number | null,
  ): HTMLButtonElement | null {
    if (targetIndex === null) return null;
    const element = document.elementFromPoint(clientX, clientY);
    const button = element?.closest<HTMLButtonElement>(
      "[data-target-index][data-operator]",
    );
    if (
      !button ||
      button.disabled ||
      Number(button.dataset.targetIndex) !== targetIndex
    ) {
      return null;
    }
    return button;
  }

  private findOperatorFromGhost(
    session: DragSession,
    targetIndex: number | null,
  ): HTMLButtonElement | null {
    if (!session.ghost || targetIndex === null) return null;
    const ghostRect = session.ghost.getBoundingClientRect();
    let best: { button: HTMLButtonElement; overlap: number } | null = null;

    for (const button of this.root.querySelectorAll<HTMLButtonElement>(
      `[data-target-index="${targetIndex}"][data-operator]`,
    )) {
      if (button.disabled) continue;
      const buttonRect = button.getBoundingClientRect();
      const visual =
        button.querySelector<HTMLElement>(".operator-visual") ?? button;
      const operatorRect = {
        left:
          buttonRect.left + (buttonRect.width - visual.offsetWidth) / 2,
        right:
          buttonRect.right - (buttonRect.width - visual.offsetWidth) / 2,
        top:
          buttonRect.top + (buttonRect.height - visual.offsetHeight) / 2,
        bottom:
          buttonRect.bottom - (buttonRect.height - visual.offsetHeight) / 2,
      };
      const minimumOverlap =
        visual.offsetWidth * visual.offsetHeight * MIN_OPERATOR_OVERLAP_RATIO;
      const overlap = intersectionArea(ghostRect, operatorRect);
      if (overlap < minimumOverlap) continue;

      const isCurrent =
        session.currentTarget?.targetIndex === targetIndex &&
        session.currentTarget.operator === button.dataset.operator;
      const isLarger = !best || overlap > best.overlap + 0.5;
      const isTied =
        best !== null && Math.abs(overlap - best.overlap) <= 0.5;
      if (isLarger || (isTied && isCurrent)) {
        best = { button, overlap };
      }
    }

    return best?.button ?? null;
  }

  private updateNearbyTarget(
    session: DragSession,
    targetIndex: number | null,
  ): void {
    if (session.nearTargetIndex === targetIndex) return;

    if (session.nearTargetIndex !== null) {
      this.root
        .querySelector<HTMLElement>(
          `[data-slot-index="${session.nearTargetIndex}"]`,
        )
        ?.classList.remove("is-near");
    }
    session.nearTargetIndex = targetIndex;
    if (targetIndex !== null) {
      this.root
        .querySelector<HTMLElement>(`[data-slot-index="${targetIndex}"]`)
        ?.classList.add("is-near");
    }
  }

  private updateCurrentTarget(
    session: DragSession,
    nextTarget: DragTarget | null,
  ): void {
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

    if (!nextTarget) return;
    this.audio.play("operator", OPERATORS.indexOf(nextTarget.operator));
    const targetSlot = this.root.querySelector<HTMLElement>(
      `[data-slot-index="${nextTarget.targetIndex}"]`,
    );
    const targetOperator = this.root.querySelector<HTMLElement>(
      `[data-target-index="${nextTarget.targetIndex}"][data-operator="${nextTarget.operator}"]`,
    );
    targetSlot?.classList.add("is-target");
    targetOperator?.classList.add("is-targeted");
  }

  private finishVisualDrag(): void {
    if (!this.dragSession) return;
    const sourceElement = this.dragSession.sourceElement;
    this.dragSession.ghost?.remove();
    this.root.querySelector<HTMLElement>("[data-board]")?.classList.remove(
      "is-dragging",
    );
    this.root
      .querySelectorAll(
        ".card-slot.is-source, .card-slot.is-target, .card-slot.is-near",
      )
      .forEach((slot) =>
        slot.classList.remove("is-source", "is-target", "is-near"),
      );
    this.root
      .querySelectorAll(".operator.is-targeted")
      .forEach((button) => button.classList.remove("is-targeted"));
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerCancel);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("blur", this.handlePointerCancel);
    sourceElement.removeEventListener(
      "lostpointercapture",
      this.handleLostPointerCapture,
    );
    this.dragSession = null;
  }

  private rejectSource(sourceIndex: number): void {
    this.audio.play("invalid");
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

  private flashGuessWrong(): void {
    const frame = this.root.querySelector<HTMLElement>(".game-frame");
    if (!frame) return;
    frame.classList.remove("is-guess-wrong");
    void frame.offsetWidth;
    frame.classList.add("is-guess-wrong");
    window.setTimeout(
      () => frame.classList.remove("is-guess-wrong"),
      420,
    );
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
        audio: this.audio.getDebugState(),
        solutionCheck: this.solutionCheckState,
        hintVisible: this.hintOpen,
        wonThisRound: this.hasWonThisRound,
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
              nearTarget: this.dragSession.nearTargetIndex,
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

function undoIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 8h11.5a7 7 0 0 1 7 7 7 7 0 0 1-7 7H2.5"></path>
      <path d="M8 2.5 2.5 8 8 13.5"></path>
    </svg>
  `;
}

function bulbIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18h6M10 21h4"></path>
      <path d="M8.5 15.5a7 7 0 1 1 7 0c-.9.7-1.5 1.6-1.5 2.5h-4c0-.9-.6-1.8-1.5-2.5Z"></path>
    </svg>
  `;
}

function audioIcon(muted: boolean): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4Z"></path>
      ${
        muted
          ? '<path d="m16 9 5 5m0-5-5 5"></path>'
          : '<path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10"></path>'
      }
    </svg>
  `;
}

function gearIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.6 3.2h4.8l.6 2.1c.5.2 1 .5 1.5.8l2.1-.6 2.4 4.1-1.5 1.6v1.6l1.5 1.6-2.4 4.1-2.1-.6c-.5.3-1 .6-1.5.8l-.6 2.1H9.6L9 20.7c-.5-.2-1-.5-1.5-.8l-2.1.6L3 16.4 4.5 14.8v-1.6L3 11.6l2.4-4.1 2.1.6c.5-.3 1-.6 1.5-.8l.6-2.1Z"></path>
      <circle cx="12" cy="13" r="3.1"></circle>
    </svg>
  `;
}

function distanceToRect(
  x: number,
  y: number,
  rect: DOMRect,
): number {
  const horizontalDistance = Math.max(
    0,
    rect.left - x,
    x - rect.right,
  );
  const verticalDistance = Math.max(
    0,
    rect.top - y,
    y - rect.bottom,
  );
  return Math.hypot(horizontalDistance, verticalDistance);
}

function intersectionArea(left: RectLike, right: RectLike): number {
  const width = Math.max(
    0,
    Math.min(left.right, right.right) - Math.max(left.left, right.left),
  );
  const height = Math.max(
    0,
    Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top),
  );
  return width * height;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function getBrowserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (milliseconds: number) => void;
  }
}
