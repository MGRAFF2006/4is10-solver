# 4=10 solver

**Four digits. Make ten.** A small browser app for the *4=10* arithmetic puzzle: use all four numbers with addition, subtraction, multiplication, division, and parentheses to reach 10.

```text
5   5   5   5  →  5 + 5 + 5 − 5 = 10
```

Drag the digit wheels with your mouse or finger. Toggle operators or parentheses to change the search, then press **solve**. If the search finds no exact match, it shows the closest expression it tried.

## Run locally

No package installation or build step is needed. Serve the checkout with a static web server:

```bash
git clone https://github.com/MGRAFF2006/4is10-solver.git
cd 4is10-solver
python -m http.server 8000
```

Open <http://localhost:8000>.

## How it works

The solver tries permutations of the four digits, combinations of the enabled operators, and several parenthesis placements. A bundled copy of **math.js** evaluates each expression. The first exact match wins; otherwise the closest evaluated result is displayed.

This is a small experiment rather than an exhaustive symbolic solver: the inputs are single digits and the search uses the parenthesis patterns implemented in the source.

| File | Role |
| :--- | :--- |
| `index.html` | Digit wheels and operator controls |
| `src/js/index.js` | Search algorithm and mouse/touch interaction |
| `src/js/mathjs/math.min.js` | Bundled expression evaluator |
| `src/css/index.css` | Layout and styling |

For JavaScript edits, a quick syntax check is:

```bash
node --check src/js/index.js
```

## License

[MIT](LICENSE).
