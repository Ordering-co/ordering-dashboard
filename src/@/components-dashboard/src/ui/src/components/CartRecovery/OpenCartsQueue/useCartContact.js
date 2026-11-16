import { useLanguage, useToast, ToastType, useUtils } from '../../../../../index'
import { Copy, Mail, Phone } from '../../Shared/Icon'
import {
  MAILTO_MAX,
  buildCartEmail,
  buildMailtoHref,
  cartTotal,
  contactOf,
  copyText
} from '../../../../../utils/openCarts'

// redesign OC-C (contact, D-4): what the team can do about a cart's customer, as a list of actions (`{ key, label, icon,
// onSelect, variant }`) that the row's ContactMenu draws as menu items and the panel draws as buttons. Only the actions
// whose datum exists are in the list, so nothing is offered that cannot work. Nothing here sends anything: «Email customer»
// opens the user's own mail app with the subject and the cart already written; «Call» opens a tel: link.

// How a link is opened. One small object so a test can spy on it (assigning window.location is not observable otherwise).
export const contactNavigation = {
  open: (href) => { window.location.href = href }
}

const clean = (value) => (typeof value === 'string' ? value.trim() : '')

// A number as it is dialled: digits, and the leading + if there is one
const dialable = (phone) => phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')

// The detail may come as the cart itself or as the controller's `{ loading, error, cart }` entry
const unwrap = (detail) => {
  if (!detail || typeof detail !== 'object') return null
  return 'cart' in detail ? (detail.cart || null) : detail
}

// The price of a line: its own total, else price times quantity, else none (the line is then written without one)
const lineTotal = (product) => {
  const total = product?.total
  if (total !== null && total !== undefined && total !== '' && Number.isFinite(Number(total))) return Number(total)
  const price = product?.price
  if (price !== null && price !== undefined && price !== '' && Number.isFinite(Number(price))) {
    return Number(price) * (Number(product?.quantity) || 1)
  }
  return null
}

/**
 * `useCartContact(cart, detail)` -> `{ actions, contact }`.
 * `cart` is the row of the list (it carries the user and the business); `detail` is the detail of the cart (its products
 * and total), or null while it has not arrived: the email is then written without lines and without a total.
 * `contact` is `contactOf(cart)`.
 */
export const useCartContact = (cart, detail) => {
  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const [, { showToast }] = useToast()

  const contact = contactOf(cart)
  const detailCart = unwrap(detail)

  const copy = async (text, copiedText) => {
    const copied = await copyText(text)
    if (copied) showToast(ToastType.Success, copiedText)
    else showToast(ToastType.Error, t('OPEN_CARTS_COPY_FAILED', "Couldn't copy. Select the text and copy it."))
    return copied
  }

  const writeEmail = () => {
    const business = clean(cart?.business?.name) || clean(detailCart?.business?.name)
    const firstName = clean(cart?.user?.name)
    const products = Array.isArray(detailCart?.products) ? detailCart.products : []
    const items = products
      .filter(product => product && clean(product.name))
      .map(product => ({ quantity: product.quantity ?? 1, name: clean(product.name), total: lineTotal(product) }))
    const total = cartTotal(detailCart)
    // the room for the cart is what MAILTO_MAX leaves once the address is in the link
    const addressLength = buildMailtoHref({ email: contact.email }).length - buildMailtoHref({}).length
    const { subject, body } = buildCartEmail({
      subject: business
        ? t('OPEN_CARTS_EMAIL_SUBJECT', 'Your cart at _business_').replace('_business_', business)
        : t('OPEN_CARTS_EMAIL_SUBJECT_NO_BUSINESS', 'Your cart'),
      greeting: firstName
        ? t('OPEN_CARTS_EMAIL_GREETING', 'Hi _name_,').replace('_name_', firstName)
        : t('OPEN_CARTS_EMAIL_GREETING_NO_NAME', 'Hi,'),
      items,
      totalLine: total === null ? '' : t('OPEN_CARTS_EMAIL_TOTAL', 'Total: _total_').replace('_total_', parsePrice(total)),
      signOff: t('OPEN_CARTS_EMAIL_SIGN_OFF', 'Can we help you finish your order?'),
      moreLabel: (count) => t('OPEN_CARTS_MORE_ITEMS', '+_count_ more items').replace('_count_', count),
      formatLine: ({ quantity, name, total: line }) => (line === null || line === undefined
        ? `${quantity}× ${name}`
        : `${quantity}× ${name} — ${parsePrice(line)}`),
      maxLength: MAILTO_MAX - addressLength
    })
    return buildMailtoHref({ email: contact.email, subject, body })
  }

  const actions = []
  if (contact.email) {
    actions.push({
      key: 'email',
      label: t('OPEN_CARTS_EMAIL_CUSTOMER', 'Email customer'),
      icon: Mail,
      variant: 'primary',
      onSelect: () => contactNavigation.open(writeEmail())
    })
  }
  if (contact.phone) {
    actions.push({
      key: 'call',
      label: t('OPEN_CARTS_CALL_PHONE', 'Call _phone_').replace('_phone_', contact.phone),
      icon: Phone,
      onSelect: () => contactNavigation.open(`tel:${dialable(contact.phone)}`)
    })
    actions.push({
      key: 'copyPhone',
      label: t('OPEN_CARTS_COPY_PHONE', 'Copy phone'),
      icon: Copy,
      onSelect: () => copy(contact.phone, t('OPEN_CARTS_PHONE_COPIED', 'Phone copied'))
    })
  }
  if (contact.email) {
    actions.push({
      key: 'copyEmail',
      label: t('OPEN_CARTS_COPY_EMAIL', 'Copy email'),
      icon: Copy,
      onSelect: () => copy(contact.email, t('OPEN_CARTS_EMAIL_COPIED', 'Email copied'))
    })
  }

  return { actions, contact }
}
