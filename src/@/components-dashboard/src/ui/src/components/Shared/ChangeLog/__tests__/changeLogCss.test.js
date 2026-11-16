import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// redesign bugs D row 85, in bugs F (; Q-01 of settings-logs): in the store editor's section the log table keeps whole words
// and a readable «Changes» column (measured live at 1024 and 1280: 147px and split emails before, 204px and none after). The page
// frame (/settings/logs) keeps its own rules.
const css = readFileSync(path.join(__dirname, '..', 'change-log.css'), 'utf8')
const bodyOf = selector => {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) return null
  return css.slice(start, css.indexOf('}', start))
}

describe('change-log.css · the store section frame (row 85)', () => {
  it('keeps names, emails, events and changes whole in the section table', () => {
    const block = bodyOf(".odc-cl[data-frame='section'] .odc-table .odc-cl-change-text")
    expect(block).toContain('overflow-wrap: break-word')
    for (const cell of ['odc-cl-who-name', 'odc-cl-who-email', 'odc-cl-event']) {
      expect(css).toContain(`.odc-cl[data-frame='section'] .odc-table .${cell},`)
    }
  })

  it('gives «Changes» a readable width in the section table', () => {
    expect(bodyOf(".odc-cl[data-frame='section'] .odc-table .odc-cl-changes")).toContain('min-inline-size: var(--od-x-search-min)')
  })

  // review R-6: the user agent, which gave way, split letter by letter in a dozen lines (rows of 240px); it keeps a readable width
  it('keeps the user agent readable in the section table (rows of 98px instead of 240px, measured)', () => {
    expect(bodyOf(".odc-cl[data-frame='section'] .odc-table .odc-cl-agent-cell")).toContain('min-inline-size: var(--od-x-search-min)')
  })

  it('leaves the page frame (/settings/logs) as it was', () => {
    expect(css).not.toContain(".odc-cl[data-frame='page'] .odc-table .odc-cl-changes")
    expect(bodyOf(".odc-cl[data-frame='page'] .odc-table .odc-cl-subject")).toContain('overflow-wrap: break-word')
  })
})

// ST8: «Data changed» is two words and a table that squeezes the Event column broke it onto two lines at 1440
describe('change-log.css · the event cell and the user agent summary (ST8)', () => {
  it('keeps the event of a table row on one line', () => {
    expect(bodyOf('.odc-cl .odc-table .odc-cl-event')).toContain('white-space: nowrap')
  })

  it('keeps a summarised user agent («Chrome 155 · macOS») on one line', () => {
    expect(bodyOf('.odc-cl-agent-cell[data-parsed]')).toContain('white-space: nowrap')
  })
})
