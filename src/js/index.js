import { solve } from "./solver.mjs";

const form = document.querySelector("#solver");
const inputs = [...document.querySelectorAll(".digit-input")];
const panel = document.querySelector(".result-panel");
const status = document.querySelector("#result-status");
const expression = document.querySelector("#expression");
const answer = document.querySelector("#answer");
const note = document.querySelector("#result-note");
const announcement = document.querySelector("#announcement");
const formatter = new Intl.NumberFormat("en", { maximumSignificantDigits: 10 });
const spokenSymbols = { "+": "plus", "−": "minus", "×": "times", "÷": "divided by", "(": "open bracket", ")": "close bracket" };
let announceTimer;

function spoken(text) {
  return text.replace(/[+−×÷()]/g, symbol => ` ${spokenSymbols[symbol]} `).replace(/\s+/g, " ").trim();
}

// Read one short summary once the digits stop changing, instead of every step of a drag.
function announce(text) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { announcement.textContent = text; }, 600);
}

function showSolution() {
  inputs.forEach(input => input.setAttribute("aria-invalid", String(!input.validity.valid)));
  const operators = [...form.querySelectorAll('[name="operator"]:checked')].map(input => input.value);
  const valid = inputs.every(input => input.validity.valid);
  const result = valid ? solve(inputs.map(input => Number(input.value)), operators,
    document.querySelector("#parentheses").checked) : null;
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

function update() {
  announce(showSolution());
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
// The first result is visible on load; announce only changes the visitor makes.
showSolution();
