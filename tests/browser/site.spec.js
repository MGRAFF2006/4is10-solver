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
