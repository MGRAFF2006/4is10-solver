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
  let negative = false;
  for (let i = 0; i < operators.length; i++) {
    const next = { n: digits[i + 1], d: 1 };
    if (operators[i] === "*" || operators[i] === "/") {
      term = combine(term, next, operators[i]);
      if (!term) return null;
    } else {
      sum = combine(sum, term, sign);
      // Products of digits are never negative, but a running sum can be, e.g. 0 − 1 + 2 + 9.
      negative ||= sum.n < 0;
      term = next;
      sign = operators[i];
    }
  }
  // Products are evaluated first: the opening product if there is one, else the second
  // term's product, else the first two digits are added or subtracted.
  const step = i => `${digits[i]} ${symbols[operators[i]]} ${digits[i + 1]}`;
  const multiplicative = operator => operator === "*" || operator === "/";
  const firstStep = !multiplicative(operators[0]) && multiplicative(operators[1]) ? step(1) : step(0);
  return { ...combine(sum, term, sign), parens: 0, negative, firstStep, expression: digits.map((digit, i) =>
    `${i ? ` ${symbols[operators[i - 1]]} ` : ""}${digit}`).join("") };
}

const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };

// Bracket an operand only when the usual order of operations would change its value.
function operand(child, operator, side) {
  const inner = precedence[child.operator] ?? 3;
  const outer = precedence[operator];
  const needed = inner < outer ||
    (side === "right" && inner === outer && (operator === "-" || operator === "/"));
  return needed ? [`(${child.expression})`, child.parens + 1] : [child.expression, child.parens];
}

// Answers that differ only in the order or grouping of terms in a sum, or of factors in a
// product, are the same solution: "5 + 5 + 5 − 5" and "5 − 5 + 5 + 5" share one key.
// Subtracting 0 and dividing by 1 count as adding 0 and multiplying by 1.
// Only answers that make ten need a key, so it is worked out on request.
function canonical(node) {
  if (!node.operator) return { kind: "digit", key: node.expression };
  const { left, right, operator } = node;
  const kind = operator === "+" || operator === "-" ? "sum" : "product";
  const [same, inverse, identity] = kind === "sum" ? ["+", "-", "0"] : ["*", "/", "1"];
  const parts = child => {
    const form = canonical(child);
    return form.kind === kind ? form.parts : [same + form.key];
  };
  const invert = part => (part[0] === same ? inverse : same) + part.slice(1);
  const rightParts = operator === same ? parts(right) : parts(right).map(invert);
  const all = [...parts(left), ...rightParts]
    .map(part => part === inverse + identity ? same + identity : part).sort();
  return { kind, parts: all, key: `${kind}(${all.join(" ")})` };
}

function* groupedResults(digits, operators) {
  if (digits.length === 1) {
    yield { n: digits[0], d: 1, expression: String(digits[0]), parens: 0, negative: false, firstStep: null };
    return;
  }
  for (let split = 1; split < digits.length; split++) {
    for (const left of groupedResults(digits.slice(0, split), operators)) {
      for (const right of groupedResults(digits.slice(split), operators)) {
        for (const operator of operators) {
          // "a + (b − c)" prints as "a + b − c", which reads as "(a + b) − c". That tree is
          // searched too, so keep only the one whose steps match the printed answer.
          if (precedence[right.operator] === precedence[operator] && (operator === "+" || operator === "*")) continue;
          const fraction = combine(left, right, operator);
          if (!fraction) continue;
          const [leftText, leftParens] = operand(left, operator, "left");
          const [rightText, rightParens] = operand(right, operator, "right");
          yield { ...fraction, left, right, operator, parens: leftParens + rightParens,
            negative: left.negative || right.negative || left.n < 0 || right.n < 0,
            // Evaluation works left to right through the tree, so the first step is the
            // leftmost operation whose operands are both single digits.
            firstStep: left.firstStep ?? right.firstStep ??
              `${left.expression} ${symbols[operator]} ${right.expression}`,
            expression: `${leftText} ${symbols[operator]} ${rightText}` };
        }
      }
    }
  }
}

/** Search every digit order and binary grouping, using exact integer fractions.
 * Prefers the closest result, then the fewest parentheses. `firstStep` is the first
 * operation to work out, such as "1 ÷ 5" for "8 ÷ (1 − 1 ÷ 5)", for hints. */
function validate(digits, operators) {
  if (!Array.isArray(digits) || digits.length !== 4 ||
      Array.from(digits).some(digit => !Number.isInteger(digit) || digit < 0 || digit > 9)) {
    throw new TypeError("Choose exactly four digits from 0 to 9.");
  }
  if (!Array.isArray(operators) || Array.from(operators).some(operator =>
    typeof operator !== "string" || !Object.hasOwn(symbols, operator))) {
    throw new TypeError("Unknown arithmetic operator.");
  }
  return [...new Set(operators)];
}

export function solve(digits, operators = ["+", "-", "*", "/"], parentheses = true) {
  operators = validate(digits, operators);
  if (operators.length === 0) return null;
  let best = null;
  // Closer to ten wins. At equal distance, fewer parentheses and then
  // avoiding negative intermediate values make the answer easier to follow.
  const consider = result => {
    if (!result) return;
    const order = !best ? -1
      : Math.abs(result.n - 10 * result.d) * best.d - Math.abs(best.n - 10 * best.d) * result.d ||
        result.parens - best.parens || result.negative - best.negative;
    if (order < 0) best = result;
  };
  const exact = () => best && best.n === 10 * best.d;
  const finish = () => ({ expression: best.expression, value: best.n / best.d, exact: exact(), firstStep: best.firstStep });
  const orders = [...permutations(digits)];
  // Every expression without parentheses is tried first, in a readable order.
  for (const order of orders) {
    for (const a of operators) for (const b of operators) for (const c of operators) {
      consider(flatResult(order, [a, b, c]));
      if (exact() && !best.negative) return finish();
    }
  }
  if (exact()) return finish();
  if (parentheses) {
    for (const order of orders) {
      for (const result of groupedResults(order, operators)) {
        consider(result);
        // No exact ten without parentheses exists here, so one pair is the minimum.
        if (exact() && best.parens === 1 && !best.negative) return finish();
      }
    }
  }
  return best ? finish() : null;
}

/** Every distinct way to make exactly ten, each printed as simply as possible: fewest
 * parentheses, then no negative intermediate values. Reordering or regrouping terms of a
 * sum or factors of a product does not make a new solution. */
export function allSolutions(digits, operators = ["+", "-", "*", "/"], parentheses = true) {
  operators = validate(digits, operators);
  const best = new Map();
  for (const order of permutations(digits)) {
    for (const result of groupedResults(order, operators)) {
      if (result.n !== 10 * result.d || (!parentheses && result.parens > 0)) continue;
      const { key } = canonical(result);
      const current = best.get(key);
      const simpler = !current || result.parens < current.parens ||
        (result.parens === current.parens && result.negative < current.negative);
      if (simpler) best.set(key, result);
    }
  }
  return [...best.values()]
    .sort((a, b) => a.parens - b.parens || a.negative - b.negative)
    .map(result => result.expression);
}
