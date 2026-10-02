import { solve } from "./solver.mjs";

const form = document.querySelector("#solver");
const inputs = [...document.querySelectorAll(".digit-input")];
const panel = document.querySelector(".result-panel");
const status = document.querySelector("#result-status");
const expression = document.querySelector("#expression");
const answer = document.querySelector("#answer");
const note = document.querySelector("#result-note");
const formatter = new Intl.NumberFormat("en", { maximumSignificantDigits: 10 });

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
    return;
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
  note.textContent = result.exact ? "All four digits. Every one used exactly once."
    : `No exact ten with these settings. Off by ${formatter.format(Math.abs(10 - result.value))}.`;
}

function setDigit(input, value) {
  input.value = String(((value % 10) + 10) % 10);
}

inputs.forEach(input => {
  const card = input.closest(".digit-card");
  card.querySelectorAll(".digit-step").forEach(button => {
    button.addEventListener("click", () => {
      setDigit(input, (Number(input.value) || 0) + Number(button.dataset.step));
      showSolution();
    });
  });
  input.addEventListener("focus", () => input.select());
  input.addEventListener("input", showSolution);
  input.addEventListener("keydown", event => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    setDigit(input, (Number(input.value) || 0) + (event.key === "ArrowUp" ? 1 : -1));
    showSolution();
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
    if (input.value !== previous) showSolution();
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
  showSolution();
});
form.querySelectorAll('input[type="checkbox"]').forEach(input => {
  input.addEventListener("change", showSolution);
});
document.querySelector("#randomize").addEventListener("click", () => {
  inputs.forEach(input => setDigit(input, Math.floor(Math.random() * 10)));
  showSolution();
});
showSolution();
