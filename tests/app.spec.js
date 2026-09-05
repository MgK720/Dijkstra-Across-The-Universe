import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const registry = new Map();
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool(tool) {
          registry.set(tool.name, tool);
        },
      },
      configurable: true,
    });
    window.__tools = registry;
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'BEGIN DIJKSTRA', exact: true }),
  ).toBeEnabled();
});
const state = (page) =>
  page.evaluate(() => window.__tools.get('read_simulation').execute({}));
test('real steps, pause, queue, reconstruction, route travel and exact reset', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const first = await state(page);
  expect(first.steps).toBe(0);
  expect(first.route).toEqual([]);
  await page.screenshot({ path: 'tests/ready.png' });
  await page.getByRole('button', { name: 'STEP', exact: true }).click();
  await expect(page.getByTestId('step-count')).toHaveText('1');
  await page.getByRole('button', { name: 'RESUME DIJKSTRA' }).click();
  await expect.poll(async () => (await state(page)).steps).toBeGreaterThan(2);
  await page.getByRole('button', { name: 'PAUSE SEARCH' }).click();
  const paused = (await state(page)).steps;
  await page.waitForTimeout(400);
  expect((await state(page)).steps).toBe(paused);
  await page.getByRole('switch', { name: 'Pathfinding X-ray' }).click();
  await page.getByRole('switch', { name: 'Cost field' }).click();
  await page.screenshot({ path: 'tests/exploring.png' });
  await page.getByRole('button', { name: 'WARP', exact: true }).click();
  await page.getByRole('button', { name: 'RESUME DIJKSTRA' }).click();
  await expect(page.getByTestId('route-complete')).toBeVisible();
  const done = await state(page);
  expect(done.route.length).toBeGreaterThan(2);
  expect(done.bestTargetCost).toBeGreaterThan(0);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'tests/route.png' });
  await page.getByRole('button', { name: 'TRAVEL ROUTE', exact: true }).click();
  await expect(page.getByRole('button', { name: 'END TRAVEL' })).toBeVisible();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/travel.png' });
  await page.getByRole('button', { name: 'END TRAVEL' }).click();
  await page.getByRole('button', { name: 'RESET ALGORITHM' }).click();
  let reset = await state(page);
  expect(reset.seed).toBe(first.seed);
  expect(reset.target).toBe(first.target);
  expect(reset.steps).toBe(0);
  expect(reset.route).toEqual([]);
  await page
    .getByRole('button', { name: 'BEGIN DIJKSTRA', exact: true })
    .click();
  await expect(page.getByTestId('route-complete')).toBeVisible();
  const repeated = await state(page);
  expect(repeated.route).toEqual(done.route);
  expect(repeated.bestTargetCost).toBe(done.bestTargetCost);
  expect(errors).toEqual([]);
});
test('seed replay, new graph, profile reset, planetary focus and sandbox', async ({
  page,
}) => {
  const initial = await state(page);
  await page.getByRole('button', { name: 'SEED', exact: true }).click();
  await page.getByLabel('UNIVERSE SEED', { exact: true }).fill('84729153');
  await page.getByRole('button', { name: 'GENERATE FROM SEED' }).click();
  await expect(page.getByTestId('seed')).toHaveText('84729153');
  await expect(
    page.getByText('GENERATING UNIVERSE', { exact: true }),
  ).toBeHidden();
  const replay = await state(page);
  await page.getByRole('button', { name: 'NEW UNIVERSE', exact: true }).click();
  await expect.poll(async () => (await state(page)).seed).not.toBe(replay.seed);
  await expect(
    page.getByText('GENERATING UNIVERSE', { exact: true }),
  ).toBeHidden();
  const newer = await state(page);
  expect(newer.seed).not.toBe(initial.seed);
  await page.getByRole('tab', { name: 'Safest', exact: true }).click();
  expect((await state(page)).mode).toBe('safest');
  expect((await state(page)).steps).toBe(0);
  await page.getByRole('button', { name: 'Earth', exact: true }).click();
  await expect(page.getByText('PLANETARY SYSTEM · 8 WORLDS')).toBeVisible();
  await expect(
    page.getByText('G2V · Yellow dwarf · Procedural stellar system'),
  ).toBeVisible();
  await page.screenshot({ path: 'tests/profile.png' });
  await page.getByRole('button', { name: 'FOCUS SYSTEM' }).click();
  await expect(page.getByText('SECTOR MAP / STAR SYSTEM VIEW')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/system.png' });
  await page
    .getByRole('button', { name: 'Galactic view', exact: true })
    .click();
  await page.locator('.itinerary .system-link').nth(1).click();
  await page.getByRole('button', { name: 'SET AS START' }).click();
  const sandbox = await state(page);
  expect(sandbox.start).toBe(sandbox.target);
  await page.getByRole('button', { name: 'STEP', exact: true }).click();
  await expect(page.getByTestId('route-complete')).toBeVisible();
  expect((await state(page)).bestTargetCost).toBe(0);
});
test('WebMCP contract uses visible state and rejects invalid seeds', async ({
  page,
}) => {
  expect(await page.evaluate(() => [...window.__tools.keys()].sort())).toEqual([
    'generate_universe',
    'read_simulation',
    'step_dijkstra',
  ]);
  const result = await page.evaluate(() =>
    window.__tools.get('step_dijkstra').execute({}),
  );
  expect(result.steps).toBe(1);
  await expect(page.getByTestId('step-count')).toHaveText('1');
  const invalid = await page.evaluate(async () => {
    try {
      await window.__tools.get('generate_universe').execute({ seed: 12 });
      return false;
    } catch {
      return true;
    }
  });
  expect(invalid).toBe(true);
  expect((await state(page)).steps).toBe(1);
  const generated = await page.evaluate(() =>
    window.__tools
      .get('generate_universe')
      .execute({ seed: 'webmcp-contract' }),
  );
  expect(generated.seed).toBe('webmcp-contract');
  expect(generated.steps).toBe(0);
  await expect(page.getByTestId('seed')).toHaveText('webmcp-contract');
});
test('mobile controls and keyboard immersion remain usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'tests/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole('button', { name: 'STEP', exact: true }).click();
  await expect(page.getByTestId('step-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Hide panels' }).click();
  await expect(
    page.getByRole('button', { name: 'SHOW CONTROLS · H' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'SHOW CONTROLS · H' }).click();
  await expect(
    page.getByRole('button', { name: 'RESUME DIJKSTRA' }),
  ).toBeVisible();
});
