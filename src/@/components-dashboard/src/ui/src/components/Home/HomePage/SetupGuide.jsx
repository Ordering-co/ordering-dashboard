import React, { useId } from 'react'

import { useLanguage } from '../../../../../index'
import { buildCreateActionEntries } from '../../../../../utils/commandPaletteCreateActions'
import { Button, Skeleton } from '../../Shared/Product'
import { Check } from '../../Shared/Icon'
import './blocks.css'

// redesign home C2 (D3, D9, auditor 10): the order the guide is read in; the controller sends the steps that apply to the level
const STEP_ORDER = ['store', 'menu', 'zone', 'payment', 'drivers', 'domain', 'first_order']

// redesign home C2 (D7): where each step leads. first_order is not here: it takes the route of the palette entry create:custom_order
const STEP_PATHS = {
  store: '/stores/add',
  menu: '/stores/list',
  zone: '/stores/list',
  payment: '/stores/list',
  drivers: '/delivery/drivers-list?add=1'
}

// redesign home R1 (Q-06): the own domain lives in the first web product the menu lets this user open, in this order
const DOMAIN_PATHS = ['/my-products/ordering-website', '/my-products/ordering-website-2', '/my-products/franchises-website']

const withoutQuery = (path) => String(path).split('?')[0]

// redesign home C2 (D4): a plain click navigates inside the dashboard, a modified or middle click stays the browser's
const isPlainClick = (event) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

/** `:done: of :total: done` with each figure in its own isolated node (decision 11). */
const withFigures = (template, values) => template.split(/(:done:|:total:)/).map((part, index) => {
  if (part !== ':done:' && part !== ':total:') return part
  return <span key={index} className='odc-figure'><bdi>{part === ':done:' ? values.done : values.total}</bdi></span>
})

/**
 * Setup guide (redesign home C2, D3, D9): only while the controller says the project is new and the person did not hide it.
 * The controller computes the steps; this paints them and the first pending one is the primary action.
 */
