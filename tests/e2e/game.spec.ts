import { expect, test, type Page } from "@playwright/test";

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

  const operatorButton = page.locator(
    `[data-target-index="${targetIndex}"][data-operator="${operator}"]`,
  );
  const operatorBox = await operatorButton.boundingBox();
  if (!operatorBox) throw new Error("Operator target is not visible");

  await page.mouse.move(
    operatorBox.x + operatorBox.width / 2,
    operatorBox.y + operatorBox.height / 2,
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
  const operatorBox = await operatorButton.boundingBox();
  if (!operatorBox) throw new Error("Operator target is not visible");

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
      y: operatorBox.y + operatorBox.height / 2,
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

test("opens directly into a playable 24-point board", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "24点" })).toBeVisible();
  await expect(page.getByTestId("timer")).toHaveText(/^00:0[0-2]$/);
  await expect(page.locator("[data-card-index]")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "撤销" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重来本题" })).toBeVisible();
  await expect(page.getByRole("button", { name: "换一题" })).toBeVisible();
  await expect(page.getByRole("button", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: /声音/ })).toHaveCount(0);
});

test("opens settings with range and unsolvable choices", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();

  await expect(page.getByRole("dialog", { name: "游戏设置" })).toBeVisible();
  await expect(page.getByLabel("1-9")).toBeChecked();
  await expect(page.getByLabel("允许出现无解题目")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "应用并换题" })).toBeVisible();
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

test("operator placement follows up, down, left, right order", async ({
  page,
}) => {
  await page.goto("/?puzzle=6,2,8,4");

  await expect(
    page.locator('[data-target-index="1"][data-operator="+"]'),
  ).toHaveClass(/operator-up/);
  await expect(
    page.locator('[data-target-index="1"][data-operator="-"]'),
  ).toHaveClass(/operator-down/);
  await expect(
    page.locator('[data-target-index="1"][data-operator="×"]'),
  ).toHaveClass(/operator-left/);
  await expect(
    page.locator('[data-target-index="1"][data-operator="÷"]'),
  ).toHaveClass(/operator-right/);
});

test("three merges show the victory state and freeze the timer", async ({
  page,
}) => {
  await page.goto("/?puzzle=6,6,6,6");
  await dragWithMouse(page, 0, 1, "×");
  await dragWithMouse(page, 2, 3, "+");
  await dragWithMouse(page, 1, 3, "-");

  await expect(page.getByText("漂亮，刚好 24！")).toBeVisible();
  await expect(page.locator('[data-card-index="3"] .card-value')).toHaveText(
    "24",
  );
  await expect(page.getByRole("button", { name: "撤销" })).toBeDisabled();
  const state = await page.evaluate(() =>
    JSON.parse(
      (
        window as Window & { render_game_to_text: () => string }
      ).render_game_to_text(),
    ),
  );
  expect(state.status).toBe("won");
  expect(state.timer.running).toBe(false);
});

test("a loss can be undone and resumes the timer", async ({ page }) => {
  await page.goto("/?puzzle=1,1,1,1");
  await dragWithMouse(page, 0, 1, "+");
  await dragWithMouse(page, 2, 3, "+");
  await dragWithMouse(page, 1, 3, "+");

  await expect(page.getByText("最后是 4")).toBeVisible();
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
