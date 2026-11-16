import { beforeEach, describe, it } from 'vitest'

import { BARE_CUT_DESCRIBE, WIDENING, bareCutSetUp, installBugsHLayout } from './filterBarBugsH'

// Bugs H, W0-D-12: one sweep of 1px of FilterBar.bugsH.test.jsx, for Status alone (a file runs on one worker: the sweeps run side by side).
installBugsHLayout()

describe(BARE_CUT_DESCRIBE, () => {
  beforeEach(bareCutSetUp)

  it.each([['Status']])(WIDENING.title, WIDENING.run, WIDENING.timeout)
})
