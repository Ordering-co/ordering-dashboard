import React, { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useLanguage, useSession, useUtils } from '../../../../../index'
import { contactOf, parseApiUtc } from '../../../../../utils/openCarts'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { CircleAlert, Ellipsis, Maximize2, Minimize2, Phone, Trash2 } from '../../Shared/Icon'
import {
  Avatar,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Menu,
  RecordPanel,
  Skeleton,
  Status,
  useSplitView
} from '../../Shared/Product'
import { ProductItemAccordion } from '../ProductItemAccordion'
import { OpenCartBill } from '../OpenCartBill'
import { useCartContact } from '../OpenCartsQueue/useCartContact'
import './open-cart-panel.css'

// redesign OC-E: statuses the API gives a cart in /carts/dashboard (CART_STATUS: 0 open, 4 payment failed)
const PAYMENT_FAILED = 4
const RULES_PATH = '/cart-recovery/recovery-actions'

// The text of a translation with its `_slot_` markers replaced by nodes (a figure keeps its own element)
const fill = (text, slots) => {
  const names = Object.keys(slots)
  return String(text)
    .split(new RegExp(`(${names.join('|')})`))
    .map((part, index) => (names.includes(part) ? <React.Fragment key={index}>{slots[part]}</React.Fragment> : part))
}

const figure = value => <span className='odc-figure'>{value}</span>

// The API answers a list of messages, one text or nothing
const messagesOf = (error, t, fallback) => {
  const list = (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())
  const texts = [...new Set(list.map(message => translateApiMessage(t, message, fallback)))]
  return texts.length ? texts : [fallback]
}

// redesign OC-F2 (OC-Q1-09): the reason a detail failed, only as far as it can be said in the user's language: the API's message when
// the project's dictionary translates it (`translateApiMessage`, empty default), never the raw text of a network failure («Failed to fetch»).
const loadErrorDetails = (error, t, fallback) => {
  const list = (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())
  const texts = list.map(message => translateApiMessage(t, message, fallback, ''))
  return [...new Set(texts.filter(text => text && text !== fallback))]
}

const PanelSkeleton = ({ label }) => (
  <div className='ocp-skeleton' role='status' aria-busy='true'>
    <span className='odc-sr-only'>{label}</span>
    {[0, 1].map(row => (
      <div key={row} className='ocp-skeleton-row'>
        <Skeleton size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' shape='round' />
        <div className='ocp-skeleton-lines'>
          <Skeleton size='60%' />
          <Skeleton size='40%' />
        </div>
      </div>
    ))}
    <Skeleton size='30%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='50%' />
  </div>
)

const Party = ({ avatar, name, muted, lines, children }) => (
  <div className='ocp-party'>
    {avatar}
    <span className='ocp-name' data-muted={muted ? '' : undefined}>{name}</span>
    {lines.length > 0 && (
      <ul className='ocp-lines'>
        {lines.map(line => <li key={line.key}><bdi>{line.text}</bdi></li>)}
      </ul>
    )}
    {children}
  </div>
)

/**
 * The panel of an open cart (redesign OC-E), a RecordPanel of Product: the cart's number, its status and last activity,
 * the customer with the ways to reach them, the business, what is in the cart with its bill, and the state of the
 * automatic recovery. It keeps every datum and action of the old OpenCartsDetail (business and customer, products
 * with their options, the bill, expand, delete) and fixes M-7 (no «not found» while it loads), M-10 (a confirmation that
 * names the cart and says what it does), M-12 (contact out of the accordions, with the email action) and M-13.
 *
 * `cart` is the row of the list; `detail` the merged detail (`details[id].cart`: user, user.address, business,
 * updated_at, products, totals). `detailState` is `{ loading, error }`. `onDelete` is the controller's `deleteCart`
 * (`{ ok, error }`); on ok the panel calls `onClose`. The panel never closes itself otherwise.
 */
