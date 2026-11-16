import React, { useEffect, useId, useRef, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { CircleCheck } from '../../Shared/Icon'
import { Avatar, Button, CopyButton } from '../../Shared/Product'
import { isCashWalletOn, isPointsWalletOn, phoneOf, walletOf } from './customerData'
import './customer-panel.css'

// redesign UC-B4 (decision 11): a number the eye compares sits in a node of its own
const figure = (value) => <span className='odc-figure'>{value}</span>

const COPIED_FOR_MS = 2000

const Verified = ({ label }) => (
  <span className='ucp-verified'>
    <CircleCheck className='odc-icon' aria-hidden='true' />
    {label}
  </span>
)

/**
 * The Overview section of the customer panel (redesign UC-B4, decision 1, auditor #13): who the customer is and where
 * they stand, with a shortcut to the section that edits each thing. Nothing here is editable.
 * redesign UC-R2 (M3-1): the rows are `div > dt + dd`, with the shortcut inside the `dd` (a `div` of a `dl` admits nothing else).
 *
 *  - `user`: the customer (`email`, `cellphone`, `country_phone_code`, `email_verified`, `phone_verified`, `orders_count`,
 *    `wallets`, `loyalty_level`, `created_at`).
 *  - `configs`: the project's configs; a balance shows only with its add-on.
 *  - `onGoTo(sectionId, extra)`: «View orders» → `('orders')`; «Adjust balance» → `('wallet', { wallet: 'cash' | 'points' })`.
 */
export const CustomerOverview = ({ user, configs, onGoTo }) => {
  const [, t] = useLanguage()
  const [{ parseDate, parsePrice }] = useUtils()
  const ids = { contact: useId(), account: useId(), cash: useId(), points: useId() }

  // «Copied» (or why not) stays for a moment in a status, for whoever cannot see the button change
  const [copyNote, setCopyNote] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const announce = (note) => {
    clearTimeout(timer.current)
    setCopyNote(note)
    timer.current = setTimeout(() => setCopyNote(null), COPIED_FOR_MS)
  }
  // redesign stores 5.18: the copy itself is P/CopyButton (iconOnly: its glyph turns into a check, and it copies over http
  // too); review F2: the block keeps saying the result in its own line (`announce={false}`), so a failure never squeezes the value
  const copyButton = (text, label) => (
    <CopyButton
      iconOnly
      announce={false}
      onResult={announce}
      size='sm'
      text={text}
      label={label}
      copiedLabel={t('COPIED', 'Copied')}
      failedLabel={t('CUSTOMERS_COPY_FAILED', "We couldn't copy. Select the text and copy it.")}
    />
  )

  if (!user) return null
  const email = user.email || null
  const phone = phoneOf(user)
  const orders = Number(user.orders_count)
  const cashWallet = walletOf(user, 'cash')
  const pointsWallet = walletOf(user, 'credit_point')
  const levelName = user.loyalty_level?.name || null
  const since = user.created_at ? parseDate(user.created_at, { dateOnly: true }) : null

  const money = (wallet) => {
    if (!wallet || wallet.balance == null) return null
    const amount = parseFloat(wallet.balance) || 0
    return amount < 0 ? `-${parsePrice(Math.abs(amount))}` : parsePrice(amount)
  }
  const points = (wallet) => {
    if (!wallet || wallet.balance == null) return null
    return new Intl.NumberFormat().format(Number(wallet.balance) || 0)
  }
  const dash = <span className='ucp-muted'>—</span>

  // redesign UC-R2 (parity with main, whose first view showed the photo): decorative, the name is the panel's title.
  // Initials come from the real name only: «No name» would paint «NN».
  const fullName = [user.name, user.lastname].filter(part => part != null && String(part).trim() !== '').join(' ')

  const copyNoteText = copyNote === 'copied'
    ? t('COPIED', 'Copied')
    : copyNote === 'failed'
      ? t('CUSTOMERS_COPY_FAILED', "We couldn't copy. Select the text and copy it.")
      : ''

  return (
    <div className='ucp-overview'>
      <div className='ucp-photo'>
        <Avatar className='ucp-avatar' name={fullName} src={user.photo || undefined} size='lg' />
      </div>

      <section className='ucp-sec' aria-labelledby={ids.contact}>
        <h3 id={ids.contact}>{t('CUSTOMERS_CONTACT', 'Contact')}</h3>
        <dl className='ucp-rows'>
          <div className='ucp-row'>
            <dt>{t('EMAIL', 'Email')}</dt>
            <dd>
              <div className='ucp-val'>
                {email
                  ? (
                    <>
                      <bdi className='ucp-value'>{email}</bdi>
                      {!!user.email_verified && <Verified label={t('VERIFIED', 'Verified')} />}
                    </>
                    )
                  : dash}
              </div>
              {email && copyButton(email, t('COPY_EMAIL', 'Copy email'))}
            </dd>
          </div>
          <div className='ucp-row'>
            <dt>{t('PHONE', 'Phone')}</dt>
            <dd>
              <div className='ucp-val'>
                {phone
                  ? (
                    <>
                      <bdi className='ucp-value'>{phone}</bdi>
                      {!!user.phone_verified && <Verified label={t('VERIFIED', 'Verified')} />}
                    </>
                    )
                  : dash}
              </div>
              {phone && copyButton(phone, t('COPY_PHONE', 'Copy phone'))}
            </dd>
          </div>
        </dl>
        <p className='ucp-note' role='status'>{copyNoteText}</p>
      </section>

      <section className='ucp-sec' aria-labelledby={ids.account}>
        <h3 id={ids.account}>{t('CUSTOMERS_ACCOUNT', 'Account')}</h3>
        <dl className='ucp-rows'>
          <div className='ucp-row'>
            <dt>{t('ORDERS', 'Orders')}</dt>
            <dd>
              <div className='ucp-val'>{figure(orders > 0 ? orders : t('NEW', 'New'))}</div>
              <Button variant='link' size='sm' onClick={() => onGoTo?.('orders')}>{t('CUSTOMERS_VIEW_ORDERS', 'View orders')}</Button>
            </dd>
          </div>
          {isCashWalletOn(configs) && (
            <div className='ucp-row'>
              <dt id={ids.cash}>{t('CUSTOMERS_CASH_BALANCE', 'Cash balance')}</dt>
              <dd>
                <div className='ucp-val'>{money(cashWallet) ? figure(money(cashWallet)) : dash}</div>
                <Button variant='link' size='sm' aria-describedby={ids.cash} onClick={() => onGoTo?.('wallet', { wallet: 'cash' })}>
                  {t('CUSTOMERS_ADJUST_BALANCE', 'Adjust balance')}
                </Button>
              </dd>
            </div>
          )}
          {isPointsWalletOn(configs) && (
            <div className='ucp-row'>
              <dt id={ids.points}>{t('CUSTOMERS_POINTS_BALANCE', 'Points balance')}</dt>
              <dd>
                <div className='ucp-val'>{points(pointsWallet) ? figure(points(pointsWallet)) : dash}</div>
                {/* redesign apply-list row 20 (P-6, D-37): «Add points» opens the Wallet already in Add (same confirmation, no extra step) */}
                <div className='ucp-shortcuts'>
                  <Button variant='link' size='sm' aria-describedby={ids.points} onClick={() => onGoTo?.('wallet', { wallet: 'points' })}>
                    {t('CUSTOMERS_ADJUST_BALANCE', 'Adjust balance')}
                  </Button>
                  <Button variant='link' size='sm' aria-describedby={ids.points} onClick={() => onGoTo?.('wallet', { wallet: 'points', mode: 'add' })}>
                    {t('CUSTOMERS_ADD_POINTS', 'Add points')}
                  </Button>
                </div>
              </dd>
            </div>
          )}
          <div className='ucp-row'>
            <dt>{t('LOYALTY_LEVEL', 'Loyalty level')}</dt>
            <dd><div className='ucp-val'>{levelName || dash}</div></dd>
          </div>
          {since && (
            <div className='ucp-row'>
              <dt>{t('CUSTOMERS_MEMBER_SINCE', 'Member since')}</dt>
              <dd><div className='ucp-val'>{figure(since)}</div></dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  )
}
