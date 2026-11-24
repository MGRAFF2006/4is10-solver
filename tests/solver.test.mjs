import assert from "node:assert/strict";
import test from "node:test";
import { solve } from "../src/js/solver.mjs";

// Reads a displayed answer with the usual order of operations, independently of the solver.
function evaluate(expression) {
  const tokens = expression.match(/\d|[−+×÷()]/g);
  let position = 0;
  const steps = [];
  const apply = (a, operator, b) => {
    steps.push({ "+": a + b, "−": a - b, "×": a * b, "÷": a / b }[operator]);
    return steps.at(-1);
  };
  const factor = () => {
    const token = tokens[position++];
    if (token !== "(") return Number(token);
    const value = sum();
    assert.equal(tokens[position++], ")", expression);
    return value;
  };
  const product = () => {
    let value = factor();
    while (tokens[position] === "×" || tokens[position] === "÷") value = apply(value, tokens[position++], factor());
    return value;
  };
  const sum = () => {
    let value = product();
    while (tokens[position] === "+" || tokens[position] === "−") value = apply(value, tokens[position++], product());
    return value;
  };
  const value = sum();
  assert.equal(position, tokens.length, expression);
  // The last step applied is the outermost operation, which produces the answer itself.
  return { value, negative: steps.slice(0, -1).some(step => step < 0) };
}

function withoutEachBracketPair(expression) {
  const variants = [];
  const open = [];
  [...expression].forEach((character, index) => {
    if (character === "(") open.push(index);
    if (character === ")") {
      const start = open.pop();
      variants.push(expression.slice(0, start) + expression.slice(start + 1, index) + expression.slice(index + 1));
    }
  });
  return variants;
}

test("prefers a simple expression and uses all four digits", () => {
  assert.deepEqual(solve([5, 5, 5, 5]), { expression: "5 + 5 + 5 − 5", value: 10, exact: true });
  assert.equal(solve([0, 1, 2, 5]).exact, true);
});

test("finds solutions requiring nested and separate groupings", () => {
  // All three fail without parentheses.
  for (const digits of [[1, 3, 4, 6], [1, 1, 2, 3], [1, 1, 5, 8]]) {
    const result = solve(digits);
    assert.equal(result.exact, true);
    assert.equal(solve(digits, undefined, false).exact, false);
    assert.deepEqual(result.expression.match(/\d/g).map(Number).sort(), [...digits].sort());
  }
});

test("shows only the parentheses an answer needs and avoids negative steps when it can", () => {
  assert.deepEqual(solve([1, 1, 5, 8]), { expression: "8 ÷ (1 − 1 ÷ 5)", value: 10, exact: true });
  // Previously "0 − ((1 − 6) × 2)": doubled brackets and a negative intermediate value.
  const result = solve([0, 1, 2, 6]);
  assert.equal(result.exact, true);
  assert.equal(result.expression.match(/\(/g).length, 1, result.expression);
  assert.deepEqual(evaluate(result.expression), { value: 10, negative: false });
  // Without parentheses too: "0 + 2 − 1 + 9" rather than "0 − 1 + 2 + 9", for exact and closest results.
  for (const [digits, operators, value] of [[[0, 1, 2, 9], ["+", "-"], 10], [[0, 1, 3, 4], ["+", "-", "*"], 11]]) {
    for (const parentheses of [true, false]) {
      const { expression } = solve(digits, operators, parentheses);
      assert.deepEqual(evaluate(expression), { value, negative: false }, expression);
    }
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

test("matches an independent subset search and prints each answer correctly for all 715 combinations", () => {
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
      // The printed answer is what the solver says it is, and no bracket pair is redundant.
      assert.ok(Math.abs(evaluate(result.expression).value - result.value) < 1e-9, result.expression);
      for (const variant of withoutEachBracketPair(result.expression)) {
        assert.ok(!(Math.abs(evaluate(variant).value - result.value) < 1e-9), `${result.expression} → ${variant}`);
      }
    }
  }
});
