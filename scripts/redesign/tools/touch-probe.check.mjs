// redesign W0-8e (T0-34) · browser check for touch-probe.mjs. Own chromium, no server, no live session.
// Usage: node scripts/redesign/tools/touch-probe.check.mjs   (exit 1 if any case is not as expected)
// jsdom has no layout, so elementFromPoint needs a real browser: a static page with four cases.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from '@playwright/test'
import { touchProbeSource, TOUCH_CONTROLS_SELECTOR } from './touch-probe.mjs'

const here = dirname(fileURLToPath(import.meta.url))

const html = `<!doctype html><meta name="viewport" content="width=device-width">
<style>
  body { margin: 0 }
  button { position: absolute; margin: 0; padding: 0; border: 1px solid #888; background: #eee; width: 32px; height: 32px }
  button.area::after { content: ''; position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; transform: translate(-50%, -50%) }
  button.big { width: 44px; height: 44px }
  /*  fila 47: a frame owns the 44px area of its select, as .odc-time-field-part does */
  .odc-time-field-part { position: absolute; display: block; width: 60px; height: 32px }
  .odc-time-field-part::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 44px; transform: translateY(-50%) }
  .odc-time-field-part select { position: relative; z-index: 1; display: block; margin: 0; width: 60px; height: 32px }
  .wrapper { position: absolute; padding: 10px; background: #fafafa }
</style>
<button id="a-bare" aria-label="a" style="left:100px;top:100px"></button>
<button id="b-area" class="area" aria-label="b" style="left:100px;top:200px"></button>
<button id="c-left" class="area" aria-label="c1" style="left:100px;top:300px"></button>
<button id="c-right" class="area" aria-label="c2" style="left:136px;top:300px"></button>
<button id="d-big" class="big" aria-label="d" style="left:100px;top:400px"></button>
<span class="odc-time-field-part" style="left:100px;top:500px"><select id="e-framed" aria-label="e"><option>1</option></select></span>
<div class="wrapper" style="left:100px;top:600px"><button id="f-wrapped" aria-label="f" style="position:static"></button></div>`

const sel = id => 'button#' + id
let failures = 0
const expect = (name, cond, detail) => {
  console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(detail)))
  if (!cond) failures++
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.setContent(html)
  // Same round trip measure.mjs uses in the live session: text -> new Function -> evaluate.
  // eslint-disable-next-line no-new-func -- intentional: this is exactly what measure.mjs does inside the session
  const probe = new Function('return (' + touchProbeSource + ')')()
  const res = await page.evaluate(probe, { items: true })
  console.log(JSON.stringify(res, null, 1))
  const by = Object.fromEntries(res.items.map(i => [i.selector.split('[')[0], i]))

  const a = by[sel('a-bare')]
  expect('(a) 32px button without area fails reach on all four sides', a && a.failedSides.join() === 'up,down,left,right', a)
  const b = by[sel('b-area')]
  expect('(b) 32px button with centered 44px ::after reaches 44', b && b.failedSides.length === 0 && b.crossed.length === 0, b)
  expect('(b) visible box stays 32x32 (the area does not grow it)', b && b.w === 32 && b.h === 32, b)
  const c1 = by[sel('c-left')]
  expect('(c) two areas 4px apart cross', res.crossings.count === 1 && c1 && c1.crossed.some(x => x.with.includes('c-right')), { crossings: res.crossings, c1 })
  expect('(c) the crossing is reported as a failed reach on the crossed side', c1 && c1.failedSides.includes('right'), c1)
  expect('(c) no crossing at all among a, b and d', res.crossings.samples.every(s => s.selector.includes('c-') || s.with.includes('c-')), res.crossings)
  const d = by[sel('d-big')]
  expect('(d) 44px button reaches without an area', d && d.failedSides.length === 0 && d.crossed.length === 0, d)
  // fila 47: the frame's area counts for the control it focuses; any other container does not
  const e = by['select#e-framed']
  expect('(e) 32px select whose frame has the 44px area reaches 44', e && e.failedSides.length === 0 && e.crossed.length === 0, e)
  const f = by[sel('f-wrapped')]
  expect('(f) 32px button inside a padded container that is not a frame fails up and down', f && f.failedSides.includes('up') && f.failedSides.includes('down'), f)
  expect('summary: 7 controls, 4 reach (b, c2, d, e), 3 fail (a, c1, f)', res.controls === 7 && res.reach44.ok === 4 && res.reach44.fail === 3, res.reach44)
  expect('visibleBox: six 32px boxes, one 44', res.visibleBox.at32 === 6 && res.visibleBox.atLeast44 === 1, res.visibleBox)

  // The selector shipped to measure.mjs must stay the one measure.mjs uses for `controls`.
  const measure = readFileSync(join(here, 'measure.mjs'), 'utf8')
  expect('selector matches measure.mjs controls selector', measure.includes("querySelectorAll('" + TOUCH_CONTROLS_SELECTOR + "')"), TOUCH_CONTROLS_SELECTOR)
  // And the probe's own default must be that selector.
  expect('probe default selector equals TOUCH_CONTROLS_SELECTOR', touchProbeSource.includes("'" + TOUCH_CONTROLS_SELECTOR + "'"), null)
} finally {
  await browser.close()
}
console.log(failures ? failures + ' case(s) failed' : 'all cases as expected')
process.exit(failures ? 1 : 0)
