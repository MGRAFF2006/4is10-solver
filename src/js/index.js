import { solve } from "./solver.mjs";

const form = document.querySelector("#solver");
const inputs = [...document.querySelectorAll(".digit-input")];
const panel = document.querySelector(".result-panel");
const status = document.querySelector("#result-status");
const expression = document.querySelector("#expression");
const answer = document.querySelector("#answer");
const note = document.querySelector("#result-note");
const announcement = document.querySelector("#announcement");
const operatorBoxes = [...form.querySelectorAll('[name="operator"]')];
const parenthesesBox = document.querySelector("#parentheses");
const copyButton = document.querySelector("#copy-link");
// Short letters keep shared links readable; "+" would turn into a space in a query string.
const operatorCodes = { "+": "a", "-": "s", "*": "m", "/": "d" };
const formatter = new Intl.NumberFormat("en", { maximumSignificantDigits: 10 });
const spokenSymbols = { "+": "plus", "−": "minus", "×": "times", "÷": "divided by", "(": "open bracket", ")": "close bracket" };
let settleTimer;

function spoken(text) {
  return text.replace(/[+−×÷()]/g, symbol => ` ${spokenSymbols[symbol]} `).replace(/\s+/g, " ").trim();
}


function showSolution() {
  inputs.forEach(input => input.setAttribute("aria-invalid", String(!input.validity.valid)));
  const operators = operatorBoxes.filter(box => box.checked).map(box => box.value);
  const valid = inputs.every(input => input.validity.valid);
  const result = valid ? solve(inputs.map(input => Number(input.value)), operators,
    parenthesesBox.checked) : null;
  if (!result) {
    panel.dataset.state = "invalid";
    status.textContent = "Check your inputs";
    expression.textContent = !valid ? "Choose four digits from 0 to 9."
      : !operators.length ? "Enable at least one operation." : "No defined result.";
    answer.textContent = "—";
    note.textContent = valid && operators.length
      ? "Every expression with these settings divides by zero. Try another operation."
      : "Change your settings and we’ll try again.";
    return `Check your inputs. ${expression.textContent} ${note.textContent}`;
  }
  panel.dataset.state = result.exact ? "exact" : "closest";
  status.textContent = result.exact ? "Exact match" : "Closest result";
  expression.textContent = result.expression;
  answer.textContent = result.exact ? "10" : formatter.format(result.value);
  if (result.exact) {
    const dot = document.createElement("span");
    dot.className = "answer-dot";
    dot.textContent = ".";
    dot.setAttribute("aria-hidden", "true");
    answer.append(dot);
  }
  const distance = formatter.format(Math.abs(10 - result.value));
  note.textContent = result.exact ? "All four digits. Every one used exactly once."
    : `No exact ten with these settings. Off by ${distance}.`;
  return result.exact ? `Exact match: ${spoken(result.expression)} equals 10.`
    : `Closest result: ${spoken(result.expression)} equals ${formatter.format(result.value)}, off by ${distance}.`;
}

// The puzzle lives in the address fragment, e.g. #digits=1158&ops=asmd&parens=on,
// so it never reaches the server and the address bar can always be shared.
const defaultPuzzle = { digits: "5555", ops: "asmd" };
let sharedHash = null;

/** The current puzzle as a fragment, or null while a digit is missing. */
function puzzleHash() {
  if (!inputs.every(input => input.validity.valid)) return null;
  return `#${new URLSearchParams({
    digits: inputs.map(input => input.value).join(""),
    ops: operatorBoxes.filter(box => box.checked).map(box => operatorCodes[box.value]).join(""),
    parens: parenthesesBox.checked ? "on" : "off",
  })}`;
}

// While a digit is being fixed, the address keeps the last complete puzzle.
function saveHash() {
  const hash = puzzleHash();
  if (!hash) return;
  sharedHash = hash;
  history.replaceState(null, "", hash);
}

