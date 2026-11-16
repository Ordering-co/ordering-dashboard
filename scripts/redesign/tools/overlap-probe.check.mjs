// redesign AH · browser check for overlap-probe.mjs. Own chromium, no server, no live session.
// Usage: node scripts/redesign/tools/overlap-probe.check.mjs   (exit 1 if any case is not as expected)
// jsdom has no layout, so the boxes need a real browser: static pages, one per case, each with what it must (not) report.
// scripts/redesign/gates.mjs runs it as step 8 of every family.
import { chromium } from '@playwright/test'
import { overlapProbeSource, overlapDirtySource, overlapScrollSource } from './overlap-probe.mjs'

const BASE = `<!doctype html><meta name="viewport" content="width=device-width"><style>
  body { margin: 0; font: 16px/20px sans-serif }
  button, a { display: inline-block; margin: 0; padding: 0; border: 0; font: inherit; background: #ddd }
  .abs { position: absolute }
</style>`

// [name, body html, expected pair count, extra check (optional)]
const CASES = [
  ['two buttons crossing by 10px', '<button class="abs" style="left:10px;top:10px;width:60px;height:40px">A</button><button class="abs" style="left:60px;top:10px;width:60px;height:40px">B</button>', 1],
  ['a crossing of exactly 2px does not count', '<button class="abs" style="left:10px;top:10px;width:60px;height:40px">A</button><button class="abs" style="left:68px;top:10px;width:60px;height:40px">B</button>', 0],
  ['side by side, touching, does not count', '<button class="abs" style="left:10px;top:10px;width:60px;height:40px">A</button><button class="abs" style="left:70px;top:10px;width:60px;height:40px">B</button>', 0],
  ['a button over a paragraph', '<p class="abs" style="left:10px;top:10px;width:300px;margin:0">How the dashboard tells staff that a new order arrived.</p><button class="abs" style="left:10px;top:14px;width:60px;height:40px">Save</button>', 1],
  ['the text of a button is its own (descendant)', '<button class="abs" style="left:10px;top:10px;width:120px;height:40px"><span>Save changes</span></button>', 0],
  ['a field with a button inside its box (containment)', '<input class="abs" style="left:10px;top:10px;width:300px;height:40px;box-sizing:border-box"><button class="abs" style="left:270px;top:15px;width:30px;height:30px">x</button>', 0],
  ['a dialog over the page does not count, two buttons crossing inside it do', '<p class="abs" style="left:10px;top:10px;margin:0">Page text under the dialog</p><div role="dialog" class="abs" style="left:0;top:0;width:400px;height:200px;background:#fff"><button class="abs" style="left:10px;top:60px;width:60px;height:40px">OK</button><button class="abs" style="left:50px;top:60px;width:60px;height:40px">Cancel</button></div>', 1],
  ['an opaque sticky header over the content it scrolls past does not count', '<div style="height:300px;overflow:auto" id="s"><div style="position:sticky;top:0;height:40px;background:#fff"><button>Header</button></div><p style="margin:-30px 0 0">Row text under the header</p><div style="height:600px"></div></div>', 0],
  // the owner\'s case: a transparent sticky wrapper with top: 100% slides its Save to the bottom of the card,
  // over the next block of the same card
  ['the owner\'s case: a sticky top:100% Save slid over the next block', '<div style="padding:20px"><div><input placeholder="Title"></div><div style="position:sticky;top:100%"><button style="height:44px">Save</button></div><div><h4 style="margin:0">Dashboard order alerts</h4><p style="margin:0">How the dashboard tells staff that a new order arrived.</p><a href="#x">Edit in Settings</a></div></div>', 3],
  // the arrows of a chip strip overlay its ends on purpose; the strip scrolls under them
  ['an opaque absolute arrow over the end of a scrolling strip does not count', '<div style="position:relative;width:300px"><div style="display:flex;overflow-x:auto;gap:8px"><button style="flex:none;width:120px;height:28px">First chip</button><button style="flex:none;width:120px;height:28px">Second chip</button><button style="flex:none;width:120px;height:28px">Third chip</button></div><button aria-label="Scroll right" style="position:absolute;right:0;top:0;width:28px;height:28px;background:#fff">›</button></div>', 0],
  ['an opaque absolute box over content that does not scroll still counts', '<div style="position:relative"><p style="margin:0">Order total and its taxes</p><span style="position:absolute;left:20px;top:2px;background:#fff">Badge</span></div>', 1],
  // review of AH: the blind spots the fresh review found
  ['an opaque close button inside a fixed panel, over the panel\'s own header button, counts', '<aside style="position:fixed;right:0;top:0;width:390px;height:400px;background:#fff;overflow:auto"><div style="position:absolute;right:20px;top:20px"><button style="width:44px;height:44px;background:#fff">X</button></div><div style="padding:20px 0 0 20px;display:flex;justify-content:flex-end;padding-right:55px"><button style="width:109px;height:42px">Add API Key</button></div></aside>', 1],
  ['the owner\'s case with an opaque sticky wrapper (pushed to the bottom of its card, not stuck) still counts', '<div style="padding:20px"><div><input placeholder="Title"></div><div style="position:sticky;top:100%;background:#fff"><button style="height:44px">Save</button></div><div><h4 style="margin:0">Dashboard order alerts</h4><p style="margin:0">How the dashboard tells staff that a new order arrived.</p><a href="#x">Edit in Settings</a></div></div>', 3],
  ['an absolute badge escaping an overflow-hidden box that is not its containing block counts', '<div style="position:relative"><div style="overflow:hidden;height:20px;width:300px"><span style="position:absolute;left:120px;top:30px;background:#fff;white-space:nowrap">Badge with a long label</span></div><p style="margin:0;position:absolute;left:10px;top:30px">Text under the badge</p></div>', 1],
  ['an opaque sticky first column over the cells that scroll under it does not count', '<div id="t" style="width:300px;overflow-x:auto"><div style="display:flex;width:900px"><div style="position:sticky;left:0;width:120px;flex:none;background:#fff">Driver name</div><div style="display:flex;gap:4px;margin-left:-60px"><button style="flex:none;width:96px;height:30px">Add shift</button></div></div></div>', 0],
  ['the page under a fixed panel does not count against the save bar inside the panel', '<p style="margin:0;padding-top:300px">List row under the panel</p><aside style="position:fixed;inset:0 0 0 auto;width:400px;background:#fff;overflow:auto"><div style="height:250px">Panel</div><div style="position:sticky;bottom:0;background:#fff;height:60px"><button style="height:32px">Save</button></div></aside>', 0],
  // the drivers-group form: a sticky bar with bottom: 0 in a scroller with 32px of end padding stops 32px short of
  // the foot; the list shows under it and what it covers counts. Giving the padding back (a negative inset) makes it flush.
  ['a sticky bar that stops short of its scroller\'s foot (end padding) counts', '<div style="height:300px;overflow:auto;padding-bottom:32px;box-sizing:border-box"><p style="margin:0;height:220px">Top</p><p style="margin:0;line-height:20px">Ethan Brooks</p><p style="margin:0;height:400px"></p><div style="position:sticky;bottom:0;background:#fff;height:40px"><button style="height:40px;width:300px">Save</button></div></div>', 1],
  ['the same bar giving the padding back (flush with the foot) does not count', '<div style="height:300px;overflow:auto;padding-bottom:32px;box-sizing:border-box"><p style="margin:0;height:250px">Top</p><p style="margin:0;line-height:20px">Ethan Brooks</p><p style="margin:0;height:400px"></p><div style="position:sticky;bottom:-32px;background:#fff;height:40px"><button style="height:40px;width:300px">Save</button></div></div>', 0],
  ['two opaque sticky columns stacked at the right of a table do not count against the cells under them', '<div style="width:400px;overflow-x:auto"><div style="display:flex;width:900px"><div style="flex:none;width:700px;text-align:right"><span style="white-space:nowrap">$ 200.00 · max</span></div><div style="position:sticky;right:68px;flex:none;width:66px;background:#fff"><button role="switch" aria-label="Enable" style="width:32px;height:24px">e</button></div><div style="position:sticky;right:0;flex:none;width:68px;background:#fff"><button aria-label="Actions" style="width:32px;height:32px">⋯</button></div></div></div>', 0],
  // /stores/add: the page scrolls on the document and the shell's <main> is display: contents with overflow hidden (no box)
  ['a sticky bar flush with the window foot does not count, past a display: contents ancestor', '<main style="display:contents;overflow:hidden"><div><p style="margin:0;height:1200px">Form</p></div><div style="position:sticky;bottom:0;background:#fff;height:56px;margin-top:-600px"><button style="height:44px">Create store</button></div><p style="margin:0">Google Pay</p></main>', 0],
  ['hidden nodes do not count (visibility, opacity, display)', '<button class="abs" style="left:10px;top:10px;width:60px;height:40px">A</button><button class="abs" style="left:20px;top:10px;width:60px;height:40px;visibility:hidden">B</button><button class="abs" style="left:20px;top:10px;width:60px;height:40px;opacity:0">C</button><button class="abs" style="left:20px;top:10px;width:60px;height:40px;display:none">D</button>', 0],
  ['a box clipped away by its overflow-hidden parent does not count', '<div class="abs" style="left:10px;top:10px;width:100px;height:40px;overflow:hidden"><button style="width:60px;height:40px">A</button><button class="abs" style="left:0;top:60px;width:60px;height:40px">B</button></div><button class="abs" style="left:10px;top:70px;width:60px;height:40px">C</button>', 0],
  ['an ancestor with display: contents clips nothing', '<div style="display:contents;overflow:hidden"><button class="abs" style="left:10px;top:10px;width:60px;height:40px">A</button><button class="abs" style="left:40px;top:10px;width:60px;height:40px">B</button></div>', 1],
  ['a closed drawer off the viewport sideways does not count', '<nav class="abs" style="left:0;top:0;width:280px;transform:translateX(-100%)"><button style="width:200px;height:40px">Menu item</button></nav><button class="abs" style="left:-150px;top:0;width:200px;height:40px">Peek</button>', 0],
  ['wrapped text: each line is its own box', '<p class="abs" style="left:10px;top:10px;width:120px;margin:0">one two three four five six seven</p><button class="abs" style="left:100px;top:10px;width:60px;height:18px">Tag</button>', 1]
]

