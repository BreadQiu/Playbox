import { expect, test, type Locator, type Page } from "@playwright/test";

async function dragWithMouse(
  page: Page,
  sourceIndex: number,
  targetIndex: number,
  operator: string,
) {
  const source = page.locator(`[data-card-index="${sourceIndex}"]`);
  const sourceBox = await source.boundingBox();
  if (!sourceBox) throw new Error("Source card is not visible");

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 12,
    sourceBox.y + sourceBox.height / 2 + 8,
    { steps: 4 },
  );
  await expect(page.locator("[data-board]")).toHaveClass(/is-dragging/);

  const targetSlot = page.locator(`[data-slot-index="${targetIndex}"]`);
  const targetBox = await targetSlot.boundingBox();
  if (!targetBox) throw new Error("Target card is not visible");
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 4 },
  );
  await expect(targetSlot).toHaveClass(/is-near/);

  const operatorButton = page.locator(
    `[data-target-index="${targetIndex}"][data-operator="${operator}"]`,
  );
  const operatorBox = await operatorButton.boundingBox();
  if (!operatorBox) throw new Error("Operator target is not visible");
  const ghostBox = await page.locator(".drag-ghost").boundingBox();
  if (!ghostBox) throw new Error("Drag ghost is not visible");
  const pointerToGhostCenterY =
    targetBox.y +
    targetBox.height / 2 -
    (ghostBox.y + ghostBox.height / 2);

  await page.mouse.move(
    operatorBox.x + operatorBox.width / 2,
    operatorBox.y + operatorBox.height / 2 + pointerToGhostCenterY,
    { steps: 8 },
  );
  await expect(
    page.locator(`[data-slot-index="${targetIndex}"]`),
  ).toHaveClass(/is-target/);
  await page.mouse.up();
}

async function dragWithTouch(
  page: Page,
  sourceIndex: number,
  targetIndex: number,
  operator: string,
) {
  const source = page.locator(`[data-card-index="${sourceIndex}"]`);
  const sourceBox = await source.boundingBox();
  if (!sourceBox) throw new Error("Source card is not visible");
  const start = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };

  await source.dispatchEvent("pointerdown", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true,
    clientX: start.x,
    clientY: start.y,
  });
  await page.evaluate(
    ({ x, y }) => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 7,
          pointerType: "touch",
          isPrimary: true,
          bubbles: true,
          clientX: x + 14,
          clientY: y + 12,
          buttons: 1,
        }),
      );
    },
    start,
  );

  const operatorButton = page.locator(
    `[data-target-index="${targetIndex}"][data-operator="${operator}"]`,
  );

  const targetSlot = page.locator(`[data-slot-index="${targetIndex}"]`);
  const targetBox = await targetSlot.boundingBox();
  if (!targetBox) throw new Error("Target card is not visible");
  await page.evaluate(
    ({ x, y }) => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 7,
          pointerType: "touch",
          isPrimary: true,
          bubbles: true,
          clientX: x,
          clientY: y,
          buttons: 1,
        }),
      );
    },
    {
      x: targetBox.x + targetBox.width / 2,
      y: targetBox.y + targetBox.height / 2,
    },
  );
  await expect(targetSlot).toHaveClass(/is-near/);

  const operatorBox = await operatorButton.boundingBox();
  if (!operatorBox) throw new Error("Operator target is not visible");
  const ghostBox = await page.locator(".drag-ghost").boundingBox();
  if (!ghostBox) throw new Error("Drag ghost is not visible");
  const pointerToGhostCenterY =
    targetBox.y +
    targetBox.height / 2 -
    (ghostBox.y + ghostBox.height / 2);

  await page.evaluate(
    ({ x, y }) => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 7,
          pointerType: "touch",
          isPrimary: true,
          bubbles: true,
          clientX: x,
          clientY: y,
          buttons: 1,
        }),
      );
    },
    {
      x: operatorBox.x + operatorBox.width / 2,
      y: operatorBox.y + operatorBox.height / 2 + pointerToGhostCenterY,
    },
  );
  await expect(
    page.locator(`[data-slot-index="${targetIndex}"]`),
  ).toHaveClass(/is-target/);
  await page.evaluate(() => {
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 7,
        pointerType: "touch",
        isPrimary: true,
        bubbles: true,
      }),
    );
  });
}

async function enableUnsolvableSetting(page: Page) {
  await page.getByRole("button", { name: "设置" }).click();
  await page
    .getByRole("checkbox", { name: "允许出现无解题目" })
    .check({ force: true });
  await page.getByRole("button", { name: "应用并换题" }).click();
}

