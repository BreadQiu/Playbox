import { describe, expect, it } from "vitest";

import {
  add,
  createFraction,
  divide,
  equals,
  formatFraction,
  multiply,
  subtract,
} from "../../src/core/fraction";

describe("exact fraction arithmetic", () => {
  it("normalizes the sign and reduces fractions", () => {
    expect(createFraction(2, 4)).toEqual({ numerator: 1, denominator: 2 });
    expect(createFraction(1, -2)).toEqual({ numerator: -1, denominator: 2 });
    expect(createFraction(-1, -2)).toEqual({ numerator: 1, denominator: 2 });
  });

  it("normalizes zero to 0/1", () => {
    expect(createFraction(0, -9)).toEqual({ numerator: 0, denominator: 1 });
  });

  it("adds and subtracts fractions exactly", () => {
    expect(add(createFraction(1, 3), createFraction(1, 6))).toEqual({
      numerator: 1,
      denominator: 2,
    });
    expect(subtract(createFraction(1, 2), createFraction(3, 4))).toEqual({
      numerator: -1,
      denominator: 4,
    });
  });

  it("multiplies and divides fractions exactly", () => {
    expect(multiply(createFraction(3, 4), createFraction(8, 9))).toEqual({
      numerator: 2,
      denominator: 3,
    });
    expect(divide(createFraction(3, 2), createFraction(9, 4))).toEqual({
      numerator: 2,
      denominator: 3,
    });
  });

  it("rejects division by zero", () => {
    expect(() =>
      divide(createFraction(1, 1), createFraction(0, 1)),
    ).toThrow("Cannot divide by zero");
  });

  it("formats integers, fractions, and negatives without decimals", () => {
    expect(formatFraction(createFraction(24, 1))).toBe("24");
    expect(formatFraction(createFraction(3, 2))).toBe("3/2");
    expect(formatFraction(createFraction(-6, 4))).toBe("-3/2");
  });

  it("compares equivalent fractions", () => {
    expect(equals(createFraction(24, 1), createFraction(48, 2))).toBe(true);
    expect(equals(createFraction(47, 2), createFraction(24, 1))).toBe(false);
  });
});
