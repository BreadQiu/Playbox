import { describe, expect, it } from "vitest";

import { generatePuzzle, hasSolution } from "../../src/core/puzzle";

function sequenceRng(values: number[]): () => number {
  let cursor = 0;
  return () => {
    const value = values[cursor % values.length];
    cursor += 1;
    return value;
  };
}

describe("24-point puzzle solving", () => {
  it("recognizes ordinary solvable puzzles", () => {
    expect(hasSolution([6, 6, 6, 6])).toBe(true);
    expect(hasSolution([1, 2, 3, 4])).toBe(true);
  });

  it("recognizes a puzzle that requires an intermediate fraction", () => {
    expect(hasSolution([3, 3, 8, 8])).toBe(true);
  });

  it("rejects a puzzle with no solution", () => {
    expect(hasSolution([1, 1, 1, 1])).toBe(false);
  });
});

describe("24-point puzzle generation", () => {
  it("generates repeatable digits from the selected range", () => {
    const first = generatePuzzle(
      "1-13",
      true,
      sequenceRng([0.999, 0.999, 0.5, 0]),
    );
    const second = generatePuzzle(
      "1-13",
      true,
      sequenceRng([0.999, 0.999, 0.5, 0]),
    );

    expect(first).toEqual([13, 13, 7, 1]);
    expect(second).toEqual(first);
  });

  it("can return an unsolvable puzzle when filtering is disabled", () => {
    expect(generatePuzzle("1-9", true, () => 0)).toEqual([1, 1, 1, 1]);
  });

  it("never returns an unsolvable puzzle when filtering is enabled", () => {
    const puzzle = generatePuzzle("1-9", false, () => 0);

    expect(puzzle).toEqual([6, 6, 6, 6]);
    expect(hasSolution(puzzle)).toBe(true);
  });
});
