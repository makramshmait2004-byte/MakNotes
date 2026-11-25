import { test, expect, type Page } from '@playwright/test';

// Runs against `vite build --mode e2e` (in-memory backend, real IndexedDB, real UI).

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/offline test storage|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  return errors;
}

test('every section renders without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await expect(page.getByTestId('day-title')).toBeVisible();
  for (const path of ['home', 'calendar', 'journal', 'tasks', 'notebooks', 'sketchbook', 'habits', 'goals', 'projects', 'insights', 'focus', 'search', 'settings']) {
    await page.goto(`./#/${path}`);
    await expect(page.locator('h1').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('opens today and navigates days without UTC drift', async ({ page }) => {
  await page.goto('./');
  const title = page.getByTestId('day-title');
  const today = await title.getAttribute('data-date');
  await page.getByTestId('next-day').click();
  await expect(page).toHaveURL(/#\/day\/\d{4}-\d{2}-\d{2}/);
  const next = await page.getByTestId('day-title').getAttribute('data-date');
  expect(new Date(next!).getTime() - new Date(today!).getTime()).toBe(86_400_000);
  await page.getByTestId('go-today').click();
  await expect(page.getByTestId('day-title')).toHaveAttribute('data-date', today!);
});

test('daily workspace: priorities, tasks and notes persist after reload (offline cache)', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('priority-1').fill('Ship MakNotes');
  await page.getByTestId('priority-1').blur();
  await page.getByTestId('day-task-input').fill('Charge the S Pen');
  await page.getByTestId('day-task-input').press('Enter');
  await expect(page.getByTestId('task-item').filter({ hasText: 'Charge the S Pen' })).toBeVisible();
  await page.getByTestId('task-item').filter({ hasText: 'Charge the S Pen' }).getByRole('checkbox').click();
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByTestId('priority-1')).toHaveValue('Ship MakNotes');
  await expect(page.getByTestId('task-item').filter({ hasText: 'Charge the S Pen' }).getByRole('checkbox')).toHaveAttribute('data-state', 'checked');
  await page.goto('./#/today?focus=progress');
  await expect(page.getByTestId('daily-score')).not.toHaveText('0%');
});

test('today defaults: section order, GymFlow label, hidden sections, Sunday review', async ({ page }) => {
  await page.goto('./#/day/2026-11-25'); // a Wednesday
  const ids = await page.locator('[data-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-section')));
  expect(ids).toEqual(['priorities', 'tasks', 'habits', 'schedule', 'evening']);
  await expect(page.getByTestId('gymflow-step')).toHaveText('GymFlow step');
  await page.goto('./#/day/2026-11-29'); // a Sunday
  await expect(page.locator('[data-section]')).toHaveCount(6);
  const review = page.locator('[data-section="sunday_review"]');
  await expect(review).toContainText('Which gym did I talk to?');
  await review.getByRole('textbox').first().fill('Shipped the mind map');
  await review.getByRole('textbox').first().blur();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('[data-section="sunday_review"]').getByRole('textbox').first()).toHaveValue('Shipped the mind map');
  // hidden sections can be shown again from Settings
  await page.goto('./#/settings');
  await page.getByTestId('section-toggle-journal').click();
  await page.goto('./#/day/2026-11-25');
  await expect(page.locator('[data-section="journal"]')).toBeVisible();
});

test('home progress only appears with real goal data', async ({ page }) => {
  await page.goto('./#/home');
  await expect(page.getByTestId('home-greeting')).toBeVisible();
  await expect(page.getByTestId('home-progress')).toHaveCount(0);
  await page.goto('./#/projects');
  await page.getByTestId('new-project').click();
  await page.getByTestId('project-title').fill('GymFlow');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/projects\/[0-9a-f-]{36}/);
  await page.goto('./#/goals');
  await page.getByTestId('new-goal').click();
  await page.getByTestId('goal-title').fill('Business mind map');
  await page.locator('input[type=date]').fill('2099-01-01');
  await page.getByRole('dialog').locator('select').last().selectOption({ label: 'GymFlow' });
  await page.getByRole('button', { name: 'Create' }).click();
  await page.goto('./#/home');
  await expect(page.getByTestId('next-deadline')).toContainText('Business mind map');
  await expect(page.getByTestId('gymflow-progress')).toContainText('0/1');
});

test('tasks: create with dialog, views, recurring completion creates next', async ({ page }) => {
  await page.goto('./#/tasks');
  await page.getByRole('button', { name: /New task/ }).click();
  await page.getByTestId('task-title-input').fill('Weekly review');
  await page.getByTestId('task-repeat').selectOption('daily');
  await page.getByTestId('task-save').click();
  const item = page.getByTestId('task-item').filter({ hasText: 'Weekly review' });
  await expect(item).toHaveCount(1);
  await item.getByRole('checkbox').click();
  await page.getByRole('tab', { name: /Tomorrow/ }).click();
  await expect(page.getByTestId('task-item').filter({ hasText: 'Weekly review' })).toHaveCount(1);
});

