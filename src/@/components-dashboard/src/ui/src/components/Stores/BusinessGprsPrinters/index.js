import React from 'react'
import { useLanguage, useApi, BusinessGprsPrinters as BusinessGprsPrintersController } from '../../../../../index'
import { Button, Field, InlineNotice, Skeleton, Switch, TextArea } from '../../Shared/Product'
import { TriangleAlert } from '../../Shared/Icon'
import '../BusinessNotifications/notifications.css'

// redesign stores 5.4: the switch and the model are controlled fields of the Notifications form (the draft lives
// in the parent). The list of models has its three states: loading, error with «Try again» (G2-30) and empty.

const BusinessGprsPrintersUI = (props) => {
  const {
    business,
    usePrinter,
    printerId,
    onChangeUsePrinter,
    onChangePrinterId,
    printersListState,
    getPrinters
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const printers = Array.isArray(printersListState?.printers) ? printersListState.printers : []
  const loading = !!printersListState?.loading
  const hasError = !loading && printersListState?.error != null && printersListState.error !== false
  const selected = printerId == null ? '' : String(printerId)

  // The queue paths belong to the SAVED store (read only, S7): they appear once the printer is stored, not while it is a draft.
  const showQueue = !!business?.printer_id && !!business?.use_printer
  const filePath = `${ordering?.root?.replace('https', 'http')}/business/${business?.id}/queue.txt`
  const filePathConfirm = `${ordering?.root?.replace('https', 'http')}/business/${business?.id}/queue/confirm`

  const changeModel = (event) => {
    const value = event.target.value
    const printer = printers.find(item => String(item.id) === value)
    onChangePrinterId && onChangePrinterId(printer ? printer.id : value)
  }

  // review 5.4: the request's own text («Failed to fetch») says nothing to the user; the notice and «Try again» do
  const failedText = t('STORE_PRINTERS_LOAD_FAILED', "We couldn't load the printer models.")
  // A saved printer that is not in the list must not show as the first model: it reads «Select a printer», as in main
  const known = printers.some(printer => String(printer.id) === selected)

  return (
    <section className='odc-store-notif-block'>
      <h2 className='odc-store-notif-section'>{t('GPRS_PRINTERS', 'Gprs printers')}</h2>
      <div className='odc-store-notif-switch'>
        <Switch
          checked={!!usePrinter}
          onCheckedChange={(checked) => onChangeUsePrinter && onChangeUsePrinter(checked)}
        >
          {t('ACCEPT_GPRS_PRINTER', 'Accept GPRS printer')}
        </Switch>
      </div>

      {loading && (
        <div className='odc-store-notif-loading' role='status' aria-busy='true' aria-label={t('LOADING', 'Loading')}>
          <span className='odc-store-notif-loading-label'>{t('PRINTER_MODEL', 'Printer model')}</span>
          <Skeleton block='var(--od-x-control-height)' />
        </div>
      )}
      {hasError && (
        <InlineNotice
          tone='danger'
          icon={TriangleAlert}
          role='alert'
          action={<Button size='sm' onClick={() => getPrinters && getPrinters()}>{t('TRY_AGAIN', 'Try again')}</Button>}
        >
          {failedText}
        </InlineNotice>
      )}
      {!loading && !hasError && printers.length === 0 && (
        <p className='odc-store-notif-empty'>{t('STORE_PRINTERS_EMPTY', 'There are no printer models to choose from.')}</p>
      )}
      {!loading && !hasError && printers.length > 0 && (
        <Field label={t('PRINTER_MODEL', 'Printer model')}>
          <select
            name='printer_id'
            className='odc-field-input odc-store-notif-select'
            value={selected}
            onChange={changeModel}
          >
            {!known && <option value={selected} disabled={selected !== ''}>{t('SELECT_PRINTER', 'Select a printer')}</option>}
            {printers.map(printer => <option key={printer.id} value={String(printer.id)}>{printer.model}</option>)}
          </select>
        </Field>
      )}

      {showQueue && (
        <>
          <TextArea label={t('GPRS_QUEUE_PATH', 'Printer Orders Queue Path')} value={filePath} rows={2} readOnly />
          <TextArea label={t('GPRS_QUEUE_PATH_CONFIRM', 'Printer Confirmation Orders Queue Path')} value={filePathConfirm} rows={2} readOnly />
        </>
      )}
    </section>
  )
}

export const BusinessGprsPrinters = (props) => {
  const businessGprsPrintersProps = {
    ...props,
    UIComponent: BusinessGprsPrintersUI
  }
  return <BusinessGprsPrintersController {...businessGprsPrintersProps} />
}
