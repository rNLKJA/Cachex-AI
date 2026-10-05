/**
 * The guided tour, as an end-to-end test.
 *
 *   pnpm showcase                                   # production, records media
 *   BASE_URL=http://localhost:3000 pnpm showcase    # a local `pnpm build` first
 *   SHOWCASE_FAST=1 pnpm showcase:test              # journeys only: no pauses, no video
 *
 * Each journey checks what it shows (the steal, both captures, the recorded
 * A* output, the seeded tournament, the mocked LLM run and the audit log), so
 * a broken feature fails the tour instead of producing a misleading video.
 * Everything is deterministic: the Play page starts at seed 4399, the A* Lab
 * uses the original sample input, and the tournament and arena use fixed
 * seeds. No real API key is used; AI calls are answered by e2e/mock-ai.ts.
 */
import path from "node:path";

import {
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  expect,
  test,
} from "@playwright/test";

import { MOCK_MODEL_ID, SCREENSHOTS, WALKTHROUGHS, type WalkthroughId } from "../src/lib/showcase";
import { PLACEHOLDER_KEY, mockAiProviders } from "./mock-ai";
import {
  FAST,
  SHOT_DIR,
  Tour,
  ensureDirs,
  finishRecording,
  recordingContext,
} from "./showcase-helpers";

const walkthrough = (id: WalkthroughId) => WALKTHROUGHS.find((w) => w.id === id)!;

const cell = (page: Page, r: number, q: number) =>
  page.getByRole("button", { name: new RegExp(`^Row ${r}, column ${q}:`) });

const expectCell = (page: Page, r: number, q: number, content: "red" | "blue" | "empty") =>
  expect(cell(page, r, q)).toHaveAttribute(
    "aria-label",
    new RegExp(`^Row ${r}, column ${q}: ${content}`),
  );

const moveLog = (page: Page) => page.getByRole("list", { name: "Move log" });

/**
 * The scripted game on /play: 5 × 5, the human is Red, the agent plays Blue
 * at the page's initial seed (4399). Found by searching the deterministic
 * agent's replies for a short line with a steal, a capture and a recapture.
 */
const PLAY_MOVES = {
  open: [1, 1],
  first: [0, 1],
  diamond: [1, 0],
  retake: [0, 1],
  recapture: [1, 0],
} as const;

async function playScriptedGame(page: Page, click: (target: Locator) => Promise<void>) {
  await click(cell(page, ...PLAY_MOVES.open));
  await expectCell(page, 1, 1, "blue"); // Blue stole the opening (mirrored onto itself)
  await expect(moveLog(page)).toContainText("STEAL");
  await click(cell(page, ...PLAY_MOVES.first));
  await expectCell(page, 4, 1, "blue");
  await click(cell(page, ...PLAY_MOVES.diamond));
  await expectCell(page, 0, 0, "blue"); // Blue captures (0, 1) and (1, 0)
  await expectCell(page, 0, 1, "empty");
  await expectCell(page, 1, 0, "empty");
  await click(cell(page, ...PLAY_MOVES.retake));
  await expectCell(page, 1, 4, "blue");
  await click(cell(page, ...PLAY_MOVES.recapture));
  await expectCell(page, 0, 0, "empty"); // Red captures (0, 0) and (1, 1)
  await expectCell(page, 1, 1, "empty");
  await expectCell(page, 1, 0, "red");
  await expect(moveLog(page).getByRole("listitem")).toHaveCount(10);
}

const captureEntry = (page: Page) =>
  moveLog(page).getByRole("button").filter({ hasText: "(0, 0)" }).filter({ hasText: "captured 2" });

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

/**
 * Viewport screenshot to .showcase/screens/<id>.png, optionally with `align`
 * scrolled to `offset` px from the top (applied twice, after layout settles).
 */
async function shot(page: Page, id: string, align?: { target: Locator; offset: number }) {
  if (!SCREENSHOTS.some((s) => s.id === id)) throw new Error(`Unknown screenshot ${id}`);
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  for (let i = 0; i < 2; i++) {
    if (align) {
      await align.target.evaluate((el, offset) => {
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "instant" });
      }, align.offset);
    }
    await page.waitForTimeout(450);
  }
  await page.screenshot({ path: path.join(SHOT_DIR, `${id}.png`) });
}

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

test.beforeAll(() => ensureDirs());