test('journal: write an entry and find it with search', async ({ page }) => {
  await page.goto('./#/journal');
  await page.getByTestId('new-journal-entry').click();
  await page.getByTestId('journal-title').fill('A calm morning');
  await page.getByTestId('journal-title').blur();
  await page.getByTestId('block-first-text').click();
  await page.keyboard.type('Walked by the sea in Beirut.');
  await page.waitForTimeout(900);
  await page.goto('./#/journal');
  await page.getByTestId('journal-search').fill('sea in beirut');
  await expect(page.getByTestId('journal-entry-card')).toHaveCount(1);
  await expect(page.getByTestId('journal-entry-card')).toContainText('A calm morning');
});

async function drawStroke(page: Page, pointerType: 'pen' | 'mouse', from: [number, number], to: [number, number]) {
  await page.getByTestId('drawing-canvas').evaluate(
    (el, { pointerType, from, to }) => {
      const r = el.getBoundingClientRect();
      const ev = (type: string, x: number, y: number, pressure: number) =>
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType, isPrimary: true, clientX: r.left + x, clientY: r.top + y, pressure, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
      ev('pointerdown', from[0], from[1], 0.3);
      for (let i = 1; i <= 20; i++) ev('pointermove', from[0] + ((to[0] - from[0]) * i) / 20, from[1] + ((to[1] - from[1]) * i) / 20, 0.3 + i / 40);
      ev('pointerup', to[0], to[1], 0);
    },
    { pointerType, from, to },
  );
}

test('sketchbook: S Pen strokes, undo/redo, eraser, persistence', async ({ page }) => {
  await page.goto('./#/sketchbook');
  await page.getByTestId('new-sketch').click();
  const canvas = page.getByTestId('drawing-canvas');
  await expect(canvas).toBeVisible();
  await drawStroke(page, 'pen', [60, 80], [260, 140]);
  await drawStroke(page, 'pen', [60, 200], [260, 220]);
  await expect(canvas).toHaveAttribute('data-stroke-count', '2');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(canvas).toHaveAttribute('data-stroke-count', '1');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(canvas).toHaveAttribute('data-stroke-count', '2');
  // pen-only turned on automatically: finger touches do not draw
  await expect(page.getByRole('button', { name: /Pen-only mode on/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Eraser', exact: true }).click();
  await drawStroke(page, 'pen', [160, 60], [160, 160]);
  await expect(canvas).toHaveAttribute('data-stroke-count', '1');
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByTestId('drawing-canvas')).toHaveAttribute('data-stroke-count', '1');
});

test('handwriting inside the daily page', async ({ page }) => {
  // handwriting is hidden by default on the GymFlow layout: show it from Settings first
  await page.goto('./#/settings');
  await page.getByTestId('section-toggle-handwriting').click();
  await page.goto('./#/today');
  await page.getByTestId('start-handwriting').click();
  await drawStroke(page, 'pen', [40, 60], [200, 70]);
  await expect(page.getByTestId('drawing-canvas')).toHaveAttribute('data-stroke-count', '1');
});

test('notebooks: create notebook, write page', async ({ page }) => {
  await page.goto('./#/notebooks');
  await page.getByTestId('new-notebook').click();
  await page.getByTestId('notebook-title').fill('Programming');
  await page.keyboard.press('Enter');
  await page.getByTestId('page-title').fill('React notes');
  await page.getByTestId('page-title').blur();
  await page.getByTestId('block-first-text').click();
  await page.keyboard.type('Hooks run in order.');
  await page.waitForTimeout(900);
  await page.goto('./#/search');
  await page.getByTestId('global-search').fill('hooks run');
  await expect(page.getByText('React notes')).toBeVisible();
});

test('habits, insights and Arabic RTL', async ({ page }) => {
  await page.goto('./#/habits');
  await page.getByTestId('new-habit').click();
  await page.getByTestId('habit-name').fill('Read 20 pages');
  await page.getByTestId('habit-save').click();
  const row = page.getByTestId('habit-row');
  await row.getByRole('button', { pressed: false }).last().click();
  await expect(row.getByRole('button', { pressed: true })).toHaveCount(1);
  await page.goto('./#/insights');
  await expect(page.getByText('Habit consistency').first()).toBeVisible();
  await page.goto('./#/settings');
  await page.getByTestId('setting-language').selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByTestId('setting-language').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('mobile layout has no horizontal scroll and large touch targets', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  for (const path of ['today', 'day/2026-11-29', 'tasks', 'calendar', 'journal', 'habits', 'goals', 'projects', 'notebooks', 'insights', 'settings', 'home']) {
    await page.goto(`./#/${path}`);
    await page.waitForTimeout(200);
    // compare against the device viewport, so a zoomed-out (too wide) page is caught too
    const vw = page.viewportSize()!.width;
    const overflow = await page.evaluate((w) => Math.max(document.documentElement.scrollWidth, window.innerWidth) - w, vw);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav).toBeVisible();
  const box = await nav.getByRole('link').first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
});

test('PWA: manifest, icons and service worker', async ({ page, request }) => {
  await page.goto('./');
  const manifest = await (await request.get('manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/MakNotes/');
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  for (const i of manifest.icons) expect((await request.get(i.src)).ok()).toBe(true);
  const sw = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
  expect(sw).toContain('/MakNotes/sw.js');
});