async function shadowColor(locator: Locator): Promise<string | null> {
  return locator.evaluate((element) => {
    const shadow = getComputedStyle(element).boxShadow;
    return shadow.match(/rgba?\([^)]+\)/)?.[0] ?? null;
  });
}

test("tactile audio preview is available from its own URL", async ({ page }) => {
  await page.goto("/?puzzle=6,2,8,4&sound=tactile");
  await expect(page).toHaveTitle("24点积木 · 积木音色");

  let state = await page.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  expect(state.audio).toMatchObject({
    style: "tactile",
    muted: false,
    lastCue: null,
  });
  await expect(page.getByRole("button", { name: "静音" })).toBeVisible();
  await dragWithMouse(page, 0, 1, "+");
  state = await page.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  expect(state.audio).toMatchObject({
    style: "tactile",
    supported: true,
    lastCue: "merge",
  });
  expect(state.audio.cueCount).toBeGreaterThanOrEqual(3);
  await expect
    .poll(async () => {
      const current = await page.evaluate(() =>
        JSON.parse(window.render_game_to_text()),
      );
      return current.audio.contextState;
    })
    .toBe("running");
});

test("comedy audio preview is available from its own URL", async ({ page }) => {
  await page.goto("/?puzzle=6,2,8,4&sound=comedy");
  await expect(page).toHaveTitle("24点积木 · 喜剧音色");

  let state = await page.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  expect(state.audio).toMatchObject({
    style: "comedy",
    muted: false,
    lastCue: null,
  });
  await page.getByRole("button", { name: "提示" }).click();
  state = await page.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  expect(state.audio).toMatchObject({
    style: "comedy",
    lastCue: "hint",
  });
});

test("audio mute persists without changing the selected sound style", async ({
  page,
}) => {
  await page.goto("/?puzzle=6,2,8,4&sound=comedy");
  await page.getByRole("button", { name: "静音" }).click();

  await expect(page.getByRole("button", { name: "开启音效" })).toBeVisible();
  let state = await page.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  expect(state.audio).toMatchObject({ style: "comedy", muted: true });

  await page.reload();
  state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  expect(state.audio).toMatchObject({ style: "comedy", muted: true });
});

test("comedy solution check plays success for no solution and failure for solvable", async ({
  page,
}) => {
  await page.goto(
    "/?puzzle=6,2,8,4&sound=comedy&allowUnsolvable=1",
  );
  await page.locator('[data-action="solution"]').click();

  let state = await page.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  expect(state.audio.lastCue).toBe("check-fail");
  await expect(page.locator(".game-frame")).toHaveClass(/is-guess-wrong/);

  await page.goto(
    "/?puzzle=1,1,1,1&sound=comedy&allowUnsolvable=1",
  );
  await page.locator('[data-action="solution"]').click();
  state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  expect(state.audio.lastCue).toBe("check-success");
});

test("opens directly into a playable 24-point board", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "24点" })).toBeVisible();
  await expect(
    page.getByText("按住一张牌，拖到另一张牌旁边的运算符"),
  ).toHaveCount(0);
  await expect(page.getByTestId("timer")).toHaveText(/^00:0[0-2]$/);
  await expect(page.locator("[data-card-index]")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "撤销" })).toBeVisible();
  await expect(page.getByRole("button", { name: "提示" })).toBeVisible();
  await expect(page.locator('[data-action="solution"]')).toHaveText("此题有解");
  await expect(page.locator('[data-action="solution"]')).toBeDisabled();
  await expect(page.getByRole("button", { name: "重来本题" })).toBeVisible();
  await expect(page.getByRole("button", { name: "换一题" })).toBeVisible();
  const settingsBackground = await page
    .getByRole("button", { name: "设置" })
    .evaluate((button) => getComputedStyle(button).backgroundColor);
  expect(
    await page
      .getByRole("button", { name: "换一题" })
      .evaluate((button) => getComputedStyle(button).backgroundColor),
  ).toBe(settingsBackground);
  expect(
    await page
      .getByRole("button", { name: "重来本题" })
      .evaluate((button) => getComputedStyle(button).backgroundColor),
  ).toBe(settingsBackground);
  await expect(page.getByRole("button", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: /声音/ })).toHaveCount(0);
});

test("undo and hint controls sit in the game panel", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.locator('.game-frame [data-action="undo"]'),
  ).toBeVisible();
  await expect(page.locator('[data-action="hint"]')).toBeVisible();
  await expect(
    page.locator('.game-controls [data-action="undo"]'),
  ).toHaveCount(0);
});