test.describe("journeys (recorded)", () => {
  test("1. play the agent: steal, capture, recapture, why that move", async ({ browser }) => {
    const context = await recordingContext(browser);
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("play-the-agent"));

    await page.goto("/play");
    await expect(cell(page, 2, 2)).toBeVisible();
    await settle(page);
    tour.markStart();

    await tour.caption(1);
    await tour.pause(1200);
    // Board and the coordinates switch below it both fit between header and caption.
    await tour.scrollTo(page.getByRole("group", { name: /^Cachex board/ }), { offset: 84 });
    await tour.click(page.getByRole("switch", { name: "Show coordinates" }));
    await tour.pause(1200);

    await tour.caption(2);
    await tour.pause(600);
    await tour.click(cell(page, ...PLAY_MOVES.open), { after: 0 });
    await expectCell(page, 1, 1, "blue");

    await tour.caption(3);
    await tour.pause(900);
    await tour.hover(page.getByText("Opening book", { exact: true }));
    await tour.pause(2600);

    await tour.caption(4);
    await tour.click(cell(page, ...PLAY_MOVES.first), { after: 0 });
    await expectCell(page, 4, 1, "blue");
    await tour.pause(1600);

    await tour.caption(5);
    await tour.pause(1200);
    await tour.click(cell(page, ...PLAY_MOVES.diamond), { after: 0 });
    await expectCell(page, 0, 0, "blue");

    await tour.caption(6);
    await expectCell(page, 0, 1, "empty");
    await expectCell(page, 1, 0, "empty");
    await tour.pause(2800);

    await tour.caption(7);
    await tour.click(cell(page, ...PLAY_MOVES.retake), { after: 0 });
    await expectCell(page, 1, 4, "blue");
    await tour.pause(1400);

    await tour.caption(8);
    await tour.pause(800);
    await tour.click(cell(page, ...PLAY_MOVES.recapture), { after: 0 });
    await expectCell(page, 0, 0, "empty");
    await expectCell(page, 1, 1, "empty");
    await tour.pause(2600);
    await expect(moveLog(page).getByRole("listitem")).toHaveCount(10);

    await tour.caption(9);
    await tour.scrollTo(moveLog(page), { offset: 300 });
    await tour.click(captureEntry(page));
    await expect(page.getByText("Turn 6: Blue played")).toBeVisible();
    await tour.scrollTo(page.getByRole("heading", { name: "Why that move?" }), { offset: 90 });
    await tour.hover(page.getByText("Top candidates"));
    await tour.pause(2200);
    await tour.hover(page.getByRole("region", { name: "Evaluation features after this move" }));
    await tour.pause(3200);

    await finishRecording(context, page, tour);
  });

  test("2. A* Lab: sample input, both heuristics, paired study", async ({ browser }) => {
    const context = await recordingContext(browser);
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("astar-lab"));
    const output = page.getByRole("region", { name: "Search output in the original CLI format" });

    await page.goto("/astar");
    await expect(page.getByRole("heading", { name: "A* Lab", level: 1 })).toBeVisible();
    await settle(page);
    tour.markStart();

    await tour.caption(1);
    await tour.pause(1200);
    await tour.hover(page.getByRole("group", { name: /^A\* board/ }), 900);
    await tour.pause(1200);

    await tour.caption(2);
    await tour.click(page.getByRole("combobox", { name: "Preset" }));
    await tour.click(page.getByRole("option", { name: "Sample input 1" }));
    await expect(page.getByText("code/sample_input.json → sample_output.txt")).toBeVisible();
    await tour.hover(page.getByText("code/sample_input.json → sample_output.txt"));
    await tour.pause(1600);

    await tour.caption(3);
    await tour.click(page.getByRole("radio", { name: "Manhattan" }));
    await tour.click(page.getByRole("button", { name: "Animate search" }));
    await expect(output).toContainText("…searching");
    await expect(output).not.toContainText("…searching", { timeout: 60_000 });

    await tour.caption(4);
    await expect(page.getByText("Matches the output recorded in the original repo")).toBeVisible();
    await expect(output).toContainText("8");
    await tour.hover(output);
    await tour.pause(1600);
    await tour.hover(page.getByText("Matches the output recorded in the original repo"));
    await tour.pause(1800);

    await tour.caption(5);
    await tour.click(page.getByRole("radio", { name: "Euclidean" }));
    await tour.click(page.getByRole("button", { name: "Animate search" }));
    await expect(output).toContainText("…searching");
    await expect(output).not.toContainText("…searching", { timeout: 60_000 });
    await tour.pause(800);

    await tour.caption(6);
    const compare = page.getByRole("table", { name: "Both heuristics on this board" });
    await expect(compare).toBeVisible();
    await tour.hover(compare);
    await tour.pause(3000);

    await tour.caption(7);
    const expansions = page.getByRole("heading", {
      name: /^Node expansions \(paired, 980 boards\)/,
    });
    await tour.scrollTo(expansions, { offset: 150, ms: 1600 });
    await tour.hover(page.getByText("Mean difference, Manhattan − Euclidean").first());
    await tour.pause(1600);
    await tour.hover(page.getByText("Wilcoxon signed-rank (two-sided)").first());
    await tour.pause(2200);

    await tour.caption(8);
    await tour.hover(page.getByText("Paired difference, Manhattan − Euclidean").first());
    await tour.pause(1600);
    await tour.hover(page.getByText("Exact McNemar test (two-sided)").first());
    await tour.pause(2600);

    await finishRecording(context, page, tour);
  });

  test("3. tournament and LLM evaluation (mocked AI response)", async ({ browser }) => {
    const context = await recordingContext(browser);
    const ai = await mockAiProviders(context, { latencyMs: FAST ? 150 : 350 });
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("tournament-llm-eval"));

    await page.goto("/tournament");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await settle(page);
    tour.markStart();

    await tour.caption(1);
    await tour.pause(1500);
    await tour.scrollTo(page.locator("#run"), { offset: 70, ms: 1600 });
    await tour.pause(800);

    await tour.caption(2);
    const sizes5 = page.getByRole("button", { name: "5×5", exact: true });
    await expect(sizes5).toHaveAttribute("aria-pressed", "true");
    await tour.click(sizes5);
    await tour.click(page.getByRole("button", { name: "2", exact: true }));
    await expect(page.getByLabel("Seed", { exact: true })).toHaveValue("4399");
    await tour.hover(page.getByLabel("Seed", { exact: true }));
    await tour.pause(900);

    await tour.caption(3);
    const runButton = page.getByRole("button", { name: "Run 24 games" });
    await tour.click(runButton, { after: 0 });
    await tour.idleWhile(() =>
      expect(page.getByText(/^24 games in .* · seed 4399$/)).toBeVisible({ timeout: 120_000 }),
    );
    await tour.pause(600);

    await tour.caption(4);
    const leaderboard = page.getByText("Your run: Bradley-Terry strengths");
    await tour.scrollTo(leaderboard, { offset: 120, ms: 1300 });
    await tour.hover(leaderboard);
    await tour.pause(2400);
    const headToHead = page.locator("#run").getByText("Head to head.");
    await tour.scrollTo(headToHead, { offset: 140, ms: 1200 });
    await tour.hover(headToHead);
    await tour.pause(2400);

    await tour.caption(5);
    await tour.click(page.getByRole("button", { name: /^AI settings/ }));
    const dialog = page.getByRole("dialog", { name: "AI settings" });
    await expect(dialog).toBeVisible();
    await tour.pause(1400);
    await tour.hover(dialog.getByText("Your key stays in this browser."));
    await tour.pause(1800);
    await tour.click(dialog.getByRole("combobox", { name: "Model" }));
    await tour.pause(900);
    await tour.click(page.getByRole("option", { name: /Claude Haiku 4\.5/ }));
    await tour.pause(600);

    await tour.caption(6);
    await tour.click(dialog.getByRole("radio", { name: "OpenAI" }));
    await tour.type(dialog.getByLabel("Model id"), MOCK_MODEL_ID);
    await tour.type(dialog.getByLabel("OpenAI API key"), PLACEHOLDER_KEY);
    await tour.pause(900);
    await tour.click(dialog.getByRole("button", { name: "Save" }));
    await expect(dialog).toBeHidden();

    await tour.caption(7);
    await tour.scrollTo(page.locator("body"), { offset: 0, ms: 600 });
    await tour.click(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "LLM Arena" }),
    );
    await expect(page).toHaveURL(/\/llm-arena$/);
    await expect(page.getByText(`Model: ${MOCK_MODEL_ID}`)).toBeVisible();
    await tour.pause(1000);
    await tour.click(page.getByRole("radio", { name: "2", exact: true }));
    await expect(page.getByRole("textbox", { name: "Seed" })).toHaveValue("2026");
    await tour.click(page.getByRole("button", { name: "Play 2 games" }), { after: 0 });

    await tour.caption(8);
    await expect(
      page.getByText("waiting for the model").or(page.getByText("minimax agent thinking")),
    ).toBeVisible();
    const reason = page.getByText("Mocked response for illustration: the first legal cell.");
    await expect(reason).toBeVisible();
    await tour.tryHover(reason);
    await tour.idleWhile(async () => {
      // Both games finished: the run button is back and the games table is shown.
      await expect(page.getByRole("button", { name: "Play 2 games" })).toBeVisible({
        timeout: 120_000,
      });
      await expect(page.getByRole("heading", { name: "Games", exact: true })).toBeVisible();
    });

    await tour.caption(9);
    const table = page.getByRole("heading", { name: "Side by side against the original agent" });
    await tour.scrollTo(table, { offset: 90, ms: 1000 });
    await expect(
      page.getByRole("rowheader", { name: new RegExp(`LLM: ${MOCK_MODEL_ID}`) }),
    ).toBeVisible();
    await tour.hover(page.getByRole("rowheader", { name: new RegExp(`LLM: ${MOCK_MODEL_ID}`) }));
    await tour.pause(2200);
    await tour.hover(page.getByRole("rowheader", { name: /First legal cell/ }));
    await tour.pause(2200);

    await tour.caption(10);
    await tour.click(page.locator("#main").getByRole("link", { name: "AI audit log" }));
    await expect(page).toHaveURL(/\/ai-log$/);
    await expect(page.getByText(MOCK_MODEL_ID).first()).toBeVisible();
    await tour.pause(1600);
    await tour.hover(page.getByRole("button", { name: /CSV/ }).first());
    await tour.pause(1800);

    await tour.caption(11);
    await tour.click(page.getByRole("button", { name: /^AI settings/ }));
    await tour.click(page.getByRole("dialog").getByRole("button", { name: /^Forget/ }));
    await expect(page.getByText(/No OpenAI key saved/)).toBeVisible();
    await tour.pause(2200);
    await page.keyboard.press("Escape");
    await tour.pause(800);

    expect(ai.calls).toBeGreaterThan(0);
    expect(ai.leaks, "the placeholder key must only go to the (mocked) provider").toEqual([]);
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(stored).not.toContain(PLACEHOLDER_KEY);

    await finishRecording(context, page, tour);
  });
});

