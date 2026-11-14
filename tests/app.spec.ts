import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('jaunt.guestMode', '1')
  })
})
import { readFile } from 'node:fs/promises'

function localDayKey(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function onboard(page: Page, name = 'Mo') {
  await page.goto('/')
  await page.getByLabel('Your name').fill(name)
  await page.getByRole('button', { name: 'Start planning' }).click()
  await expect(page.getByRole('heading', { name: new RegExp(`Good .*${name}`) })).toBeVisible()
}

test('registers the service worker during offline onboarding', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start planning' })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return false
        await navigator.serviceWorker.ready
        return Boolean(navigator.serviceWorker.controller)
      }),
    )
    .toBe(true)
})

async function addLoosePlan(page: Page, name: string, startTime?: string) {
  await page.getByLabel('Add a plan', { exact: true }).click()
  await page.getByLabel('What is it?').fill(name)
  if (startTime) {
    await page.getByRole('button', { name: 'Time', exact: true }).click()
    await page.getByLabel('Start time', { exact: true }).fill(startTime)
  }
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(page.getByRole('button', { name: `View ${name}` })).toBeVisible()
}

async function addTimedPlan(page: Page, name: string, startTime: string, endTime?: string) {
  await page.getByLabel('Add a plan', { exact: true }).click()
  await page.getByLabel('What is it?').fill(name)
  await page.getByRole('button', { name: 'Time', exact: true }).click()
  await page.getByLabel('Start time', { exact: true }).fill(startTime)
  if (endTime) await page.getByLabel('End time', { exact: true }).fill(endTime)
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(page.getByRole('button', { name: `View ${name}` })).toBeVisible()
}

function planNames(page: Page) {
  return page
    .getByRole('button', { name: /^View / })
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')?.replace('View ', '')))
}

test('plan a day, reorder it, cross things off, and reload offline', async ({ page, context }) => {
  await onboard(page)
  await addLoosePlan(page, 'Late plan', '18:00')
  await addLoosePlan(page, 'Early plan', '09:00')

  const names = () =>
    page
      .getByRole('button', { name: /^View / })
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')?.replace('View ', '')))

  await expect.poll(names).toEqual(['Early plan', 'Late plan'])

  const handle = page.getByRole('button', { name: 'Reorder Early plan' })
  await handle.focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(250)
  await page.keyboard.press('Space')
  await expect.poll(names).toEqual(['Late plan', 'Early plan'])
  await page.waitForTimeout(500)

  await page.reload()
  await expect.poll(names).toEqual(['Late plan', 'Early plan'])

  const check = page.getByRole('button', { name: /Mark Early plan as/ })
  await check.click()
  await expect(page.getByRole('button', { name: 'Mark Early plan as not done' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await expect
    .poll(async () => {
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready
      })
      return page.evaluate(() => Boolean(navigator.serviceWorker.controller))
    })
    .toBe(true)

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'View Late plan' })).toBeVisible()
  await context.setOffline(false)
})

test('keeps time order unless the day is manually reordered', async ({ page }) => {
  await onboard(page, 'Order')

  await addTimedPlan(page, 'Plan one', '12:30', '17:30')
  await addTimedPlan(page, 'Plan two', '18:00', '21:00')
  await expect.poll(() => planNames(page)).toEqual(['Plan one', 'Plan two'])

  const handle = page.getByRole('button', { name: 'Reorder Plan two' })
  await handle.focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(250)
  await page.keyboard.press('Space')

  await expect.poll(() => planNames(page)).toEqual(['Plan two', 'Plan one'])
  await expect(page.getByText('Custom order')).toBeVisible()

  await page.getByRole('button', { name: 'View Plan one' }).click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Start time', { exact: true }).fill('09:00')
  await page.getByLabel('End time', { exact: true }).fill('10:00')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect.poll(() => planNames(page)).toEqual(['Plan one', 'Plan two'])
  await expect(page.getByText('Custom order')).toHaveCount(0)
})

test('interleaves early morning and specific-time plans in time order', async ({ page }) => {
  await onboard(page, 'Buckets')

  const addSlotPlan = async (name: string, slot: RegExp) => {
    await page.getByLabel('Add a plan', { exact: true }).click()
    await page.getByLabel('What is it?').fill(name)
    await page.getByRole('button', { name: 'Part of day' }).click()
    await page.getByRole('button', { name: slot }).click()
    await page.getByRole('button', { name: 'Add plan', exact: true }).click()
    await expect(page.getByRole('button', { name: `View ${name}` })).toBeVisible()
  }

  await addSlotPlan('Red-eye', /^Early morning/)
  await addSlotPlan('Breakfast', /^Morning/)
  await addTimedPlan(page, '3am taxi', '03:00')

  await expect.poll(() => planNames(page)).toEqual(['Red-eye', '3am taxi', 'Breakfast'])
})

