import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

async function createRotation(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel(/rotation name/i).fill(name);
  await page.getByRole('button', { name: /create rotation/i }).click();
  await page.waitForURL(/\/[a-zA-Z1-9]{8}/);
  return page.url().split('/').pop() ?? '';
}

test.describe('Rotation Rename (US3)', () => {
  test('renames a rotation and shows updated name', async ({ page }) => {
    await createRotation(page, 'Old name');
    await page.getByLabel(/rotation name/i).fill('New name');
    await page.getByRole('button', { name: /rename/i }).click();
    await expect(page.getByRole('heading', { name: 'New name' })).toBeVisible();
  });

  test('shows validation error for empty rename', async ({ page }) => {
    await createRotation(page, 'Rename test');
    await page.getByLabel(/rotation name/i).fill('');
    await page.getByRole('button', { name: /rename/i }).click();
    await expect(page.getByText(/name is required/i)).toBeVisible();
  });
});
