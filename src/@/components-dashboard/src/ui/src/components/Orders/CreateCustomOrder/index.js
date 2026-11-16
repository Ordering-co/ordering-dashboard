import React, { createContext, lazy, Suspense, useContext, useEffect, useRef, useState } from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { Button as ProductButton, ConfirmDialog, InlineNotice, Sheet, Skeleton } from '../../Shared/Product'
import { Button } from '../../../styles'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { isChunkLoadError, lazyWithReload } from '~/utils/chunkReload'
import { ChunkErrorState } from '../../Shared/ChunkErrorBoundary'
import { StepBoundary } from '../../Shared/Product/Wizard/StepBoundary'
import './create-custom-order-wizard.css'
import './steps.css'

// redesign N-05: the wizard (its four steps, the map, the payment forms) is not on the first paint of /orders, so its code is a
// separate chunk, asked for when the Sheet opens (the button or `?add=custom_order`). While it arrives the Sheet is already
// there, with the rows of the steps' own skeleton (the ghost rows of the business list) inside.
// redesign tramo B r3 (W0-PB2-01): if its chunk is gone (a deploy under an open tab) the page reloads once; see utils/chunkReload.js
// `useOneShotQuery` removed `?add=custom_order` when the sheet opened, so the reload would come back without it and the
// form would not reopen. Right before that reload the param is written back (replaceState: the router and this page do not see it,
// only the URL that gets reloaded); `useOpenFromQuery` then opens the sheet and consumes it again, so there is no loop.
const restoreAddParam = () => {
  const url = new URL(window.location.href)
  url.searchParams.set('add', 'custom_order')
  window.history.replaceState(window.history.state, '', url)
}
const CustomOrderDetails = lazy(() => lazyWithReload(() => import('./CustomOrderDetails'), undefined, { beforeReload: restoreAddParam }).then(module => ({ default: module.CustomOrderDetails })))
const LOADING_ROWS = 6

// redesign F6e (Q4-06): where the focus goes when the form opens: the customer search field, or the step title when there is
// no field to type in (a customer is already picked); `true` leaves it to the Sheet (its first control).
const wizardFocusTarget = () => {
  const sheet = document.getElementById('custom_order_details')
  return sheet?.querySelector('[data-wizard-initial-focus]') ?? sheet?.querySelector('[data-wizard-step-title]') ?? null
}

// redesign N-05: the Sheet asks for its initial focus when it opens, and with the wizard in a chunk the content is not
// there yet (the focus would stay on the Close button). When the content arrives (this sits next to it in the Suspense, so
// it mounts with it) the focus goes where F6e put it, unless the user already moved it to a control of their own.
const FocusWhenLoaded = () => {
  useEffect(() => {
    const target = wizardFocusTarget()
    const active = document.activeElement
    const sheet = document.getElementById('custom_order_details')
    const isDefault = !active || active === document.body || active === sheet || active.classList?.contains('odc-overlay-close')
    if (target && isDefault && target !== active) target.focus({ preventScroll: true })
  }, [])
  return null
}

