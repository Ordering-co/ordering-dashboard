import { test, expect, fixtureUrl } from './fixtures'
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names this spec looks up changed.

const campaignState = page => page.getByTestId('c4-campaign-events').evaluate(element => JSON.parse(element.textContent))
const dayButton = (scope, day) => scope
  .locator('button.rdrDay:not(.rdrDayPassive):not(.rdrDayDisabled)')
  .filter({ hasText: new RegExp(`^${day}$`) })

test('real CampaignSignUpOption preserves single withTime payloads and prop resync', async ({ page }) => {
  await page.goto(fixtureUrl('surface=c4-linked-consumers&consumer=campaign&condition=single&mode=light&fixtureUserLevel=0'))
  await expect(page.getByRole('heading', { name: 'Customer sign-up date', exact: true })).toBeVisible()
  await expect(page.getByText('Before', { exact: true })).toBeVisible()
  const trigger = page.getByRole('button', { name: '15 Jun, 2024', exact: true })
  await trigger.click()
  const calendar = page.getByRole('dialog', { name: 'Select a date', exact: true })
  await expect(calendar.locator('.rdrCalendarWrapper')).toBeVisible()
  await dayButton(calendar, 18).click()

  await expect.poll(async () => (await campaignState(page)).events).toEqual([
    { kind: 'single', args: ['2024-06-18 00:00:00'] }
  ])
  expect((await campaignState(page)).ruleFormState.changes).toEqual({
    type: 'signup_date',
    date_condition: '<',
    date: '2024-06-18 00:00:00',
    max_date: null
  })

  await page.getByRole('button', { name: 'Resync campaign date props', exact: true }).click()
  await expect(page.getByRole('button', { name: '20 Jul, 2024', exact: true })).toBeVisible()
  await expect.poll(async () => (await campaignState(page)).ruleFormState.changes).toEqual({
    type: 'signup_date',
    date_condition: '<',
    date: '2024-07-20T12:00:00',
    max_date: null
  })
  expect((await campaignState(page)).events).toEqual([{ kind: 'single', args: ['2024-06-18 00:00:00'] }])
})

test('real CampaignSignUpOption preserves range payload arity and prop resync', async ({ page }) => {
  await page.goto(fixtureUrl('surface=c4-linked-consumers&consumer=campaign&condition=range&mode=dark&fixtureUserLevel=0'))
  await expect(page.getByText('Date range', { exact: true })).toBeVisible()
  const trigger = page.getByRole('button', { name: '10 - 12 Jun, 2024', exact: true })
  await trigger.click()
  const calendar = page.getByRole('dialog', { name: 'Select Date Range', exact: true })
  await expect(calendar.locator('.rdrDateRangeWrapper')).toBeVisible()
  await dayButton(calendar, 18).click()

  await expect.poll(async () => (await campaignState(page)).events).toEqual([
    { kind: 'range', args: ['2024-06-18', '2024-06-18'] }
  ])
  expect((await campaignState(page)).ruleFormState.changes).toEqual({
    type: 'signup_date',
    date_condition: '><',
    date: '2024-06-18 00:00:00',
    max_date: '2024-06-18 00:00:00'
  })

  await page.getByRole('button', { name: 'Resync campaign date props', exact: true }).click()
  await expect(page.getByRole('button', { name: '21 - 23 Jul, 2024', exact: true })).toBeVisible()
  await expect.poll(async () => (await campaignState(page)).ruleFormState.changes).toEqual({
    type: 'signup_date',
    date_condition: '><',
    date: '2024-07-21T12:00:00',
    max_date: '2024-07-23T12:00:00'
  })
  expect((await campaignState(page)).events).toEqual([{ kind: 'range', args: ['2024-06-18', '2024-06-18'] }])
})
