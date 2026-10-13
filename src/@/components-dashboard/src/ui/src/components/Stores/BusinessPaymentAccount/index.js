import React, { useCallback, useMemo, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import { BusinessPaymentAccount as BusinessPaymentAccountController, useLanguage } from '../../../../../index'

import { Button, Switch, DefaultSelect } from '../../../styles'
import { Alert, Confirm } from '../../Shared'

import {
  Container,
  HeaderContainer,
  HeaderTitleContainer,
  SectionCard,
  FormField,
  FormActions,
  AccountDetailRow,
  AccountDetailLabel,
  AccountDetailValue,
  EmptyWrapper,
  MethodBadge,
  StatusBadge,
  ReadOnlyNotice,
  EnabledWrapper,
  OptionCardsWrapper,
  OptionCard,
  SelectWrapper
} from './styles'

const BusinessPaymentAccountUI = (props) => {
  const {
    isAdmin,
    isBusinessOwner,
    accountState,
    methodsState,
    allAccountsState,
    actionState,
    createAccount,
    updateAccount,
    associateAccount,
    dissociateAccount
  } = props

  const [, t] = useLanguage()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [confirmState, setConfirmState] = useState({ open: false, content: '', handleOnAccept: null })

  // Mode: 'choose' | 'create' | 'associate'
  // Business owners go directly to create mode (no associate option)
  const [mode, setMode] = useState(isAdmin ? 'choose' : 'create')

  // Creation form state
  const [selectedGateway, setSelectedGateway] = useState('')
  const [formName, setFormName] = useState('')
  const [formData, setFormData] = useState({})

  // Association state
  const [selectedAccountId, setSelectedAccountId] = useState('')

  // Search states for selects
  const [methodSearchValue, setMethodSearchValue] = useState('')
  const [accountSearchValue, setAccountSearchValue] = useState('')

  // Edit form state (admin only)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editData, setEditData] = useState({})
  const [editEnabled, setEditEnabled] = useState(true)

  const selectedMethod = useMemo(() => {
    if (!selectedGateway) return null
    return methodsState?.methods?.find(m => m.gateway === selectedGateway) || null
  }, [selectedGateway, methodsState?.methods])

  const accountMethod = useMemo(() => {
    if (!accountState?.account?.paymethod) return null
    return methodsState?.methods?.find(m => m.gateway === accountState.account.paymethod) || null
  }, [accountState?.account?.paymethod, methodsState?.methods])

  const cycleLabel = useCallback((method) => {
    if (!method) return ''
    const cycle = method.cycle === 'weekly'
      ? t('WEEKLY', 'Weekly')
      : t('MONTHLY', 'Monthly')
    let dayLabel = ''
    if (method.cycle === 'weekly') {
      const days = [
        t('SUNDAY', 'Sunday'), t('MONDAY', 'Monday'), t('TUESDAY', 'Tuesday'),
        t('WEDNESDAY', 'Wednesday'), t('THURSDAY', 'Thursday'), t('FRIDAY', 'Friday'),
        t('SATURDAY', 'Saturday')
      ]
      dayLabel = days[method.cycle_day] || ''
    } else {
      dayLabel = `${t('DAY', 'Day')} ${method.cycle_day}`
    }
    const time = method.cycle_time || ''
    return `${cycle} - ${dayLabel}${time ? ` (${time})` : ''}`
  }, [t])

  const methodOptions = useMemo(() => {
    const list = methodsState?.methods || []
    const filtered = methodSearchValue
      ? list.filter(m => m.name?.toLowerCase().includes(methodSearchValue.toLowerCase()))
      : list
    return filtered.map(m => ({ value: m.gateway, content: m.name }))
  }, [methodsState?.methods, methodSearchValue])

  const existingAccountOptions = useMemo(() => {
    const list = allAccountsState?.accounts || []
    const filtered = accountSearchValue
      ? list.filter(a => {
        const label = a.name || `${a.paymethod} #${a.id}`
        return label.toLowerCase().includes(accountSearchValue.toLowerCase())
      })
      : list
    return filtered.map(a => ({
      value: a.id,
      content: a.name || `${a.paymethod} #${a.id}`
    }))
  }, [allAccountsState?.accounts, accountSearchValue])

  const handleGatewayChange = (value) => {
    setSelectedGateway(value)
    setFormData({})
    setMethodSearchValue('')
  }

  const handleFormDataChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleCreate = async () => {
    if (!selectedGateway) {
      setAlertState({ open: true, content: [t('PAYMETHOD_REQUIRED', 'Payment method is required')] })
      return
    }

    if (selectedMethod?.data_template?.length > 0) {
      const missingFields = selectedMethod.data_template
        .filter(field => field.required && !formData[field.key]?.trim())
        .map(field => field.name)

      if (missingFields.length > 0) {
        setAlertState({
          open: true,
          content: [t('REQUIRED_FIELDS_MISSING', 'Required fields missing: ') + missingFields.join(', ')]
        })
        return
      }
    }

    const result = await createAccount({
      paymethod: selectedGateway,
      name: formName || undefined,
      data: Object.keys(formData).length > 0
        ? formData
        : undefined
    })

    if (result?.error) {
      const msg = Array.isArray(result?.result)
        ? result.result
        : [String(result?.result || 'Error')]
      setAlertState({ open: true, content: msg })
    }
  }

  const handleAssociate = async () => {
    if (!selectedAccountId) {
      setAlertState({ open: true, content: [t('SELECT_ACCOUNT_REQUIRED', 'Please select an account')] })
      return
    }

    const result = await associateAccount(Number(selectedAccountId))
    if (result?.error) {
      const msg = Array.isArray(result?.result)
        ? result.result
        : [String(result?.result || 'Error')]
      setAlertState({ open: true, content: msg })
    }
  }

  const handleDissociate = () => {
    setConfirmState({
      open: true,
      content: t('QUESTION_DISSOCIATE_PAYMENT_ACCOUNT', 'Are you sure you want to dissociate this payment account from this business?'),
      handleOnAccept: async () => {
        setConfirmState(prev => ({ ...prev, open: false }))
        const result = await dissociateAccount()
        if (result?.error) {
          const msg = Array.isArray(result?.result)
            ? result.result
            : [String(result?.result || 'Error')]
          setAlertState({ open: true, content: msg })
        } else {
          setMode('choose')
        }
      }
    })
  }

  const handleStartEdit = () => {
    const account = accountState?.account
    setEditName(account?.name || '')
    setEditData(account?.data ? { ...account.data } : {})
    setEditEnabled(account?.enabled !== false)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const handleEditDataChange = (key, value) => {
    setEditData(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    const account = accountState?.account
    if (!account?.id) return

    if (accountMethod?.data_template?.length > 0) {
      const missingFields = accountMethod.data_template
        .filter(field => field.required && !editData[field.key]?.toString().trim())
        .map(field => field.name)

      if (missingFields.length > 0) {
        setAlertState({
          open: true,
          content: [t('REQUIRED_FIELDS_MISSING', 'Required fields missing: ') + missingFields.join(', ')]
        })
        return
      }
    }

    const changes = {
      name: editName,
      data: editData,
      enabled: editEnabled
    }

    const result = await updateAccount(account.id, changes)
    if (result?.error) {
      const msg = Array.isArray(result?.result)
        ? result.result
        : [String(result?.result || 'Error')]
      setAlertState({ open: true, content: msg })
    } else {
      setIsEditing(false)
    }
  }

  const isLoading = accountState?.loading || methodsState?.loading

  // Helper to render cycle info row
  const renderCycleInfo = (method) => {
    if (!method) return null
    return (
      <AccountDetailRow>
        <AccountDetailLabel>{t('PAYMENT_CYCLE', 'Payment cycle')}</AccountDetailLabel>
        <AccountDetailValue>{cycleLabel(method)}</AccountDetailValue>
      </AccountDetailRow>
    )
  }

  // Helper to render data fields (read-only)
  const renderDataFields = (account, method) => (
    <>
      {account.data && method?.data_template?.map(field => (
        <AccountDetailRow key={field.key}>
          <AccountDetailLabel>{field.name}</AccountDetailLabel>
          <AccountDetailValue>{account.data[field.key] || '-'}</AccountDetailValue>
        </AccountDetailRow>
      ))}
      {account.data && !method?.data_template?.length && Object.entries(account.data).map(([key, value]) => (
        <AccountDetailRow key={key}>
          <AccountDetailLabel>{key}</AccountDetailLabel>
          <AccountDetailValue>{value || '-'}</AccountDetailValue>
        </AccountDetailRow>
      ))}
    </>
  )

  // --- RENDER ---

  if (isLoading) {
    return (
      <Container>
        <HeaderContainer>
          <HeaderTitleContainer>
            <h1>{t('BUSINESS_PAYMENT_ACCOUNT', 'Business Payment Account')}</h1>
          </HeaderTitleContainer>
        </HeaderContainer>
        <SectionCard>
          <Skeleton height={40} style={{ marginBottom: 15 }} />
          <Skeleton height={40} style={{ marginBottom: 15 }} />
          <Skeleton height={40} style={{ marginBottom: 15 }} />
          <Skeleton height={40} />
        </SectionCard>
      </Container>
    )
  }

  // No account exists — show options
  if (!accountState?.account) {
    const existingAccounts = allAccountsState?.accounts || []
    const hasExistingAccounts = existingAccounts.length > 0

    return (
      <Container>
        <HeaderContainer>
          <HeaderTitleContainer>
            <h1>{t('BUSINESS_PAYMENT_ACCOUNT', 'Business Payment Account')}</h1>
          </HeaderTitleContainer>
        </HeaderContainer>

        <EmptyWrapper>
          <p>{t('NO_PAYMENT_ACCOUNT', 'This business doesn\'t have a payment account yet.')}</p>
        </EmptyWrapper>

        {isAdmin && mode === 'choose' && (
          <OptionCardsWrapper>
            <OptionCard onClick={() => setMode('create')}>
              <h3>{t('CREATE_NEW_ACCOUNT', 'Create new account')}</h3>
              <p>{t('CREATE_NEW_ACCOUNT_DESC', 'Set up a new payment account with a payment method')}</p>
            </OptionCard>
            {hasExistingAccounts && (
              <OptionCard onClick={() => setMode('associate')}>
                <h3>{t('ASSOCIATE_EXISTING_ACCOUNT', 'Associate existing account')}</h3>
                <p>{t('ASSOCIATE_EXISTING_ACCOUNT_DESC', 'Link an existing payment account to this business')}</p>
              </OptionCard>
            )}
          </OptionCardsWrapper>
        )}

        {mode === 'create' && (
          <SectionCard>
            <FormField>
              <label>
                {t('PAYMENT_METHOD', 'Payment method')}
                <span>*</span>
              </label>
              <DefaultSelect
                placeholder={t('SELECT_PAYMENT_METHOD', 'Select payment method')}
                options={methodOptions}
                defaultValue={selectedGateway || null}
                onChange={handleGatewayChange}
                optionInnerMaxHeight='200px'
                isDisabled={actionState?.loading}
              />
            </FormField>

            {selectedGateway && (
              <>
                <FormField>
                  <label>{t('ACCOUNT_NAME', 'Account name')}</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('ACCOUNT_NAME_PLACEHOLDER', 'e.g., Main Business Account')}
                    disabled={actionState?.loading}
                  />
                </FormField>

                {selectedMethod?.data_template?.map(field => (
                  <FormField key={field.key}>
                    <label>
                      {field.name}
                      {field.required && <span>*</span>}
                    </label>
                    <input
                      type={field.type || 'text'}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleFormDataChange(field.key, e.target.value)}
                      placeholder={field.name}
                      disabled={actionState?.loading}
                    />
                  </FormField>
                ))}

                {renderCycleInfo(selectedMethod)}
              </>
            )}

            <FormActions>
              {isAdmin && (
                <Button
                  color="primary"
                  outline
                  onClick={() => setMode('choose')}
                  disabled={actionState?.loading}
                >
                  {t('BACK', 'Back')}
                </Button>
              )}
              <Button
                color="primary"
                onClick={handleCreate}
                disabled={actionState?.loading || !selectedGateway}
              >
                {actionState?.loading
                  ? t('LOADING', 'Loading')
                  : t('CREATE_PAYMENT_ACCOUNT', 'Create Payment Account')
                }
              </Button>
            </FormActions>
          </SectionCard>
        )}

        {isAdmin && mode === 'associate' && (
          <SectionCard>
            <FormField>
              <label>
                {t('SELECT_ACCOUNT', 'Select account')}
                <span>*</span>
              </label>
              <SelectWrapper>
                <DefaultSelect
                  placeholder={t('SELECT_AN_ACCOUNT', 'Select an account')}
                  options={existingAccountOptions}
                  defaultValue={selectedAccountId || null}
                  onChange={(val) => { setSelectedAccountId(val); setAccountSearchValue('') }}
                  isShowSearchBar
                  searchValue={accountSearchValue}
                  handleChangeSearch={setAccountSearchValue}
                  searchBarPlaceholder={t('SEARCH', 'Search')}
                  optionInnerMaxHeight='200px'
                  isDisabled={actionState?.loading}
                />
              </SelectWrapper>
            </FormField>

            <FormActions>
              <Button
                color="primary"
                outline
                onClick={() => setMode('choose')}
                disabled={actionState?.loading}
              >
                {t('BACK', 'Back')}
              </Button>
              <Button
                color="primary"
                onClick={handleAssociate}
                disabled={actionState?.loading || !selectedAccountId}
              >
                {actionState?.loading
                  ? t('LOADING', 'Loading')
                  : t('ASSOCIATE_ACCOUNT', 'Associate Account')
                }
              </Button>
            </FormActions>
          </SectionCard>
        )}

        <Alert
          title={t('WEB_APPNAME', 'Ordering')}
          content={alertState.content}
          acceptText={t('ACCEPT', 'Accept')}
          open={alertState.open}
          onClose={() => setAlertState({ open: false, content: [] })}
          onAccept={() => setAlertState({ open: false, content: [] })}
          closeOnBackdrop={false}
        />
      </Container>
    )
  }

  // Account exists
  const account = accountState.account

  // Business owner — read-only view
  if (isBusinessOwner && !isAdmin) {
    return (
      <Container>
        <HeaderContainer>
          <HeaderTitleContainer>
            <h1>{t('BUSINESS_PAYMENT_ACCOUNT', 'Business Payment Account')}</h1>
          </HeaderTitleContainer>
        </HeaderContainer>

        <SectionCard>
          <AccountDetailRow>
            <AccountDetailLabel>{t('PAYMENT_METHOD', 'Payment method')}</AccountDetailLabel>
            <MethodBadge>{accountMethod?.name || account.paymethod}</MethodBadge>
          </AccountDetailRow>

          {account.name && (
            <AccountDetailRow>
              <AccountDetailLabel>{t('ACCOUNT_NAME', 'Account name')}</AccountDetailLabel>
              <AccountDetailValue>{account.name}</AccountDetailValue>
            </AccountDetailRow>
          )}

          <AccountDetailRow>
            <AccountDetailLabel>{t('STATUS', 'Status')}</AccountDetailLabel>
            <StatusBadge enabled={account.enabled !== false}>
              {account.enabled !== false
                ? t('ENABLED', 'Enabled')
                : t('DISABLED', 'Disabled')
              }
            </StatusBadge>
          </AccountDetailRow>

          {renderCycleInfo(accountMethod)}
          {renderDataFields(account, accountMethod)}

          <ReadOnlyNotice>
            {t('READ_ONLY_BUSINESS_OWNER', 'Your payment account details are read-only. Contact an administrator to make changes.')}
          </ReadOnlyNotice>
        </SectionCard>

        <Alert
          title={t('WEB_APPNAME', 'Ordering')}
          content={alertState.content}
          acceptText={t('ACCEPT', 'Accept')}
          open={alertState.open}
          onClose={() => setAlertState({ open: false, content: [] })}
          onAccept={() => setAlertState({ open: false, content: [] })}
          closeOnBackdrop={false}
        />
      </Container>
    )
  }

  // Admin — editable view
  return (
    <Container>
      <HeaderContainer>
        <HeaderTitleContainer>
          <h1>{t('BUSINESS_PAYMENT_ACCOUNT', 'Business Payment Account')}</h1>
        </HeaderTitleContainer>
      </HeaderContainer>

      <SectionCard>
        <AccountDetailRow>
          <AccountDetailLabel>{t('PAYMENT_METHOD', 'Payment method')}</AccountDetailLabel>
          <MethodBadge>{accountMethod?.name || account.paymethod}</MethodBadge>
        </AccountDetailRow>

        {renderCycleInfo(accountMethod)}

        {!isEditing
          ? (
              <>
                {account.name && (
                  <AccountDetailRow>
                    <AccountDetailLabel>{t('ACCOUNT_NAME', 'Account name')}</AccountDetailLabel>
                    <AccountDetailValue>{account.name}</AccountDetailValue>
                  </AccountDetailRow>
                )}

                <AccountDetailRow>
                  <AccountDetailLabel>{t('STATUS', 'Status')}</AccountDetailLabel>
                  <StatusBadge enabled={account.enabled !== false}>
                    {account.enabled !== false
                      ? t('ENABLED', 'Enabled')
                      : t('DISABLED', 'Disabled')
                    }
                  </StatusBadge>
                </AccountDetailRow>

                {renderDataFields(account, accountMethod)}

                <FormActions>
                  <Button
                    color="primary"
                    outline
                    onClick={handleDissociate}
                    disabled={actionState?.loading}
                  >
                    {t('DISSOCIATE', 'Dissociate')}
                  </Button>
                  <Button
                    color="primary"
                    onClick={handleStartEdit}
                    disabled={actionState?.loading}
                  >
                    {t('EDIT', 'Edit')}
                  </Button>
                </FormActions>
              </>
            )
          : (
              <>
                <FormField>
                  <label>{t('ACCOUNT_NAME', 'Account name')}</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t('ACCOUNT_NAME_PLACEHOLDER', 'e.g., Main Business Account')}
                    disabled={actionState?.loading}
                  />
                </FormField>

                {accountMethod?.data_template?.map(field => (
                  <FormField key={field.key}>
                    <label>
                      {field.name}
                      {field.required && <span>*</span>}
                    </label>
                    <input
                      type={field.type || 'text'}
                      value={editData[field.key] || ''}
                      onChange={(e) => handleEditDataChange(field.key, e.target.value)}
                      placeholder={field.name}
                      disabled={actionState?.loading}
                    />
                  </FormField>
                ))}

                <EnabledWrapper>
                  <AccountDetailLabel>{t('ENABLED', 'Enabled')}</AccountDetailLabel>
                  <Switch
                    defaultChecked={editEnabled}
                    onChange={(val) => setEditEnabled(val)}
                  />
                </EnabledWrapper>

                <FormActions>
                  <Button
                    color="primary"
                    outline
                    onClick={handleCancelEdit}
                    disabled={actionState?.loading}
                  >
                    {t('CANCEL', 'Cancel')}
                  </Button>
                  <Button
                    color="primary"
                    onClick={handleSave}
                    disabled={actionState?.loading}
                  >
                    {actionState?.loading
                      ? t('LOADING', 'Loading')
                      : t('SAVE', 'Save')
                    }
                  </Button>
                </FormActions>
              </>
            )}
      </SectionCard>

      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
      <Confirm
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirmState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirmState.open}
        onClose={() => setConfirmState(prev => ({ ...prev, open: false }))}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
        onAccept={confirmState.handleOnAccept}
        closeOnBackdrop={false}
      />
    </Container>
  )
}

export const BusinessPaymentAccount = (props) => {
  const businessId = props?.businessId
  const businessPaymentAccountProps = {
    ...props,
    businessId,
    UIComponent: BusinessPaymentAccountUI
  }

  return <BusinessPaymentAccountController {...businessPaymentAccountProps} />
}
