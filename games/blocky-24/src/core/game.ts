import {
  add,
  createWhole,
  divide,
  equals,
  formatFraction,
  multiply,
  subtract,
  type Fraction,
} from "./fraction";

export type Operator = "+" | "-" | "×" | "÷";
export type GameStatus = "playing" | "won" | "lost";
export type OperatorPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type Card = Readonly<{
  id: string;
  value: Fraction;
  expression: string;
}>;

export type BoardSnapshot = readonly [
  Card | null,
  Card | null,
  Card | null,
  Card | null,
];

export type GameState = Readonly<{
  slots: BoardSnapshot;
  history: readonly BoardSnapshot[];
  status: GameStatus;
}>;

export type MergeResult =
  | { ok: true; state: GameState }
  | {
      ok: false;
      reason: "empty-slot" | "same-card" | "divide-by-zero";
    };

const TARGET = createWhole(24);

export function newGame(values: readonly number[]): GameState {
  if (values.length !== 4) {
    throw new Error("A 24-point puzzle needs exactly four values");
  }

  const slots: BoardSnapshot = [
    createCard(0, values[0]),
    createCard(1, values[1]),
    createCard(2, values[2]),
    createCard(3, values[3]),
  ];

  return {
    slots,
    history: [],
    status: "playing",
  };
}

export function mergeCards(
  state: GameState,
  source: number,
  target: number,
  operator: Operator,
): MergeResult {
  if (source === target) {
    return { ok: false, reason: "same-card" };
  }

  const sourceCard = state.slots[source];
  const targetCard = state.slots[target];
  if (!sourceCard || !targetCard) {
    return { ok: false, reason: "empty-slot" };
  }

  let value: Fraction;
  try {
    value = applyOperator(sourceCard.value, targetCard.value, operator);
  } catch {
    return { ok: false, reason: "divide-by-zero" };
  }

  const mergedCard: Card = {
    id: `merged-${state.history.length}-${target}`,
    value,
    expression: `(${sourceCard.expression} ${displayOperator(operator)} ${targetCard.expression})`,
  };

  const slots = [...state.slots] as [
    Card | null,
    Card | null,
    Card | null,
    Card | null,
  ];
  slots[source] = null;
  slots[target] = mergedCard;

  const remaining = slots.filter((card): card is Card => card !== null);
  const status: GameStatus =
    remaining.length === 1
      ? equals(remaining[0].value, TARGET)
        ? "won"
        : "lost"
      : "playing";

  return {
    ok: true,
    state: {
      slots,
      history: [...state.history, state.slots],
      status,
    },
  };
}

export function undoGame(state: GameState): GameState {
  if (state.history.length === 0) {
    return state;
  }

  const previous = state.history[state.history.length - 1];
  return {
    slots: previous,
    history: state.history.slice(0, -1),
    status: "playing",
  };
}

export function resetRound(
  _state: GameState,
  initialValues: readonly number[],
): GameState {
  return newGame(initialValues);
}

export function formatCardValue(card: Card): string {
  return formatFraction(card.value);
}

export function displayOperator(operator: Operator): string {
  return operator === "-" ? "−" : operator;
}

function createCard(index: number, value: number): Card {
  return {
    id: `card-${index}-${value}`,
    value: createWhole(value),
    expression: String(value),
  };
}

function applyOperator(
  source: Fraction,
  target: Fraction,
  operator: Operator,
): Fraction {
  switch (operator) {
    case "+":
      return add(source, target);
    case "-":
      return subtract(source, target);
    case "×":
      return multiply(source, target);
    case "÷":
      return divide(source, target);
  }
}
