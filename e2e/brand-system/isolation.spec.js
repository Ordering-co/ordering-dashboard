import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect, fixtureUrl } from './fixtures'

// the rendered contracts these tests compare against are test baselines, kept in e2e/brand-system/baselines/.
// The dated evidence they came from (captures, logs, diffs) is in the tag archive/redesign-evidence-2026-10-27.
// The L0/L1 contracts are no longer read: every surface below is owned by the L2 feedback or the redesign boot contract.
// A capture's screenshots go to the git-ignored .local/redesign-evidence/; only the JSON baselines are versioned.
const evidence = resolve('.local/redesign-evidence/brand-system/l0-l1')
// C5 deliberately adopts these former nonpilot surfaces. Keep L0/L1 evidence
// immutable and version their complete rendered contract with the new owners.
const feedbackEvidence = resolve('e2e/brand-system/baselines/l2-feedback')
// redesign Q2-09 (386740ca, db497d81): the Home boot skeleton marks the screen it stands for (data-screen) and its
// sidebar is the real one's 248px (--od-x-sidebar, preservation boot-layout-afce4cf5), not 240px. As C5 did, the L0/L1
// evidence stays immutable and the redesign owns the new complete contract of the two Home densities. It was recorded
// with BRAND_CAPTURE_BASELINE=1 and diffed against L0/L1 property by property: only data-screen and the widths and
// origins that follow the 8px of the sidebar changed (redesign/pilot-orders/evidence/e2e-stage-close.md in the archive tag).
// bugs H #76a (aea9ea87d) gave the skeleton's content column data-testid='boot-content' (and makes it a
// div inside the shell, which these standalone densities are not). Re-recorded the same way; the only difference in
// the four files is that attribute on the <main>, and the four screenshots are byte-identical
// (redesign/pages/brand-specs-drift-3/evidence/boot-contract-diff.txt in the archive tag).
const redesignEvidence = resolve('e2e/brand-system/baselines/boot-loader')
const shots = resolve('.local/redesign-evidence/brand-system/contracts')
const capture = process.env.BRAND_CAPTURE_BASELINE === '1'
const production = process.env.BRAND_HARNESS_PRODUCTION === '1'

const settleContract = page => page.evaluate(async () => {
  await document.fonts.ready
  await Promise.all([...document.querySelectorAll('#root img')].map(image => image.decode()))
  document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 0 })
})

// The only compiled asset this ever rewrote was the old 404 page image (alt 'error404'), removed with the origin theme; no
// compared surface renders it any more. What remains: never replace a historical development baseline with compiled output.
const normalizeCompiledAssets = async (page, contract) => {
  if (production) expect(capture, 'Historical development baselines must not be replaced by compiled output').toBe(false)
  return contract
}

// Classes are stylesheet implementation IDs; semantic DOM and every computed
// property (including pseudo elements) are compared, not just visible text.
export const renderedContract = async page => page.locator('#root').evaluate(root => {
  const styles = []
  const ids = new Map()
  const style = (element, pseudo) => {
    const computed = getComputedStyle(element, pseudo)
    const value = Object.fromEntries([...computed].map(key => [key, computed.getPropertyValue(key)]))
    const key = JSON.stringify(value)
    if (!ids.has(key)) { ids.set(key, styles.length); styles.push(value) }
    return ids.get(key)
  }
  const elements = [...root.querySelectorAll('*')].map(element => ({
    tag: element.tagName,
    attributes: Object.fromEntries([...element.attributes].filter(attr => attr.name !== 'class').map(attr => [attr.name, attr.value])),
    text: [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(''),
    children: element.children.length,
    style: style(element),
    before: style(element, '::before'),
    after: style(element, '::after')
  }))
  return { elements, styles }
})

for (const width of [1440, 390]) {
  for (const surface of ['control', 'legacy-full', 'legacy-light', 'legacy-spinner']) {
    const adopted = surface === 'control' || surface === 'legacy-spinner'
    const redesigned = surface === 'legacy-full' || surface === 'legacy-light'
    test(`${surface} matches ${adopted ? 'L2 feedback' : redesigned ? 'redesign boot' : 'L0/L1'} contract at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const query = surface === 'control' ? 'surface=control' : surface === 'legacy-spinner' ? 'variant=spinner' : 'density=' + surface.replace('legacy-', '')
      await page.goto(fixtureUrl(query))
      await expect(page.locator('#root > *')).toBeVisible()
      // Freeze any remaining timeline at the same instant for an exact comparison.
      await settleContract(page)
      const actual = await normalizeCompiledAssets(page, await renderedContract(page))
      const owner = adopted ? feedbackEvidence : redesigned ? redesignEvidence : evidence
      const path = resolve(owner, `${surface}-${width}.json`)
      if (capture) {
        expect(adopted || redesigned, 'Historical L0/L1 baselines must not be regenerated').toBe(true)
        writeFileSync(path, JSON.stringify(actual) + '\n')
        await page.screenshot({ path: resolve(shots, `${surface}-${width}.png`) })
      } else expect(actual).toEqual(JSON.parse(readFileSync(path, 'utf8')))
    })
  }
}

for (const width of [1440, 390]) {
  for (const mode of ['light', 'dark']) {
    test(`feedback control stays isolated beside ${mode} pilot at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(fixtureUrl(`surface=control&mounted=${mode}&density=full`))
      await expect(page.locator('#brand-sibling [data-testid="boot-home"]')).toBeVisible()
      await settleContract(page)
      expect(await normalizeCompiledAssets(page, await renderedContract(page))).toEqual(JSON.parse(readFileSync(resolve(feedbackEvidence, `control-${width}.json`), 'utf8')))
    })
  }
}