test("opens settings with range and unsolvable choices", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();

  await expect(page.getByRole("dialog", { name: "游戏设置" })).toBeVisible();
  await expect(page.getByText("出题方式")).toHaveCount(0);
  await expect(page.getByLabel("1-9")).toBeChecked();
  await expect(page.getByText("简单")).toBeVisible();
  await expect(page.getByText("困难")).toBeVisible();
  await expect(page.getByLabel("允许出现无解题目")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "应用并换题" })).toBeVisible();
  expect(
    await page
      .getByRole("button", { name: "应用并换题" })
      .evaluate((button) => getComputedStyle(button).backgroundColor),
  ).toBe("rgb(159, 224, 180)");
  expect(await shadowColor(page.getByRole("button", { name: "应用并换题" }))).toBe(
    await shadowColor(page.getByRole("button", { name: "重来本题" })),
  );
});

test("settings controls grow when hovered", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();

  for (const control of [
    page.locator(".dialog-close"),
    page.locator(".choice-card").nth(0),
    page.locator(".choice-card").nth(1),
    page.locator(".toggle-ui"),
    page.getByRole("button", { name: "应用并换题" }),
  ]) {
    const before = await control.boundingBox();
    if (!before) throw new Error("Settings control is not visible");
    await control.hover();
    await page.waitForTimeout(180);
    const after = await control.boundingBox();
    if (!after) throw new Error("Settings control disappeared");
    expect(after.width).toBeGreaterThan(before.width + 1);
    await page.mouse.move(2, 2);
    await page.waitForTimeout(180);
  }
});

test("hint shows the first operation from the original cards", async ({
  page,
}) => {
  await page.goto("/?puzzle=6,2,8,4");
  const hint = page.getByRole("button", { name: "提示" });
  const bubble = page.locator("[data-hint-bubble]");

  await expect(bubble).toBeHidden();
  await hint.click();
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveText(/^\d+ [+−×÷] \d+$/);
  const bubbleBox = await bubble.boundingBox();
  const hintBox = await hint.boundingBox();
  if (!bubbleBox || !hintBox) throw new Error("Hint UI is not visible");
  expect(
    Math.abs(
      bubbleBox.y +
        bubbleBox.height / 2 -
        (hintBox.y + hintBox.height / 2),
    ),
  ).toBeLessThanOrEqual(2);
  expect(bubbleBox.x + bubbleBox.width).toBeLessThanOrEqual(hintBox.x);

  await page.getByRole("heading", { name: "24点" }).click();
  await expect(bubble).toBeHidden();

  await hint.click();
  await page.mouse.wheel(0, 20);
  await expect(bubble).toBeHidden();

  await hint.click();
  await page.keyboard.press("Escape");
  await expect(bubble).toBeHidden();

  await hint.click();
  await hint.click();
  await expect(bubble).toBeHidden();
});

test("hint shows reversed subtraction in its actual operand order", async ({
  page,
}) => {
  await page.goto("/?puzzle=3,5,6,8");
  await page.getByRole("button", { name: "提示" }).click();

  await expect(page.locator("[data-hint-bubble]")).toHaveText("5 − 3");
  await expect(page.locator("[data-hint-bubble]")).not.toHaveText("3 − 5");
});

test("hint shows reversed division in its actual operand order", async ({
  page,
}) => {
  await page.goto("/?puzzle=3,6,13,9");
  await page.getByRole("button", { name: "提示" }).click();

  await expect(page.locator("[data-hint-bubble]")).toHaveText("6 ÷ 3");
  await expect(page.locator("[data-hint-bubble]")).not.toHaveText("3 ÷ 6");
});

test("an unsolvable hint pauses and prepares the next puzzle", async ({
  page,
}) => {
  await page.goto("/?puzzle=1,1,1,1");

  await page.getByRole("button", { name: "提示" }).click();
  await expect(page.locator("[data-hint-bubble]")).toHaveText("此题无解");
  await expect(page.locator('[data-action="solution"]')).toHaveText("此题无解");
  await expect(page.locator('[data-action="solution"]')).toBeDisabled();
  await expect(page.getByRole("button", { name: "下一题" })).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(state.timer.running).toBe(false);
});

