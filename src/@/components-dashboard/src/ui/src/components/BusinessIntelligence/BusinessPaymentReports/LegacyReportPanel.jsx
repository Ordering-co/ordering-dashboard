import React from 'react'

import { useLanguage } from '../../../../../index'
import { Maximize2, Minimize2 } from '../../Shared/Icon'
import { IconButton, RecordPanel, useSplitView } from '../../Shared/Product'
import { EatStreetReportDetail } from '../EatStreetReportDetail'
import './panels.css'

/**
 * redesign business-payments FD (D8): the panel of one legacy EatStreet report, a RecordPanel of Product inside the
 * SplitView the shell mounts. The body is the report's iframe (`EatStreetReportDetail`), unchanged inside;
 * the header adds the Expand button. `expanded` and `onExpandedChange` are the shell's.
 */
export const LegacyReportPanel = ({ reportId, onClose, expanded = false, onExpandedChange }) => {
  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'

  const headerActions = !phone && onExpandedChange
    ? (
      <IconButton
        icon={expanded ? Minimize2 : Maximize2}
        label={expanded ? t('COLLAPSE', 'Collapse') : t('EXPAND', 'Expand')}
        onClick={() => onExpandedChange(!expanded)}
      />
      )
    : null

  return (
    <RecordPanel
      className='bpp-panel'
      data-kind='legacy'
      title={t('LEGACY_REPORTS', 'Legacy Reports')}
      closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
      onClose={onClose}
      headerActions={headerActions}
    >
      <EatStreetReportDetail reportId={reportId} />
    </RecordPanel>
  )
}
