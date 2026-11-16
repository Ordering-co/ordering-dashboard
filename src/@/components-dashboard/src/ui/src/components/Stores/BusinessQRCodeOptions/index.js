import React, { useState } from 'react'
import { useLanguage, BusinessQRCodeOptions as BusinessQRCodeOptionsController } from '../../../../../index'
import { SectionSplit } from '../../Shared/Product'
import { ChevronRight } from '../../Shared/Icon'
import { EDITOR_PANEL_WIDE_FROM } from '../../../../../utils/editorPanel'
import { BusinessQRCodeOption } from '../BusinessQRCodeOption'
import { publishingItemsValues } from './utils'
import './qr-codes.css'

// redesign stores 5.15a (; decision 5, G5-07, G5-08): the QR codes of a store (level 0) as a list and its detail on
// P/SectionSplit. The detail sits beside the list from 1000px of window (`EDITOR_PANEL_WIDE_FROM`, where main opened its column)
// and replaces it below that, with «‹ Back» (main opened an 80% modal). No `document.getElementById` width animation.
// The five order types and what each QR opens are main's (`utils.js`); the title says «QR Codes», as the menu does.
const BusinessQRCodeOptionsUI = (props) => {
  const { business, setIsExtendExtraOpen } = props

  const [, t] = useLanguage()
  const [selectedKey, setSelectedKey] = useState(null)

  const items = publishingItemsValues({ t })
  const selected = items.find(item => item.key === selectedKey) || null

  const list = (
    <div className='odc-qr-pane'>
      <h1 className='odc-qr-title'>{t('QR_CODES', 'QR Codes')}</h1>
      <ul className='odc-qr-rows' aria-label={t('QR_CODES', 'QR Codes')}>
        {items.map(item => {
          const active = item.key === selectedKey
          return (
            <li key={item.key} className='odc-qr-row' data-section-split-key={item.key} aria-current={active ? 'true' : undefined}>
              <button type='button' className='odc-qr-name' onClick={() => setSelectedKey(item.key)}>
                <span className='odc-qr-name-text'>{item.title}</span>
              </button>
              <ChevronRight className='odc-icon odc-icon-flip odc-qr-chevron' aria-hidden='true' />
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <div className='odc-root odc-qr'>
      <SectionSplit
        revealDetail // redesign bugs F row 6 (D5 of 5.18): stacked, the detail opens at its header
        splitFrom={EDITOR_PANEL_WIDE_FROM}
        open={!!selected}
        detailKey={selected?.key}
        onClose={() => setSelectedKey(null)}
        onExtendChange={value => setIsExtendExtraOpen?.(value)}
        detailTitle={selected?.title ?? ''}
        closeLabel={t('CLOSE', 'Close')}
        backLabel={t('BACK', 'Back')}
        list={list}
        detail={selected ? <BusinessQRCodeOption key={selected.key} item={selected} business={business} /> : null}
      />
    </div>
  )
}

export const BusinessQRCodeOptions = (props) => {
  const businessQRcodeOptionsProps = {
    ...props,
    UIComponent: BusinessQRCodeOptionsUI
  }
  return <BusinessQRCodeOptionsController {...businessQRcodeOptionsProps} />
}
