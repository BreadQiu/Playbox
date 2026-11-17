export type Fraction = Readonly<{
  numerator: number;
  denominator: number;
}>;

export function createFraction(numerator: number, denominator: number): Fraction {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new Error("Fraction terms must be integers");
  }
  if (denominator === 0) {
    throw new Error("Fraction denominator cannot be zero");
  }

  const sign = denominator < 0 ? -1 : 1;
  const divisor = greatestCommonDivisor(Math.abs(numerator), Math.abs(denominator));
  const normalizedNumerator = (numerator * sign) / divisor;

  return {
    numerator: normalizedNumerator === 0 ? 0 : normalizedNumerator,
    denominator: Math.abs(denominator) / divisor,
  };
}

export function createWhole(value: number): Fraction {
  return createFraction(value, 1);
}

export function add(left: Fraction, right: Fraction): Fraction {
  return createFraction(
    left.numerator * right.denominator +
      right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function subtract(left: Fraction, right: Fraction): Fraction {
  return createFraction(
    left.numerator * right.denominator -
      right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function multiply(left: Fraction, right: Fraction): Fraction {
  return createFraction(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  );
}

export function divide(left: Fraction, right: Fraction): Fraction {
  if (right.numerator === 0) {
    throw new Error("Cannot divide by zero");
  }
  return createFraction(
    left.numerator * right.denominator,
    left.denominator * right.numerator,
  );
}

export function equals(left: Fraction, right: Fraction): boolean {
  return (
    left.numerator === right.numerator &&
    left.denominator === right.denominator
  );
}

export function formatFraction(value: Fraction): string {
  if (value.denominator === 1) {
    return String(value.numerator);
  }
  return `${value.numerator}/${value.denominator}`;
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left;
  let b = right;

  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a || 1;
}
