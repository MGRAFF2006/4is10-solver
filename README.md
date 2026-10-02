# 4=10

Four digits. One perfect ten. A small arithmetic puzzle solver with a responsive black and white interface.

**[Open the live site](https://4is10-solver.graff-mathis.workers.dev)** · [Source](https://github.com/MGRAFF2006/4is10-solver)

Choose four digits from 0 to 9, allow the operations you want, and make ten. Drag a digit up or down, use its buttons or keyboard arrows, or type directly. All calculations happen in your browser; there are no runtime dependencies, external fonts, analytics, or backend calls.

## Run

The site needs no build or installation to serve locally:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000>. For the Cloudflare development server and project tooling, use Node.js 22 or later:

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:8787>. Wrangler rebuilds when the site files change.

## Check

```sh
npm run check          # Syntax checks and solver regression tests
npm run deploy:check   # Build public assets and validate deployment
npx playwright install chromium
npm run test:browser   # Desktop and mobile browser checks
```

On Arch Linux, use an existing Chromium installation instead of downloading a browser:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

The solver tests compare the result against an independent subset search for all 715 unordered four-digit combinations. Browser tests cover typing, operation toggles, mouse and touch dragging, keyboard controls, invalid input, layout overflow, security headers, and private file exclusion.

## Solver

The solver prefers a simple expression without parentheses. If necessary, it searches every distinct digit permutation and all five binary parenthesis groupings, using only the enabled operations. Each digit is used exactly once. Integer fractions make the arithmetic exact; division by zero is skipped. If no expression equals ten, the closest finite result is displayed. Concatenation, powers, factorials, and unary operations are outside the puzzle rules.

- `index.html`, `src/css/index.css`: interface and responsive styling.
- `src/js/index.js`: accessible inputs, dragging, and result display.
- `src/js/solver.mjs`: pure solver shared by the browser and Node tests.
- `scripts/build.mjs`: copies only public assets to `dist/`.
- `wrangler.jsonc`, `_headers`: Cloudflare hosting and security headers.

## Deploy

The site is hosted on Cloudflare Workers Static Assets. No server-side application is needed.

```sh
npx wrangler login
npm run check
npm run deploy
```

Wrangler builds `dist/` before publishing. Only the HTML, CSS, JavaScript, favicon, and header rules are shipped; Git files, tests, dependencies, and local secrets are excluded. The live URL is <https://4is10-solver.graff-mathis.workers.dev>.

To check an existing deployment:

```sh
SITE_URL=https://4is10-solver.graff-mathis.workers.dev npm run test:browser
```

## GitHub workflows

- **Check the puzzle**: runs on pushes to `main` and pull requests; checks syntax, solver correctness, the deployment build, and desktop/mobile browser behavior. Failed browser checks upload a report and traces.
- **Deploy to Cloudflare**: manually run from the Actions tab on `main`. It runs the checks first, then publishes to the `production` environment. Add repository or environment secrets named `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Use Cloudflare’s **Edit Cloudflare Workers** API token template scoped to the hosting account. Store its value in GitHub Secrets, never in a file or commit. Browser OAuth login is for local deployments and is not a CI credential.
- **Dependabot**: monthly updates for the pinned development tools and GitHub Actions. Actions are pinned to commit hashes.

Cloudflare hosting uses the default Workers subdomain; no custom-domain DNS changes are required. GitHub workflows become available after these files are committed and pushed.

## License

[MIT](LICENSE).