const WizardLoading = () => {
  const [, t] = useLanguage()
  return (
    <div className='odc-steps' aria-busy='true'>
      <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
      <ul className='odc-steps-list' data-scroll='' aria-hidden='true'>
        {Array.from({ length: LOADING_ROWS }, (_, index) => (
          <li key={index} className='odc-steps-skeleton-row' data-rich=''>
            <Skeleton shape='box' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
            <span className='odc-steps-row-main'>
              <span className='odc-steps-skeleton-name'><Skeleton size={index % 2 ? '44%' : '56%'} /></span>
              <span className='odc-steps-skeleton-meta'><Skeleton size={index % 2 ? '68%' : '76%'} /></span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// redesign F6c (Q2-08): the open form and what was picked in it live in a host, not in the button. The page head
// draws the button in one place on desktop and in another below 768px, so a form that belonged to the button was
// unmounted, and lost, whenever the window crossed that line. `CreateCustomOrderProvider` is mounted once above the
// head (OrdersManager) and owns the Sheet; any `CreateCustomOrder` below it is only a button that opens it. Without a
// host above (the other pages that draw the button) `CreateCustomOrder` mounts its own, exactly as before.
const CreateCustomOrderContext = createContext(null)

// Redesign 5.5: the form is a Product Sheet with a four-step wizard inside (Wizard/). One panel level
// (C8): the sidebars that used to stack on it are now views of the same step.
// `disabled` is for a manager embedded in another page (the lateral bars), which never had the form.
export const CreateCustomOrderProvider = ({
  handleOpenCustomOrderDetail,
  handleOpenOrderDetail,
  disabled = false,
  children
}) => {
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [open, setOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  // Slot in the Sheet foot where the wizard pins its footer; null until the Sheet has drawn it.
  const [footerHost, setFooterHost] = useState(null)
  // The wizard reports whether there is a customer picked; only then does closing ask first.
  const hasDataRef = useRef(false)
  // redesign W0-2 r2 (W0-Q1-02): when the whole form fails its step title is gone too, so the focus goes to «Try again»
  const retryRef = useRef(null)
  // One value for the life of the host: the buttons that read it do not redraw when the form opens.
  const [host] = useState(() => ({ open: () => setOpen(true) }))

  // `?add=custom_order` (command palette) opens the same form as the button
  useOpenFromQuery('add', () => setOpen(true), {
    enabled: user?.level === 0 && !disabled,
    accept: value => value === 'custom_order'
  })

  const closeSheet = () => {
    setConfirmDiscard(false)
    setOpen(false)
  }

  // Escape, the close button and the scrim: discard directly, or ask when there is something to lose.
  const requestClose = () => {
    if (hasDataRef.current) setConfirmDiscard(true)
    else closeSheet()
  }

  return (
    <CreateCustomOrderContext.Provider value={host}>
      {children}
      {!disabled && (
        <>
      <Sheet
        id='custom_order_details'
        className='odc-wizard-sheet'
        side='end'
        open={open}
        onOpenChange={next => { if (!next) requestClose() }}
        title={t('CREATE_CUSTOM_ORDER', 'Create custom order')}
        closeLabel={t('CLOSE', 'Close')}
        // redesign F6e (Q4-06): the customer search field takes the focus when the form opens, so what the operator
        // types at once lands in it. The step title (the heading) takes it on every step change, and here when
        // there is no field to type in (a customer is already picked).
        initialFocus={() => wizardFocusTarget() ?? true}
        footer={<div ref={setFooterHost} className='odc-wizard-foot-slot' />}
      >
        {/* redesign fix-qa: E3. Whatever fails inside the wizard stays inside the Sheet: the page behind never goes blank. */}
        {/* redesign W0-2c (D-23): after «Try again» the focus goes where F6e puts it when the form opens, not to <body>. */}
        <StepBoundary
          focusOnReset={wizardFocusTarget}
          // redesign W0-2 r2 (W0-Q1-02): same destination as after «Try again»; when the form is gone, its retry action
          focusOnError={() => wizardFocusTarget() ?? retryRef.current}
          // redesign tramo B r4 (W0-PB3-01): the wizard's chunk that did not load (React caches the rejected lazy import) is not
          // recovered by «Try again» or by closing the sheet: the load state, with «Reload», is what works.
          fallback={({ error, reset }) => {
            // redesign tramo B cierre (W0-QB4-03, W0-PB4-02): its own scope, so the title says the form did not load, not the page
            if (isChunkLoadError(error)) return <ChunkErrorState error={error} scope='orderForm' />
            return (
              <InlineNotice
                tone='danger'
                role='alert'
                action={<ProductButton ref={retryRef} variant='link' size='sm' onClick={reset}>{t('TRY_AGAIN', 'Try again')}</ProductButton>}
              >
                {t('CUSTOM_ORDER_ERROR', 'The order form could not be shown. Try again, or close it and open it again.')}
              </InlineNotice>
            )
          }}
        >
          <Suspense fallback={<WizardLoading />}>
            <CustomOrderDetails
              footerHost={footerHost}
              onDirtyChange={value => { hasDataRef.current = value }}
              handleOpenCustomOrderDetail={handleOpenCustomOrderDetail}
              onClose={closeSheet}
              handleOpenOrderDetail={handleOpenOrderDetail}
            />
            <FocusWhenLoaded />
          </Suspense>
        </StepBoundary>
      </Sheet>
      <ConfirmDialog
        open={confirmDiscard}
        title={t('CUSTOM_ORDER_DISCARD_TITLE', 'Discard this order?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={closeSheet}
        onCancel={() => setConfirmDiscard(false)}
      >
        {t('CUSTOM_ORDER_DISCARD_TEXT', 'The customer, business and products you picked are cleared.')}
      </ConfirmDialog>
        </>
      )}
    </CreateCustomOrderContext.Provider>
  )
}

const CreateCustomOrderButton = () => {
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const host = useContext(CreateCustomOrderContext)
  if (user?.level !== 0) return null
  return (
    <Button
      borderRadius='7.6px'
      color='lightPrimary'
      onClick={() => host?.open()}
    >
      {t('CREATE_CUSTOM_ORDER', 'Create custom order')}
    </Button>
  )
}

export const CreateCustomOrder = (props) => {
  const {
    handleOpenCustomOrderDetail,
    handleOpenOrderDetail
  } = props
  const host = useContext(CreateCustomOrderContext)

  if (host) return <CreateCustomOrderButton />
  return (
    <CreateCustomOrderProvider
      handleOpenCustomOrderDetail={handleOpenCustomOrderDetail}
      handleOpenOrderDetail={handleOpenOrderDetail}
    >
      <CreateCustomOrderButton />
    </CreateCustomOrderProvider>
  )
}
