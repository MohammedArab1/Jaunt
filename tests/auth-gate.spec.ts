import { expect, test } from '@playwright/test'

test('shows account choices first and still allows offline mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Create your account.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use without an account' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Feedback' })).toHaveAttribute(
    'href',
    'https://github.com/MohammedArab1/Jaunt/issues',
  )
  await expect(page.getByRole('link', { name: 'Open source' })).toHaveAttribute(
    'href',
    'https://github.com/MohammedArab1/Jaunt',
  )

  await page.getByRole('button', { name: 'Use without an account' }).click()
  await expect(page.getByText("Who's planning?")).toBeVisible()

  await page.getByRole('button', { name: 'Back to sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Create your account.' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Create your account.' })).toBeVisible()
  await expect(page.getByText("Who's planning?")).toHaveCount(0)
})

test('serves the privacy page without an account', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Your plans are yours.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What Jaunt stores' })).toBeVisible()
})
