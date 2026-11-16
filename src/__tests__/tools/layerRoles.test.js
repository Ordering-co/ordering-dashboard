import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanSource } from '../../../scripts/product-ui/literal-guard.mjs'

// (bugs H, W2-3): z-index of the legacy Shared/UI files and ThemeContext reads the layer scale
// (--od-x-layer-*). These files still hold other legacy literals (colors, px), so they are not in
// scripts/product-ui/governed-files.json yet; this test holds only their z-index declarations.
const ROOT = path.resolve(__dirname, '../../..')
const UI = 'src/@/components-dashboard/src/ui/src/components/Shared/UI'
const read = file => readFileSync(path.join(ROOT, file), 'utf8')
const zIndexFindings = file => scanSource(read(file), file).filter(finding => /z-?index/i.test(finding.property))

// (O-7) mapped the numbers left (999, 1001, 1005, 2000/2001, 9999, 10000…) to roles at the same place on the
// ladder; only the toast moved, to `notice`, above the open lists.
const MIGRATED = [
  'HtmlEditor/insert-image.css',
  'auto-scroll.css',
  'disabled-feature-alert.css',
  'drag-scroll.css',
  'image-crop.css',
  'language-selector.css',
  'modal.css',
  'phone-input.css',
  'range-calendar.css',
  'spinner-loader.css',
  'spreadsheet.css'
]

describe('layer roles — Shared/UI and ThemeContext', () => {
  it.each(MIGRATED)('%s holds no literal z-index', file => {
    expect(zIndexFindings(`${UI}/${file}`)).toEqual([])
  })

  // (O-7): the open lists took the place their 10000 had — above every page layer, the dialog host and the palette —
  // but under the toast, which is the notice role and now sits above everything
  it('first-select, multi-select and legacy-select open their lists just under the notice role', () => {
    for (const file of ['first-select.css', 'multi-select.css', 'legacy-select.css']) {
      expect(zIndexFindings(`${UI}/${file}`), file).toEqual([])
      expect(read(`${UI}/${file}`), file).toMatch(/z-index: calc\(var\(--od-x-layer-notice\) - 10\);/)
    }
    expect(read(`${UI}/legacy-select.css`)).toMatch(/\.od-legacy-select-positioner \{ z-index: calc\(var\(--od-x-layer-chrome\) \+ 1\); \}/)
  })

  it('the toast is the notice role, above every open list and status badge', () => {
    expect(read(`${UI}/toast.css`)).toMatch(/z-index: var\(--od-x-layer-notice\);/)
    for (const file of ['Orders/AllInOne/styles.js', 'Orders/OrdersManager/styles.js']) {
      expect(read(`src/@/components-dashboard/src/ui/src/components/${file}`), file).toMatch(/z-index: calc\(var\(--od-x-layer-notice\) - 20\);/)
    }
    expect(read('src/@/components-dashboard/src/components/GoogleAutocompleteInput/index.js')).toMatch(/zIndex: 'calc\(var\(--od-x-layer-notice\) - 5\)'/)
    expect(read('index.html')).toMatch(/\.pac-container[\s\S]*?z-index: calc\(var\(--od-x-layer-notice\) - 5\) !important;/)
  })

  it('the sidebar shell takes the chrome role and the sidebar actions stay raised', () => {
    expect(read(`${UI}/shell-navigation.css`)).toMatch(/\.od-shell-sidebar\) \{\s*position: fixed;\s*z-index: var\(--od-x-layer-chrome\);/)
    expect(read(`${UI}/sidebar.css`)).toMatch(/z-index: calc\(var\(--od-x-layer-raised\) \+ 9\);/)
  })

  it('keeps the same numbers it had: raised + n only orders siblings, sticky is 100, chrome is 1000', () => {
    expect(read(`${UI}/image-crop.css`)).toMatch(/z-index: calc\(var\(--od-x-layer-raised\) \+ 19\);/)
    // more-sidebar.css went with the dead Shared/MoreSidebarLayout; range-calendar.css holds the sticky role now
    expect(read(`${UI}/range-calendar.css`)).toMatch(/z-index: var\(--od-x-layer-sticky\);/)
    expect(read(`${UI}/disabled-feature-alert.css`)).toMatch(/z-index: var\(--od-x-layer-chrome\);/)
  })

  // (O-7): no numeric z-index of 100 or more is left in the app; each one reads a role (or role ± n). The two left
  // on purpose: the boot splash (index.html, painted before any stylesheet) and the brand pilot (src/brand/pilot.css).
  it('leaves no legacy z-index number of 100 or more in src', () => {
    const result = spawnSync('git', ['grep', '-nE', 'z-index:[[:space:]]*[0-9]{3,}|zIndex:[[:space:]]*[0-9]{3,}', '--', 'src'], { cwd: ROOT, encoding: 'utf8' })
    expect(result.error).toBeUndefined()
    expect([0, 1]).toContain(result.status)
    const hits = result.stdout.split('\n').filter(Boolean)
      .filter(line => !/__tests__|\.test\.|^src\/brand\/pilot\.css:/.test(line))
    expect(hits).toEqual([])
  })

  it('the dialog host (.popup-backdrop) takes the overlay role', () => {
    const theme = read('src/@/components-dashboard/src/ui/src/contexts/ThemeContext/index.js')
    expect(theme).toMatch(/\.popup-backdrop \{[^}]*z-index: var\(--od-x-layer-overlay\);/)
    expect(theme).not.toMatch(/\.popup-backdrop \{[^}]*z-index: 3000/)
  })
})
