// redesign deliveries-followups P3: one comment dialog, promoted to Shared/Product. The order panel and the /deliveries
// board both use P/AssignCommentDialog; the board's copy and the panel's own form (and its sheet) are gone.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = path.join(__dirname, '..', '..')
const read = file => readFileSync(path.join(COMPONENTS, file), 'utf8')
const IMPORTS_FROM_PRODUCT = /import\s*\{[^}]*\bAssignCommentDialog\b[^}]*\}\s*from\s*'\.\.\/\.\.\/Shared\/Product'/

describe('P3 · one assignment comment dialog', () => {
  it.each([
    ['the order panel', 'Orders/OrderDetails/OrderDetailsPanel.jsx'],
    ['the /deliveries board', 'Orders/DeliveriesLocation/index.js']
  ])('%s imports it from Shared/Product', (_name, file) => {
    expect(read(file)).toMatch(IMPORTS_FROM_PRODUCT)
  })

  it('the copies are gone', () => {
    expect(existsSync(path.join(COMPONENTS, 'Orders/DeliveriesLocation/AssignCommentDialog.jsx'))).toBe(false)
    expect(existsSync(path.join(COMPONENTS, 'Orders/OrderDetails/assignment-comment.css'))).toBe(false)
    expect(read('Orders/OrderDetails/OrderDetailsPanel.jsx')).not.toContain('manual_driver_assignment_comment')
  })
})
