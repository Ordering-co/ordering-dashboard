// (row 33, drivers-time-display P-1): «block» reads «Shift» on this page (the keys keep their names; the API keeps delivery_blocks).
import React, { useEffect, useRef, useState } from 'react'

import { useConfig, useLanguage, useUtils } from '../../../../../index'
import { firstDayOfWeekFor, formatVisibleDay } from '../../../../../utils/dateRange'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { learnOptionsValues } from '../../../utils/learnOptionsValues'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { Menu as MenuIcon } from '../../Shared/Icon'
import { AlertDialog, Button, Dialog, FilterBar, IconButton, PageHeader, Pagination } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { BlockConfirmDialog } from './BlockConfirmDialog'
import { BlockDialog } from './BlockDialog'
import { DateNav } from './DateNav'
import { ScheduleAgenda } from './ScheduleAgenda'
import { ScheduleGrid } from './ScheduleGrid'
import { ScopePills } from './ScopePills'
import { addBody, editBody, formatClock, timeOf, timeOptions, todayDay } from './blockData'
import { browserTimeZone, timeZoneNote } from '../../../../../utils/timeZone'
import './drivers-time-page.css'

// redesign DT-B5 (decisions 1–7 | DT-05, DT-12, DT-15, DT-16, DT-17): the page of /delivery/drivers-time-display. A header (title,
// Learn), a bar with the scope (driver group, drivers) and the dates (Day · Week, previous / next, a custom range, Today), the grid
// (a desktop) or the agenda (a phone), the pagination of main (10, 25, 50), the block dialog and its confirmation with the
// propagation, the list of a day's blocks («+N more», main's «N Blocks») and the API errors in an AlertDialog. The controller
// (K/CalendarDriversList) owns the data and the requests; this owns what the person sees: the dialogs, the busy state and the
// errors. `Delivery/DriversTimeDisplay` mounts it as the UIComponent of the controller.

export const PAGE_SIZES = [10, 25, 50]

// how long (50 ms × 40 = 2 s, more than the exit of a dialog) the page waits for the dialogs to leave before it gives the focus back
const RESTORE_FOCUS_EVERY_MS = 50
const RESTORE_FOCUS_TRIES = 40

// «Showing _from_–_to_ of _total_» → the numbers become .odc-figure nodes (decision 11)
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

export const fullName = (user) => [user?.name, user?.lastname].filter(Boolean).join(' ')

const asMessages = (error) => (Array.isArray(error) ? error : [error].filter(Boolean))

