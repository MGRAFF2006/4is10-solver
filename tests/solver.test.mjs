import assert from "node:assert/strict";
import test from "node:test";
import { solve } from "../src/js/solver.mjs";

test("prefers a simple expression and uses all four digits", () => {
  assert.deepEqual(solve([5, 5, 5, 5]), { expression: "5 + 5 + 5 − 5", value: 10, exact: true });
  assert.equal(solve([0, 1, 2, 5]).exact, true);
});

test("finds solutions requiring nested and separate groupings", () => {
  // Both fail without parentheses. The second needs a grouping on each side.
  for (const digits of [[1, 3, 4, 6], [1, 1, 2, 3], [1, 1, 5, 8]]) {
    const result = solve(digits);
    assert.equal(result.exact, true);
    assert.equal(solve(digits, undefined, false).exact, false);
    assert.deepEqual(result.expression.match(/\d/g).map(Number).sort(), [...digits].sort());
  }
});

test("respects enabled operators and returns the closest finite result", () => {
  assert.deepEqual(solve([1, 2, 3, 4], ["+"]), { expression: "1 + 2 + 3 + 4", value: 10, exact: true });
  assert.equal(solve([1, 1, 1, 1]).value, 4);
  assert.equal(solve([0, 0, 0, 0]).value, 0);
  assert.equal(solve([0, 0, 0, 0], ["/"]), null);
  assert.equal(solve([5, 5, 5, 5], []), null);
  assert.equal(solve([1, 2, 3, 4], ["*"], false).value, 24);
});

test("validates input at the solver boundary", () => {
  for (const digits of [[1, 2, 3], [0, 1, 2, 10], [0, 1, 2, -1], [0, 1, 2, 1.5], [0, 1, 2, "3"], Array(4), null]) {
    assert.throws(() => solve(digits), TypeError);
  }
  assert.throws(() => solve([1, 2, 3, 4], ["eval"]), TypeError);
  assert.throws(() => solve([1, 2, 3, 4], ["toString"]), TypeError);
  assert.throws(() => solve([1, 2, 3, 4], Array(1)), TypeError);
  assert.throws(() => solve([1, 2, 3, 4], [new String("+")]), TypeError);
});

test("matches an independent subset search for all 715 unordered digit combinations", () => {
  function closestDistance(digits) {
    const values = Array.from({ length: 16 }, () => new Set());
    digits.forEach((digit, index) => values[1 << index].add(digit));
    for (let mask = 1; mask < 16; mask++) {
      for (let left = (mask - 1) & mask; left > 0; left = (left - 1) & mask) {
        const right = mask ^ left;
        if (left > right) continue;
        for (const a of values[left]) for (const b of values[right]) {
          for (const value of [a + b, a - b, b - a, a * b, a / b, b / a]) {
            if (Number.isFinite(value)) values[mask].add(value);
          }
        }
      }
    }
    return Math.min(...[...values[15]].map(value => Math.abs(10 - value)));
  }
  for (let a = 0; a <= 9; a++) for (let b = a; b <= 9; b++) {
    for (let c = b; c <= 9; c++) for (let d = c; d <= 9; d++) {
      const digits = [a, b, c, d];
      const result = solve(digits);
      assert.ok(Math.abs(Math.abs(10 - result.value) - closestDistance(digits)) < 1e-9, String(digits));
      assert.deepEqual(result.expression.match(/\d/g).map(Number).sort(), digits);
    }
  }
});
