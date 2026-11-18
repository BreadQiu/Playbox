import {
  add,
  createWhole,
  divide,
  equals,
  multiply,
  subtract,
  type Fraction,
} from "./fraction";

export type DigitRange = "1-9" | "1-13";
export type PuzzleValues = readonly [number, number, number, number];
export type SolutionOperator = "+" | "-" | "×" | "÷";
export type SolutionStep = Readonly<{
  left: number;
  right: number;
  operator: SolutionOperator;
}>;

type OperatorCandidate = Readonly<{
  value: Fraction;
  left: Fraction;
  right: Fraction;
  operator: SolutionOperator;
}>;

type ExpressionNode =
  | Readonly<{ kind: "number"; value: number }>
  | Readonly<{
      kind: "operation";
      left: ExpressionNode;
      right: ExpressionNode;
      operator: SolutionOperator;
    }>;

type ExpressionCandidate = Readonly<{
  value: Fraction;
  node: ExpressionNode;
}>;

const TARGET = createWhole(24);
const SOLVABLE_FALLBACK: PuzzleValues = [6, 6, 6, 6];
const MAX_GENERATION_ATTEMPTS = 10_000;

export function hasSolution(values: readonly number[]): boolean {
  return findSolutionStep(values) !== null;
}

export function findSolutionStep(
  values: readonly number[],
): SolutionStep | null {
  const fractions = values.map(createWhole);
  let negativeFallback: SolutionStep | null = null;

  for (let leftIndex = 0; leftIndex < fractions.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < fractions.length;
      rightIndex += 1
    ) {
      const left = fractions[leftIndex];
      const right = fractions[rightIndex];
      const remaining = fractions.filter(
        (_, index) => index !== leftIndex && index !== rightIndex,
      );

      for (const candidate of combine(left, right)) {
        if (solve([...remaining, candidate.value])) {
          const step: SolutionStep = {
            left: candidate.left.numerator,
            right: candidate.right.numerator,
            operator: candidate.operator,
          };
          if (candidate.value.numerator >= 0) {
            return step;
          }
          negativeFallback ??= step;
        }
      }
    }
  }

  return negativeFallback;
}

export function findSolutionExpression(
  values: readonly number[],
): string | null {
  return solveExpression(
    values.map((value) => ({
      value: createWhole(value),
      node: { kind: "number", value },
    })),
  );
}

export function generatePuzzle(
  range: DigitRange,
  allowUnsolvable: boolean,
  rng: () => number = Math.random,
): PuzzleValues {
  const maximum = range === "1-13" ? 13 : 9;
  const knownResults = new Map<string, boolean>();

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const puzzle = randomPuzzle(maximum, rng);

    if (allowUnsolvable) {
      return puzzle;
    }

    const key = [...puzzle].sort((a, b) => a - b).join(",");
    let solvable = knownResults.get(key);
    if (solvable === undefined) {
      solvable = hasSolution(puzzle);
      knownResults.set(key, solvable);
    }
    if (solvable) {
      return puzzle;
    }
  }

  return SOLVABLE_FALLBACK;
}

function randomPuzzle(maximum: number, rng: () => number): PuzzleValues {
  return [
    randomDigit(maximum, rng),
    randomDigit(maximum, rng),
    randomDigit(maximum, rng),
    randomDigit(maximum, rng),
  ];
}

function randomDigit(maximum: number, rng: () => number): number {
  const sample = Math.min(0.9999999999999999, Math.max(0, rng()));
  return Math.floor(sample * maximum) + 1;
}

function solve(values: readonly Fraction[]): boolean {
  if (values.length === 1) {
    return equals(values[0], TARGET);
  }

  for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < values.length;
      rightIndex += 1
    ) {
      const left = values[leftIndex];
      const right = values[rightIndex];
      const remaining = values.filter(
        (_, index) => index !== leftIndex && index !== rightIndex,
      );
      for (const candidate of combine(left, right)) {
        if (solve([...remaining, candidate.value])) {
          return true;
        }
      }
    }
  }

  return false;
}

