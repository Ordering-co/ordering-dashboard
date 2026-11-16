import { test, expect, fixtureUrl } from './fixtures'

const events = page => page.evaluate(() => globalThis.__OD_SCHEDULE_CONSUMER_EVENTS__ || [])

test('real business schedule serializes changed days through its actual save controller', async ({ page }) => {
  await page.goto(fixtureUrl('surface=schedule-consumers&mode=light'))
  const business = page.getByTestId('schedule-business')
  // Outside the tutorial the schedule saves through the Product SaveBar, drawn from the first change.
  // With nothing changed there is no Save to press (was: a disabled Save), and the save controller has not been called.
  const bar = business.getByRole('group', { name: 'Save changes', exact: true })
  // review R-1: the absences below are only meaningful once the editor is on screen
  await expect(business.getByRole('switch', { name: 'Schedule: Monday', exact: true })).toBeVisible()
  await expect(bar).toHaveCount(0)
  await expect(business.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  await business.getByRole('switch', { name: 'Schedule: Monday', exact: true }).check()
  await expect(bar).toContainText('1 unsaved change · Schedule')
  await expect(bar.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  expect((await events(page)).filter(event => event.type === 'business-save')).toEqual([])
  await bar.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(async () => (await events(page)).filter(event => event.type === 'business-save').length).toBe(1)
  const saved = (await events(page)).find(event => event.type === 'business-save').value
  expect(saved.id).toBe(701)
  expect(saved.options).toEqual({ accessToken: 'synthetic-schedule-token' })
  expect(Object.keys(saved.changes)).toEqual(['schedule'])
  const schedule = JSON.parse(saved.changes.schedule)
  expect(schedule).toHaveLength(7)
  expect(schedule.map(day => day.enabled)).toEqual([true, true, false, false, false, false, false])
  expect(schedule[1].lapses).toEqual([{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }])
  // Stored: nothing left to save (was: Save disabled again), the bar says so, and a second save cannot be sent.
  await expect(bar.getByRole('status')).toHaveText('Saved')
  await expect(business.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  expect((await events(page)).filter(event => event.type === 'business-save')).toHaveLength(1)
})

test('real promotion schedule emits its unchanged schedule object and Done arguments', async ({ page }) => {
  await page.goto(fixtureUrl('surface=schedule-consumers&mode=light'))
  const promotion = page.getByTestId('schedule-promotion')
  await promotion.getByRole('checkbox').nth(2).check()
  await expect.poll(async () => (await events(page)).filter(event => event.type === 'promotion-change').length).toBe(1)
  const changed = (await events(page)).find(event => event.type === 'promotion-change').value
  expect(Object.keys(changed)).toEqual(['schedule'])
  expect(changed.schedule.map(day => day.enabled)).toEqual([true, false, true, false, false, false, false])
  await promotion.getByRole('button', { name: 'Done', exact: true }).click()
  expect((await events(page)).filter(event => event.type === 'promotion-done')).toEqual([{ type: 'promotion-done', value: [] }])
})
