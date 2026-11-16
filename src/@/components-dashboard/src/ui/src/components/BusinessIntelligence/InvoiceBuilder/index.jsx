import React, { useCallback, useEffect, useRef } from 'react'
import { useHistory, useLocation } from 'react-router-dom'

import { useLanguage } from '../../../../../index'
import { InvoiceBuilder } from '../../../../../components/InvoiceBuilder'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton, PageHeader, SegmentedControl, useProductDir } from '../../Shared/Product'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { Menu as MenuIcon } from '../../Shared/Icon'
import { learnOptionsValues } from '../../../utils/learnOptionsValues'
import { InvoiceKindView } from './InvoiceKindView'
import './invoice-builder.css'

// redesign invoice FC2 (D1, D2; IV-01, IV-02; auditor 5): /intelligence/invoice, one page. The header (menu button when the menu is collapsed,
// «Invoice manager», what the page does, Learn), the kind of invoice, and below it the form and the preview of the kind that is shown. The old catalog
// of cards and the side panel of `main` (`InvoiceManager`, `InvoiceDetails`) are not used. The data of each kind is the controller `InvoiceBuilder`
// of `~components` (lote A); this file only mounts it and reads the URL.

const KINDS = ['business', 'driver']
// the destinations of ⌘K that `main` had (`?tab=`); the driver has no order types
const FOCUS_TARGETS = { business: ['payment_methods', 'order_type', 'general'], driver: ['payment_methods', 'general'] }

/** `?invoice=` → the kind. Without it, or with another value, the business invoice (as the first card of `main`). */
export const kindFromSearch = (search) => (new URLSearchParams(search).get('invoice') === 'driver' ? 'driver' : 'business')

export const InvoiceManager = () => {
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const dir = useProductDir()
  const history = useHistory()
  // redesign invoice FC2 (D2, auditor 5): the kind is read from the location on EVERY change, so ⌘K from this very page works
  const { search, pathname } = useLocation()
  const params = new URLSearchParams(search)
  const kind = kindFromSearch(search)
  const tab = params.get('tab')
  const focusTarget = FOCUS_TARGETS[kind].includes(tab) ? tab : null

  // redesign invoice FC2 (D2): a kind is mounted the first time it is chosen and stays mounted (hidden), so what was typed is kept
  const mounted = useRef(new Set())
  mounted.current.add(kind)

  const learnOptions = learnOptionsValues(['invoice_manager'], t)

  const replaceWithout = useCallback((name) => {
    const next = new URLSearchParams(history.location.search)
    next.delete(name)
    const text = next.toString()
    history.replace({ pathname: history.location.pathname, search: text ? `?${text}` : '' })
  }, [history])
  // stable, so a form that lists it as a dependency does not run again on every render
  const onFocusDone = useCallback(() => replaceWithout('tab'), [replaceWithout])

  const changeKind = (value) => {
    if (value === kind) return
    const next = new URLSearchParams(search)
    next.set('invoice', value)
    next.delete('tab')
    history.push({ pathname, search: `?${next.toString()}` })
  }

  // a destination that this kind does not have, or an unknown one, is dropped from the URL
  useEffect(() => {
    if (tab && !focusTarget) replaceWithout('tab')
  }, [tab, focusTarget])

  return (
    <div className='odc-root odc-iv-page' data-slot='invoice-page' dir={dir}>
      <PageHeader
        leading={isCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
        title={t('INVOICE_MANAGER', 'Invoice manager')}
        description={t('INVOICE_MANAGER_DESCRIPTION', 'Build an invoice from the orders of a business or a driver and download it as a PDF.')}
        learn={<LearnDropDown learnOptions={learnOptions} />}
      />
      <div className='odc-iv-switch'>
        <SegmentedControl
          // redesign invoice R2 (P1): «Invoice type» is the name of the Charge/Payout group of the form; this one says who the invoice is for
          label={t('INVOICE_MANAGER_INVOICE_FOR', 'Invoice for')}
          value={kind}
          onValueChange={changeKind}
          options={[
            { value: 'business', label: t('BUSINESS_INVOICE', 'Business invoice') },
            { value: 'driver', label: t('DRIVER_INVOICE', 'Driver invoice') }
          ]}
        />
      </div>
      {KINDS.filter(name => mounted.current.has(name)).map(name => (
        <div key={name} className='odc-iv-panel' data-kind={name} hidden={name !== kind}>
          <InvoiceBuilder
            kind={name}
            UIComponent={InvoiceKindView}
            focusTarget={name === kind ? focusTarget : null}
            onFocusDone={onFocusDone}
          />
        </div>
      ))}
    </div>
  )
}
