const symbols = { "+": "+", "-": "−", "*": "×", "/": "÷" };

// Four single digits keep these integer fractions within Number's safe range.
function combine(left, right, operator) {
  const { n: a, d: b } = left;
  const { n: c, d: d } = right;
  if (operator === "/" && c === 0) return null;
  const [n, denominator] = operator === "+" ? [a * d + c * b, b * d]
    : operator === "-" ? [a * d - c * b, b * d]
    : operator === "*" ? [a * c, b * d] : [a * d, b * c];
  return { n: denominator < 0 ? -n : n, d: Math.abs(denominator) };
}

function* permutations(digits) {
  if (digits.length === 0) { yield []; return; }
  const seen = new Set();
  for (let i = 0; i < digits.length; i++) {
    if (seen.has(digits[i])) continue;
    seen.add(digits[i]);
    const rest = [...digits.slice(0, i), ...digits.slice(i + 1)];
    for (const tail of permutations(rest)) yield [digits[i], ...tail];
  }
}

function flatResult(digits, operators) {
  let sum = { n: 0, d: 1 };
  let term = { n: digits[0], d: 1 };
  let sign = "+";
  for (let i = 0; i < operators.length; i++) {
    const next = { n: digits[i + 1], d: 1 };
    if (operators[i] === "*" || operators[i] === "/") {
      term = combine(term, next, operators[i]);
      if (!term) return null;
    } else {
      sum = combine(sum, term, sign);
      term = next;
      sign = operators[i];
    }
  }
  return { ...combine(sum, term, sign), expression: digits.map((digit, i) =>
    `${i ? ` ${symbols[operators[i - 1]]} ` : ""}${digit}`).join("") };
}

function* groupedResults(digits, operators) {
  if (digits.length === 1) {
    yield { n: digits[0], d: 1, expression: String(digits[0]) };
    return;
  }
  for (let split = 1; split < digits.length; split++) {
    for (const left of groupedResults(digits.slice(0, split), operators)) {
      for (const right of groupedResults(digits.slice(split), operators)) {
        for (const operator of operators) {
          const fraction = combine(left, right, operator);
          if (fraction) yield { ...fraction, expression: `(${left.expression} ${symbols[operator]} ${right.expression})` };
        }
      }
    }
  }
}

/** Search every digit order and binary grouping, using exact integer fractions. */
export function solve(digits, operators = ["+", "-", "*", "/"], parentheses = true) {
  if (!Array.isArray(digits) || digits.length !== 4 ||
      Array.from(digits).some(digit => !Number.isInteger(digit) || digit < 0 || digit > 9)) {
    throw new TypeError("Choose exactly four digits from 0 to 9.");
  }
  if (!Array.isArray(operators) || Array.from(operators).some(operator =>
    typeof operator !== "string" || !Object.hasOwn(symbols, operator))) {
    throw new TypeError("Unknown arithmetic operator.");
  }
  if (operators.length === 0) return null;
  operators = [...new Set(operators)];
  let best = null;
  const consider = result => {
    if (result && (!best || Math.abs(result.n - 10 * result.d) * best.d <
        Math.abs(best.n - 10 * best.d) * result.d)) best = result;
    return result && result.n === 10 * result.d;
  };
  const finish = () => ({
    expression: best.expression.startsWith("(") ? best.expression.slice(1, -1) : best.expression,
    value: best.n / best.d,
    exact: best.n === 10 * best.d,
  });
  const orders = [...permutations(digits)];
  // Prefer a readable expression without parentheses whenever possible.
  for (const order of orders) {
    for (const a of operators) for (const b of operators) for (const c of operators) {
      if (consider(flatResult(order, [a, b, c]))) return finish();
    }
  }
  if (parentheses) {
    for (const order of orders) {
      for (const result of groupedResults(order, operators)) {
        if (consider(result)) return finish();
      }
    }
  }
  return best ? finish() : null;
}
