import React, { useState, useContext, useEffect } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ToggleOn, Dot } from 'react-bootstrap-icons'
import { useTheme } from 'styled-components'

import { useToast, ToastType, useLanguage } from '~components'
import { BillingPaymentOptions as BillingPaymentController } from '../../../../../index'
import { Alert, Button } from '~ui'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { useProjectState } from '../../../contexts/ProjectContext'
import { parseBillingPrice, formatYearlyPrice, priceTypeDictionary } from '../../../utils'

import {
  Container,
  List,
  WrapperPlaceOrderButton,
  BlockTrial,
  BlockContainer,
  BlockPlanLoading,
  PlanDetails,
  PlanWrapper,
  PlanTitle,
  PlanDescription,
  WrapperTierList,
  InfoMessage
} from './styles'

import { PaymentOptionStripe } from './Stripe'

export const BillingPaymentOptionsUI = (props) => {
  const {
    isUpgradeToPro,
    handlePaymethodChange,
    handlePlaceOrder,
    paymethodSelected,
    subscriptionsState,
    placeOrderState,
    confirmState,
    planStateToUpgrade,
    upgradeProPlanId,
    showPlanInformation
  } = props
  const { plan } = planStateToUpgrade
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const theme = useTheme()

  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [selectedSub, setSelectedSub] = useState({})
  const [planPriceState, setPlanPriceState] = useState('monthly')
  const [priceAmount, setPriceAmount] = useState(0)

  const closeAlert = () => {
    setAlertState({ open: false, content: [] })
  }

  const productPlanPrice = ({ amountToAdd = 0, isLgText = false } = {}) => {
    return `${parseBillingPrice(priceAmount + amountToAdd)}${isLgText ? `/${priceTypeDictionary({ type: planPriceState, t })}` : ''}`
  }

  useEffect(() => {
    if (placeOrderState?.error) {
      showToast(ToastType.Error, placeOrderState?.error)
      window.location.href = `${window.location.origin}/home`
    }
    if (!placeOrderState?.error && placeOrderState?.result) {
      showToast(ToastType.Success, t('PLAN_UPDATED_SUCCESSFULLY', 'Plan updated Successfully'))
      window.location.reload()
    }
  }, [placeOrderState])

  useEffect(() => {
    if (confirmState?.error) {
      showToast(ToastType.Error, confirmState?.error)
    }
  }, [confirmState])

  useEffect(() => {
    if (!subscriptionsState?.subscriptions) return
    const checkStatus = isUpgradeToPro ? 'active' : 'past_due'
    const selectedSub = subscriptionsState?.subscriptions?.find((sub) => ((sub?.status === checkStatus) || (isUpgradeToPro && upgradeProPlanId.includes(sub?.plan?.plan?.id))))
    setSelectedSub(selectedSub)
  }, [subscriptionsState.subscriptions])

  useEffect(() => {
    if (planStateToUpgrade.loading || !planStateToUpgrade?.plan || Object.keys(planStateToUpgrade?.plan).length === 0) return
    setPriceAmount(planStateToUpgrade?.plan?.prices[planPriceState]?.amount)
  }, [planStateToUpgrade.loading, planStateToUpgrade?.plan, planPriceState])

  return (
    <Container>
      <List>
        <PaymentOptionStripe
          onSelectCard={handlePaymethodChange}
        />
      </List>
      {showPlanInformation && (
        <InfoMessage>
          <span>{t('UPGRADE_PLAN_INFORMATION_PRO', 'You can create another project, pay per store or upgrade to pro plan')}</span>
        </InfoMessage>
      )}
      {isUpgradeToPro && !(subscriptionsState?.loading || planStateToUpgrade?.loading) && (
        <InfoMessage>
          <span>{t('IF_YOU_CHANGE_PAYMENT_IT_WILL_CHANGE_FOR_SUBSCRIPTION_ALSO', 'If you change your payment method it will also change for your subscription.')}</span>
        </InfoMessage>
      )}
      {isUpgradeToPro && (!planStateToUpgrade?.loading && planStateToUpgrade?.plan && Object.keys(planStateToUpgrade?.plan)?.length > 0) && (
        <BlockTrial style={{ padding: '20px 20px 0' }}>
          <BlockContainer>
            <PlanDetails>
              <PlanWrapper isDescription={!!plan?.description}>
                {!planStateToUpgrade?.loading
                  ? (
                  <>
                    <PlanTitle>
                      <h3 id='plan-title'>{plan?.name}</h3>
                      <PlanDescription fd='column' p={'10px 0'} rotate={planPriceState === 'monthly' ? 180 : 0}>
                        <PlanDescription>
                          <div id='wrap1'>
                            <h4>
                              {planPriceState === 'monthly'
                                ? productPlanPrice({ isLgText: true })
                                : formatYearlyPrice({ isLgText: false, yearlyPrice: priceAmount, t })}
                            </h4>
                            {plan?.prices?.monthly && plan?.prices?.annual && (
                              <div id='action'>
                                <span
                                  id='switch'
                                  onClick={() => setPlanPriceState(planPriceState === 'monthly' ? 'annual' : 'monthly')}
                                >
                                  <ToggleOn color={theme.colors.primary} />
                                </span>
                              </div>
                            )}
                          </div>
                          {planPriceState !== 'monthly' && (
                            <span>{formatYearlyPrice({ yearlyPrice: priceAmount, t })}</span>
                          )}
                        </PlanDescription>
                      </PlanDescription>
                    </PlanTitle>
                    {plan?.description && (
                      <p style={{ marginTop: 0 }} dangerouslySetInnerHTML={{ __html: plan?.description }} />
                    )}
                    <PlanDescription fd='column' rotate={planPriceState === 'monthly' ? 180 : 0}>
                      <span>
                        {t('CHANGE_PAUSE_PLAN_TEXT', 'Change, pause or cancel your plan at any time.')}
                      </span>
                    </PlanDescription>
                  </>
                    )
                  : (
                  <BlockPlanLoading>
                    <Skeleton height={50} style={{ marginBottom: 10 }} />
                    <Skeleton height={30} style={{ marginBottom: 5 }} />
                    <Skeleton height={30} style={{ marginBottom: 5 }} />
                    <Skeleton height={80} style={{ marginBottom: 30 }} />
                    <Skeleton height={50} style={{ marginBottom: 10 }} />
                    <Skeleton height={30} style={{ marginBottom: 5 }} />
                    <Skeleton height={30} style={{ marginBottom: 5 }} />
                    <Skeleton height={80} />
                  </BlockPlanLoading>
                    )}
              </PlanWrapper>
            </PlanDetails>
            {plan?.products?.length !== null && plan?.products?.length > 0 && plan?.products?.some(p => p.product?.description) && (
              <WrapperTierList
                style={{ paddingBottom: 0 }}
                isBorderBottom={plan?.products?.length !== null && plan?.products?.length > 0}
              >
                <h2>{t('PLAN_DETAILS', 'Plan Details')}</h2>
                {plan?.products?.map(product => product.product?.description && (
                  <div key={product.product.id}>
                    <p><Dot />{product.product?.description}</p>
                  </div>
                ))}
              </WrapperTierList>
            )}
            {plan?.features?.length !== null && plan?.features?.length > 0 && (
              <WrapperTierList
                style={{ paddingBottom: 10, paddingTop: 10 }}
              >
                <h2>{t('ALL_FEATURES', 'All features')}</h2>
                {plan?.features?.map((featureName, i) => (
                  <div key={i}>
                    <p><Dot />{featureName}</p>
                  </div>
                ))}
              </WrapperTierList>
            )}
          </BlockContainer>
        </BlockTrial>
      )}

      <WrapperPlaceOrderButton>
        <Button
          color='primary'
          borderRadius='8px'
          disabled={
            !paymethodSelected?.id || placeOrderState.loading || subscriptionsState?.loading || planStateToUpgrade?.loading ||
            (isUpgradeToPro && !planStateToUpgrade?.loading && planStateToUpgrade?.plan && Object.keys(planStateToUpgrade?.plan)?.length === 0)
          }
          onClick={() => handlePlaceOrder({
            propPlanId: planStateToUpgrade?.plan?.id || selectedSub?.plan?.plan?.id,
            period: planPriceState || selectedSub?.interval,
            subscription: selectedSub
          })}
        >
        {placeOrderState.loading ? t('PAYING', 'Paying') : (subscriptionsState?.loading || planStateToUpgrade?.loading) ? t('LOADING', 'Loading') : !paymethodSelected?.id ? t('SELECT_A_CARD', 'Select/Add card') : t('PAY', 'Pay')}
        </Button>
        {(isUpgradeToPro && !planStateToUpgrade?.loading && planStateToUpgrade?.plan && Object.keys(planStateToUpgrade?.plan)?.length === 0) && (
          <p>{t('NO_UPGRADE_PLAN_FOUND', 'No plan found to upgrade')}</p>
        )}
      </WrapperPlaceOrderButton>

      <Alert
        title={t('PAYMENT_METHODS', 'Payment Methods')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </Container>
  )
}
export const BillingPaymentOptions = (props) => {
  const [configFile] = useContext(ConfigFileContext)
  const [projectStatus] = useProjectState()

  const billingPaymentOptionsProps = {
    ...props,
    settings: configFile,
    projectId: projectStatus?.project?.id,
    UIComponent: BillingPaymentOptionsUI
  }
  return (
    <BillingPaymentController {...billingPaymentOptionsProps} />
  )
}