test('builds a trip, keeps its plans when deleted, and restores a backup', async ({ page }) => {
  await onboard(page)

  const start = localDayKey(2)
  const end = localDayKey(4)

  await page.getByRole('link', { name: 'Trips' }).click()
  await page.getByRole('button', { name: 'New trip' }).click()
  await page.getByLabel('Trip name').fill('Test trip')
  await page.getByLabel('Destination').fill('Testville')
  await page.keyboard.press('Enter')
  await page.getByLabel('Destination').fill('Elsewhere')
  await page.keyboard.press('Enter')
  await page.locator('#trip-start').fill(start)
  await page.locator('#trip-end').fill(end)
  await page.getByRole('button', { name: 'Create trip' }).click()
  await expect(page.getByRole('heading', { name: 'Test trip' })).toBeVisible()
  await expect(page.getByText('Testville · Elsewhere')).toBeVisible()

  await page.getByRole('button', { name: 'Add a plan', exact: true }).first().click()
  await page.getByLabel('What is it?').fill('Trip plan')
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'View Trip plan' })).toBeVisible()

  await page.getByRole('button', { name: 'Delete trip' }).click()
  await page.getByRole('button', { name: 'Delete trip, keep the plans' }).click()
  await expect(page).toHaveURL(/\/trips$/)

  await page.goto(`/calendar?date=${start}`)
  await expect(page.getByRole('button', { name: 'View Trip plan' })).toBeVisible()

  await page.goto('/settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download backup/ }).click()
  const download = await downloadPromise
  const backupPath = test.info().outputPath('backup.json')
  await download.saveAs(backupPath)
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.format).toBe('jaunt-backup')
  expect(backup.profiles).toHaveLength(1)
  expect(backup.activities.length).toBeGreaterThanOrEqual(1)

  await page.goto('/')
  await addLoosePlan(page, 'Erased by restore')
  await page.goto('/settings')
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(backupPath)
  await page.getByRole('button', { name: 'Restore backup' }).click()
  await expect(page.getByText(/Backup restored/)).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'View Erased by restore' })).toHaveCount(0)
  await page.goto(`/calendar?date=${start}`)
  await expect(page.getByRole('button', { name: 'View Trip plan' })).toBeVisible()
})

test('adds another local profile and switches between them', async ({ page }) => {
  await onboard(page, 'Mo')
  await addLoosePlan(page, 'Mo plan')

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByLabel('Your name').fill('Sam')
  await page.getByRole('button', { name: 'Add profile' }).click()
  await expect(page.getByText('New profile ready.')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good .*Sam/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View Mo plan' })).toHaveCount(0)

  await page.goto('/settings')
  await page.getByRole('button', { name: /Mo\s+Tap to switch/ }).click()
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'View Mo plan' })).toBeVisible()
})


test('supports empty times, multi-day day-part plans, and light mode', async ({ page }) => {
  await onboard(page, 'Sunny')

  // Saving with no specific time should be allowed.
  await page.getByLabel('Add a plan', { exact: true }).click()
  await page.getByLabel('What is it?').fill('No-time plan')
  await page.getByRole('button', { name: 'Time', exact: true }).click()
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'View No-time plan' })).toBeVisible()

  // A plan spanning multiple days with a day-part instead of a clock time.
  await page.getByLabel('Add a plan', { exact: true }).click()
  await page.getByLabel('What is it?').fill('Away weekend')
  await page.getByRole('button', { name: 'Multi-day' }).click()
  await page.locator('#activity-end-date').fill(localDayKey(1))
  await page.getByRole('button', { name: 'Part of day' }).click()
  await page.getByRole('button', { name: 'Evening' }).click()
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'View Away weekend' })).toBeVisible()

  await page.getByRole('button', { name: 'View Away weekend' }).click()
  await expect(page.getByText('Evening').first()).toBeVisible()
  await expect(page.getByText(/Day 1 of 2/)).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('link', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Light' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Today' }).click()
  await expect(page.getByRole('button', { name: 'View Away weekend' })).toBeVisible()
})

test('searches trips, plans, places, confirmations, and notes', async ({ page }) => {
  await onboard(page, 'Searcher')

  await page.getByLabel('Add a plan', { exact: true }).click()
  await page.getByLabel('What is it?').fill('Tea ceremony')
  await page.getByLabel('Where').fill('Gion')
  await page.getByLabel('Confirmation number').fill('ABC123')
  await page.getByLabel('Notes').fill('Window seat with a garden view')
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'View Tea ceremony' })).toBeVisible()

  await page.getByRole('link', { name: 'Trips' }).click()
  await page.getByRole('button', { name: 'New trip' }).click()
  await page.getByLabel('Trip name').fill('Kyoto escape')
  await page.getByLabel('Destination').fill('Kyoto')
  await page.keyboard.press('Enter')
  await page.locator('#trip-start').fill(localDayKey(2))
  await page.locator('#trip-end').fill(localDayKey(4))
  await page.getByRole('button', { name: 'Create trip' }).click()
  await expect(page.getByRole('heading', { name: 'Kyoto escape' })).toBeVisible()

  await page.getByRole('link', { name: 'Search everything' }).click()
  const searchbox = page.getByRole('searchbox')
  await expect(searchbox).toBeVisible()

  await searchbox.fill('Kyoto')
  await expect(page.getByRole('link', { name: 'Open trip Kyoto escape' })).toBeVisible()

  await searchbox.fill('Gion')
  await expect(page.getByRole('button', { name: 'Open plan Tea ceremony' })).toBeVisible()
  await page.getByRole('button', { name: 'Open plan Tea ceremony' }).click()
  await expect(page.getByRole('heading', { name: 'Tea ceremony' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await searchbox.fill('ABC123')
  await expect(page.getByRole('button', { name: 'Open plan Tea ceremony' })).toBeVisible()
  await expect(page.getByText('Confirmation ABC123')).toBeVisible()

  await searchbox.fill('garden')
  await expect(page.getByRole('button', { name: 'Open plan Tea ceremony' })).toBeVisible()
  await expect(page.getByText('Window seat with a garden view')).toBeVisible()

  await searchbox.fill('nothing-like-this')
  await expect(page.getByText('Nothing matched.')).toBeVisible()
})