/** Apply a shared puzzle from the address fragment. Returns false for other fragments, such as #solver. */
function applyHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has("digits") && !params.has("ops") && !params.has("parens")) return false;
  // A link describes a whole puzzle: missing or malformed parts use the defaults,
  // never whatever was on screen before.
  const digits = params.get("digits");
  const ops = params.get("ops");
  const validDigits = digits !== null && /^[0-9]{4}$/.test(digits) ? digits : defaultPuzzle.digits;
  const validOps = ops !== null && /^[asmd]*$/.test(ops) ? ops : defaultPuzzle.ops;
  inputs.forEach((input, index) => { input.value = validDigits[index]; });
  operatorBoxes.forEach(box => { box.checked = validOps.includes(operatorCodes[box.value]); });
  parenthesesBox.checked = params.get("parens") !== "off";
  sharedHash = puzzleHash();
  return true;
}

// Once the digits stop changing, read one short summary instead of every step of a drag
// and save the puzzle in the address (browsers limit how often it may be rewritten).
function update() {
  const summary = showSolution();
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    announcement.textContent = summary;
    saveHash();
  }, 600);
}

function setDigit(input, value) {
  input.value = String(((value % 10) + 10) % 10);
}

inputs.forEach(input => {
  const card = input.closest(".digit-card");
  card.querySelectorAll(".digit-step").forEach(button => {
    button.addEventListener("click", () => {
      setDigit(input, (Number(input.value) || 0) + Number(button.dataset.step));
      update();
    });
  });
  input.addEventListener("focus", () => input.select());
  // Focusing selects the digit, and moving the pointer over selected text would start the
  // browser's own text drag, which cancels ours. There is nothing to drag out of the field.
  input.addEventListener("dragstart", event => event.preventDefault());
  input.addEventListener("input", update);
  input.addEventListener("keydown", event => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    setDigit(input, (Number(input.value) || 0) + (event.key === "ArrowUp" ? 1 : -1));
    update();
  });
  let drag = null;
  input.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, y: event.clientY, value: Number(input.value) || 0 };
    input.setPointerCapture(event.pointerId);
  });
  input.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const steps = Math.trunc((drag.y - event.clientY) / 28);
    if (steps === 0 && !card.classList.contains("dragging")) return;
    card.classList.add("dragging");
    event.preventDefault();
    const previous = input.value;
    setDigit(input, drag.value + steps);
    if (input.value !== previous) update();
  });
  const endDrag = () => {
    drag = null;
    card.classList.remove("dragging");
  };
  input.addEventListener("pointerup", endDrag);
  input.addEventListener("pointercancel", endDrag);
  input.addEventListener("lostpointercapture", endDrag);
});

form.addEventListener("submit", event => {
  event.preventDefault();
  update();
});
form.querySelectorAll('input[type="checkbox"]').forEach(input => {
  input.addEventListener("change", update);
});
document.querySelector("#randomize").addEventListener("click", () => {
  inputs.forEach(input => setDigit(input, Math.floor(Math.random() * 10)));
  update();
});
let copyReset;
copyButton.addEventListener("click", async () => {
  // Settle now, so the address matches the link and the copy feedback is not replaced
  // by a pending result summary.
  clearTimeout(settleTimer);
  saveHash();
  const hash = puzzleHash();
  let copied = false;
  if (hash) {
    try {
      await navigator.clipboard.writeText(new URL(hash, location.href).href);
      copied = true;
    } catch {
      // Clipboard access needs a secure context and permission; the address bar holds the same link.
    }
  }
  copyButton.textContent = !hash ? "Check the digits" : copied ? "Link copied" : "Copy failed";
  announcement.textContent = !hash ? "Choose four digits from 0 to 9 before copying a link."
    : copied ? "Link to this puzzle copied." : "Copying failed. Copy the address from the address bar instead.";
  clearTimeout(copyReset);
  copyReset = setTimeout(() => { copyButton.textContent = "Copy link"; }, 2000);
});
addEventListener("hashchange", () => {
  if (applyHash()) update();
  // In-page links such as #solver have already scrolled; keep the puzzle in the address.
  else if (sharedHash) history.replaceState(null, "", sharedHash);
});
// The first result is visible on load; announce only changes the visitor makes.
applyHash();
showSolution();