export const TimeCalendarListingUI = (props) => {
  const {
    range,
    setRange,
    selectedGroup,
    setSelectedGroup,
    timeZone = { zone: browserTimeZone(), fallback: true }, // { zone, fallback } of the chosen group
    driverIds = [],
    toggleDriver,
    clearDrivers,
    driversList,
    paginationProps,
    changePage,
    changePageSize,
    addBlock,
    editBlock,
    deleteBlock
  } = props

  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate } = {}] = useUtils() || []
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const isPhone = useIsPhone()

  const locale = languageState?.language?.code
  const firstDayOfWeek = firstDayOfWeekFor(locale)
  const is12 = String(configs?.general_hour_format?.value ?? '').includes('hh:mm')
  const clock = (hhmm) => formatClock(hhmm, { is12, am: t('AM', 'AM'), pm: t('PM', 'PM') })
  const shownDay = (day) => (parseDate ? formatVisibleDay(day, parseDate) : day)
  const learnOptions = learnOptionsValues(['drivers_time_display'], t)

  const [driverNames, setDriverNames] = useState({})
  const [rangeError, setRangeError] = useState(false)
  // { mode: 'add' | 'edit', driver, block, day, startTime }
  const [dialog, setDialog] = useState(null)
  // { kind: 'edit' | 'delete', form, propagation }
  const [confirm, setConfirm] = useState(null)
  // { user, day, blocks }: the blocks of a day that do not fit its cell
  const [dayList, setDayList] = useState(null)
  const [busy, setBusy] = useState(false)
  const [alertContent, setAlertContent] = useState(null)

  const users = driversList?.users ?? []
  const loading = Boolean(driversList?.loading)
  const loadError = driversList?.error
  const zone = timeZone.zone
  const today = todayDay(zone)

  const onToggleDriver = (id, name) => {
    if (name != null) setDriverNames(current => ({ ...current, [id]: name }))
    toggleDriver?.(id)
  }

  const changeRange = (next) => {
    setRangeError(false)
    setRange?.(next)
  }

  // after a save or a delete the agenda reloads and the button that opened the dialog is gone (so is the «+N more» list it
  // came from). The dialogs cannot return the focus there: the shift dialog and its confirmation close together, and the one that
  // closes first hands the focus to the other, which is leaving too, so it falls on <body>. So, once a save or a delete worked, the
  // page waits for the dialogs to be gone and, if the focus is lost (on <body>), puts it on a stable place of the agenda: the «add»
  // button of that driver and day, else the tab stop of the driver's row, else the page itself (tabindex -1). `lastTarget` is who and
  // which day the dialog was opened for (`dialog` is already null by then). It never takes the focus from a control the person
  // already moved to.
  const pageRef = useRef(null)
  const lastTarget = useRef({ driverId: null, day: null })
  const restoreTimer = useRef(null)
  useEffect(() => () => clearInterval(restoreTimer.current), [])
  const stablePlace = () => {
    const { driverId, day } = lastTarget.current
    const page = pageRef.current
    const row = driverId != null ? page?.querySelector(`[data-user-id="${driverId}"]`) : null
    const add = day ? row?.querySelector(`[data-day="${day}"] .odc-sg-add, [data-day="${day}"] .odc-sa-add`) : null
    return add || row?.querySelector('button[data-nav][tabindex="0"]') || row?.querySelector('button') || page
  }
  const restoreFocus = () => {
    clearInterval(restoreTimer.current)
    let tries = 0
    restoreTimer.current = setInterval(() => {
      tries += 1
      const active = document.activeElement
      const lost = !active || active === document.body
      const inDialog = Boolean(active?.closest?.('[role="dialog"], [role="alertdialog"]'))
      if (!lost && !inDialog) tries = Infinity
      else if (lost) stablePlace()?.focus?.()
      if (tries > RESTORE_FOCUS_TRIES || (lost && document.activeElement !== document.body)) clearInterval(restoreTimer.current)
    }, RESTORE_FOCUS_EVERY_MS)
  }

  const openBlock = (user, block, day) => {
    setDayList(null)
    lastTarget.current = { driverId: user?.id, day }
    setDialog({ mode: 'edit', driver: user, block, day })
  }
  // an hour of today that has already gone is not offered by the dialog (timeOptions, as main): it starts at the next quarter instead
  const openAdd = (user, day, startTime = null) => {
    const usable = startTime && timeOptions({ day, now: new Date(), zone }).includes(startTime) ? startTime : null
    lastTarget.current = { driverId: user?.id, day }
    setDialog({ mode: 'add', driver: user, block: null, day, startTime: usable })
  }
  const closeDialog = () => {
    if (busy) return
    setDialog(null)
    setConfirm(null)
  }

  // the summary of the confirmation (C8): who, when and which day
  const summaryOf = (form) => {
    const block = dialog?.block
    const start = form?.start ?? timeOf(block?.start)
    const end = form?.end ?? timeOf(block?.end)
    return `${fullName(dialog?.driver)} · ${clock(start)} – ${clock(end)} · ${shownDay(form?.day ?? dialog?.day)}`
  }

  const finish = (result) => {
    setBusy(false)
    if (result?.ok) {
      setConfirm(null)
      setDialog(null)
      restoreFocus()
      return
    }
    setAlertContent(asMessages(result?.error).length > 0 ? asMessages(result?.error) : [t('ERROR', 'Error')])
  }

  const submit = async (form) => {
    if (!dialog) return
    if (dialog.mode === 'edit') {
      setConfirm({ kind: 'edit', form, propagation: 'none' })
      return
    }
    setBusy(true)
    finish(await addBlock?.(dialog.driver.id, addBody(form, zone)))
  }

  const confirmAction = async () => {
    if (!dialog || !confirm) return
    setBusy(true)
    const result = confirm.kind === 'delete'
      ? await deleteBlock?.(dialog.driver.id, dialog.block.id, confirm.propagation)
      : await editBlock?.(dialog.driver.id, dialog.block.id, editBody(confirm.form, dialog.block, confirm.propagation, zone))
    finish(result)
  }

  const scheduleProps = {
    users,
    loading,
    range,
    today,
    is12,
    onOpenBlock: openBlock,
    onAddBlock: openAdd,
    onShowDay: (user, day, blocks) => setDayList({ user, day, blocks })
  }

  const total = paginationProps?.totalItems
  const showPagination = !loadError && users.length > 0 && total != null

  return (
    <>
      <div className='odc-root odc-dtd-page' ref={pageRef} tabIndex={-1}>
        <PageHeader
          className='odc-dtd-head'
          title={t('DRIVERS_TIME_DISPLAY', 'Drivers time display')}
          description={timeZoneNote(timeZone, t)}
          learn={<LearnDropDown learnOptions={learnOptions} />}
          leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
        />

        <FilterBar
          className='odc-dtd-bar'
          label={t('DRIVER_BLOCKS_FILTERS', 'Calendar filters')}
          filters={(
            <ScopePills
              selectedGroup={selectedGroup}
              onGroupChange={(group) => setSelectedGroup?.(group)}
              driverIds={driverIds}
              driverNames={driverNames}
              onToggleDriver={onToggleDriver}
              onClearDrivers={() => clearDrivers?.()}
            />
          )}
          // review r1 R-06: main's «Clear filters» stays one click away while drivers are chosen
          clear={driverIds.length > 0
            ? <Button variant='ghost' onClick={() => clearDrivers?.()}>{t('CLEAR_FILTERS', 'Clear filters')}</Button>
            : null}
          tools={(
            <DateNav
              range={range}
              onRangeChange={changeRange}
              locale={locale}
              firstDayOfWeek={firstDayOfWeek}
              zone={zone}
              rangeError={rangeError}
              onRangeError={setRangeError}
            />
          )}
        />

        {loadError && !loading
          ? (
            <div className='odc-dtd-error' role='alert'>
              <p>{t('DRIVER_BLOCKS_LOAD_ERROR', 'The drivers could not be loaded.')}</p>
              <Button onClick={() => changePage?.(paginationProps?.currentPage ?? 1)}>{t('TRY_AGAIN', 'Try again')}</Button>
            </div>
            )
          : isPhone
            ? <ScheduleAgenda {...scheduleProps} />
            : <ScheduleGrid {...scheduleProps} />}

        {showPagination && (
          <div className='odc-dtd-foot'>
            <Pagination
              page={paginationProps.currentPage ?? 1}
              pageSize={paginationProps.pageSize ?? PAGE_SIZES[0]}
              total={total}
              pageSizeOptions={PAGE_SIZES}
              onPageChange={(page) => changePage?.(page)}
              onPageSizeChange={(size) => changePageSize?.(size)}
              busy={loading}
              label={t('PAGINATION', 'Pagination')}
              previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
              nextLabel={t('NEXT_PAGE', 'Next page')}
              pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
              rangeLabel={(from, to, count, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(Math.min(to, from + users.length - 1)), total: figureOf(count) })}
              pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
            />
          </div>
        )}
      </div>

      <BlockDialog
        // review r1 R-01: it stays open under the confirmation, so «Cancel» there (or a failed save) comes back to the edits
        open={Boolean(dialog)}
        mode={dialog?.mode ?? 'add'}
        driver={dialog?.driver}
        block={dialog?.block}
        day={dialog?.day}
        startTime={dialog?.startTime}
        zone={zone}
        busy={busy}
        onSubmit={submit}
        onDelete={() => setConfirm({ kind: 'delete', form: null, propagation: 'none' })}
        onClose={closeDialog}
      />

      <BlockConfirmDialog
        open={Boolean(confirm)}
        kind={confirm?.kind ?? 'edit'}
        summary={confirm ? summaryOf(confirm.form) : ''}
        propagation={confirm?.propagation ?? 'none'}
        // (row 34, drivers-time-display P-3): ask about the series only if the block (as it was before the edit) repeats
        repeats={Boolean(dialog?.block?.rrule)}
        onPropagationChange={(propagation) => setConfirm(current => (current ? { ...current, propagation } : current))}
        onConfirm={confirmAction}
        onCancel={() => { if (!busy) setConfirm(null) }}
        busy={busy}
      />

      <Dialog
        open={Boolean(dayList)}
        onOpenChange={(open) => { if (!open) setDayList(null) }}
        title={t('STACKED_BLOCKS', 'Stacked shifts')}
        description={dayList ? `${fullName(dayList.user)} · ${shownDay(dayList.day)}` : undefined}
        closeLabel={t('CLOSE', 'Close')}
        size='sm'
      >
        <ul className='odc-dtd-daylist'>
          {(dayList?.blocks ?? []).map(block => (
            <li key={block.id}>
              <Button variant='secondary' onClick={() => openBlock(dayList.user, block, dayList.day)}>
                <span className='odc-figure'>{clock(timeOf(block.start))} – {clock(timeOf(block.end))}</span>
                {block.name ? <span className='odc-dtd-daylist-name'>{block.name}</span> : null}
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>

      <AlertDialog
        open={Boolean(alertContent)}
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertContent ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setAlertContent(null)}
      />
    </>
  )
}
