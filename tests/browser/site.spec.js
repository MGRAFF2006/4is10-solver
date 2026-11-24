import { test, expect } from "@playwright/test";

test("loads locally without errors or third-party requests", async ({ page, baseURL }) => {
  const errors = [];
  const external = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", request => { if (new URL(request.url()).origin !== new URL(baseURL).origin) external.push(request.url()); });
  await page.goto("/");
  await expect(page.locator("#result-status")).toHaveText("Exact match");
  await expect(page.locator("#expression")).toHaveText("5 + 5 + 5 − 5");
  await expect(page.locator("#answer")).toHaveText("10.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("typing and toggles update the result and recover from invalid settings", async ({ page }) => {
  await page.goto("/");
  for (const [index, digit] of [1, 3, 4, 6].entries()) await page.locator(`#digit-${index + 1}`).fill(String(digit));
  await expect(page.locator("#result-status")).toHaveText("Exact match");
  await page.getByRole("checkbox", { name: "Allow parentheses" }).uncheck();
  await expect(page.locator("#result-status")).toHaveText("Closest result");
  for (const name of ["addition", "subtraction", "multiplication", "division"]) await page.getByRole("checkbox", { name: `Allow ${name}` }).uncheck();
  await expect(page.locator("#expression")).toHaveText("Enable at least one operation.");
  await page.getByRole("checkbox", { name: "Allow addition" }).check();
  await expect(page.locator("#answer")).toHaveText("14");
  await page.locator("#digit-1").fill("");
  await expect(page.locator("#expression")).toHaveText("Choose four digits from 0 to 9.");
  await expect(page.locator("#digit-1")).toHaveAttribute("aria-invalid", "true");
  await page.locator("#digit-1").fill("1");
  await page.getByRole("button", { name: "Find a solution" }).click();
  await expect(page.locator("#answer")).toHaveText("14");
});

test("digits support arrow buttons, keyboard input, and mouse or touch dragging", async ({ page, isMobile }) => {
  await page.goto("/");
  const digit = page.locator("#digit-1");
  await digit.fill("9");
  await page.getByRole("button", { name: "Increase first digit" }).click();
  await expect(digit).toHaveValue("0");
  await digit.press("ArrowDown");
  await expect(digit).toHaveValue("9");
  await digit.fill("5");
  const box = await digit.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (isMobile) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - 56 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 56, { steps: 5 });
    await page.mouse.up();
  }
  await expect(digit).toHaveValue("7");
  await page.getByRole("button", { name: "Shuffle" }).click();
  for (const input of await page.locator(".digit-input").all()) await expect(input).toHaveValue(/^[0-9]$/);
});

test("Cloudflare serves security headers and hides repository files", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-security-policy"]).toContain("connect-src 'none'");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  for (const path of ["/.git/config", "/package.json", "/README.md", "/tests/solver.test.mjs", "/not-a-page"]) {
    const missing = await request.get(path);
    expect(missing.status()).toBe(404);
  }
});

test("screen readers hear one summary after the digits settle", async ({ page }) => {
  // Paused fake time makes the 600 ms settling delay deterministic.
  await page.clock.install({ time: new Date("2026-01-01T08:00:00") });
  await page.goto("/");
  await page.clock.pauseAt(new Date("2026-01-01T09:00:00"));
  // A single live region, silent on load, so the result panel's own changes stay quiet.
  await expect(page.locator("[aria-live], [role='status'], [role='alert']")).toHaveCount(1);
  const status = page.getByRole("status");
  await expect(status).toHaveText("");
  await status.evaluate(element => {
    window.announcements = [];
    new MutationObserver(() => window.announcements.push(element.textContent))
      .observe(element, { childList: true, characterData: true, subtree: true });
  });
  const digit = page.locator("#digit-1");
  for (let step = 0; step < 4; step++) await digit.press("ArrowUp");
  await expect(digit).toHaveValue("9");
  await page.clock.runFor(599);
  expect(await page.evaluate(() => window.announcements)).toEqual([]);
  await page.clock.runFor(1);
  expect(await page.evaluate(() => window.announcements)).toHaveLength(1);
  // Spoken words instead of symbols, which screen readers read inconsistently.
  await expect(status).toHaveText(/^Exact match: [0-9a-z ]+ equals 10\.$/);

  // Invalid settings keep the explanation and the way out.
  await page.locator("#digit-1").fill("0");
  for (const index of [2, 3, 4]) await page.locator(`#digit-${index}`).fill("0");
  for (const name of ["addition", "subtraction", "multiplication"]) await page.getByRole("checkbox", { name: `Allow ${name}` }).uncheck();
  await page.clock.runFor(600);
  await expect(status).toHaveText("Check your inputs. No defined result. Every expression with these settings divides by zero. Try another operation.");
});