export const OpenCartPanel = ({
  cart,
  detail,
  detailState,
  onClose,
  onRetry,
  onDelete,
  rules,
  expanded = false,
  onExpandedChange
}) => {
  const [, t] = useLanguage()
  const [{ user: sessionUser }] = useSession()
  const [{ parseDate, optimizeImage }] = useUtils()
  const split = useSplitView()
  const { actions } = useCartContact(cart ?? detail, detail)
  const ids = { customer: useId(), business: useId(), items: useId(), recovery: useId() }

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const base = cart ?? detail
  if (!base) return null

  // The detail brings the totals, the products and the address; the row still has the rest while it loads
  const source = detail
    ? { ...base, ...detail, user: detail.user ?? base.user, business: detail.business ?? base.business }
    : base
  const hasDetail = Boolean(detail)
  const failed = Boolean(detailState?.error) && !hasDetail
  // A detail nobody has asked for yet is a detail on its way, never a missing one (M-7)
  const loading = !hasDetail && !failed
  // redesign OC-F2 (OC-Q1-09): the customer and the business are the row's own data too, so they stay when the detail fails
  const showParties = hasDetail || failed

  const phone = split.mode === 'full'
  const failedPayment = Number(source.status) === PAYMENT_FAILED
  const shrink = value => (value && optimizeImage ? optimizeImage(value, 'h_50,c_limit') : value)

  const updatedAt = parseApiUtc(source.updated_at)
  const when = updatedAt ? parseDate(updatedAt) : null
  const businessName = source.business?.name || null
  let subtitle = null
  if (when && businessName) {
    subtitle = fill(t('OPEN_CART_LAST_ACTIVITY_BUSINESS', 'Last activity _time_ · _business_'), { _time_: figure(when), _business_: businessName })
  } else if (when) {
    subtitle = fill(t('OPEN_CART_LAST_ACTIVITY', 'Last activity _time_'), { _time_: figure(when) })
  } else if (businessName) {
    subtitle = businessName
  }

  const contact = contactOf(source)
  const customerLines = [
    contact.email && { key: 'email', text: contact.email },
    contact.phone && { key: 'phone', text: contact.phone },
    contact.address && { key: 'address', text: contact.address }
  ].filter(Boolean)

  const business = source.business || {}
  const businessPhone = business.phone || business.cellphone || null
  const businessLines = [
    businessPhone && { key: 'phone', text: businessPhone },
    business.email && { key: 'email', text: business.email },
    business.address && { key: 'address', text: business.address }
  ].filter(Boolean)
  // The old panel hid the business from a business owner (level 2)
  const showBusiness = sessionUser?.level !== 2

  const products = Array.isArray(source.products) ? source.products : []
  const itemsHeading = products.length === 1
    ? t('OPEN_CART_IN_CART_ONE', 'In the cart · _count_ item')
    : t('OPEN_CART_IN_CART_MANY', 'In the cart · _count_ items')

  const ruleCount = rules && !rules.loading ? rules : null
  const recoveryText = ruleCount
    ? fill(
      ruleCount.enabled > 0
        ? t('OPEN_CART_RULES_ON', '_on_ of _total_ rules on')
        : t('OPEN_CART_RECOVERY_OFF', 'Automatic recovery is off for this project (_on_ of _total_ rules on).'),
      { _on_: figure(ruleCount.enabled ?? 0), _total_: figure(ruleCount.total ?? 0) }
    )
    : null

  const openDelete = () => {
    setDeleteErrors(null)
    setDeleteOpen(true)
  }
  const cancelDelete = () => {
    if (deleting) return
    setDeleteOpen(false)
    setDeleteErrors(null)
  }
  const loadError = t('OPEN_CART_LOAD_ERROR', "We couldn't load this cart.")
  const loadErrorMore = failed ? loadErrorDetails(detailState.error, t, loadError) : []
  const deleteFallback = t('OPEN_CART_DELETE_ERROR', "We couldn't delete this cart. Try again.")
  const confirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteErrors(null)
    let result
    try {
      result = await onDelete?.(base)
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    if (!mounted.current) return
    setDeleting(false)
    if (result?.ok) {
      setDeleteOpen(false)
      onClose?.()
    } else {
      setDeleteErrors(messagesOf(result?.error, t, deleteFallback))
    }
  }

  const headerActions = (
    <>
      <Menu
        label={t('MORE_ACTIONS', 'More actions')}
        icon={Ellipsis}
        items={[
          { key: 'delete', label: t('OPEN_CART_DELETE', 'Delete cart'), icon: Trash2, tone: 'danger', onSelect: openDelete }
        ]}
      />
      {!phone && onExpandedChange && (
        <IconButton
          icon={expanded ? Minimize2 : Maximize2}
          label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
          onClick={() => onExpandedChange(!expanded)}
        />
      )}
    </>
  )

  return (
    <>
      <RecordPanel
        title={fill(t('OPEN_CART_NUMBER', 'Cart #_id_'), { _id_: figure(base.id) })}
        status={(
          <Status
            family={failedPayment ? 'cancel' : 'pending'}
            label={failedPayment ? t('OPEN_CARTS_PAYMENT_FAILED', 'Payment failed') : t('OPEN_CART_STATUS_OPEN', 'Open')} // the state, not the verb
          />
        )}
        subtitle={subtitle}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={onClose}
        headerActions={headerActions}
      >
        <div className='ocp-body'>
          {loading && <PanelSkeleton label={t('LOADING', 'Loading')} />}

          {showParties && (
            <>
              <section className='ocp-sec' aria-labelledby={ids.customer}>
                <h3 id={ids.customer}>{t('CUSTOMER', 'Customer')}</h3>
                <Party
                  avatar={<Avatar kind='person' size='lg' name={contact.name} src={shrink(source.user?.photo)} />}
                  name={contact.name || t('OPEN_CARTS_GUEST_NO_CONTACT', 'Guest · no contact details')}
                  muted={!contact.name}
                  lines={customerLines}
                >
                  {actions?.length > 0 && (
                    <div className='ocp-actions'>
                      {actions.map((action, index) => (
                        <Button
                          key={action.key}
                          size='sm'
                          variant={index === 0 ? 'primary' : 'secondary'}
                          icon={action.icon}
                          disabled={action.disabled}
                          onClick={() => action.onSelect?.()}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </Party>
              </section>

              {showBusiness && (
                <section className='ocp-sec' aria-labelledby={ids.business}>
                  <h3 id={ids.business}>{t('BUSINESS', 'Business')}</h3>
                  <Party
                    avatar={<Avatar kind='business' name={businessName} src={shrink(business.logo)} />}
                    name={businessName}
                    lines={businessLines}
                  >
                    {businessPhone && (
                      <div className='ocp-actions'>
                        <a className='odc-btn' data-variant='secondary' data-size='sm' href={`tel:${businessPhone}`}>
                          <Phone className='odc-icon' />
                          {t('OPEN_CART_CALL_BUSINESS', 'Call business')}
                        </a>
                      </div>
                    )}
                  </Party>
                </section>
              )}

              {failed
                ? (
                  <section className='ocp-sec'>
                    <EmptyState
                      tone='error'
                      icon={CircleAlert}
                      title={loadError}
                      description={loadErrorMore.length > 0 ? loadErrorMore.join(' ') : undefined}
                      action={onRetry && <Button onClick={onRetry}>{t('RETRY', 'Retry')}</Button>}
                    />
                  </section>
                  )
                : (
                  <section className='ocp-sec' aria-labelledby={ids.items}>
                    <h3 id={ids.items}>{fill(itemsHeading, { _count_: figure(products.length) })}</h3>
                    {products.length === 0
                      ? <p className='ocp-empty'>{t('OPEN_CART_NO_ITEMS', 'No items in this cart.')}</p>
                      : (
                        <div className='ocp-items'>
                          {products.map((product, index) => (
                            <ProductItemAccordion
                              key={product?.code || `${product?.id}-${index}`} // main the line's code, never the product id (it repeats)
                              product={product}
                              toppingsRemoved={source.toppings_removed?.[product?.code]}
                              isCartProduct
                            />
                          ))}
                        </div>
                        )}
                    <OpenCartBill cart={source} />
                  </section>
                  )}
            </>
          )}

          <section className='ocp-sec' aria-labelledby={ids.recovery}>
            <h3 id={ids.recovery}>{t('OPEN_CART_RECOVERY', 'Recovery')}</h3>
            <div className='ocp-recovery'>
              {rules?.loading
                ? <Skeleton size='60%' />
                : recoveryText && <p className='ocp-recovery-text'>{recoveryText}</p>}
              <Link className='odc-btn' data-variant='link' to={RULES_PATH}>{t('OPEN_CARTS_MANAGE_RULES', 'Manage rules')}</Link>
            </div>
          </section>
        </div>
      </RecordPanel>

      <ConfirmDialog
        open={deleteOpen}
        title={fill(t('OPEN_CART_DELETE_TITLE', 'Delete cart #_id_?'), { _id_: figure(base.id) })}
        confirmLabel={t('OPEN_CART_DELETE', 'Delete cart')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      >
        {t('OPEN_CART_DELETE_BODY', "This empties the customer's cart. This can't be undone.")}
        {deleteErrors && (
          <div className='ocp-dialog-error' role='alert'>
            {deleteErrors.map(message => <div key={message}>{message}</div>)}
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}
