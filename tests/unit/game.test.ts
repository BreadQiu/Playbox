import { describe, expect, it } from "vitest";

import {
  mergeCards,
  newGame,
  resetRound,
  undoGame,
} from "../../src/core/game";

function cardValues(state: ReturnType<typeof newGame>) {
  return state.slots.map((card) => card?.value ?? null);
}

describe("drag merge game state", () => {
  it("merges in source-op-target order and empties the source slot", () => {
    const state = newGame([6, 8, 2, 4]);
    const result = mergeCards(state, 0, 1, "-");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.slots[0]).toBeNull();
    expect(result.state.slots[1]?.value).toEqual({
      numerator: -2,
      denominator: 1,
    });
    expect(result.state.slots[1]?.expression).toBe("(6 − 8)");
    expect(result.state.slots[2]).toBe(state.slots[2]);
    expect(result.state.slots[3]).toBe(state.slots[3]);
  });

  it("uses the dragged value as the dividend", () => {
    const state = newGame([6, 2, 8, 4]);
    const result = mergeCards(state, 0, 1, "÷");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.slots[1]?.value).toEqual({
      numerator: 3,
      denominator: 1,
    });
  });

  it("rejects invalid merges without changing the state", () => {
    const state = newGame([1, 0, 2, 3]);
    const firstMerge = mergeCards(state, 0, 1, "+");
    expect(firstMerge.ok).toBe(true);
    if (!firstMerge.ok) return;
    const emptyState = mergeCards(firstMerge.state, 0, 2, "+");

    expect(emptyState).toEqual({ ok: false, reason: "empty-slot" });
    expect(mergeCards(state, 0, 0, "+")).toEqual({
      ok: false,
      reason: "same-card",
    });
    expect(mergeCards(state, 0, 1, "÷")).toEqual({
      ok: false,
      reason: "divide-by-zero",
    });
    expect(cardValues(state)).toEqual([
      { numerator: 1, denominator: 1 },
      { numerator: 0, denominator: 1 },
      { numerator: 2, denominator: 1 },
      { numerator: 3, denominator: 1 },
    ]);
  });

  it("reaches a win after three valid merges", () => {
    let state = newGame([6, 6, 6, 6]);

    const first = mergeCards(state, 0, 1, "×");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.state;

    const second = mergeCards(state, 2, 3, "+");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    state = second.state;

    const third = mergeCards(state, 1, 3, "-");
    expect(third.ok).toBe(true);
    if (!third.ok) return;

    expect(third.state.status).toBe("won");
    expect(third.state.slots[3]?.value).toEqual({
      numerator: 24,
      denominator: 1,
    });
  });

  it("marks a non-24 final value as lost and can undo every move", () => {
    let state = newGame([1, 1, 1, 1]);
    for (const [source, target, operator] of [
      [0, 1, "+"],
      [2, 3, "+"],
      [1, 3, "+"],
    ] as const) {
      const result = mergeCards(state, source, target, operator);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }

    expect(state.status).toBe("lost");
    const undone = undoGame(state);
    expect(undone.status).toBe("playing");
    expect(undone.history).toHaveLength(2);

    const fullyUndone = undoGame(undoGame(undone));
    expect(fullyUndone.status).toBe("playing");
    expect(fullyUndone.history).toHaveLength(0);
    expect(fullyUndone.slots).toEqual(newGame([1, 1, 1, 1]).slots);
  });

  it("does not undo a winning board", () => {
    const won = {
      ...newGame([24, 2, 3, 4]),
      status: "won" as const,
    };
    expect(undoGame(won)).toBe(won);
  });

  it("resets the current puzzle without restoring merge history", () => {
    const initial = newGame([6, 8, 2, 4]);
    const merged = mergeCards(initial, 0, 1, "+");
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    const reset = resetRound(merged.state, [6, 8, 2, 4]);
    expect(reset.history).toEqual([]);
    expect(reset.status).toBe("playing");
    expect(reset.slots).toEqual(initial.slots);
  });
});
