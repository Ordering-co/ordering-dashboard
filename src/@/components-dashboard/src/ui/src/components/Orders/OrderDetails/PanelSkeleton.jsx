import React from 'react'
import { IconButton, Skeleton } from '../../Shared/Product'
import { X } from '../../Shared/Icon'
import './order-details.css'
import './details-tab.css'

// redesign N-05: the skeleton is its own module because two things draw it: the panel itself while the order loads, and
// the lazy boundary in index.js while the panel's chunk loads. It is eager (small) and brings the stylesheets of the frame,
// so the placeholder is styled before the chunk of the real panel has arrived (a lazy chunk's CSS comes with the chunk).

// redesign F4 (C20): the panel while it loads is the grid of the loaded one. It is built with the frame, the header, the
// tab strip, the route and the footer classes of the real panel (so their heights are the real ones), with
// placeholders where the data goes: the title and status, the actions (the way out stays a real button), the
// metadata line, the four tabs, the five steps of the route, the blocks of the body and the status selector. There is
// no tablist while it loads: there is nothing to go to yet.
const SK_META_ITEMS = 4
const SK_ROUTE_STEPS = 5
const SK_TABS = 4

export const PanelSkeleton = ({ loadingLabel, closeLabel, onClose }) => (
  <div className='odc-od-frame' data-skeleton=''>
    <span className='odc-sr-only'>{loadingLabel}</span>
    <header className='odc-root odc-od-head'>
      <div className='odc-od-head-row'>
        <span className='odc-od-sk-title'><Skeleton size='var(--od-x-sk-tab)' /></span>
        <span className='odc-od-sk-badge'>
          <Skeleton size='var(--od-x-sk-status)' block='var(--od-x-badge-height)' shape='box' />
        </span>
        <span className='odc-od-spacer' />
        <div className='odc-od-head-actions'>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} size='var(--od-x-control-height)' block='var(--od-x-control-height)' shape='box' />
          ))}
          <IconButton icon={X} label={closeLabel} onClick={onClose} />
        </div>
      </div>
      <div className='odc-od-meta'>
        {Array.from({ length: SK_META_ITEMS }, (_, index) => (
          <span key={index} className='odc-od-sk-line'><Skeleton size='var(--od-x-sk-meta)' /></span>
        ))}
      </div>
    </header>
    <div className='odc-od-tabs'>
      <div className='odc-tabs-list odc-fade-x' data-size='sm'>
        {Array.from({ length: SK_TABS }, (_, index) => (
          <span key={index} className='odc-tab'><Skeleton size='var(--od-x-sk-tab)' /></span>
        ))}
      </div>
      <div className='odc-od-body'>
        <div className='odc-route odc-od-sk-route'>
          <ol style={{ '--steps': SK_ROUTE_STEPS }}>
            {Array.from({ length: SK_ROUTE_STEPS }, (_, index) => (
              <li key={index} data-state='todo'>
                <span className='odc-route-node' />
                <span className='odc-route-label odc-od-sk-line'><Skeleton size='70%' /></span>
                <span className='odc-route-time odc-od-sk-line'><Skeleton size='50%' /></span>
              </li>
            ))}
          </ol>
          <div className='odc-route-note odc-od-sk-line'><Skeleton size='40%' /></div>
        </div>
        {[3, 3, 2].map((rows, block) => (
          <section key={block} className='odc-od-sk-block'>
            <span className='odc-od-sk-line'><Skeleton size='25%' /></span>
            <div className='odc-od-sk-row'>
              <Skeleton size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' shape={block === 1 ? 'box' : 'round'} />
              <div className='odc-od-sk-lines'>
                {Array.from({ length: rows }, (_, line) => (
                  <span key={line} className='odc-od-sk-line'><Skeleton size={['60%', '80%', '45%'][line]} /></span>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
      <div className='odt-foot odc-root'>
        <div className='odt-foot-selector'>
          <Skeleton size='100%' block='var(--od-x-control-height)' shape='box' />
        </div>
      </div>
    </div>
  </div>
)
