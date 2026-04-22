import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

async function createRotation(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel(/rotation name/i).fill(name);
  await page.getByRole('button', { name: /create rotation/i }).click();
  await page.waitForURL(/\/[a-zA-Z1-9]{8}/);
  return page.url().split('/').pop() ?? '';
}

async function addMemberViaForm(
  page: Page,
  name: string,
  placement: 'Front' | 'Back' = 'Back',
): Promise<void> {
  await page.getByLabel(/member name/i).fill(name);
  await page.getByRole('radio', { name: placement }).click();
  await page.getByRole('button', { name: /add member/i }).click();
  await page.waitForLoadState('networkidle');
}

test.describe('Member Queue (US1–US4)', () => {
  test('shows empty state when no members', async ({ page }) => {
    await createRotation(page, 'Empty queue test');
    await expect(page.getByText(/no members yet/i)).toBeVisible();
  });

  test('adds a member to the back of the queue', async ({ page }) => {
    await createRotation(page, 'Add back test');
    await addMemberViaForm(page, 'Alice', 'Back');
    await expect(page.locator('.queue-item').first().locator('.queue-item__name')).toHaveText(
      'Alice',
    );
  });

  test('adds a member to the front of the queue', async ({ page }) => {
    await createRotation(page, 'Add front test');
    await addMemberViaForm(page, 'Alice', 'Back');
    await addMemberViaForm(page, 'Bob', 'Front');

    const items = page.locator('.queue-item');
    await expect(items).toHaveCount(2);
    await expect(items.first().locator('.queue-item__name')).toHaveText('Bob');
    await expect(items.nth(1).locator('.queue-item__name')).toHaveText('Alice');
  });

  test('removes a member from the queue', async ({ page }) => {
    await createRotation(page, 'Remove test');
    await addMemberViaForm(page, 'Alice', 'Back');
    await addMemberViaForm(page, 'Bob', 'Back');

    const removeButtons = page.getByRole('button', { name: /remove alice/i });
    await removeButtons.click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.queue-item')).toHaveCount(1);
    await expect(page.locator('.queue-item__name')).toHaveText('Bob');
  });

  test('reorders members via drag-and-drop', async ({ page }) => {
    await createRotation(page, 'Reorder test');
    await addMemberViaForm(page, 'Alice', 'Back');
    await addMemberViaForm(page, 'Bob', 'Back');
    await addMemberViaForm(page, 'Carol', 'Back');

    const items = page.locator('.queue-item');
    await expect(items).toHaveCount(3);

    // Drag Alice (position 1) to position 3 (after Carol)
    const alice = items.first();
    const carol = items.nth(2);
    await alice.dragTo(carol);
    await page.waitForLoadState('networkidle');

    await expect(items.nth(2).locator('.queue-item__name')).toHaveText('Alice');
  });

  test('shows 409 capacity error after adding 100 members', async ({ page }) => {
    await createRotation(page, 'Capacity test');

    // Add 100 members via API to reach capacity quickly
    const slug = page.url().split('/').pop() ?? '';
    for (let i = 1; i <= 100; i++) {
      await page.request.post(`/api/rotations/${slug}/members`, {
        data: { name: `Member ${i}`, placement: 'back' },
      });
    }

    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/member name/i).fill('One too many');
    await page.getByRole('button', { name: /add member/i }).click();
    await expect(page.getByText(/queue is full/i)).toBeVisible();
  });
});
