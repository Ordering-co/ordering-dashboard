import React, { useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { CheckCircleFill, DashCircle } from 'react-bootstrap-icons'
import {
  useLanguage,
  useToast,
  ToastType,
  StripeConnectAccount as StripeConnectAccountController
} from '../../../../../index'
import { Alert, Confirm } from '../Confirm'
import { Button } from '../../../styles'
import {
  AccountActions,
  AccountBadge,
  AccountBadges,
  AccountCard,
  AccountCheck,
  AccountChecks,
  AccountError,
  AccountHeader,
  AccountHelp,
  AccountId,
  AccountNotice,
  AccountTitle
} from './styles'

/**
 * Where an account stands: `ready` once the platform can send it money,
 * `pending` while Stripe still wants something from its owner.
 */
export const getStripeConnectAccountStatus = (account) => {
  if (!account) return 'none'
  if (account.transfers_enabled) return 'ready'
  return account.details_submitted ? 'review' : 'pending'
}

const StripeConnectAccountUI = (props) => {
  const {
    ownerType,
    accountState,
    actionState,
    handleOpenStripe,
    handleGetStripeLink,
    handleDisconnect
  } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [blockedUrl, setBlockedUrl] = useState(null)

  const account = accountState.account
  const status = getStripeConnectAccountStatus(account)
  const statusCopy = {
    none: t('STRIPE_CONNECT_ACCOUNT_STATUS_NONE', 'Not connected'),
    pending: t('STRIPE_CONNECT_ACCOUNT_STATUS_PENDING', 'Details pending'),
    review: t('STRIPE_CONNECT_ACCOUNT_STATUS_REVIEW', 'Not ready to receive payments'),
    ready: t('STRIPE_CONNECT_ACCOUNT_STATUS_READY', 'Ready to receive payments')
  }
  const checks = account
    ? [
        { key: 'details', ok: !!account.details_submitted, label: t('STRIPE_CONNECT_ACCOUNT_CHECK_DETAILS', 'Details submitted') },
        { key: 'transfers', ok: !!account.transfers_enabled, label: t('STRIPE_CONNECT_ACCOUNT_CHECK_TRANSFERS', 'Can receive transfers') },
        { key: 'payouts', ok: !!account.payouts_enabled, label: t('STRIPE_CONNECT_ACCOUNT_CHECK_PAYOUTS', 'Bank payouts enabled') }
      ]
    : []
  const needsInformation = !!(account?.requirements?.currently_due?.length || account?.requirements?.past_due?.length)
  const isNotReady = status === 'pending' || status === 'review'
  // A driver goes back to the onboarding form where they left it. A store's link only authorizes
  // the account again, so what is missing is completed by its owner on Stripe.
  const isDriver = ownerType === 'driver'
  const canContinue = isNotReady && isDriver

  const closeAlert = () => setAlertState({ open: false, content: [] })

  const onOpenStripe = async () => {
    setBlockedUrl(null)
    const { error, result } = await handleOpenStripe()
    if (error) {
      if (result?.length) setAlertState({ open: true, content: result })
      return
    }
    if (!result.opened) setBlockedUrl(result.url)
  }

  // For an administrator to send the driver, who fills the form in on their own
  const onCopyLink = async () => {
    setBlockedUrl(null)
    const { error, result } = await handleGetStripeLink()
    if (error) {
      if (result?.length) setAlertState({ open: true, content: result })
      return
    }
    try {
      await navigator.clipboard.writeText(result.url)
      showToast(ToastType.Success, t('STRIPE_CONNECT_ACCOUNT_LINK_COPIED', 'Onboarding link copied'))
    } catch (err) {
      setBlockedUrl(result.url)
    }
  }

  const onDisconnect = async () => {
    setConfirmOpen(false)
    const { error, result } = await handleDisconnect()
    if (error) {
      if (result?.length) setAlertState({ open: true, content: result })
      return
    }
    showToast(ToastType.Success, t('STRIPE_CONNECT_ACCOUNT_DISCONNECTED', 'Stripe account disconnected'))
  }

  return (
    <AccountCard>
      <AccountHeader>
        <AccountTitle>{t('STRIPE_CONNECT_ACCOUNT_TITLE', 'Stripe account')}</AccountTitle>
        {!accountState.loading && !accountState.error && (
          <AccountBadges>
            {account?.sandbox && <AccountBadge>{t('STRIPE_CONNECT_ACCOUNT_TEST_MODE', 'Test mode')}</AccountBadge>}
            <AccountBadge $tone={status === 'ready' ? 'ready' : status === 'none' ? undefined : 'pending'}>
              {statusCopy[status]}
            </AccountBadge>
          </AccountBadges>
        )}
      </AccountHeader>

      {accountState.loading && <Skeleton height={18} count={3} />}

      {!accountState.loading && accountState.error && (
        <AccountError role='alert'>{accountState.error.join(' ')}</AccountError>
      )}

      {!accountState.loading && !accountState.error && (
        <>
          {account
            ? (
              <>
                <AccountId>{account.account_id}</AccountId>
                <AccountChecks>
                  {checks.map(check => (
                    <AccountCheck key={check.key} $ok={check.ok}>
                      {check.ok ? <CheckCircleFill aria-hidden='true' /> : <DashCircle aria-hidden='true' />}
                      <span>{check.label}</span>
                    </AccountCheck>
                  ))}
                </AccountChecks>
                {needsInformation && (
                  <AccountNotice>
                    {t('STRIPE_CONNECT_ACCOUNT_REQUIREMENTS', 'Stripe is asking this account for more information.')}
                  </AccountNotice>
                )}
                {isNotReady && !canContinue && (
                  <AccountNotice>
                    {t('STRIPE_CONNECT_ACCOUNT_FINISH_ON_STRIPE', 'This account cannot receive payments yet. Its owner completes it from their own Stripe dashboard.')}
                  </AccountNotice>
                )}
              </>
              )
            : (
              <AccountHelp>
                {t('STRIPE_CONNECT_ACCOUNT_EMPTY', 'No Stripe account is connected. Its share of each order waits until one is.')}
                {isDriver && ` ${t('STRIPE_CONNECT_ACCOUNT_DRIVER_HELP', 'The driver can also connect it from the Driver App.')}`}
              </AccountHelp>
              )}

          {blockedUrl && (
            <AccountNotice>
              {!isDriver && `${t('STRIPE_CONNECT_ACCOUNT_BLOCKED', 'Your browser blocked the Stripe window.')} `}
              <a href={blockedUrl} target='_blank' rel='noopener noreferrer'>
                {t('STRIPE_CONNECT_ACCOUNT_OPEN', 'Open Stripe')}
              </a>
            </AccountNotice>
          )}

          <AccountActions>
            {(status === 'none' || canContinue) && (
              <Button color='primary' disabled={actionState.loading} onClick={onOpenStripe}>
                {status !== 'none'
                  ? t('STRIPE_CONNECT_ACCOUNT_CONTINUE', 'Continue in Stripe')
                  : isDriver
                    ? t('STRIPE_CONNECT_ACCOUNT_ONBOARD', 'Start onboarding')
                    : t('STRIPE_CONNECT_ACCOUNT_CONNECT', 'Connect with Stripe')}
              </Button>
            )}
            {isDriver && status !== 'ready' && (
              <Button color='secundary' disabled={actionState.loading} onClick={onCopyLink}>
                {t('STRIPE_CONNECT_ACCOUNT_COPY_LINK', 'Copy onboarding link')}
              </Button>
            )}
            {account && handleDisconnect && (
              <Button color='secundary' disabled={actionState.loading} onClick={() => setConfirmOpen(true)}>
                {t('STRIPE_CONNECT_ACCOUNT_DISCONNECT', 'Disconnect')}
              </Button>
            )}
          </AccountActions>
        </>
      )}

      <Alert
        title={t('STRIPE_CONNECT_ACCOUNT_TITLE', 'Stripe account')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={closeAlert}
        onAccept={closeAlert}
        closeOnBackdrop={false}
      />
      <Confirm
        width='700px'
        title={t('STRIPE_CONNECT_ACCOUNT_TITLE', 'Stripe account')}
        content={t('STRIPE_CONNECT_ACCOUNT_DISCONNECT_CONFIRM', 'Disconnect this Stripe account? Its share of new orders will wait until an account is connected again.')}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
        onAccept={onDisconnect}
        closeOnBackdrop={false}
      />
    </AccountCard>
  )
}

export const StripeConnectAccount = (props) => (
  <StripeConnectAccountController
    {...props}
    UIComponent={StripeConnectAccountUI}
  />
)
