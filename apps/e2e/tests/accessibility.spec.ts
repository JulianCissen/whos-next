import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

/** Set up a rotation with a weekly schedule and one member, leaving it ready for skip tests. */
async function setupA11yWithScheduleAndMember(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/rotation name/i).fill('A11y skip');
  await page.getByRole('button', { name: /create rotation/i }).click();
  await page.waitForURL(/\/[a-zA-Z1-9]{8}/);
  await page.waitForLoadState('networkidle');

  // Open Settings panel and save the default weekly schedule
  await page.getByRole('button', { name: /^settings$/i }).click();
  await page.getByRole('button', { name: /^save$/i }).click();
  await page.waitForLoadState('networkidle');

  // Add one member so the skip trigger becomes visible
  await page.getByLabel(/member name/i).fill('Dave');
  await page.getByRole('radio', { name: 'Back' }).click();
  await page.getByRole('button', { name: /add member/i }).click();
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('button', { name: 'Skip this occurrence' })).toBeVisible({
    timeout: 10_000,
  });
}

test.describe('Accessibility — WCAG 2.2 AA', () => {
  test('landing page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('rotation page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/rotation name/i).fill('A11y test');
    await page.getByRole('button', { name: /create rotation/i }).click();
    await page.waitForURL(/\/[a-zA-Z1-9]{8}/);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('delete dialog has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/rotation name/i).fill('A11y dialog');
    await page.getByRole('button', { name: /create rotation/i }).click();
    await page.waitForURL(/\/[a-zA-Z1-9]{8}/);
    await page.getByRole('button', { name: /delete rotation/i }).click();
    await page.waitForSelector('[mat-dialog-content]');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('rotation page with member queue has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/rotation name/i).fill('A11y queue');
    await page.getByRole('button', { name: /create rotation/i }).click();
    await page.waitForURL(/\/[a-zA-Z1-9]{8}/);

    await page.getByLabel(/member name/i).fill('Alice');
    await page.getByRole('radio', { name: 'Back' }).click();
    await page.getByRole('button', { name: /add member/i }).click();
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('rotation page drag-and-drop element has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/rotation name/i).fill('A11y drag');
    await page.getByRole('button', { name: /create rotation/i }).click();
    await page.waitForURL(/\/[a-zA-Z1-9]{8}/);

    await page.getByLabel(/member name/i).fill('Bob');
    await page.getByRole('radio', { name: 'Back' }).click();
    await page.getByRole('button', { name: /add member/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[cdkDrag]').first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('occurrence-view section has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/rotation name/i).fill('A11y occurrence');
    await page.getByRole('button', { name: /create rotation/i }).click();
    await page.waitForURL(/\/[a-zA-Z1-9]{8}/);

    await page.getByLabel(/member name/i).fill('Carol');
    await page.getByRole('radio', { name: 'Back' }).click();
    await page.getByRole('button', { name: /add member/i }).click();
    await page.waitForLoadState('networkidle');

    const occurrenceSection = page.locator('app-occurrence-view');
    await expect(occurrenceSection).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('app-occurrence-view')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('occurrence card with skip trigger has no accessibility violations', async ({ page }) => {
    await setupA11yWithScheduleAndMember(page);

    const results = await new AxeBuilder({ page })
      .include('app-occurrence-view')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('skip panel (expanded) has no accessibility violations', async ({ page }) => {
    await setupA11yWithScheduleAndMember(page);

    // Open the skip panel
    await page.getByRole('button', { name: 'Skip this occurrence' }).click();
    await expect(
      page.getByRole('button', { name: 'Cancel this date — no one performs the task' }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('app-occurrence-view')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('cancelled occurrence card has no accessibility violations', async ({ page }) => {
    await setupA11yWithScheduleAndMember(page);

    // Cancel the date to reach the Cancelled state
    await page.getByRole('button', { name: 'Skip this occurrence' }).click();
    await page.getByRole('button', { name: 'Cancel this date — no one performs the task' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.occ-card__cancelled-label')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('app-occurrence-view')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
