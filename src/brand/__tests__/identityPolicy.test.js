import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = path => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('active identity source policy', () => {
  it('keeps preboot identity on the Ordering.co defaults until the tenant is resolved', () => {
    const document = new DOMParser().parseFromString(read('index.html'), 'text/html')
    expect(document.title).toBe('Ordering.co Dashboard')
    for (const rel of ['android-touch-icon', 'windows-touch-icon']) {
      const links = document.querySelectorAll(`link[rel="${rel}"]`)
      expect(links).toHaveLength(1)
      expect(links[0].getAttribute('href')).toBe('/favicon.png')
    }
    // PWA is disabled: the manifest is not linked
    expect(document.querySelector('link[rel="manifest"]')).toBeNull()
  })

  it('does not advertise maskable icons in the manifest', () => {
    const manifest = JSON.parse(read('public/manifest.json'))
    expect(manifest.icons.some(icon => String(icon.purpose || '').split(' ').includes('maskable'))).toBe(false)
  })

  it('boots the Ordering.co lockup and isotype masters without retired identity assets', () => {
    const entry = read('src/index.js')
    expect(entry).toContain("import logotype from './assets/images/ordering-lockup-color.svg'")
    expect(entry).toContain("import logotypeInvert from './assets/images/ordering-lockup-color-reversed.svg'")
    expect(entry).toMatch(/theme\.images\s*=\s*\{\s*logos,/)
  })
})