function solveExpression(
  values: readonly ExpressionCandidate[],
): string | null {
  if (values.length === 1) {
    return equals(values[0].value, TARGET)
      ? renderExpression(values[0].node)
      : null;
  }

  for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < values.length;
      rightIndex += 1
    ) {
      const left = values[leftIndex];
      const right = values[rightIndex];
      const remaining = values.filter(
        (_, index) => index !== leftIndex && index !== rightIndex,
      );
      for (const candidate of combineExpressions(left, right)) {
        const expression = solveExpression([...remaining, candidate]);
        if (expression) return expression;
      }
    }
  }

  return null;
}

function combine(left: Fraction, right: Fraction): OperatorCandidate[] {
  const results: OperatorCandidate[] = [
    { value: add(left, right), left, right, operator: "+" },
    { value: subtract(left, right), left, right, operator: "-" },
    { value: subtract(right, left), left: right, right: left, operator: "-" },
    { value: multiply(left, right), left, right, operator: "×" },
  ];

  const leftDividedByRight = (): OperatorCandidate => ({
    value: divide(left, right),
    left,
    right,
    operator: "÷",
  });
  const rightDividedByLeft = (): OperatorCandidate => ({
    value: divide(right, left),
    left: right,
    right: left,
    operator: "÷",
  });
  const leftIsGreater =
    left.numerator * right.denominator >
    right.numerator * left.denominator;

  if (leftIsGreater) {
    if (right.numerator !== 0) results.push(leftDividedByRight());
    if (left.numerator !== 0) results.push(rightDividedByLeft());
  } else {
    if (left.numerator !== 0) results.push(rightDividedByLeft());
    if (right.numerator !== 0) results.push(leftDividedByRight());
  }

  const unique = new Map<string, OperatorCandidate>();
  for (const result of results) {
    const key = `${result.value.numerator}/${result.value.denominator}`;
    if (!unique.has(key)) {
      unique.set(key, result);
    }
  }
  return [...unique.values()];
}

function combineExpressions(
  left: ExpressionCandidate,
  right: ExpressionCandidate,
): ExpressionCandidate[] {
  const results: ExpressionCandidate[] = [
    operation(left, right, "+", add(left.value, right.value)),
    operation(left, right, "-", subtract(left.value, right.value)),
    operation(right, left, "-", subtract(right.value, left.value)),
    operation(left, right, "×", multiply(left.value, right.value)),
  ];

  if (right.value.numerator !== 0) {
    results.push(
      operation(left, right, "÷", divide(left.value, right.value)),
    );
  }
  if (left.value.numerator !== 0) {
    results.push(
      operation(right, left, "÷", divide(right.value, left.value)),
    );
  }

  const unique = new Map<string, ExpressionCandidate>();
  for (const result of results) {
    const key = `${result.value.numerator}/${result.value.denominator}`;
    if (!unique.has(key)) {
      unique.set(key, result);
    }
  }
  return [...unique.values()];
}

function operation(
  left: ExpressionCandidate,
  right: ExpressionCandidate,
  operator: SolutionOperator,
  value: Fraction,
): ExpressionCandidate {
  return {
    value,
    node: {
      kind: "operation",
      left: left.node,
      right: right.node,
      operator,
    },
  };
}

function renderExpression(node: ExpressionNode): string {
  if (node.kind === "number") return String(node.value);

  const left = renderExpressionPart(node.left, node.operator, "left");
  const right = renderExpressionPart(node.right, node.operator, "right");
  return `${left}${node.operator === "-" ? "−" : node.operator}${right}`;
}

function renderExpressionPart(
  node: ExpressionNode,
  parentOperator: SolutionOperator,
  side: "left" | "right",
): string {
  const expression = renderExpression(node);
  if (node.kind === "number") return expression;

  const childPrecedence = operatorPrecedence(node.operator);
  const parentPrecedence = operatorPrecedence(parentOperator);
  const needsParentheses =
    childPrecedence < parentPrecedence ||
    (side === "right" &&
      childPrecedence === parentPrecedence &&
      (parentOperator === "-" || parentOperator === "÷"));
  return needsParentheses ? `(${expression})` : expression;
}

function operatorPrecedence(operator: SolutionOperator): number {
  return operator === "+" || operator === "-" ? 1 : 2;
}
