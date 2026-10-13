import { describe, expect, it } from 'vitest'
import { setThemePath } from '../setThemePath'

describe('setThemePath', () => {
  it('creates missing objects and sets the design type', () => {
    const theme = {}
    setThemePath(theme, 'maweja', 'app_design.components.layout.type')
    expect(theme).toEqual({
      app_design: {
        components: {
          layout: {
            type: 'maweja'
          }
        }
      }
    })
  })

  it('replaces an existing type and keeps sibling values', () => {
    const theme = {
      app_design: {
        components: {
          layout: {
            type: 'original',
            rows: 2
          }
        }
      }
    }
    setThemePath(theme, 'maweja', 'app_design.components.layout.type')
    expect(theme.app_design.components.layout).toEqual({
      type: 'maweja',
      rows: 2
    })
  })
})