async function desktop(browser: Browser, colorScheme: "light" | "dark" = "light") {
  return browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme,
  });
}

async function mobile(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });
}

const quickClick = (target: Locator) => target.click();

test.describe("screenshots", () => {
  test("landing, light and dark", async ({ browser }) => {
    for (const scheme of ["light", "dark"] as const) {
      const context = await desktop(browser, scheme);
      const page = await context.newPage();
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Cachex");
      await settle(page);
      await shot(page, `0${scheme === "light" ? 1 : 2}-landing-${scheme}`);
      await context.close();
    }
  });

  test("key features at 1440 × 900", async ({ browser }) => {
    const context = await desktop(browser);
    const page = await context.newPage();

    await page.goto("/play");
    await settle(page);
    await page.getByRole("switch", { name: "Show coordinates" }).click();
    await playScriptedGame(page, quickClick);
    await captureEntry(page).click();
    await expect(page.getByText("Turn 6: Blue played")).toBeVisible();
    await shot(page, "03-play", { target: h1(page), offset: 100 });

    await page.goto("/spectate");
    await settle(page);
    await page.getByRole("switch", { name: "Coordinates" }).click();
    const delay = page.getByRole("slider", { name: "Move delay" });
    await delay.focus();
    await page.keyboard.press("Home");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /wins|Draw/ })
        .first(),
    ).toBeVisible({
      timeout: 120_000,
    });
    await shot(page, "04-spectate", { target: h1(page), offset: 100 });

    await page.goto("/astar");
    await settle(page);
    await expect(page.getByText("Matches the output recorded in the original repo")).toBeVisible();
    await shot(page, "05-astar-lab", { target: h1(page), offset: 100 });
    await shot(page, "06-astar-paired-study", {
      target: page.locator("#paired-study ul").first(),
      offset: 76,
    });

    await page.goto("/tournament#run");
    await settle(page);
    await page.getByRole("button", { name: "5×5", exact: true }).click();
    await page.getByRole("button", { name: "2", exact: true }).click();
    await page.getByRole("button", { name: "Run 24 games" }).click();
    await expect(page.getByText(/^24 games in .* · seed 4399$/)).toBeVisible({ timeout: 120_000 });
    await shot(page, "07-tournament", {
      target: page.getByText(/^24 games in .* · seed 4399$/),
      offset: 84,
    });

    await page.goto("/llm-arena");
    await settle(page);
    await expect(page.getByRole("rowheader", { name: /First legal cell/ })).toBeVisible();
    await page.getByRole("button", { name: /^AI settings/ }).click();
    await expect(page.getByRole("dialog", { name: "AI settings" })).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, "08-ai-settings");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await shot(page, "09-llm-arena");

    await page.goto("/methods");
    await settle(page);
    await shot(page, "10-methods");
    await context.close();
  });

  test("mobile at 390 × 844", async ({ browser }) => {
    const context = await mobile(browser);
    const page = await context.newPage();

    await page.goto("/");
    await settle(page);
    await shot(page, "11-mobile-landing");

    await page.goto("/play");
    await settle(page);
    await playScriptedGame(page, quickClick);
    await shot(page, "12-mobile-play", { target: h1(page), offset: 96 });

    await page.goto("/astar");
    await settle(page);
    await expect(page.getByText("Matches the output recorded in the original repo")).toBeAttached();
    await shot(page, "13-mobile-astar", { target: h1(page), offset: 96 });
    await context.close();
  });
});