test("solution checking follows settings and puzzle solvability", async ({
  page,
}) => {
  await page.goto("/?puzzle=6,2,8,4");
  const solution = page.locator('[data-action="solution"]');
  await expect(solution).toHaveText("此题有解");
  await expect(solution).toBeDisabled();
  await expect(solution).toHaveCSS("opacity", "0.45");

  await enableUnsolvableSetting(page);
  await expect(solution).toHaveText("无解");
  await expect(solution).toBeEnabled();
  await expect(solution).toHaveCSS("background-color", "rgb(76, 127, 232)");
  expect(await shadowColor(solution)).toBe(
    await shadowColor(page.getByRole("button", { name: "重来本题" })),
  );
  await page.getByRole("button", { name: "提示" }).click();
  await expect(solution).toHaveText("此题有解");
  await expect(solution).toBeDisabled();
  await expect(solution).toHaveCSS("background-color", "rgb(255, 255, 255)");
  expect(await shadowColor(solution)).toBe(
    await shadowColor(page.getByRole("button", { name: "重来本题" })),
  );
  await expect(page.getByRole("button", { name: "换一题" })).toBeVisible();
  let state = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(state.timer.running).toBe(true);

  await page.getByRole("button", { name: "重来本题" }).click();
  await expect(solution).toHaveText("无解");
  await expect(solution).toBeEnabled();
});

test("manual solvable check after a wrong merge keeps the timer running", async ({
  page,
}) => {
  await page.goto("/?puzzle=6,2,8,4");
  await enableUnsolvableSetting(page);
  await dragWithMouse(page, 0, 1, "-");

  const solution = page.locator('[data-action="solution"]');
  await expect(solution).toHaveText("无解");
  await solution.click();
  await expect(solution).toHaveText("此题有解");
  await expect(solution).toBeDisabled();
  await expect(solution).toHaveCSS("background-color", "rgb(255, 140, 114)");
  await expect(page.getByRole("button", { name: "提示" })).toBeEnabled();
  await page.getByRole("button", { name: "提示" }).click();
  await expect(page.locator("[data-hint-bubble]")).toBeVisible();
  await expect(solution).toHaveText("此题有解");
  await page.getByRole("heading", { name: "24点" }).click();
  await expect(page.locator("[data-hint-bubble]")).toBeHidden();
  expect(await shadowColor(solution)).toBe(
    await shadowColor(page.getByRole("button", { name: "重来本题" })),
  );
  const state = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(state.status).toBe("playing");
  expect(state.timer.running).toBe(true);
  await expect(page.locator("[data-hint-bubble]")).toBeHidden();
});

test("a wrong final result keeps timing until next or undo", async ({ page }) => {
  await page.goto("/?puzzle=6,2,8,4");
  await enableUnsolvableSetting(page);
  await dragWithMouse(page, 0, 1, "+");
  await dragWithMouse(page, 2, 3, "+");
  await dragWithMouse(page, 1, 3, "+");

  let state = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(state.status).toBe("lost");
  expect(state.timer.running).toBe(true);

  await page.locator('[data-action="solution"]').click();
  await expect(page.locator('[data-action="solution"]')).toHaveText("此题有解");
  state = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(state.timer.running).toBe(true);
});

