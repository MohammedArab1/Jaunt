import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

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

async function createTrip(page: Page, name: string, start: string, end: string) {
  await page.getByRole('link', { name: 'Trips' }).click()
  await page.getByRole('button', { name: 'New trip' }).click()
  await page.getByLabel('Trip name').fill(name)
  await page.locator('#trip-start').fill(start)
  await page.locator('#trip-end').fill(end)
  await page.getByRole('button', { name: 'Create trip' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
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

test('drags a plan to another day', async ({ page }) => {
  await onboard(page, 'Mover')
  const dayOne = localDayKey(0)
  const dayTwo = localDayKey(1)
  await createTrip(page, 'Moving trip', dayOne, dayTwo)

  const firstDay = page.locator(`[data-day-date="${dayOne}"]`)
  const secondDay = page.locator(`[data-day-date="${dayTwo}"]`)

  await firstDay.getByRole('button', { name: /^Add a plan on/ }).click()
  await page.getByLabel('What is it?').fill('Move me')
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(firstDay.getByRole('button', { name: 'View Move me' })).toBeVisible()
  await expect(page.getByText('Trip created. Time to fill the days.')).toBeHidden({ timeout: 6000 })

  await page.evaluate(() => window.scrollTo(0, 400))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

  await firstDay.scrollIntoViewIfNeeded()

  const planButton = firstDay.getByRole('button', { name: 'View Move me' })
  const planBox = await planButton.boundingBox()
  const targetBox = await secondDay.boundingBox()
  expect(planBox).not.toBeNull()
  expect(targetBox).not.toBeNull()
  if (!planBox || !targetBox) return

  const startX = planBox.x + planBox.width / 2
  const startY = planBox.y + planBox.height / 2
  const targetX = targetBox.x + targetBox.width / 2
  const targetY = targetBox.y + 24

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 10, startY + 10, { steps: 3 })
  await page.waitForTimeout(120)

  const cardBox = await planButton.evaluate((element) => {
    const article = element.closest('article')
    if (!article) return null
    const rect = article.getBoundingClientRect()
    return { x: rect.x, y: rect.y }
  })
  const preview = page.locator('[data-drag-preview]')
  await expect(preview).toBeVisible()
  const previewBox = await preview.boundingBox()
  expect(cardBox).not.toBeNull()
  expect(previewBox).not.toBeNull()
  if (cardBox && previewBox) {
    expect(Math.abs(previewBox.x - cardBox.x)).toBeLessThan(24)
    expect(Math.abs(previewBox.y - cardBox.y)).toBeLessThan(24)
  }

  await page.mouse.move(targetX, targetY, { steps: 15 })
  await page.waitForTimeout(120)
  await page.mouse.up()

  await expect(secondDay.getByRole('button', { name: 'View Move me' })).toBeVisible()
  await expect(firstDay.getByRole('button', { name: 'View Move me' })).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('on touch, only the plan grip starts a drag', async ({ page }) => {
  await onboard(page, 'Touch')
  const dayOne = localDayKey(0)
  const dayTwo = localDayKey(1)
  await createTrip(page, 'Touch trip', dayOne, dayTwo)

  const firstDay = page.locator(`[data-day-date="${dayOne}"]`)
  const secondDay = page.locator(`[data-day-date="${dayTwo}"]`)

  await firstDay.getByRole('button', { name: /^Add a plan on/ }).click()
  await page.getByLabel('What is it?').fill('Touch plan')
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(firstDay.getByRole('button', { name: 'View Touch plan' })).toBeVisible()
  await expect(page.getByText('Trip created. Time to fill the days.')).toBeHidden({ timeout: 6000 })

  const client = await page.context().newCDPSession(page)
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) => {
    await client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: x ?? 0, y: y ?? 0 }],
    })
  }
  const touchDrag = async (startX: number, startY: number, targetX: number, targetY: number) => {
    await touch('touchStart', startX, startY)
    await page.waitForTimeout(120)
    await touch('touchMove', startX + 10, startY + 10)
    await page.waitForTimeout(120)
    await touch('touchMove', targetX, targetY)
    await page.waitForTimeout(120)
    await touch('touchEnd')
  }

  await page.evaluate(() => window.scrollTo(0, 400))
  await firstDay.scrollIntoViewIfNeeded()

  const cardBox = await firstDay.getByRole('button', { name: 'View Touch plan' }).boundingBox()
  const firstTarget = await secondDay.boundingBox()
  expect(cardBox).not.toBeNull()
  expect(firstTarget).not.toBeNull()
  if (!cardBox || !firstTarget) return

  await touchDrag(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2,
    firstTarget.x + firstTarget.width / 2,
    firstTarget.y + 24,
  )

  await expect(firstDay.getByRole('button', { name: 'View Touch plan' })).toBeVisible()
  await expect(secondDay.getByRole('button', { name: 'View Touch plan' })).toHaveCount(0)

  await page.evaluate(() => window.scrollTo(0, 400))
  await firstDay.scrollIntoViewIfNeeded()

  const gripBox = await page.getByRole('button', { name: 'Reorder Touch plan' }).boundingBox()
  const secondTarget = await secondDay.boundingBox()
  expect(gripBox).not.toBeNull()
  expect(secondTarget).not.toBeNull()
  if (!gripBox || !secondTarget) return

  await touchDrag(
    gripBox.x + gripBox.width / 2,
    gripBox.y + gripBox.height / 2,
    secondTarget.x + secondTarget.width / 2,
    secondTarget.y + 24,
  )

  await expect(secondDay.getByRole('button', { name: 'View Touch plan' })).toBeVisible()
})

