import React, { useId, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import ReactToPrint from 'react-to-print'
import { useLanguage, useSite } from '../../../../../index'
import { Button, CopyButton, InlineNotice, TextField } from '../../Shared/Product'
import { useStoreWebsiteUrl } from '../../../hooks/useWebsiteUrl'
import { useProjectState } from '../../../contexts/ProjectContext'
import './qr-code.css'

// redesign stores 5.15a (; G5-04, G5-07, G5-08, G5-09): the detail of one QR code, inside P/SectionSplit (which draws
// its title and its X / «‹ Back»).
// - The address is the store's one address, `useStoreWebsiteUrl` (as the widgets and the Overview): main built a second one here
//   from `getPreferredSiteUrl` + `checkSiteUrl` + an unguarded `business.slug` (`…/store/undefined`). Same host, same path.
// - «Generate code» says why it cannot: a project without a website, a store without an address yet, or the address loading. It
//   used to be disabled, or to return, without a word.
// - Eat in, Curbside and Drive thru need a number: the same characters as main (digits and a point), now also when pasted; when it
//   is missing it is said under the field, not in a modal.
// - The printed page is the QR (`printRef`) and, J2 row 18 (O1), under it the store's name and «Table 12» / «Spot 12» (the number the
//   code was made with) or the order type, so several printed codes can be told apart. The link it opens is shown under it,
//   outside the print, with «Copy link».

const NUMBER_FREE = ['delivery', 'pick_up']

export const BusinessQRCodeOption = ({ item, business }) => {
  const [, t] = useLanguage()
  const [{ loading: sitesLoading }] = useSite()
  const [projectStatus] = useProjectState()
  const storeUrl = useStoreWebsiteUrl(business?.slug)
  const reasonId = useId()

  const [number, setNumber] = useState('')
  const [tried, setTried] = useState(false)
  const [code, setCode] = useState(null)
  // redesign bugs F row 36: the number the code was made with; a new number keeps the code (and Print, Copy link) as in
  // main, and says it is still the old one until it is generated again
  const [codeNumber, setCodeNumber] = useState('')
  const printRef = useRef(null)

  const needsNumber = !NUMBER_FREE.includes(item?.key)
  const isEatIn = item?.key === 'eat_in'
  const numberLabel = isEatIn ? t('TABLE_NUMBER', 'Table number') : t('SPOT_NUMBER', 'Spot number')
  const numberError = needsNumber && tried && !number
    ? (isEatIn ? t('QR_TABLE_NUMBER_REQUIRED', 'Table number is required') : t('QR_SPOT_NUMBER_REQUIRED', 'Spot number is required'))
    : undefined

  // the address waits for the sites and for the project's plan (which says whether it has a website): until both answer, it loads
  const addressLoading = !storeUrl && (sitesLoading || !!projectStatus?.loading)
  const reason = storeUrl
    ? null
    : addressLoading
      ? t('QR_ADDRESS_LOADING', 'Loading the store\'s address…')
      : !projectStatus?.websiteProduct
          ? t('QR_NO_WEBSITE', 'This project has no website, so a QR code would have nowhere to take customers.')
          : t('QR_NO_STORE_ADDRESS', 'This store has no website address yet, so a QR code can\'t be made.')

  const generateCode = () => {
    if (reason) return
    setTried(true)
    if (needsNumber && !number) return
    const numberParam = needsNumber ? `&${isEatIn ? 'table_number' : 'spot_number'}=${number}` : ''
    setCode(`${storeUrl}?order_type=${item.value}${numberParam}`)
    setCodeNumber(number)
  }
  const outdated = !!code && needsNumber && number !== codeNumber
  const printedFor = needsNumber
    ? (isEatIn ? t('QR_PRINT_TABLE', 'Table _number_') : t('QR_PRINT_SPOT', 'Spot _number_')).replace('_number_', () => codeNumber)
    : item?.title

  return (
    <div className='odc-qr-detail'>
      <p className='odc-qr-intro'>{t('QR_CODE_INTRO', 'Customers who scan it open this store with this order type chosen.')}</p>
      {needsNumber && (
        <TextField
          label={numberLabel}
          value={number}
          onChange={value => setNumber(String(value ?? '').replace(/[^0-9.]/g, ''))}
          placeholder='0'
          autoComplete='off'
          error={numberError}
          hint={isEatIn && code ? t('TO_GENERATE_NEW_QR_CODE_UPDATE_TABLE_NUMBER', 'To generate new QR codes, update the table number and regenerate the code.') : undefined}
          onKeyDown={event => { if (event.key === 'Enter') generateCode() }}
        />
      )}

      <div className='odc-qr-actions'>
        <Button
          variant={code && !outdated ? 'secondary' : 'primary'}
          disabled={!!reason}
          aria-describedby={reason ? reasonId : undefined}
          onClick={generateCode}
        >
          {t('GENERATE_CODE', 'Generate Code')}
        </Button>
        <ReactToPrint
          trigger={() => (
            <Button variant={code && !outdated ? 'primary' : 'secondary'} disabled={!code}>
              {t('PRINT', 'Print')}
            </Button>
          )}
          content={() => printRef.current}
          removeAfterPrint
        />
      </div>
      {reason && <p id={reasonId} className='odc-qr-reason'>{reason}</p>}
      {outdated && (
        <InlineNotice tone='warning'>
          {t('QR_CODE_OUTDATED', 'This QR code and its link still use number _number_. Generate the code again to use the new one.').replace('_number_', codeNumber)}
        </InlineNotice>
      )}

      {code && (
        <>
          <div className='odc-qr-code'>
            {/* the printed page: the code and, under it, which store and which table or spot (J2 row 18, O1) */}
            <div ref={printRef} className='odc-qr-print'>
              <QRCode
                size={256}
                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                value={code}
                viewBox='0 0 256 256'
              />
              <p className='odc-qr-print-caption'>
                {business?.name && <span className='odc-qr-print-store' dir='auto'>{business.name}</span>}
                {printedFor && <span className='odc-qr-print-for' dir='auto'>{printedFor}</span>}
              </p>
            </div>
          </div>
          <div className='odc-qr-link'>
            <span className='odc-qr-link-label'>{t('QR_CODE_LINK', 'Link in this QR code')}</span>
            <code className='odc-qr-link-url' dir='ltr'>{code}</code>
            <CopyButton
              text={code}
              label={t('COPY_QR_LINK', 'Copy link')}
              copyLabel={t('COPY_QR_LINK', 'Copy link')}
              copiedLabel={t('COPIED', 'Copied')}
              failedLabel={t('COPY_FAILED_SELECT', 'Couldn\'t copy. Select the text and copy it.')}
            />
          </div>
        </>
      )}
    </div>
  )
}