test("a shared link restores the puzzle and the address follows changes", async ({ page }) => {
  await page.goto("/#digits=1158&ops=asd&parens=on");
  for (const [index, digit] of [1, 1, 5, 8].entries()) await expect(page.locator(`#digit-${index + 1}`)).toHaveValue(String(digit));
  await expect(page.getByRole("checkbox", { name: "Allow multiplication" })).not.toBeChecked();
  await expect(page.locator("#result-status")).toHaveText("Exact match");
  await expect(page.locator("#expression")).not.toContainText("×");

  await page.locator("#digit-4").press("ArrowUp");
  await page.getByRole("checkbox", { name: "Allow parentheses" }).uncheck();
  await expect(page).toHaveURL(/#digits=1159&ops=asd&parens=off$/);
  const expression = await page.locator("#expression").textContent();
  await page.reload();
  await expect(page.locator("#digit-4")).toHaveValue("9");
  await expect(page.getByRole("checkbox", { name: "Allow parentheses" })).not.toBeChecked();
  await expect(page.locator("#expression")).toHaveText(expression);

  // In-page links scroll as usual but keep the puzzle in the address.
  for (const name of [/Let’s solve it/, "The rules", /Back to top/]) {
    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(/#digits=1159&ops=asd&parens=off$/);
  }
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#digits=1159&ops=asd&parens=off$/);
  await expect(page.locator("#digit-4")).toHaveValue("9");
});

test("malformed or partial links use the defaults, not the previous puzzle", async ({ page }) => {
  const defaults = async () => {
    for (const input of await page.locator(".digit-input").all()) await expect(input).toHaveValue("5");
    for (const name of ["addition", "subtraction", "multiplication", "division", "parentheses"]) {
      await expect(page.getByRole("checkbox", { name: `Allow ${name}` })).toBeChecked();
    }
  };
  await page.goto("/#digits=12x4&ops=zz&parens=on");
  await defaults();
  await expect(page.locator("#result-status")).toHaveText("Exact match");
  await page.evaluate(() => { location.hash = "digits=1158&ops=a&parens=off"; });
  await expect(page.locator("#digit-4")).toHaveValue("8");
  await page.evaluate(() => { location.hash = "digits=12&ops=zz&parens=?"; });
  await defaults();
  await page.evaluate(() => { location.hash = "digits=2468"; });
  await expect(page.locator("#digit-4")).toHaveValue("8");
  await expect(page.getByRole("checkbox", { name: "Allow division" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Allow parentheses" })).toBeChecked();
});

test("Copy link copies the current puzzle and its feedback is not overwritten", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await page.clock.install({ time: new Date("2026-01-01T08:00:00") });
  await page.goto("/");
  await page.clock.pauseAt(new Date("2026-01-01T09:00:00"));
  const status = page.getByRole("status");
  const copied = new URL("/#digits=7555&ops=asm&parens=on", baseURL).href;
  await page.locator("#digit-1").fill("7");
  await page.getByRole("checkbox", { name: "Allow division" }).uncheck();
  // Copied before the edits settle: the link, and now the address, show the current puzzle.
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copied);
  await expect(page).toHaveURL(copied);
  await page.clock.runFor(1000);
  await expect(status).toHaveText("Link to this puzzle copied.");
  await page.clock.runFor(1000);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();

  // An incomplete puzzle is neither copied nor written to the address.
  await page.locator("#digit-1").fill("");
  await page.clock.runFor(1000);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Check the digits" })).toBeVisible();
  await expect(status).toHaveText("Choose four digits from 0 to 9 before copying a link.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copied);
  await expect(page).toHaveURL(copied);
});

test("puzzle mode hides the answer until a hint or reveal is asked for", async ({ page }) => {
  await page.goto("/");
  const status = page.locator("#result-status");
  const expression = page.locator("#expression");
  await page.getByRole("checkbox", { name: "Hide the answer until I ask" }).check();
  await expect(status).toHaveText("Your turn");
  await expect(expression).toHaveText("Make 10 with 5, 5, 5 and 5.");
  await expect(page.locator("#answer")).toHaveText("?");
  await expect(page.locator(".result-panel")).not.toContainText("5 + 5 + 5 − 5");
  await expect(page.getByRole("status")).toHaveText("Your turn. Make 10 with 5, 5, 5 and 5.");
  await expect(page).toHaveURL(/#digits=5555&ops=asmd&parens=on&mode=puzzle$/);

  await page.getByRole("button", { name: "Show a hint" }).click();
  await expect(status).toHaveText("Hint");
  await expect(expression).toHaveText("Start with 5 + 5.");
  await expect(page.getByRole("button", { name: "Show a hint" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Reveal the answer" })).toBeFocused();
  await expect(page.getByRole("status")).toHaveText("Hint: Start with 5 plus 5.");

  await page.getByRole("button", { name: "Reveal the answer" }).click();
  await expect(status).toHaveText("Exact match");
  await expect(expression).toHaveText("5 + 5 + 5 − 5");
  await page.getByRole("button", { name: "Hide the answer" }).click();
  await expect(status).toHaveText("Hint");

  // A new puzzle starts hidden again, without the earlier hint; "Find a solution" reveals it.
  await page.locator("#digit-1").press("ArrowDown");
  await expect(status).toHaveText("Your turn");
  await expect(page.getByRole("button", { name: "Show a hint" })).toBeVisible();
  await page.getByRole("button", { name: "Find a solution" }).click();
  await expect(status).toHaveText("Exact match");

  await page.getByRole("checkbox", { name: "Hide the answer until I ask" }).uncheck();
  await expect(page.locator("#puzzle-actions")).toBeHidden();
  await expect(page).toHaveURL(/#digits=4555&ops=asmd&parens=on$/);
});

test("a shared puzzle-mode link opens hidden, also when ten is out of reach", async ({ page }) => {
  await page.goto("/#digits=1111&ops=asmd&parens=on&mode=puzzle");
  await expect(page.getByRole("checkbox", { name: "Hide the answer until I ask" })).toBeChecked();
  await expect(page.locator("#result-status")).toHaveText("Your turn");
  await page.getByRole("button", { name: "Show a hint" }).click();
  await expect(page.locator("#expression")).toHaveText("Ten isn’t reachable with these settings. Get as close as you can.");
  await page.getByRole("button", { name: "Reveal the answer" }).click();
  await expect(page.locator("#result-status")).toHaveText("Closest result");
  await expect(page.locator("#answer")).toHaveText("4");
});

test("puzzle mode protects the answer immediately, before changes settle", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-01-01T08:00:00") });
  await page.goto("/#digits=1158&ops=asmd&parens=on");
  await page.clock.pauseAt(new Date("2026-01-01T09:00:00"));
  const status = page.getByRole("status");

  // Turning the mode on puts it in the address at once, and it stays there while a digit is missing.
  await page.getByRole("checkbox", { name: "Hide the answer until I ask" }).check();
  await expect(page).toHaveURL(/#digits=1158&ops=asmd&parens=on&mode=puzzle$/);
  await page.locator("#digit-1").fill("");
  await page.clock.runFor(1000);
  await expect(page).toHaveURL(/#digits=1158&ops=asmd&parens=on&mode=puzzle$/);
  await page.locator("#digit-1").fill("1");

  // Hiding a revealed answer clears its spoken summary at once.
  await page.getByRole("button", { name: "Reveal the answer" }).click();
  await page.clock.runFor(600);
  await expect(status).toContainText("equals 10");
  await page.getByRole("button", { name: "Hide the answer" }).click();
  await expect(status).toHaveText("");
  await page.clock.runFor(600);
  await expect(status).toHaveText("Your turn. Make 10 with 1, 1, 5 and 8.");

  // Copy feedback is not an answer, so asking for a hint leaves it until the hint arrives.
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(status).toHaveText(/^(Link to this puzzle copied|Copying failed)/);
  await page.getByRole("button", { name: "Show a hint" }).click();
  await expect(status).toHaveText(/^(Link to this puzzle copied|Copying failed)/);
  await page.clock.runFor(600);
  await expect(status).toHaveText("Hint: Start with 1 divided by 5.");

  // An invalid edit after revealing clears the spoken answer at once.
  await page.getByRole("button", { name: "Reveal the answer" }).click();
  await page.clock.runFor(600);
  await expect(status).toContainText("equals 10");
  await page.locator("#digit-2").fill("");
  await expect(status).toHaveText("");
});

test("on a fresh page, puzzle mode reaches the address even while a digit is missing", async ({ page }) => {
  await page.goto("/");
  await page.locator("#digit-1").fill("");
  await page.getByRole("checkbox", { name: "Hide the answer until I ask" }).check();
  await expect(page).toHaveURL(/#digits=5555&ops=asmd&parens=on&mode=puzzle$/);
});

test("the puzzle cannot be changed before the script is ready", async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route("**/src/js/solver.mjs", async route => {
    await held;
    await route.continue();
  });
  await page.goto("/#digits=1158&ops=asmd&parens=on", { waitUntil: "commit" });
  const layout = page.locator(".puzzle-layout");
  await expect(layout).toHaveAttribute("inert", "");
  await expect(page.locator("#hide-answer").click({ timeout: 1000 })).rejects.toThrow();
  release();
  await expect(layout).not.toHaveAttribute("inert");
  await expect(page.locator("#hide-answer")).not.toBeChecked();
  await expect(page.locator("#result-status")).toHaveText("Exact match");
});