test('stacks the time fields on a phone', async ({ page }) => {
  await onboard(page, 'Clock')

  await page.getByLabel('Add a plan', { exact: true }).click()
  await page.getByRole('button', { name: 'Time', exact: true }).click()

  const start = page.getByLabel('Start time', { exact: true })
  const end = page.getByLabel('End time', { exact: true })
  const startBox = await start.boundingBox()
  const endBox = await end.boundingBox()

  expect(startBox).not.toBeNull()
  expect(endBox).not.toBeNull()
  if (!startBox || !endBox) return

  expect(startBox.x).toBeCloseTo(endBox.x, 0)
  expect(startBox.y + startBox.height).toBeLessThanOrEqual(endBox.y + 1)
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

test('shows every trip that is active today on the dashboard', async ({ page }) => {
  await onboard(page, 'Traveler')

  await createTrip(page, 'Trip A', localDayKey(0), localDayKey(1))
  await createTrip(page, 'Trip B', localDayKey(0), localDayKey(2))

  await page.goto('/')
  await expect(page.getByRole('link', { name: /Trip A/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Trip B/ })).toBeVisible()
})

test('uses start, any-time, and end timing across multi-day plan instances', async ({ page }) => {
  await onboard(page, 'Long')
  await createTrip(page, 'Long trip', localDayKey(0), localDayKey(2))

  const openEditor = () =>
    page.locator('main').getByRole('button', { name: 'Add a plan', exact: true }).first().click()

  await openEditor()
  await page.getByLabel('What is it?').fill('Timed journey')
  await page.getByRole('button', { name: 'Multi-day' }).click()
  await page.locator('#activity-date').fill(localDayKey(0))
  await page.locator('#activity-end-date').fill(localDayKey(2))
  await page.getByRole('button', { name: 'Time', exact: true }).click()
  await page.getByLabel('Start time', { exact: true }).fill('12:30')
  await page.getByLabel('End time', { exact: true }).fill('17:30')
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'View Timed journey' }).first()).toBeVisible()

  await openEditor()
  await page.getByLabel('What is it?').fill('Evening plan')
  await page.getByRole('button', { name: 'Multi-day' }).click()
  await page.locator('#activity-date').fill(localDayKey(0))
  await page.locator('#activity-end-date').fill(localDayKey(2))
  await page.getByRole('button', { name: 'Part of day' }).click()
  await page.getByRole('button', { name: /^Evening/ }).click()
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'View Evening plan' }).first()).toBeVisible()

  const daySection = (day: number) =>
    page.locator('section').filter({ has: page.getByText(`Day ${day}`, { exact: true }) })

  const day1 = daySection(1)
  await expect(day1.getByText('12:30 PM')).toBeVisible()
  await expect(day1.getByText('Evening', { exact: true })).toBeVisible()
  await expect(day1.getByText('Any time')).toHaveCount(0)

  const day2 = daySection(2)
  await expect(day2.getByText('Any time')).toHaveCount(2)

  const day3 = daySection(3)
  await expect(day3.getByText('5:30 PM')).toBeVisible()
  await expect(day3.getByText('Any time')).toHaveCount(1)
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

