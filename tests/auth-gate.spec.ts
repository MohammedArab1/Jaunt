import { expect, test } from '@playwright/test'

test('shows sign-in first and still allows offline mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in to Jaunt.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue offline' })).toBeVisible()

  await page.getByRole('button', { name: 'Continue offline' }).click()
  await expect(page.getByText("Who's planning?")).toBeVisible()
})
