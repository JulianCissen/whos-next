import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

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
});