export const SetupGuide = ({ guide, level, canOpen = () => false, onHide, onNavigate, user, configs, headingRef }) => {
  const [, t] = useLanguage()
  const headingId = useId()
  // redesign home R1 (Q-03): `expected` reserves the card from the first paint (what the last visit remembered); without it, the real eligibility
  const expected = guide?.expected ?? guide?.eligible
  if (!guide || guide.hidden || (!expected && !guide.eligible)) return null

  const title = Number(level) === 0
    ? t('HOME_SETUP_TITLE_PROJECT', 'Set up your marketplace')
    : t('HOME_SETUP_TITLE_STORE', 'Set up your store')
  const steps = STEP_ORDER
    .map(id => (guide.steps || []).find(step => step?.id === id))
    .filter(Boolean)

  if (!steps.length || !guide.eligible) {
    // Loading: a card with the shape of the guide. Without steps and not loading there is nothing to paint when the guide could not be read
    if (guide.error || !expected) return null
    // redesign home R1 (Q-03): title, progress line, bar and 5 rows of the step class, so the real card lands on the same boxes
    return (
      <section className='odc-home-block odc-guide' data-slot='home-guide' aria-labelledby={headingId} aria-busy='true'>
        <div className='odc-guide-head'>
          <h2 className='odc-home-block-title' id={headingId} ref={headingRef} tabIndex={-1}>{title}</h2>
          <Skeleton size='calc(var(--od-x-control-height) * 3)' block='var(--od-x-control-height)' shape='box' />
        </div>
        <div className='odc-guide-progress odc-guide-progress-skeleton' aria-hidden='true'>
          <Skeleton size='30%' />
        </div>
        <div className='odc-guide-bar' aria-hidden='true' />
        <ol className='odc-guide-steps' aria-hidden='true'>
          {/* redesign home R1 (Q-03): as many rows as the guide the level gets (5 required, plus drivers and domain for level 0) */}
          {Array.from({ length: Number(level) === 0 ? 7 : 5 }, (_, index) => index).map(index => (
            <li key={index} className='odc-guide-step'>
              <span className='odc-guide-mark' />
              <span className='odc-guide-text'>
                <Skeleton size='55%' />
                <Skeleton size='75%' />
              </span>
              <Skeleton className='odc-guide-action' size='calc(var(--od-x-control-height) * 2)' block='var(--od-x-control-height)' shape='box' />
            </li>
          ))}
        </ol>
      </section>
    )
  }

  const copy = {
    store: { title: t('HOME_SETUP_STORE', 'Create your first store'), text: t('HOME_SETUP_STORE_TEXT', 'Name, logo, address and opening hours.') },
    menu: { title: t('HOME_SETUP_MENU', 'Create a menu with products'), text: t('HOME_SETUP_MENU_TEXT', 'Categories and products your customers can order.') },
    zone: { title: t('HOME_SETUP_ZONE', 'Add a delivery zone'), text: t('HOME_SETUP_ZONE_TEXT', 'Where you deliver and what it costs.') },
    payment: { title: t('HOME_SETUP_PAYMENT', 'Turn on a payment method'), text: t('HOME_SETUP_PAYMENT_TEXT', 'Cash, card or a payment gateway.') },
    drivers: { title: t('HOME_SETUP_DRIVERS', 'Add your drivers'), text: t('HOME_SETUP_DRIVERS_TEXT', 'Only if you deliver with your own fleet.') },
    domain: { title: t('HOME_SETUP_DOMAIN', 'Connect your own domain'), text: t('HOME_SETUP_DOMAIN_TEXT', 'Your website already works on a temporary address.') },
    first_order: { title: t('HOME_SETUP_FIRST_ORDER', 'Receive your first order'), text: t('HOME_SETUP_FIRST_ORDER_TEXT', 'It shows here as soon as it arrives.') }
  }

  // redesign home C2 (D7, D10): the same rule as «Create custom order» of ⌘K, read from its own entry (no new permission rule)
  const can = (path) => Boolean(canOpen(withoutQuery(path)))
  const customOrder = buildCreateActionEntries({ t, can, user, configs }).find(entry => entry.id === 'create:custom_order')
  const domainPath = DOMAIN_PATHS.find(can) || null
  const pathOf = (id) => {
    if (id === 'first_order') return customOrder?.path
    if (id === 'domain') return domainPath
    return can(STEP_PATHS[id]) ? STEP_PATHS[id] : null
  }

  const doneCount = Number(guide.doneCount) || 0
  const requiredCount = Number(guide.requiredCount) || 0
  const percent = requiredCount > 0 ? Math.min(100, Math.round((doneCount / requiredCount) * 100)) : 0
  const progressText = t('HOME_SETUP_PROGRESS', ':done: of :total: done')
  // The visible word is «Start»; the name adds the object, and starts with the visible text (label in name)
  const startLabel = t('HOME_SETUP_START', 'Start')
  // redesign home R1 (Q-06, D3, D9): the primary is the first pending REQUIRED step that has an action; optional steps never are
  const firstPending = steps.find(step => !step.done && !step.optional && pathOf(step.id))?.id

  return (
    <section className='odc-home-block odc-guide' data-slot='home-guide' aria-labelledby={headingId}>
      <div className='odc-guide-head'>
        {/* redesign home R1 (Q-04): F2 moves the focus here after «Show setup guide» */}
        <h2 className='odc-home-block-title' id={headingId} ref={headingRef} tabIndex={-1}>{title}</h2>
        <Button variant='ghost' onClick={onHide}>{t('HOME_SETUP_HIDE', 'Hide guide')}</Button>
      </div>
      <p className='odc-guide-progress'>{withFigures(progressText, { done: doneCount, total: requiredCount })}</p>
      <div
        className='odc-guide-bar'
        role='progressbar'
        aria-labelledby={headingId}
        aria-valuemin={0}
        aria-valuemax={requiredCount}
        aria-valuenow={doneCount}
        aria-valuetext={progressText.replace(':done:', doneCount).replace(':total:', requiredCount)}
        style={{ '--odc-guide-progress': `${percent}%` }}
      >
        <span className='odc-guide-bar-fill' />
      </div>
      <ol className='odc-guide-steps'>
        {steps.map(step => {
          const path = step.done ? null : pathOf(step.id)
          const primary = step.id === firstPending
          const handleClick = (event) => {
            if (event.defaultPrevented || !isPlainClick(event) || !onNavigate) return
            event.preventDefault()
            onNavigate(path)
          }
          return (
            <li key={step.id} className='odc-guide-step' data-step={step.id} data-done={step.done ? '' : undefined}>
              {step.done
                ? (
                  <span className='odc-guide-mark' data-done=''>
                    <Check className='odc-icon' />
                    <span className='odc-sr-only'>{t('HOME_SETUP_DONE', 'Done')}</span>
                  </span>
                  )
                : <span className='odc-guide-mark' aria-hidden='true' />}
              <span className='odc-guide-text'>
                <span className='odc-guide-title'>
                  {copy[step.id].title}
                  {step.optional && <span className='odc-guide-optional'>{t('OPTIONAL', 'Optional')}</span>}
                </span>
                <span className='odc-guide-line'>{copy[step.id].text}</span>
              </span>
              {path && (
                <a
                  className='odc-btn odc-guide-action'
                  href={path}
                  aria-label={`${startLabel} ${copy[step.id].title}`}
                  data-variant={primary ? 'primary' : 'secondary'}
                  data-size='md'
                  onClick={handleClick}
                >
                  {startLabel}
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** The way back to a hidden guide (D3): a ghost button at the foot of the page. */
export const SetupGuideRestore = ({ guide, onShow, buttonRef }) => {
  const [, t] = useLanguage()
  if (!guide?.eligible || !guide.hidden) return null
  return (
    <div className='odc-guide-restore' data-slot='home-guide-restore'>
      {/* redesign home R1 (Q-04): F2 moves the focus here after «Hide guide» */}
      <Button ref={buttonRef} variant='ghost' onClick={onShow}>{t('HOME_SETUP_SHOW', 'Show setup guide')}</Button>
    </div>
  )
}
