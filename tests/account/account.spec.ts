import { expect, test, type Browser, type Page } from '@playwright/test'
import path from 'node:path'

const password = 'supersecret123'
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8080'

function localDayKey(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

async function register(page: Page, email: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create one' }).click()
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

async function loginOnNewDevice(browser: Browser, email: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
  })
  const page = await context.newPage()
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: /Good/ })).toBeVisible()
  return { page, close: () => context.close() }
}

test('syncs plans, completions, and ticket files across devices', async ({ page, browser }) => {
  const email = uniqueEmail('mo.sync')
  await register(page, email)
  await addPlan(page, 'Synced plan')

  await page.getByRole('button', { name: 'View Synced plan' }).click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.locator('input[type="file"]').setInputFiles(path.resolve('public/pwa-192x192.png'))
  await expect(page.getByText('1/12', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()

  await page.waitForTimeout(4000)

  const second = await loginOnNewDevice(browser, email)
  try {
    await expect(second.page.getByRole('button', { name: 'View Synced plan' })).toBeVisible()
    await second.page.getByRole('button', { name: 'View Synced plan' }).click()
    await expect(second.page.getByRole('button', { name: /^Open / })).toBeVisible()
    await second.page.getByRole('button', { name: 'Close' }).click()

    await second.page.getByRole('button', { name: 'Mark Synced plan as done' }).click()
    await expect(second.page.getByRole('button', { name: 'Mark Synced plan as not done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await second.page.waitForTimeout(3000)
  } finally {
    await second.close()
  }

  await page.reload()
  await expect(page.getByRole('button', { name: 'Mark Synced plan as not done' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('keeps working offline and syncs queued edits afterward', async ({ page, context, browser }) => {
  const email = uniqueEmail('mo.offline')
  await register(page, email)
  await addPlan(page, 'Before offline')
  await expect
    .poll(() =>
      page.evaluate(async () => {
        await navigator.serviceWorker.ready
        return Boolean(navigator.serviceWorker.controller)
      }),
    )
    .toBe(true)
  await page.waitForTimeout(3000)

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'View Before offline' })).toBeVisible()
  await addPlan(page, 'Queued offline plan')
  await context.setOffline(false)
  await page.waitForTimeout(4000)

  const second = await loginOnNewDevice(browser, email)
  try {
    await expect(second.page.getByRole('button', { name: 'View Before offline' })).toBeVisible()
    await expect(second.page.getByRole('button', { name: 'View Queued offline plan' })).toBeVisible()
  } finally {
    await second.close()
  }
})

test('imports an offline profile into an account', async ({ page }) => {
  const email = uniqueEmail('mo.import')
  await register(page, email)

  await page.getByRole('link', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Sign out of this device' }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to Jaunt.' })).toBeVisible()

  await page.getByRole('button', { name: 'Continue offline' }).click()
  await page.getByLabel('Your name').fill('Offline Tester')
  await page.getByRole('button', { name: 'Start planning' }).click()
  await expect(page.getByRole('heading', { name: /Good/ })).toBeVisible()
  await addPlan(page, 'Guest plan')
  await page.getByRole('button', { name: 'View Guest plan' }).click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.locator('input[type="file"]').setInputFiles(path.resolve('public/pwa-192x192.png'))
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.waitForTimeout(500)

  await page.getByRole('link', { name: 'More' }).click()
  await page.getByRole('link', { name: /Sync across your devices/ }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: /Good/ })).toBeVisible()

  await page.getByRole('link', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Import', exact: true }).first().click()
  await page.getByRole('button', { name: 'Import plans' }).click()
  await expect(page.getByText(/Imported .* plan/)).toBeVisible()

  await page.getByRole('link', { name: 'Today' }).click()
  await expect(page.getByRole('button', { name: 'View Guest plan' })).toBeVisible()
  await page.getByRole('button', { name: 'View Guest plan' }).click()
  await expect(page.getByRole('button', { name: /^Open / })).toBeVisible()
})

test('syncs a trip across devices and keeps plans when the trip is deleted', async ({ page, browser }) => {
  const email = uniqueEmail('mo.trip')
  await register(page, email)

  const start = (() => {
    const date = new Date()
    date.setDate(date.getDate() + 2)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })()
  const end = (() => {
    const date = new Date()
    date.setDate(date.getDate() + 4)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })()

  await page.getByRole('link', { name: 'Trips' }).click()
  await page.getByRole('button', { name: 'New trip' }).click()
  await page.getByLabel('Trip name').fill('Sync trip')
  await page.getByLabel('Starts').fill(start)
  await page.getByLabel('Ends').fill(end)
  await page.getByRole('button', { name: 'Create trip' }).click()
  await expect(page.getByRole('heading', { name: 'Sync trip' })).toBeVisible()

  await page.getByRole('button', { name: 'Add a plan', exact: true }).first().click()
  await page.getByLabel('What is it?').fill('Trip plan')
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'View Trip plan' })).toBeVisible()
  await page.waitForTimeout(4000)

  const second = await loginOnNewDevice(browser, email)
  try {
    await second.page.getByRole('link', { name: 'Trips' }).click()
    await expect(second.page.getByRole('link', { name: /Sync trip/ })).toBeVisible()
    await second.page.getByRole('link', { name: /Sync trip/ }).click()
    await expect(second.page.getByRole('button', { name: 'View Trip plan' })).toBeVisible()
  } finally {
    await second.close()
  }

  await page.getByRole('button', { name: 'Delete trip' }).click()
  await page.getByRole('button', { name: 'Delete trip, keep the plans' }).click()
  await expect(page).toHaveURL(/\/trips$/)
  await page.waitForTimeout(4000)

  await page.goto(`/calendar?date=${start}`)
  await expect(page.getByRole('button', { name: 'View Trip plan' })).toBeVisible()

  const check = await loginOnNewDevice(browser, email)
  try {
    await check.page.goto(`/calendar?date=${start}`)
    await expect(check.page.getByRole('button', { name: 'View Trip plan' })).toBeVisible()
    await check.page.getByRole('link', { name: 'Trips' }).click()
    await expect(check.page.getByText('Sync trip')).toHaveCount(0)
  } finally {
    await check.close()
  }
})


test('invites another account into a shared trip', async ({ browser }) => {
  const base = baseURL
  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' }
  const alexContext = await browser.newContext({ baseURL: base, ...phone })
  const samContext = await browser.newContext({ baseURL: base, ...phone })
  const alex = await alexContext.newPage()
  const sam = await samContext.newPage()

  try {
    await register(alex, uniqueEmail('alex.share'))
    await register(sam, uniqueEmail('sam.share'))

    await alex.getByRole('link', { name: 'Trips' }).click()
    await alex.getByRole('button', { name: 'New trip' }).click()
    await alex.getByLabel('Trip name').fill('Shared trip')
    await alex.getByLabel('Starts').fill(localDayKey(2))
    await alex.getByLabel('Ends').fill(localDayKey(4))
    await alex.getByRole('button', { name: 'Create trip' }).click()
    await expect(alex.getByRole('heading', { name: 'Shared trip' })).toBeVisible()

    await alex.getByRole('button', { name: 'Trip members' }).click()
    const samEmail = await sam.evaluate(() => {
      const cached = localStorage.getItem('jaunt.cachedUser')
      return cached ? JSON.parse(cached).email : ''
    })
    await alex.getByPlaceholder('their@email.com').fill(samEmail)
    await alex.getByRole('button', { name: 'Invite', exact: true }).click()
    await expect(alex.getByText(samEmail)).toBeVisible()
    await alex.getByRole('button', { name: 'Done' }).click()

    await sam.reload()
    await sam.getByRole('link', { name: 'Trips' }).click()
    await expect(sam.getByText('Trip invitations')).toBeVisible()
    await sam.getByRole('button', { name: 'Accept' }).click()
    await expect(sam.getByRole('link', { name: /Shared trip/ })).toBeVisible()
    await sam.getByRole('link', { name: /Shared trip/ }).click()
    await expect(sam.getByRole('heading', { name: 'Shared trip' })).toBeVisible()
    await expect(sam.getByRole('button', { name: 'Edit trip' })).toHaveCount(0)

    await sam.locator('main').getByRole('button', { name: 'Add a plan', exact: true }).first().click()
    await sam.getByLabel('What is it?').fill('Plan from Sam')
    await sam.getByRole('button', { name: 'Add plan', exact: true }).click()
    await expect(sam.getByRole('button', { name: 'View Plan from Sam' })).toBeVisible()

    await alex.waitForTimeout(4000)
    await alex.reload()
    await alex.getByRole('button', { name: 'View Plan from Sam' }).waitFor({ timeout: 20_000 })
  } finally {
    await alexContext.close()
    await samContext.close()
  }
})

test('creates a read-only public link and revokes it', async ({ browser }) => {
  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' }
  const ownerContext = await browser.newContext({ baseURL, ...phone })
  const publicContext = await browser.newContext({ baseURL, ...phone })
  const owner = await ownerContext.newPage()
  const publicPage = await publicContext.newPage()

  try {
    await register(owner, uniqueEmail('alex.public'))

    await owner.getByRole('link', { name: 'Trips' }).click()
    await owner.getByRole('button', { name: 'New trip' }).click()
    await owner.getByLabel('Trip name').fill('Public trip')
    await owner.getByLabel('Destination').fill('Lisbon')
    await owner.getByLabel('Starts').fill(localDayKey(2))
    await owner.getByLabel('Ends').fill(localDayKey(4))
    await owner.getByRole('button', { name: 'Create trip' }).click()
    await expect(owner.getByRole('heading', { name: 'Public trip' })).toBeVisible()

    await owner.getByRole('button', { name: 'Add a plan', exact: true }).first().click()
    await owner.getByLabel('What is it?').fill('Sunset cruise')
    await owner.getByLabel('Where').fill('Marina Bay')
    await owner.getByLabel('Confirmation number').fill('SECRET123')
    await owner.getByLabel('Notes').fill('Bring a jacket')
    await owner.getByRole('button', { name: 'Add plan', exact: true }).click()
    await expect(owner.getByRole('button', { name: 'View Sunset cruise' })).toBeVisible()
    await owner.waitForTimeout(3000)

    await owner.getByRole('button', { name: 'Share trip' }).click()
    await owner.getByRole('button', { name: 'Create public link' }).click()
    const shareUrl = await owner.getByLabel('Public share link').inputValue()
    expect(shareUrl).toContain('/share/')

    await publicPage.goto(shareUrl)
    await expect(publicPage.getByRole('heading', { name: 'Public trip' })).toBeVisible()
    await expect(publicPage.getByText('Sunset cruise')).toBeVisible()
    await expect(publicPage.getByText('Marina Bay')).toBeVisible()
    await expect(publicPage.getByText('SECRET123')).toHaveCount(0)
    await expect(publicPage.getByText('Bring a jacket')).toHaveCount(0)
    await expect(publicPage.getByText('Read-only', { exact: true })).toBeVisible()

    await owner.getByRole('button', { name: 'Stop sharing' }).click()
    await owner.getByRole('button', { name: 'Turn off link' }).click()
    await expect(owner.getByRole('button', { name: 'Create public link' })).toBeVisible()

    await publicPage.reload()
    await expect(publicPage.getByText(/This link is no longer available/)).toBeVisible()
  } finally {
    await ownerContext.close()
    await publicContext.close()
  }
})

test('changes the account password and signs out other devices', async ({ page, browser }) => {
  const email = uniqueEmail('mo.password')
  const newPassword = 'newsupersecret123'
  await register(page, email)

  const second = await loginOnNewDevice(browser, email)
  try {
    await page.getByRole('link', { name: 'More' }).click()
    await page.getByRole('button', { name: 'Change password' }).click()
    await page.getByLabel('Current password', { exact: true }).fill(password)
    await page.getByLabel('New password', { exact: true }).fill(newPassword)
    await page.getByLabel('Confirm new password', { exact: true }).fill(newPassword)
    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(page.getByText(/Password changed/)).toBeVisible()

    await second.page.reload()
    await expect(second.page.getByRole('heading', { name: 'Sign in to Jaunt.' })).toBeVisible()

    await page.getByRole('button', { name: 'Sign out of this device' }).click()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sign in to Jaunt.' })).toBeVisible()

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toHaveText(/Email or password is incorrect/)

    await page.getByLabel('Password', { exact: true }).fill(newPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: /Good/ })).toBeVisible()
  } finally {
    await second.close()
  }
})
