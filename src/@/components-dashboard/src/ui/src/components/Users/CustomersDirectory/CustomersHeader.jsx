import React from 'react'

import { useLanguage } from '../../../../../index'
import { Button, IconButton, PageHeader } from '../../Shared/Product'
import { Menu as MenuIcon, Plus } from '../../Shared/Icon'
import './customers-page.css'

// redesign UC-B7 (decisions 1, 3; auditor #1, #14): the page header of the customers list: title and count, the help entry
// (Learn), the visible Export CSV and the one primary action, «Add customer». `onOpenMenu` (given while the sidebar is
// collapsed) puts the menu button before the title (it is PageHeader's `leading`, as on the other redesigned pages).
//
// redesign UC-R1 (I-01): the header is ONE line in the list column at every width ('Opening or closing the detail never moves the
// page header'). Beside the panel the column is ~620px and the three buttons with their words do not fit beside the title (they wrapped
// to a second line and moved the filters and the first row 36px). Below 768px of the header's own width (a container query,
// customers-page.css) Learn and Export CSV keep only their icon, and «Add customer» does below 600px (the page header's rule, from
// `data-collapse-label`). The words are clipped, not removed: the accessible name stays, and every one carries its `title`.
export const CustomersHeader = ({ title, total, learn, actions, onAdd, onOpenMenu }) => {
  const [, t] = useLanguage()
  const known = total != null && Number.isFinite(Number(total))
  const countLabel = Number(total) === 1
    ? t('CUSTOMERS_COUNT_ONE', '1 customer')
    : t('CUSTOMERS_COUNT_OTHER', '_count_ customers').replace('_count_', total)

  return (
    <PageHeader
      className='odc-cpg-head'
      title={title}
      count={known ? Number(total) : undefined}
      countLabel={known ? countLabel : undefined}
      learn={learn}
      // the page's own node (Export CSV): its holder carries the tooltip of the icon-only state, since the button is not this file's
      actions={actions ? <span className='odc-cpg-export' title={t('CUSTOMERS_EXPORT_CSV', 'Export CSV')}>{actions}</span> : undefined}
      primaryAction={(
        // `data-tour` is the anchor of the Learn tour (today's «Add user» button had it)
        <Button variant='primary' icon={Plus} data-tour='tour_add' title={t('CUSTOMERS_ADD', 'Add customer')} onClick={onAdd}>
          <span data-collapse-label=''>{t('CUSTOMERS_ADD', 'Add customer')}</span>
        </Button>
      )}
      leading={onOpenMenu && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={onOpenMenu} />}
    />
  )
}
