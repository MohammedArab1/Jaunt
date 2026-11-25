import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const password = 'supersecret123'

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

async function register(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: /Good/ })).toBeVisible()
}

async function addPlan(page: Page, name: string) {
  await page.getByLabel('Add a plan', { exact: true }).click()
  await page.getByLabel('What is it?').fill(name)
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(page.getByRole('button', { name: `View ${name}` })).toBeVisible()
}

test('downloads an account export', async ({ page }) => {
  const email = uniqueEmail('data.export')
  await register(page, email)
  await addPlan(page, 'Export me')

  await page.goto('/settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download my data/ }).click()
  const download = await downloadPromise
  const filePath = await download.path()
  expect(filePath).not.toBeNull()

  const exported = JSON.parse(await readFile(filePath as string, 'utf8')) as {
    format: string
    account: { email: string }
    activities: Array<{ name: string }>
  }

  expect(exported.format).toBe('jaunt-account-export')
  expect(exported.account.email).toBe(email)
  expect(exported.activities.some((activity) => activity.name === 'Export me')).toBe(true)
  await expect(page.getByText('Account export downloaded.')).toBeVisible()
})

test('deletes the account and invalidates the login', async ({ page }) => {
  const email = uniqueEmail('data.delete')
  await register(page, email)

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Delete account' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Delete your account?' })).toBeVisible()
  await dialog.getByLabel('Type Delete to confirm').fill('Delete')
  await dialog.getByRole('button', { name: 'Delete account' }).click()

  await expect(page.getByRole('heading', { name: 'Create your account.' })).toBeVisible()

  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(/Email or password is incorrect/)
})
