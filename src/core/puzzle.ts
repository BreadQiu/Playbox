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

const TARGET = createWhole(24);
const SOLVABLE_FALLBACK: PuzzleValues = [6, 6, 6, 6];
const MAX_GENERATION_ATTEMPTS = 10_000;

export function hasSolution(values: readonly number[]): boolean {
  return solve(values.map(createWhole));
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
      const candidates = combine(left, right);

      for (const candidate of candidates) {
        if (solve([...remaining, candidate])) {
          return true;
        }
      }
    }
  }

  return false;
}

function combine(left: Fraction, right: Fraction): Fraction[] {
  const results = [
    add(left, right),
    subtract(left, right),
    subtract(right, left),
    multiply(left, right),
  ];

  if (right.numerator !== 0) {
    results.push(divide(left, right));
  }
  if (left.numerator !== 0) {
    results.push(divide(right, left));
  }

  const unique = new Map<string, Fraction>();
  for (const result of results) {
    unique.set(`${result.numerator}/${result.denominator}`, result);
  }
  return [...unique.values()];
}
