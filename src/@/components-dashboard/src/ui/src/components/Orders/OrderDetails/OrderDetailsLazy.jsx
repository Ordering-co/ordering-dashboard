import React, { lazy, Suspense } from 'react'
import { useLanguage } from '../../../../../index'
import { Sheet } from '../../Shared/Product'
import { ChunkErrorBoundary, ChunkErrorState } from '../../Shared/ChunkErrorBoundary'
import { removeQueryToUrl } from '../../../utils'
import { lazyWithReload } from '~/utils/chunkReload'
import { PanelSkeleton } from './PanelSkeleton'

// redesign N-05: the panel (header, four tabs, footer, dialogs) is not on the first paint of /orders, so its code is a
// separate chunk (OrderDetailsPanel). The controller stays in index.js, eager and small: it starts the order's request as
// soon as the panel is asked for, in parallel with the download of the chunk (a `?id=` deep link loads right away). While
// the chunk is on its way the panel is its own skeleton (F4, C20): the same frame, so nothing moves when the real panel
// replaces it.
// redesign tramo B r3 (W0-PB2-01): if its chunk is gone (a deploy under an open tab) the page reloads once; see utils/chunkReload.js
const OrderDetailsPanel = lazy(() => lazyWithReload(() => import('./OrderDetailsPanel')))

const OrderDetailsFallback = (props) => {
  const [, t] = useLanguage()
  const closePanel = () => {
    if (!props.isSelectedOrders) removeQueryToUrl(['section', 'tab']) // inside a user's record they are the record's
    props.onClose?.()
  }
  // redesign tramo B r2 (W0-PB1-01): `failed` draws the same frame with the error state instead of the skeleton.
  // redesign tramo B r3 (W0-PB2-02, W0-QB2-07): `failure` is the error caught, which picks the text; the title is the panel's, not a page's.
  const body = props.failed
    ? <ChunkErrorState error={props.failure} scope='order' onClose={closePanel} />
    : (
      <PanelSkeleton
        loadingLabel={t('LOADING', 'Loading')}
        closeLabel={t('CLOSE', 'Close')}
        onClose={closePanel}
      />
      )
  const content = (
    <div className='odc-root odc-od' id='orderDetails' aria-busy={props.failed ? undefined : 'true'}>
      {body}
    </div>
  )
  // The split view takes the content as it is; the overlay panels (deliveries, appointments, all-in-one, messages) keep
  // the lateral Sheet that the loaded panel draws, so the Sheet does not appear after the skeleton.
  if (props.layout === 'split') return content
  return (
    <Sheet
      open={props.open !== false}
      onOpenChange={(next) => { if (!next) closePanel() }}
      title={t('LOADING', 'Loading')}
      closeLabel={t('CLOSE', 'Close')}
      side='end'
      className='odc-order-sheet'
    >
      {content}
    </Sheet>
  )
}

// The controller's UIComponent: the lazy panel behind its skeleton.
// redesign tramo B r2 (W0-PB1-01): if the chunk fails to load (opening an order after a deploy) the failure stays in the panel's
// own frame, with «Reload» and «Close»; the page behind keeps working.
export const OrderDetailsUI = (props) => (
  <ChunkErrorBoundary resetKey={props.order?.id ?? props.orderId} fallback={({ error }) => <OrderDetailsFallback {...props} failed failure={error} />}>
    <Suspense fallback={<OrderDetailsFallback {...props} />}>
      <OrderDetailsPanel {...props} />
    </Suspense>
  </ChunkErrorBoundary>
)
