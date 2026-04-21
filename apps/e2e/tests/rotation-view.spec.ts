import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

async function createRotation(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel(/rotation name/i).fill(name);
  await page.getByRole('button', { name: /create rotation/i }).click();
  await page.waitForURL(/\/[a-zA-Z1-9]{8}/);
  return page.url().split('/').pop() ?? '';
}

test.describe('Rotation View (US2)', () => {
  test('navigating directly to slug shows the rotation', async ({ page }) => {
    const slug = await createRotation(page, 'View test');
    await page.goto(`/${slug}`);
    await expect(page.getByRole('heading', { name: 'View test' })).toBeVisible();
  });

  test('navigating to unknown slug shows 404 page', async ({ page }) => {
    await page.goto('/aBcDeFgH');
    await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible();
  });

  test('navigating to malformed slug shows 404 page', async ({ page }) => {
    await page.goto('/bad-slug!@#');
    await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible();
  });
});
