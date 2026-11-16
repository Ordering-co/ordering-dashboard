import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss from 'postcss'
// The T1 pilot is Tailwind 3 (alias `tailwindcss-v3`); `tailwindcss` is Tailwind 4, used by the Mia buttons (docs/BRAND.md › Boundary).
import tailwindcss from 'tailwindcss-v3'
import autoprefixer from 'autoprefixer'
import { describe, expect, it } from 'vitest'
import { orderingButtonStyle } from '../../@/components-dashboard/src/ui/src/components/Shared/UI/theme'
import { createDashboardTheme } from '../adapter'
import { tokens } from '../ordering.tokens.generated'
import theme from '../../theme.json'

describe('T1 compiled CSS isolation', () => {
  it('emits only prefixed selectors and uses the canonical runtime roles', async () => {
    const input = resolve('src/brand/pilot.css')
    const compiled = await postcss([tailwindcss({ config: resolve('tailwind.config.cjs') }), autoprefixer()]).process(readFileSync(input, 'utf8'), { from: input })
    const selectors = []
    compiled.root.walkRules(rule => selectors.push(...rule.selectors))
    expect(selectors.length).toBeGreaterThan(20)
    for (const selector of selectors) expect(selector.trim()).toMatch(/^\.od-/)
    expect(compiled.css).toContain('var(--od-ui-button-background, var(--od-ui-surface))')
    for (const mode of ['light', 'dark']) {
      const variables = orderingButtonStyle(createDashboardTheme(theme, { mode }), { color: 'primary' })
      expect(variables['--od-ui-button-background']).toBe(tokens.theme[mode].semantic.action.default)
    }
    expect(compiled.css).toContain('var(--od-ui-touch-target)')
    expect(compiled.css).not.toContain('--tw-ring-offset-shadow')
    expect(compiled.css).not.toContain('box-sizing: border-box;\n}\n\nhtml')
  })
})