let failures = 0
const expect = (name, cond, detail) => {
  console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(detail).slice(0, 600)))
  if (!cond) failures++
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 600 } })
  // Same round trip the drivers use in the live session: text -> new Function -> evaluate.
  // eslint-disable-next-line no-new-func -- intentional: this is exactly what measure.mjs and overlap-sweep.mjs do
  const probe = new Function('return (' + overlapProbeSource + ')')()
  for (const [name, body, count] of CASES) {
    await page.setContent(BASE + body)
    const res = await page.evaluate(probe, {})
    expect(`${name}: ${count} pair(s)`, res.count === count, res)
  }

  // the owner's case names the pairs: Save × the heading, × the help text and × the link (live, the heading is just above it)
  await page.setContent(BASE + CASES.find(c => c[0].startsWith('the owner'))[1])
  const owner = await page.evaluate(probe, {})
  expect('owner\'s case: Save crosses the help text and the link', ['Edit in Settings × Save', 'How the dashboard tells staff that a new × Save'].every(want => owner.pairs.some(p => [p.a.text, p.b.text].sort().join(' × ') === want)), owner.pairs)
  expect('owner\'s case: each pair has selectors, boxes and a stable key', owner.pairs.every(p => p.key === p.a.selector + ' × ' + p.b.selector && p.a.box.w > 0 && p.overlap.w > 2), owner.pairs)

  // overlapScroll reaches what an inner scroller hides; the probe alone does not see it
  await page.setContent(BASE + '<div id="s" style="height:300px;overflow:auto"><div style="height:700px"></div><button style="width:60px;height:40px">A</button><button style="width:60px;height:40px;margin-left:-30px">B</button><div style="height:20px"></div></div>')
  // eslint-disable-next-line no-new-func
  const scroll = new Function('return (' + overlapScrollSource + ')')()
  const top = await page.evaluate(probe, {})
  expect('scroller at the top: the crossing below is clipped away', top.count === 0, top)
  let found = 0
  for (let step = 0; step < 10; step++) {
    const at = await page.evaluate(scroll, step)
    found = Math.max(found, (await page.evaluate(probe, {})).count)
    if (at.done) break
  }
  expect('overlapScroll brings it into view and the probe counts it', found === 1, found)

  // overlapDirty picks the form's fields, never the shell's search or the sidebar
  await page.setContent(BASE + '<aside><input placeholder="Search"></aside><header><input aria-label="Search ⌘K"></header><main><input type="search"><input name="title" value="Acme"><input name="hidden" type="hidden"><input name="ro" readonly value="x"><textarea name="desc"></textarea><input name="qty" type="number" value="2"></main>')
  // eslint-disable-next-line no-new-func
  const dirty = new Function('return (' + overlapDirtySource + ')')()
  const picked = await page.evaluate(dirty, 3)
  expect('overlapDirty: title, desc and qty (no search, sidebar, hidden or read-only field)', picked.map(p => p.selector).join() === 'input[title],textarea[desc],input[qty]', picked)
  expect('overlapDirty: text gets « x», a number gets +1', picked[0].value === 'Acme x' && picked[2].value === '3', picked)
  // inside an open dialog, only the dialog's fields
  await page.setContent(BASE + '<main><input name="page"></main><div role="dialog"><input name="inDialog"></div>')
  const inDialog = await page.evaluate(dirty, 3)
  expect('overlapDirty: an open dialog\'s form wins over the page', inDialog.map(p => p.selector).join() === 'input[inDialog]', inDialog)
  // the store editor is a wide <aside> inside the page, not a dialog: its fields win over the list behind it
  await page.setContent(BASE + '<nav><input name="nav"></nav><main class="od-shell-main"><input name="listField"><aside style="position:fixed;inset:0 0 0 auto;width:900px;background:#fff"><input name="storeName"></aside></main>')
  const inPanel = await page.evaluate(dirty, 3)
  expect('overlapDirty: a wide aside panel of the page (store editor) wins over the list', inPanel.map(p => p.selector).join() === 'input[storeName]', inPanel)
  // a form without text fields: one select set to another option, else one switch
  await page.setContent(BASE + '<main><select name="open"><option value="9">9:00</option><option value="10">10:00</option></select><select name="close"><option>18:00</option><option>19:00</option></select><button role="switch" aria-checked="false" aria-label="Open">o</button></main>')
  const noText = await page.evaluate(dirty, 3)
  expect('overlapDirty: no text field → one select, to another option', noText.length === 1 && noText[0].kind === 'select' && noText[0].value === '10', noText)
  await page.setContent(BASE + '<main><button role="switch" aria-checked="false" aria-label="Open">o</button><input type="checkbox" name="b"></main>')
  const onlySwitch = await page.evaluate(dirty, 3)
  expect('overlapDirty: only switches → one switch, clicked', onlySwitch.length === 1 && onlySwitch[0].kind === 'click', onlySwitch)
  // a Product switch: the native checkbox is invisible (opacity 0) inside its visible frame
  await page.setContent(BASE + '<main><label style="display:inline-block;width:40px;height:24px;background:#ccc"><input type="checkbox" name="hiddenSwitch" style="opacity:0;width:40px;height:24px;margin:0"></label></main>')
  const productSwitch = await page.evaluate(dirty, 3)
  expect('overlapDirty: a Product switch (hidden checkbox, visible frame) counts', productSwitch.length === 1 && productSwitch[0].selector === 'input[hiddenSwitch]', productSwitch)
  // review of AH: the aria-hidden mirror checkbox of a row select is not a field
  await page.setContent(BASE + '<main><span aria-hidden="true"><input type="checkbox" name="mirror" style="width:1px;height:1px"></span><button role="switch" aria-label="Enable">e</button></main>')
  const noMirror = await page.evaluate(dirty, 3)
  expect('overlapDirty: an aria-hidden checkbox is skipped', noMirror.length === 1 && noMirror[0].selector === 'button[Enable]', noMirror)
  // a Product sheet (.odc-sheet) is a panel even without role=dialog
  await page.setContent(BASE + '<main class="od-shell-main"><input name="listSearchless"></main><div class="odc-sheet" style="position:fixed;inset:0 0 0 auto;width:500px;background:#fff"><input name="phone"></div>')
  const inSheet = await page.evaluate(dirty, 3)
  expect('overlapDirty: an open Product sheet wins over the page', inSheet.map(p => p.selector).join() === 'input[phone]', inSheet)
} finally {
  await browser.close()
}
console.log(failures ? failures + ' case(s) failed' : 'all cases as expected')
process.exit(failures ? 1 : 0)
