import { test, expect } from '@playwright/test';

test.describe('Rotation Create (US1)', () => {
  test('creates a rotation and navigates to rotation page', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/rotation name/i).fill('Dish duty');
    await page.getByRole('button', { name: /create rotation/i }).click();
    await page.waitForURL(/\/[a-zA-Z1-9]{8}/);
    await expect(page.getByRole('heading', { name: 'Dish duty' })).toBeVisible();
  });

  test('shows share banner after create', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/rotation name/i).fill('Share test');
    await page.getByRole('button', { name: /create rotation/i }).click();
    await page.waitForURL(/\/[a-zA-Z1-9]{8}/);
    await expect(page.getByRole('status')).toBeVisible();
  });

  test('shows validation error for empty name', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create rotation/i }).click();
    await expect(page.getByText(/name is required/i)).toBeVisible();
  });

  test('shows validation error for too-long name', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/rotation name/i).fill('a'.repeat(101));
    await page.getByRole('button', { name: /create rotation/i }).click();
    await expect(page.getByText(/100 characters/i)).toBeVisible();
  });
});
