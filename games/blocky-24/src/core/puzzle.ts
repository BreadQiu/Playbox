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

function combine(left: Fraction, right: Fraction): OperatorCandidate[] {
  const results: OperatorCandidate[] = [
    { value: add(left, right), left, right, operator: "+" },
    { value: subtract(left, right), left, right, operator: "-" },
    { value: subtract(right, left), left: right, right: left, operator: "-" },
    { value: multiply(left, right), left, right, operator: "×" },
  ];

  if (right.numerator !== 0) {
    results.push({
      value: divide(left, right),
      left,
      right,
      operator: "÷",
    });
  }
  if (left.numerator !== 0) {
    results.push({
      value: divide(right, left),
      left: right,
      right: left,
      operator: "÷",
    });
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