test("an unsolvable check stops the timer and shows next", async ({ page }) => {
  await page.goto("/?puzzle=1,1,1,1");
  await enableUnsolvableSetting(page);

  const unsolvable = page.locator('[data-action="solution"]');
  await expect(unsolvable).toHaveText("无解");
  await unsolvable.click();
  await expect(unsolvable).toHaveText("此题无解");
  await expect(unsolvable).toBeDisabled();
  await expect(unsolvable).toHaveCSS("background-color", "rgb(159, 224, 180)");
  expect(await shadowColor(unsolvable)).toBe(
    await shadowColor(page.getByRole("button", { name: "重来本题" })),
  );
  await expect(page.getByRole("button", { name: "提示" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "下一题" })).toHaveClass(
    /is-next/,
  );
  const state = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(state.timer.running).toBe(false);
  await page.getByRole("button", { name: "下一题" }).click();
  await expect(page.locator('[data-action="solution"]')).toHaveText("无解");
  await expect(page.locator('[data-action="solution"]')).toBeEnabled();
  await expect(page.getByRole("button", { name: "提示" })).toBeEnabled();
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "ipad", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`${viewport.name} board has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/");

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expect(page.locator("[data-card-index]")).toHaveCount(4);
  });
}

test("mouse drag merges in source-op-target order", async ({ page }) => {
  await page.goto("/?puzzle=6,2,8,4");
  await dragWithMouse(page, 0, 1, "-");

  await expect(page.locator('[data-slot-index="0"] [data-card-index]')).toHaveCount(
    0,
  );
  await expect(page.locator('[data-slot-index="0"]')).toHaveClass(/is-empty/);
  await expect(
    page.locator('[data-slot-index="0"] .slot-placeholder'),
  ).toHaveCount(0);
  await expect(page.locator('[data-card-index="1"] .card-value')).toHaveText("4");
  await expect(
    page.locator('[data-card-index="1"] .card-expression'),
  ).toHaveText("(6 − 2)");
  await expect(page.getByRole("button", { name: "撤销" })).toBeEnabled();
});

test("touch pointer drag merges a tile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?puzzle=6,2,8,4");
  await dragWithTouch(page, 0, 1, "+");

  await expect(page.locator('[data-card-index="1"] .card-value')).toHaveText("8");
  await expect(
    page.locator('[data-card-index="1"] .card-expression'),
  ).toHaveText("(6 + 2)");
});

test("a second pointer cannot replace an active drag", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?puzzle=6,2,8,4");
  const first = page.locator('[data-card-index="0"]');
  const firstBox = await first.boundingBox();
  if (!firstBox) throw new Error("First card is not visible");

  await page.mouse.move(firstBox.x + 20, firstBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + 40, firstBox.y + 40, { steps: 4 });
  await expect(page.locator(".drag-ghost")).toHaveCount(1);

  const second = page.locator('[data-card-index="1"]');
  const secondBox = await second.boundingBox();
  if (!secondBox) throw new Error("Second card is not visible");
  await second.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "touch",
    isPrimary: false,
    bubbles: true,
    clientX: secondBox.x + 20,
    clientY: secondBox.y + 20,
  });
  await page.evaluate(
    ({ x, y }) => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 2,
          pointerType: "touch",
          bubbles: true,
          clientX: x + 20,
          clientY: y + 20,
          buttons: 1,
        }),
      );
    },
    { x: secondBox.x, y: secondBox.y },
  );

  await expect(page.locator(".drag-ghost")).toHaveCount(1);
  await expect(page.locator('[data-slot-index="0"]')).toHaveClass(/is-source/);
  await expect(page.locator('[data-slot-index="1"]')).not.toHaveClass(
    /is-source/,
  );
});

test("window blur cancels an active drag", async ({ page }) => {
  await page.goto("/?puzzle=6,2,8,4");
  const source = page.locator('[data-card-index="0"]');
  const box = await source.boundingBox();
  if (!box) throw new Error("Source card is not visible");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 24, box.y + 20, { steps: 5 });
  await expect(page.locator(".drag-ghost")).toHaveCount(1);

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator(".drag-ghost")).toHaveCount(0);
  await expect(page.locator("[data-board]")).not.toHaveClass(/is-dragging/);
  const state = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(state.drag).toBeNull();
  await page.mouse.up();
});

test("lost pointer capture cancels an active drag", async ({ page }) => {
  await page.goto("/?puzzle=6,2,8,4");
  const source = page.locator('[data-card-index="0"]');
  const box = await source.boundingBox();
  if (!box) throw new Error("Source card is not visible");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 24, box.y + 20, { steps: 5 });
  await source.dispatchEvent("lostpointercapture", {
    bubbles: true,
    pointerId: 1,
  });

  await expect(page.locator(".drag-ghost")).toHaveCount(0);
  await expect(page.locator("[data-board]")).not.toHaveClass(/is-dragging/);
  await page.mouse.up();
});

test("the game still opens when localStorage access is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "24点" })).toBeVisible();
  await expect(page.locator("[data-card-index]")).toHaveCount(4);
});

test("all displayed numbers use the A-scheme numeric font", async ({ page }) => {
  await page.goto("/?puzzle=6,2,8,4");
  await dragWithMouse(page, 0, 1, "+");

  for (const selector of [
    ".brand",
    ".timer",
    ".card-value",
    ".card-expression",
    ".operator",
  ]) {
    const fontFamily = await page
      .locator(selector)
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily);
    expect(fontFamily).toContain("Trebuchet MS");
  }
});

test("cards use unique regular colors and keep a stable appearance", async ({
  page,
}) => {
  const allowedColors = [
    "#ffe49b",
    "#a9d8ff",
    "#f3c0e2",
    "#d7c7ff",
  ];
  const readAppearances = () =>
    page.locator("[data-card-index]").evaluateAll((cards) =>
      Object.fromEntries(
        cards.map((card) => {
          const element = card as HTMLElement;
          const style = getComputedStyle(element);
          return [
            element.dataset.cardIndex,
            {
              color: style.getPropertyValue("--card-color").trim(),
              tilt: Number.parseFloat(
                style.getPropertyValue("--card-tilt").trim(),
              ),
            },
          ];
        }),
      ),
    );

  await page.goto("/?puzzle=6,2,8,4");
  const initial = await readAppearances();
  expect(Object.keys(initial)).toHaveLength(4);
  expect(
    new Set(
      Object.values(initial).map(
        (appearance) => (appearance as { color: string }).color,
      ),
    ).size,
  ).toBe(4);
  for (const appearance of Object.values(initial) as {
    color: string;
    tilt: number;
  }[]) {
    expect(allowedColors).toContain(appearance.color);
    expect(Math.abs(appearance.tilt)).toBeLessThanOrEqual(3.2);
  }

  await dragWithMouse(page, 0, 1, "+");
  const afterMerge = await readAppearances();
  const mergedAppearance = afterMerge["1"] as {
    color: string;
    tilt: number;
  };
  expect(allowedColors).toContain(mergedAppearance.color);
  expect(Math.abs(mergedAppearance.tilt)).toBeLessThanOrEqual(3.2);
  const otherColors = Object.entries(afterMerge)
    .filter(([cardIndex]) => cardIndex !== "1")
    .map(([, appearance]) => (appearance as { color: string }).color);
  expect(otherColors).not.toContain(mergedAppearance.color);

  await page.getByRole("button", { name: "撤销" }).click();
  expect(await readAppearances()).toEqual(initial);
});

test("invalid drops leave the board unchanged", async ({ page }) => {
  await page.goto("/?puzzle=6,2,8,4");
  const before = await page.evaluate(() =>
    (window as Window & { render_game_to_text: () => string })
      .render_game_to_text(),
  );
  const source = page.locator('[data-card-index="0"]');
  const box = await source.boundingBox();
  if (!box) throw new Error("Source card is not visible");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 20, { steps: 5 });
  await page.mouse.move(5, 5, { steps: 5 });
  await page.mouse.up();

  await expect(page.locator("[data-card-index]")).toHaveCount(4);
  const after = await page.evaluate(() =>
    (window as Window & { render_game_to_text: () => string })
      .render_game_to_text(),
  );
  expect(JSON.parse(after).slots).toEqual(JSON.parse(before).slots);
});

test("zero targets expose a disabled division target", async ({ page }) => {
  await page.goto("/?puzzle=1,0,2,3");
  const source = page.locator('[data-card-index="0"]');
  const box = await source.boundingBox();
  if (!box) throw new Error("Source card is not visible");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 24, box.y + 18, { steps: 5 });

  await expect(
    page.locator('[data-target-index="1"][data-operator="÷"]'),
  ).toBeDisabled();
  await page.mouse.up();
});

test("operators appear only near the dragged-over card with a non-overlapping target", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?puzzle=6,2,8,4");
  const source = page.locator('[data-card-index="0"]');
  const sourceBox = await source.boundingBox();
  const targetSlot = page.locator('[data-slot-index="1"]');
  const targetBox = await targetSlot.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Cards are not visible");

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 12,
    sourceBox.y + sourceBox.height / 2 + 8,
    { steps: 4 },
  );

  await expect(targetSlot).not.toHaveClass(/is-near/);
  expect(
    await page
      .locator('[data-target-index="1"][data-operator="+"]')
      .evaluate((button) => Number(getComputedStyle(button).opacity)),
  ).toBe(0);

  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 8 },
  );
  await expect(targetSlot).toHaveClass(/is-near/);
  await expect
    .poll(() =>
      page
        .locator('[data-target-index="1"][data-operator="+"]')
        .evaluate((button) => Number(getComputedStyle(button).opacity)),
    )
    .toBeGreaterThan(0.8);

  await page.waitForTimeout(180);
  const operatorBox = await page
    .locator('[data-target-index="1"][data-operator="+"]')
    .boundingBox();
  expect(operatorBox?.width).toBeGreaterThanOrEqual(48);
  expect(operatorBox?.height).toBeGreaterThanOrEqual(48);
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const plusButton = page.locator('[data-target-index="1"][data-operator="+"]');
  await plusButton.hover();
  await expect(plusButton).toHaveClass(/is-targeted/);
  await expect(page.locator(".merge-preview")).toHaveCount(0);
  await expect(page.getByText(/^= \d/)).toHaveCount(0);
  await page.waitForTimeout(180);
  const activeBox = await plusButton.boundingBox();
  expect(activeBox?.width).toBeGreaterThan((operatorBox?.width ?? 0) * 1.1);
  await page.mouse.up();
});

for (const viewport of [
  { name: "small-phone", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "ipad", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "landscape-phone", width: 844, height: 390 },
]) {
  test(`${viewport.name} operator hit areas never overlap`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/?puzzle=6,2,8,4");

    const overlaps = await page.evaluate(() => {
      const style = document.createElement("style");
      style.textContent = ".operator { transition: none !important; }";
      document.head.append(style);
      document.querySelector("[data-board]")?.classList.add("is-dragging");
      document
        .querySelectorAll("[data-slot-index]")
        .forEach((slot) => slot.classList.add("is-near"));

      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          "[data-target-index][data-operator]",
        ),
      );
      const found: string[] = [];
      const readRects = () =>
        buttons.map((button) => button.getBoundingClientRect());

      for (const activeButton of buttons) {
        buttons.forEach((button) => button.classList.remove("is-targeted"));
        activeButton.classList.add("is-targeted");
        const rects = readRects();
        for (let first = 0; first < rects.length; first += 1) {
          for (let second = first + 1; second < rects.length; second += 1) {
            const a = rects[first];
            const b = rects[second];
            if (
              a.left < b.right &&
              a.right > b.left &&
              a.top < b.bottom &&
              a.bottom > b.top
            ) {
              found.push(
                `${activeButton.dataset.targetIndex}${activeButton.dataset.operator}:${first}-${second}`,
              );
            }
          }
        }
      }
      return found;
    });

    expect(overlaps).toEqual([]);
  });
}

test("a floating card can target an operator while the pointer is outside it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?puzzle=6,2,8,4");
  const source = page.locator('[data-card-index="0"]');
  const sourceBox = await source.boundingBox();
  const plusButton = page.locator('[data-target-index="1"][data-operator="+"]');
  if (!sourceBox) throw new Error("Source card is not visible");

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 12,
    sourceBox.y + sourceBox.height / 2 + 8,
    { steps: 4 },
  );
  const targetBox = await page.locator('[data-slot-index="1"]').boundingBox();
  if (!targetBox) throw new Error("Target card is not visible");
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 8 },
  );

  const plusBox = await plusButton.boundingBox();
  if (!plusBox) throw new Error("Operator is not visible");
  await page.mouse.move(
    plusBox.x + plusBox.width / 2,
    plusBox.y + plusBox.height / 2 + 52,
    { steps: 6 },
  );

  await expect(plusButton).toHaveClass(/is-targeted/);
  await page.mouse.up();
});

test("dragging a card does not scroll the phone page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?puzzle=6,2,8,4");
  await page.evaluate(() => {
    document.body.style.minHeight = "1600px";
    window.scrollTo(0, 100);
  });
  const source = page.locator('[data-card-index="0"]');
  const box = await source.boundingBox();
  if (!box) throw new Error("Source card is not visible");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 120, {
    steps: 8,
  });
  await page.mouse.up();

  expect(await page.evaluate(() => window.scrollY)).toBe(100);
});

test("undo, retry, and new puzzle manage game and timer state", async ({
  page,
}) => {
  await page.goto("/?puzzle=6,2,8,4");
  await dragWithMouse(page, 0, 1, "+");
  await page.getByRole("button", { name: "撤销" }).click();

  await expect(page.locator("[data-card-index]")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "撤销" })).toBeDisabled();

  await page.evaluate(() => {
    (
      window as Window & { advanceTime: (milliseconds: number) => void }
    ).advanceTime(2_000);
  });
  await page.getByRole("button", { name: "重来本题" }).click();
  await page.evaluate(() => {
    (
      window as Window & { advanceTime: (milliseconds: number) => void }
    ).advanceTime(3_000);
  });
  await expect(page.getByTestId("timer")).toHaveText(/00:0[45]/);

  await page.getByRole("button", { name: "换一题" }).click();
  await page.evaluate(() => {
    (
      window as Window & { advanceTime: (milliseconds: number) => void }
    ).advanceTime(1_000);
  });
  await expect(page.getByTestId("timer")).toHaveText(/00:0[01]/);
});

test("settings apply, persist, and start a fresh puzzle", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("radio", { name: "1-13" }).check({ force: true });
  await page
    .getByRole("checkbox", { name: "允许出现无解题目" })
    .check({ force: true });
  await page.getByRole("button", { name: "应用并换题" }).click();

  const settings = await page.evaluate(() =>
    JSON.parse(
      window.localStorage.getItem("twenty-four.settings.v1") ?? "null",
    ),
  );
  expect(settings).toEqual({ range: "1-13", allowUnsolvable: true });
  await expect(page.getByRole("dialog", { name: "游戏设置" })).toBeHidden();
});

test("settings choices show keyboard focus", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("radio", { name: "1-13" }).focus();

  const outline = await page
    .locator(".choice-card")
    .nth(1)
    .evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");
});

test("number tiles are not misleading keyboard buttons", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /^数字 / })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /^数字 / })).toHaveCount(4);
});

test("debug text describes the visible board", async ({ page }) => {
  await page.goto("/?puzzle=6,2,8,4");
  const state = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );

  expect(state.status).toBe("playing");
  expect(state.slots).toHaveLength(4);
  expect(state.slots.map((card: { expression: string }) => card.expression)).toEqual([
    "6",
    "2",
    "8",
    "4",
  ]);
});

test("operators sit at the four corners in arithmetic order", async ({
  page,
}) => {
  await page.goto("/?puzzle=6,2,8,4");

  await expect(
    page.locator('[data-target-index="1"][data-operator="+"]'),
  ).toHaveClass(/operator-top-left/);
  await expect(
    page.locator('[data-target-index="1"][data-operator="-"]'),
  ).toHaveClass(/operator-top-right/);
  await expect(
    page.locator('[data-target-index="1"][data-operator="×"]'),
  ).toHaveClass(/operator-bottom-left/);
  await expect(
    page.locator('[data-target-index="1"][data-operator="÷"]'),
  ).toHaveClass(/operator-bottom-right/);
});

test("three merges show the victory state and freeze the timer", async ({
  page,
}) => {
  await page.goto("/?puzzle=6,6,6,6");
  await enableUnsolvableSetting(page);
  await dragWithMouse(page, 0, 1, "×");
  await dragWithMouse(page, 2, 3, "+");
  await dragWithMouse(page, 1, 3, "-");

  await expect(page.getByText("漂亮，刚好 24！")).toHaveCount(0);
  await expect(page.locator("[data-result]")).toHaveCount(0);
  await expect(page.locator('[data-card-index="3"] .card-value')).toHaveText(
    "24",
  );
  expect(
    await page
      .locator('[data-card-index="3"]')
      .evaluate((card) =>
        getComputedStyle(card).getPropertyValue("--card-color").trim(),
      ),
  ).toBe("#aee8cb");
  const solution = page.locator('[data-action="solution"]');
  await expect(solution).toHaveText("此题有解");
  await expect(solution).toBeDisabled();
  await expect(solution).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.getByRole("button", { name: "撤销" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "下一题" })).toHaveClass(
    /is-next/,
  );
  expect(
    await page
      .getByRole("button", { name: "下一题" })
      .evaluate((button) => getComputedStyle(button).backgroundColor),
  ).toBe("rgb(159, 224, 180)");
  expect(await shadowColor(page.getByRole("button", { name: "下一题" }))).toBe(
    await shadowColor(page.getByRole("button", { name: "重来本题" })),
  );
  const wonState = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(wonState.status).toBe("won");
  expect(wonState.timer.running).toBe(false);

  const elapsedWhenWon = wonState.timer.elapsedMs;
  await page.getByRole("button", { name: "撤销" }).click();
  await page.evaluate(() => {
    (
      window as Window & { advanceTime: (milliseconds: number) => void }
    ).advanceTime(2_000);
  });
  const undoneState = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(undoneState.status).toBe("playing");
  expect(undoneState.timer.running).toBe(false);
  expect(undoneState.timer.elapsedMs).toBe(elapsedWhenWon);
  await expect(page.getByRole("button", { name: "下一题" })).toBeVisible();
  await expect(solution).toHaveText("此题有解");

  await page.getByRole("button", { name: "重来本题" }).click();
  const restartedState = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(restartedState.status).toBe("playing");
  expect(restartedState.timer.running).toBe(false);
  await expect(page.getByRole("button", { name: "下一题" })).toBeVisible();
  await expect(solution).toHaveText("此题有解");

  await page.getByRole("button", { name: "下一题" }).click();
  await expect(page.getByRole("button", { name: "换一题" })).toBeVisible();
  await expect(solution).toHaveText("无解");
  await expect(solution).toBeEnabled();
});

test("a loss keeps the timer running until next", async ({ page }) => {
  await page.goto("/?puzzle=1,1,1,1");
  await dragWithMouse(page, 0, 1, "+");
  await dragWithMouse(page, 2, 3, "+");
  await dragWithMouse(page, 1, 3, "+");

  await expect(page.getByText(/最后是/)).toHaveCount(0);
  await expect(page.locator("[data-result]")).toHaveCount(0);
  const lostState = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(lostState.status).toBe("lost");
  expect(lostState.timer.running).toBe(true);
  expect(
    await page
      .locator('[data-card-index="3"]')
      .evaluate((card) =>
        getComputedStyle(card).getPropertyValue("--card-color").trim(),
      ),
  ).toBe("#ffb29b");
  const lossElapsed = lostState.timer.elapsedMs;
  await page.evaluate(() => {
    (
      window as Window & { advanceTime: (milliseconds: number) => void }
    ).advanceTime(2_000);
  });
  const stillLostState = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(stillLostState.timer.running).toBe(true);
  expect(stillLostState.timer.elapsedMs).toBeGreaterThan(lossElapsed);
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.getByText(/最后是/)).toHaveCount(0);
  const state = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(state.status).toBe("playing");
  expect(state.timer.running).toBe(true);
});
