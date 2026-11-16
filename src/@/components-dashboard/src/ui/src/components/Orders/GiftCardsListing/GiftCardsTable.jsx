import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useLanguage, useUtils } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import {
  Avatar,
  Button,
  DataTable,
  EmptyState,
  RecordCardList,
  SecretField,
  Status
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { CreditCard, Search, TriangleAlert } from '../../Shared/Icon'
import {
  firstErrorMessage,
  hasError,
  hasRedeemData,
  isDeletedPerson,
  orderIdOf,
  orderPath,
  personContact,
  personName,
  personPhoto,
  recipientOf,
  statusOf
} from './giftCardData'
import './gift-cards.css'

// redesign GC-B (GC-01, GC-02, GC-03, GC-04, GC-14 | D2, D3, D10): the gift cards list as a Product DataTable (and RecordCards under
// 768px). It draws what the controller gives (`cards`) and fetches nothing. redesign (row 42, P-1): the code of the card
// is drawn masked in a read-only P/SecretField («Show» reveals it, one card at a time), in the Gift card cell and in the phone
// cards; the PIN (`password`, the other half of the redemption credential) is still never drawn. There is no detail to open, so the
// rows are plain (no `onOpenRow`, no selection): the controls inside them (the order link, Show) keep their natural tab order.
//
// Props:
//   cards          the page's rows, as GET /gift_cards returns them (see giftCardData.js)
//   loading        true while the page loads: skeleton rows (cards under 768px), `pageSize` of them
//   error          the controller's error (a string, `{ message }` or a list): non-empty replaces the list, with «Retry»
//   status         the active tab: 'pending', 'activated' or any other value the URL carried (drawn as Pending's empty state)
//   searchValue    the text searched; non-blank turns the empty state into «No gift cards match» + «Clear search» + «Look in …»
//   onClearSearch()    «Clear search»
//   onLookIn(status)   «Look in Redeemed / Pending»: the other tab, with the search kept
//   onRetry()      «Retry» of the error state (reload)
//   pageSize       how many skeleton rows to draw while loading (10 by default)

const DEFAULT_PAGE_SIZE = 10
const NONE = '—'

// redesign a narrow column (German at 1440) cut an email anywhere («customer@ordering.c / o»). An email offers a soft
// break after its «@» and before each «.», so it folds there first; `overflow-wrap: anywhere` stays the last resort for a longer part.
const emailBreaks = (email) => email.split(/(@|\.)/).filter(Boolean).map((part, index) => {
  if (part === '@') return <React.Fragment key={index}>@<wbr /></React.Fragment>
  if (part === '.') return <React.Fragment key={index}><wbr />.</React.Fragment>
  return part
})

// redesign GC-B (audit F4): width priorities. A column steps aside when the table is narrower than all the columns that outrank it
// plus its own: Recipient first, then Purchased date. Card, Amount, Status, Purchased by and the Redeemed columns stay. What
// steps aside is not lost: the Gift card cell's lines take the recipient and the date. Widths are the estimate, in px, of what each
// column asks for with its padding (an estimate, not a measure: DataTable only compares them with the width it has).
// redesign GC-B (live 1024): Redeemed date steps aside too; the widths are the ones measured live at 1600 (dates carry the time)
const WIDTH_PRIORITY = ['recipient', 'purchased', 'redeemed']
const COLUMN_WIDTH = { card: 150, amount: 96, status: 124, buyer: 180, recipient: 220, purchased: 216, redeemedBy: 180, redeemed: 224 }

// «a · b · c»: the separators go between the parts, never after the last one
const joined = (parts) => parts.map((part, index) => (
  <React.Fragment key={part.key}>
    {index > 0 && ' · '}
    {part}
  </React.Fragment>
))

// «Redeemed _date_ by _name_» → the placeholders become nodes
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

export const GiftCardsTable = ({
  cards = [],
  loading = false,
  error = null,
  status = 'pending',
  searchValue = '',
  onClearSearch,
  onLookIn,
  onRetry,
  pageSize
}) => {
  const [, t] = useLanguage()
  const [{ parseDate, parsePrice }] = useUtils()
  const isPhone = useIsPhone()
  // the columns DataTable hid for want of width (it reports them once per change)
  const [widthHiddenIds, setWidthHiddenIds] = useState([])
  useEffect(() => {
    if (isPhone) setWidthHiddenIds([]) // the cards have no columns: what a table reported earlier is stale
  }, [isPhone])

  const skeletonCount = Number(pageSize) || DEFAULT_PAGE_SIZE
  const searching = String(searchValue ?? '').trim() !== ''
  const redeemedTab = status === 'activated'
  // D3 (audit F3): Redeemed always; Pending only when some row of the page has redeem data
  const showRedeemed = redeemedTab || hasRedeemData(cards)

  const loadingLabel = t('GIFT_CARDS_LOADING', 'Loading gift cards')
  const listLabel = t('GIFT_CARDS', 'Gift Cards')

  // ---- the parts the table and the cards draw alike ----
  const idPart = (card) => <bdi dir='ltr' className='odc-figure'>{`#${card.id}`}</bdi>
  // GC-01 (decision 13): the project's date format, never the ISO the API sends
  const dateOf = (value) => (value ? <bdi dir='ltr' className='odc-figure'>{parseDate(value)}</bdi> : null)
  const amountOf = (card) => <bdi dir='ltr' className='odc-figure'>{parsePrice(card.amount)}</bdi>

  // D2 (T5): the order the card was bought in, one click away. `order_product` comes null for a card without one.
  const orderLink = (card) => {
    const orderId = orderIdOf(card)
    if (orderId === null) return null
    return (
      <Link key='order' className='odc-btn odc-gc-order' data-variant='link' to={orderPath(orderId)}>
        {/* one flex item, so the link button's gap does not split «Order #n» in two underlines */}
        <span>{t('ORDER', 'Order')} <bdi dir='ltr' className='odc-figure'>{`#${orderId}`}</bdi></span>
      </Link>
    )
  }

  // redesign (row 42, P-1): the code of the card, masked (type password) and read-only; «Show» reveals it, «Hide» masks
  // it again. Named by the card, so the Show buttons of many rows are told apart. A card with no code says «—», as the other cells.
  const codeNode = (card) => {
    const code = card?.code === null || card?.code === undefined ? '' : String(card.code).trim()
    if (!code) return <span className='odc-gc-none'>{NONE}</span>
    const [before, after] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
    return (
      <SecretField
        aria-label={`${t('GIFT_CARD_CODE', 'Gift card code')} #${card.id}`}
        showLabel={t('SHOW', 'Show')}
        hideLabel={t('HIDE', 'Hide')}
        endingLabel={ending => <>{before}{ending}{after}</>}
        value={code}
        readOnly
      />
    )
  }

  const statusLabel = (card) => {
    const { kind, raw } = statusOf(card)
    if (kind === 'pending') return t('ORDER_PENDING', 'Pending')
    if (kind === 'sent') return t('SENT', 'Sent')
    if (kind === 'activated') return t('REDEEMED', 'Redeemed')
    return raw || t('ORDER_PENDING', 'Pending') // a status the API adds later keeps its own text
  }
  const statusNode = (card) => <Status family={statusOf(card).family} label={statusLabel(card)} wrap />

  // The lines under one another in a person's cell: the first is the name (or what stands for it), the rest is muted. Each line
  // isolates its own direction (a Latin email in an Arabic page keeps its order) and carries its full text as `title`.
  const whoLines = (lines) => (
    <span className='odc-gc-who'>
      {lines.filter(line => line.text).map((line, index) => (
        <bdi key={line.key} dir={line.dir} className={index === 0 ? 'odc-gc-name' : 'odc-gc-sub'} title={line.text}>{line.email ? emailBreaks(line.text) : line.text}</bdi>
      ))}
    </span>
  )

  // GC-04: initials without a photo (never an empty box); the name, and under it the phone (the email when there is none)
  const personNode = (person) => {
    const name = personName(person)
    const contact = personContact(person)
    if (!name && !contact) return <span className='odc-gc-none'>{NONE}</span>
    return (
      <span className='odc-gc-person'>
        <Avatar kind='person' name={name} src={personPhoto(person)} />
        {/* (T10): a deleted user says so in a third line; the contact above is already without the API's «_deleted_» suffix */}
        {whoLines([
          { key: 'name', dir: 'auto', text: name },
          { key: 'contact', dir: 'ltr', text: contact, email: contact === personContact({ email: person?.email }) },
          { key: 'deleted', dir: 'auto', text: isDeletedPerson(person) ? t('USER_DELETED', 'User deleted') : '' }
        ])}
      </span>
    )
  }

  // the recipient the buyer typed: the name, and under it the email; either one alone is drawn alone
  const recipientNode = (card) => {
    const { name, email } = recipientOf(card)
    if (!name && !email) return <span className='odc-gc-none'>{NONE}</span>
    return whoLines([{ key: 'name', dir: 'auto', text: name }, { key: 'email', dir: 'ltr', text: email, email: true }])
  }

  // ---- the states that are not rows ----
  const anchored = (content) => <div className='odc-gc-list'>{content}</div>

  const emptyState = () => {
    if (searching) {
      // the tab the person did not choose, with the search kept: where the card may be (audit F1 of the analysis, T1)
      const otherStatus = redeemedTab ? 'pending' : 'activated'
      const lookIn = redeemedTab
        ? t('GIFT_CARDS_LOOK_IN_PENDING', 'Look in Pending')
        : t('GIFT_CARDS_LOOK_IN_REDEEMED', 'Look in Redeemed')
      return (
        <EmptyState
          icon={Search}
          title={t('GIFT_CARDS_NO_MATCH', 'No gift cards match')}
          action={(
            <span className='odc-gc-actions'>
              <Button onClick={() => onClearSearch?.()}>{t('CLEAR_SEARCH', 'Clear search')}</Button>
              <Button onClick={() => onLookIn?.(otherStatus)}>{lookIn}</Button>
            </span>
          )}
        />
      )
    }
    let title = t('GIFT_CARDS_EMPTY', 'No gift cards')
    if (status === 'pending') title = t('GIFT_CARDS_EMPTY_PENDING', 'No pending gift cards')
    else if (redeemedTab) title = t('GIFT_CARDS_EMPTY_REDEEMED', 'No redeemed gift cards')
    return <EmptyState icon={CreditCard} title={title} />
  }

  // GC-02: a failure takes the place of the list, with the message of the API (translated) and the way to try again
  if (!loading && hasError(error)) {
    return anchored(
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('GIFT_CARDS_LOAD_ERROR', "We couldn't load the gift cards.")}
        description={translateApiMessage(t, firstErrorMessage(error), undefined)}
        action={<Button data-gc-retry='' onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  }

  // ---- phone: the same data as cards (F4: nothing of the row is lost) ----
  if (isPhone) {
    const toCard = (card) => {
      const buyer = card.author
      const redeemer = card.activater
      const recipient = recipientOf(card)
      const hasRecipient = Boolean(recipient.name || recipient.email)
      const redeemedAt = dateOf(card.activated_at)
      const redeemerName = personName(redeemer)
      const redeemerContact = personContact(redeemer)
      // «Redeemed _date_ by _name_ · phone»: only what the row has
      let redeemedLine = null
      if (redeemedAt && redeemerName) {
        redeemedLine = fill(t('GIFT_CARDS_REDEEMED_ON_BY', 'Redeemed _date_ by _name_'), { date: redeemedAt, name: <bdi dir='auto'>{redeemerName}</bdi> })
      } else if (redeemedAt) {
        redeemedLine = fill(t('GIFT_CARDS_REDEEMED_ON', 'Redeemed _date_'), { date: redeemedAt })
      } else if (redeemerName || redeemerContact) {
        redeemedLine = <>{t('REDEEMED_BY', 'Redeemed by')} <bdi dir='auto'>{redeemerName || redeemerContact}</bdi></>
      }
      if (redeemedLine && redeemerContact && (redeemerName || redeemedAt)) redeemedLine = <>{redeemedLine} · <bdi dir='ltr'>{redeemerContact}</bdi></>
      // (T10, review): the card has no Redeemed by cell, so a deleted redeemer is said on this line
      if (redeemedLine && isDeletedPerson(redeemer)) redeemedLine = <>{redeemedLine} · {t('USER_DELETED', 'User deleted')}</>
      const purchasedAt = dateOf(card.created_at)
      const order = orderLink(card)
      return {
        id: card.id,
        // redesign (row 69): a gift card has no detail URL; without `link: false` RecordCard drew an <a> with no href
        link: false,
        label: `${t('GIFT_CARD', 'Gift card')} #${card.id}`,
        title: idPart(card),
        status: statusNode(card),
        figure: amountOf(card),
        from: <span className='odc-gc-card-person'>{personNode(buyer)}</span>,
        to: hasRecipient ? <span className='odc-gc-card-person'>{recipientNode(card)}</span> : null,
        schedule: [
          purchasedAt && <span key='purchased'>{fill(t('GIFT_CARDS_PURCHASED_ON', 'Purchased _date_'), { date: purchasedAt })}</span>,
          redeemedLine && <span key='redeemed'>{redeemedLine}</span>
        ],
        actions: (
          <div className='odc-gc-card-actions' data-card-actions=''>{codeNode(card)}{order}</div>
        )
      }
    }
    return anchored(
      <div className='odc-gc-cards'>
        <RecordCardList
          label={listLabel}
          items={loading ? [] : cards.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={skeletonCount}
          empty={emptyState()}
        />
      </div>
    )
  }

  // ---- desktop: one table; the controls inside the rows keep their natural tab order ----
  const cardCell = (card) => {
    const recipientHidden = widthHiddenIds.includes('recipient')
    const purchasedHidden = widthHiddenIds.includes('purchased')
    const redeemedHidden = widthHiddenIds.includes('redeemed')
    const redeemedAt = dateOf(card.activated_at)
    const { name, email } = recipientOf(card)
    const recipientParts = [
      name && <bdi key='name' dir='auto'>{name}</bdi>,
      email && <bdi key='email' dir='ltr'>{email}</bdi>
    ].filter(Boolean)
    const purchasedAt = dateOf(card.created_at)
    return (
      <span className='odc-gc-card'>
        {/* redesign AC-D (G4): «#id» and «Order #n» on one line; the field and its «Ends in» sit in the next one (see gift-cards.css) */}
        <span className='odc-gc-card-head'>
          <span className='odc-gc-id'>{idPart(card)}</span>
          {orderLink(card)}
        </span>
        {codeNode(card)}
        {recipientHidden && recipientParts.length > 0 && (
          <span className='odc-gc-sub'>{t('RECIPIENT', 'Recipient')} {joined(recipientParts)}</span>
        )}
        {purchasedHidden && purchasedAt && (
          <span className='odc-gc-sub'>{fill(t('GIFT_CARDS_PURCHASED_ON', 'Purchased _date_'), { date: purchasedAt })}</span>
        )}
        {redeemedHidden && redeemedAt && (
          <span className='odc-gc-sub'>{fill(t('GIFT_CARDS_REDEEMED_ON', 'Redeemed _date_'), { date: redeemedAt })}</span>
        )}
      </span>
    )
  }

  const DEFINITIONS = {
    card: { header: t('GIFT_CARD', 'Gift card'), rowHeader: true, wrap: true, locked: true, skeleton: { lines: 2 }, cell: cardCell },
    amount: { header: t('AMOUNT', 'Amount'), align: 'end', skeleton: { lines: 1 }, cell: amountOf },
    status: { header: t('STATUS', 'Status'), skeleton: { lines: 1, lead: 'dot' }, cell: statusNode },
    buyer: { header: t('PURCHASED_BY', 'Purchased by'), wrap: true, skeleton: { lines: 2, lead: 'avatar' }, cell: card => personNode(card.author) },
    recipient: { header: t('RECIPIENT', 'Recipient'), wrap: true, skeleton: { lines: 2 }, cell: recipientNode },
    purchased: { header: t('PURCHASED_DATE', 'Purchased date'), skeleton: { lines: 1 }, cell: card => dateOf(card.created_at) },
    redeemedBy: { header: t('REDEEMED_BY', 'Redeemed by'), wrap: true, skeleton: { lines: 2, lead: 'avatar' }, cell: card => personNode(card.activater) },
    redeemed: { header: t('REDEEMED_DATE', 'Redeemed date'), skeleton: { lines: 1 }, cell: card => dateOf(card.activated_at) || <span className='odc-gc-none'>{NONE}</span> }
  }
  const shown = ['card', 'amount', 'status', 'buyer', 'recipient', 'purchased', ...(showRedeemed ? ['redeemedBy', 'redeemed'] : [])]
  // The threshold of a priority column is the width of the table with it and everything that outranks it
  const hideBelow = {}
  let needed = shown.reduce((sum, id) => sum + COLUMN_WIDTH[id], 0)
  WIDTH_PRIORITY.filter(id => shown.includes(id)).forEach(id => {
    hideBelow[id] = needed
    needed -= COLUMN_WIDTH[id]
  })
  const columns = shown.map(id => ({ id, ...DEFINITIONS[id], hideBelow: hideBelow[id] }))

  return anchored(
    <DataTable
      label={listLabel}
      columns={columns}
      rows={cards}
      getRowId={card => card.id}
      onWidthHiddenChange={setWidthHiddenIds}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={skeletonCount}
      empty={emptyState()}
    />
  )
}
