import React from 'react'
import { useLanguage } from '../../../../../index'
import { tenantAccentContrast } from '~/utils/bootTheme'
import { InlineNotice } from '../../Shared/Product'
import './accent-contrast-note.css'

// redesign J5 row 45 (my-products-dashboard P-DB5, ): the AA report of decision 30 (tenantAccentContrast, the same one the
// boot uses) next to the buttons color, on the screen where it is chosen. White text on a color below 4.5:1 is hard to read on the
// primary buttons; the notice says so and does not block saving. Nothing for a color that passes or one it cannot measure.
export const AccentContrastNote = ({ value }) => {
  const [, t] = useLanguage()
  const report = tenantAccentContrast(value)
  if (!report || report.passesAA) return null
  // decision 42: on a color the report measures below AA, the primary buttons paint a darker shade of it with white text
  // (tenantAccentPaint), and the notice says so
  const text = t('BUTTONS_COLOR_CONTRAST_DARKER_SHADE', 'White text on this color has a contrast of _ratio_:1, below the 4.5:1 that text needs to be easy to read, so the buttons use a slightly darker shade of it to keep white text readable. You can still save it.')
  return (
    <InlineNotice tone='warning' className='odc-settings-contrast-note'>
      {text.replace('_ratio_', () => String(report.ratio))}
    </InlineNotice>
  )
}