test('builds a packing list, checks items off, and keeps it after reload', async ({ page }) => {
  await onboard(page, 'Packer')
  await createTrip(page, 'Packing trip', localDayKey(2), localDayKey(4))

  await page.getByRole('link', { name: 'Open packing list for Packing trip' }).click()
  await expect(page.getByRole('heading', { name: 'Packing', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Add essentials' }).click()
  await expect(page.getByRole('button', { name: 'Mark Passport or ID as packed' })).toBeVisible()

  await page.getByLabel('Packing item').fill('Camera')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Camera' })).toBeVisible()

  await page.getByRole('button', { name: 'Mark Camera as packed' }).click()
  await expect(page.getByRole('button', { name: 'Mark Camera as not packed' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.reload()
  await expect(page.getByRole('button', { name: 'Mark Camera as not packed' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.getByRole('button', { name: 'Back to trip' }).click()
  await expect(page.getByText('1 of 15 items packed')).toBeVisible()

  const packingUrl = `${page.url()}/packing`
  await page.getByRole('link', { name: 'More' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download backup/ }).click()
  const download = await downloadPromise
  const backupPath = test.info().outputPath('packing-backup.json')
  await download.saveAs(backupPath)
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.packingItems).toHaveLength(15)

  await page.goto(packingUrl)
  await page.getByLabel('Packing item').fill('Erased item')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Erased item' })).toBeVisible()

  await page.goto('/settings')
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(backupPath)
  await page.getByRole('button', { name: 'Restore backup' }).click()
  await expect(page.getByText(/Backup restored/)).toBeVisible()

  await page.goto(packingUrl)
  await expect(page.getByRole('button', { name: 'Edit Erased item' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mark Camera as not packed' })).toBeVisible()
})

test('opens PDF attachments in the in-app viewer', async ({ page, context }) => {
  await onboard(page, 'PDF')
  await page.getByLabel('Add a plan', { exact: true }).click()
  await page.getByLabel('What is it?').fill('PDF plan')
  await page.locator('input[type="file"]').setInputFiles(path.resolve('tests/fixtures/sample.pdf'))
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await page.getByRole('button', { name: 'View PDF plan' }).click()
  await page.getByRole('button', { name: 'Open sample.pdf' }).click()

  await expect(page.locator('canvas[aria-label="sample.pdf page 1"]')).toBeVisible()
  await expect(page.getByText('This PDF could not be displayed. You can download it instead.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Close viewer' }).click()

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
  await page.getByRole('button', { name: 'View PDF plan' }).click()
  await page.getByRole('button', { name: 'Open sample.pdf' }).click()
  await expect(page.locator('canvas[aria-label="sample.pdf page 1"]')).toBeVisible()
  await context.setOffline(false)
})

test('shows per-city weather, plan weather, and cached weather offline', async ({ page, context }) => {
  await page.route('**/api/geocode**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })
  await page.route('**/api/weather**', async (route) => {
    const url = new URL(route.request().url())
    const name = url.searchParams.get('name') ?? 'Destination'
    const start = url.searchParams.get('start') ?? localDayKey(0)
    const days = [0, 1, 2].map((offset) => {
      const date = localDayKey(offset)
      const climate = offset === 2
      return {
        date,
        mode: climate ? 'climate' : 'forecast',
        available: true,
        weatherCode: climate ? 3 : offset === 1 ? 61 : 0,
        tempMax: name === 'Porto' ? 18 - offset : 22 - offset,
        tempMin: name === 'Porto' ? 11 - offset : 14 - offset,
        precipProbability: climate ? 40 : offset === 1 ? 60 : 10,
        precipSum: offset === 1 ? 2 : 0,
        windMax: 14,
        uvMax: climate ? null : 4,
        sunrise: climate ? null : `${date}T07:00`,
        sunset: climate ? null : `${date}T18:00`,
        rainYears: climate ? 2 : undefined,
        climateYears: climate ? 5 : undefined,
      }
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name,
        country: 'Portugal',
        admin1: name === 'Porto' ? 'Porto District' : 'Lisbon District',
        latitude: name === 'Porto' ? 41.15 : 38.72,
        longitude: name === 'Porto' ? -8.61 : -9.14,
        timezone: 'Europe/Lisbon',
        days,
        hourly: [
          {
            time: `${start}T18:00`,
            temp: name === 'Porto' ? 16 : 20,
            weatherCode: 0,
            precipProbability: 5,
            windSpeed: 10,
            isDay: true,
          },
          {
            time: `${start}T19:00`,
            temp: name === 'Porto' ? 15 : 19,
            weatherCode: 0,
            precipProbability: 5,
            windSpeed: 9,
            isDay: true,
          },
        ],
        current: {
          time: `${start}T18:00`,
          temp: name === 'Porto' ? 17 : 21,
          feelsLike: name === 'Porto' ? 16 : 20,
          weatherCode: name === 'Porto' ? 3 : 0,
          windSpeed: 10,
          isDay: true,
        },
        fetchedAt: Date.now(),
        attribution: { name: 'Open-Meteo', url: 'https://open-meteo.com/' },
      }),
    })
  })

  await onboard(page, 'Weather')
  await page.getByRole('link', { name: 'Trips' }).click()
  await page.getByRole('button', { name: 'New trip' }).click()
  await page.getByLabel('Trip name').fill('Weather trip')
  const destination = page.getByLabel('Destination')
  await destination.fill('Lisbon')
  await page.keyboard.press('Enter')
  await destination.fill('Porto')
  await page.keyboard.press('Enter')
  await page.locator('#trip-start').fill(localDayKey(0))
  await page.locator('#trip-end').fill(localDayKey(2))
  await page.getByRole('button', { name: 'Create trip' }).click()

  await expect(page.getByRole('heading', { name: 'Weather trip' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open weather details for Lisbon' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open weather details for Porto' })).toBeVisible()
  await expect(page.getByText('Trip average').first()).toBeVisible()
  await expect(page.getByText('Rain likely on 2 of 3 days').first()).toBeVisible()

  await page.getByRole('button', { name: 'Open weather details for Lisbon' }).click()
  await expect(page.getByRole('heading', { name: 'Weather in Lisbon' })).toBeVisible()
  await expect(page.getByText('Next few hours')).toBeVisible()
  await expect(page.getByText('Typical', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).last().click()

  await page.locator('main').getByRole('button', { name: 'Add a plan', exact: true }).first().click()
  await page.getByLabel('What is it?').fill('Sunset walk')
  await page.getByLabel('Location', { exact: true }).selectOption({ label: 'Lisbon' })
  await page.getByLabel('Address or place').fill('Miradouro')
  await page.getByRole('button', { name: 'Time', exact: true }).click()
  await page.getByLabel('Start time', { exact: true }).fill('18:30')
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await page.getByRole('button', { name: 'View Sunset walk' }).click()
  await expect(page.getByText(/Forecast · Lisbon/)).toBeVisible()

  await page.getByRole('button', { name: 'Close', exact: true }).last().click()
  const dayWeather = page.getByRole('group', { name: /Weather for/ }).first()
  await expect(dayWeather.getByText('Lisbon')).toBeVisible()
  await expect(dayWeather.getByText('Porto')).toHaveCount(0)

  await page.locator('main').getByRole('button', { name: 'Add a plan', exact: true }).first().click()
  await page.getByLabel('What is it?').fill('Unlocated plan')
  await page.getByLabel('Date', { exact: true }).fill(localDayKey(1))
  await page.getByRole('button', { name: 'Add plan', exact: true }).click()
  await expect(
    page.getByText("Add a location to this day's plans to see the weather."),
  ).toBeVisible()

  await page.goto(`/calendar?date=${localDayKey(0)}`)
  await expect(page.getByText(/72° \/ 57°/)).toBeVisible()

  await page.getByRole('link', { name: 'Today', exact: true }).click()
  await expect(page.getByText(/Lisbon \d+°/)).toBeVisible()
  await expect(page.getByText(/Porto \d+°/)).toBeVisible()

  await page.getByRole('link', { name: 'Trips' }).click()
  await page.getByRole('link', { name: /Weather trip/ }).click()
  await page.getByRole('link', { name: 'Open packing list for Weather trip' }).click()
  await expect(page.getByText('Weather suggests')).toBeVisible()
  await page.getByRole('button', { name: 'Umbrella', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Umbrella' })).toBeVisible()
  await page.getByRole('link', { name: 'Today', exact: true }).click()
  await expect(page.getByText(/Lisbon \d+°/)).toBeVisible()

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
  await expect(page.getByText(/Lisbon \d+°/)).toBeVisible()
  await context.setOffline(false)
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
  await page.getByLabel('Address or place').fill('Gion')
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

  await page.getByRole('link', { name: 'Open packing list for Kyoto escape' }).click()
  await page.getByRole('button', { name: 'Electronics', exact: true }).click()
  await page.getByLabel('Packing item').fill('Pocket wifi')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Pocket wifi' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to trip' }).click()

  await page.getByRole('link', { name: 'Search everything' }).click()
  const searchbox = page.getByRole('searchbox')
  await expect(searchbox).toBeVisible()

  await searchbox.fill('Kyoto')
  await expect(page.getByRole('link', { name: 'Open trip Kyoto escape' })).toBeVisible()

  await searchbox.fill('Pocket wifi')
  await expect(page.getByRole('link', { name: 'Open packing item Pocket wifi' })).toBeVisible()

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
