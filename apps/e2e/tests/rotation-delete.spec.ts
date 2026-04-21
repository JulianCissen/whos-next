import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

async function createRotation(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel(/rotation name/i).fill(name);
  await page.getByRole('button', { name: /create rotation/i }).click();
  await page.waitForURL(/\/[a-zA-Z1-9]{8}/);
  return page.url().split('/').pop() ?? '';
}

test.describe('Rotation Delete (US4)', () => {
  test('deletes a rotation after typing the name and redirects home', async ({ page }) => {
    await createRotation(page, 'Delete me');
    await page.getByRole('button', { name: /delete rotation/i }).click();
    await page.getByLabel(/rotation name/i).fill('Delete me');
    await page.getByRole('button', { name: /^delete$/i }).click();
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('delete button is disabled until name matches', async ({ page }) => {
    await createRotation(page, 'Protected');
    await page.getByRole('button', { name: /delete rotation/i }).click();
    const deleteBtn = page.getByRole('button', { name: /^delete$/i });
    await expect(deleteBtn).toBeDisabled();
    await page.getByLabel(/rotation name/i).fill('Protecte');
    await expect(deleteBtn).toBeDisabled();
    await page.getByLabel(/rotation name/i).fill('Protected');
    await expect(deleteBtn).toBeEnabled();
  });

  test('cancel closes the dialog without deleting', async ({ page }) => {
    await createRotation(page, 'Keep me');
    await page.getByRole('button', { name: /delete rotation/i }).click();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('heading', { name: 'Keep me' })).toBeVisible();
  });
});
