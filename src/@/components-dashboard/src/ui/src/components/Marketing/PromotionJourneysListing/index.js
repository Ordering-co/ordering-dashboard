import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Trash, X } from 'react-bootstrap-icons'
import {
  EnterprisePromotionList as EnterprisePromotionListController,
  ToastType,
  useConfig,
  useLanguage,
  useToast
} from '../../../../../index'
import { Confirm, Schedule, SelectBusinessCategories } from '../../Shared'
import { JourneyProductPicker } from './JourneyProductPicker'
import { JOURNEY_TEMPLATES } from './journeyTemplates'
import {
  buildJourneyPayload,
  buildJourneySummary,
  buildJourneyUpdatePayload,
  captureJourneyEvent,
  getInitialJourneyForm,
  getJourneyChannelsStatus,
  getJourneyFormFromPromotion,
  getJourneyValueWithDefaultTime,
  validateJourneyForm
} from './journeyUtils'
import {
  ActionBar,
  ActionButton,
  ApiError,
  Builder,
  BuilderBody,
  BuilderHeader,
  BusinessList,
  BusinessOption,
  CheckGrid,
  ChoiceGroup,
  CloseButton,
  EmptyState,
  ErrorText,
  Field,
  FieldHint,
  FormGrid,
  Hero,
  JourneysContainer,
  PromotionCard,
  PromotionAction,
  PromotionCardActions,
  PromotionControls,
  PromotionDeleteAction,
  PromotionGrid,
  PromotionPagination,
  PromotionToggle,
  ScopeBox,
  ScopeHint,
  ScopeMode,
  ScopeModeButton,
  Section,
  Status,
  TemplateCard,
  TemplateAction,
  TemplateContent,
  TemplateGrid,
  TemplateMeta,
  TemplateVisual,
  UnavailableNotice
} from './styles'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'

const FormError = ({ message }) => message ? <ErrorText role='alert'>{message}</ErrorText> : null

const hasExcludedRelationships = promotion => [
  ...(promotion?.products || []),
  ...(promotion?.categories || [])
].some(relationship => {
  const include = relationship?.pivot?.include ?? relationship?.include
  return include === false || Number(include) === 0
})

const getTranslatedTemplateCopy = (template, t) => {
  const copy = {
    first_order: {
      title: t('QUICK_OFFER_FIRST_PURCHASE', 'First purchase'),
      description: t('QUICK_OFFER_FIRST_PURCHASE_DESCRIPTION', 'Welcome customers who have not placed an order yet.'),
      audience: t('QUICK_OFFER_FIRST_PURCHASE_AUDIENCE', 'Customers with exactly 0 orders')
    },
    second_order: {
      title: t('QUICK_OFFER_SECOND_PURCHASE', 'Second purchase'),
      description: t('QUICK_OFFER_SECOND_PURCHASE_DESCRIPTION', 'Give first-time buyers a reason to order again.'),
      audience: t('QUICK_OFFER_SECOND_PURCHASE_AUDIENCE', 'Customers with exactly 1 order')
    },
    free_delivery: {
      title: t('QUICK_OFFER_FREE_DELIVERY', 'Free delivery'),
      description: t('QUICK_OFFER_FREE_DELIVERY_DESCRIPTION', 'Remove the delivery fee after a minimum purchase.'),
      audience: t('QUICK_OFFER_FREE_DELIVERY_AUDIENCE', 'Customers who meet the minimum purchase')
    },
    minimum_purchase: {
      title: t('QUICK_OFFER_MINIMUM_PURCHASE', 'Minimum purchase reward'),
      description: t('QUICK_OFFER_MINIMUM_PURCHASE_DESCRIPTION', 'Encourage customers to reach a higher subtotal.'),
      audience: t('QUICK_OFFER_MINIMUM_PURCHASE_AUDIENCE', 'Orders that meet the minimum subtotal')
    },
    buy_x_get_y: {
      title: t('QUICK_OFFER_BUY_X_GET_Y', 'Buy X, get Y'),
      description: t('QUICK_OFFER_BUY_X_GET_Y_PRODUCTS_DESCRIPTION', 'Make items free from the same product selection used to qualify.'),
      audience: t('QUICK_OFFER_BUY_X_GET_Y_PRODUCTS_AUDIENCE', 'Orders containing selected products')
    },
    loyalty_reward: {
      title: t('QUICK_OFFER_LOYALTY_REWARD', 'Loyalty level reward'),
      description: t('QUICK_OFFER_LOYALTY_REWARD_DESCRIPTION', 'Offer a benefit to selected loyalty levels.'),
      audience: t('QUICK_OFFER_LOYALTY_REWARD_AUDIENCE', 'Customers in selected loyalty levels')
    },
    slow_hours: {
      title: t('QUICK_OFFER_HAPPY_HOUR', 'Happy hour'),
      description: t('QUICK_OFFER_SLOW_HOURS_DESCRIPTION', 'Drive demand during selected days and hours.'),
      audience: t('QUICK_OFFER_SLOW_HOURS_AUDIENCE', 'Orders placed during the configured schedule')
    },
    winback: {
      title: t('QUICK_OFFER_WE_MISS_YOU', 'We miss you'),
      description: t('QUICK_OFFER_WINBACK_DESCRIPTION', 'Reward customers after a period without ordering.'),
      audience: t('QUICK_OFFER_WINBACK_AUDIENCE', 'Customers inactive for the configured number of days')
    }
  }
  return copy[template.key] || { title: template.title, description: template.description, audience: template.audience }
}

const PromotionJourneysListingUI = (props) => {
  const {
    promotionListState,
    businessesList,
    businessesPaginationProps,
    searchBusinesses,
    handleChangeBusinessPage,
    sitesState,
    getPromotions,
    paginationProps,
    handleSuccessDeletePromotion,
    handleSuccessUpdatePromotions,
    saveJourney,
    updateJourneyStatus,
    deleteJourney,
    loadJourneyLoyaltyLevels,
    loadAllJourneyBusinesses,
    loadPromotionSites,
    onOpenAdvancedPromotion
  } = props
  const [{ configs }] = useConfig()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const journeysContainerRef = useRef(null)

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [form, setForm] = useState(null)
  const [dirtyFields, setDirtyFields] = useState({})
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(null)
  const [validationAttempted, setValidationAttempted] = useState(false)
  const [togglingPromotionId, setTogglingPromotionId] = useState(null)
  const [promotionActionError, setPromotionActionError] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState(null)
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false)
  const [deletingPromotionId, setDeletingPromotionId] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [allBusinessesState, setAllBusinessesState] = useState({ loading: true, businesses: [], error: '' })
  const [loyaltyLevels, setLoyaltyLevels] = useState({ loading: false, values: [], error: '' })

  const loyaltyAvailable = true
  const currencySymbol = configs?.format_number_currency?.value?.trim()
  const allBusinessIds = allBusinessesState.businesses.map(business => Number(business.id)).filter(Number.isFinite)
  const translatedTemplates = useMemo(() => JOURNEY_TEMPLATES.map(template => ({
    ...template,
    copy: getTranslatedTemplateCopy(template, t)
  })), [t])
  const selectedTemplateCopy = selectedTemplate ? getTranslatedTemplateCopy(selectedTemplate, t) : null
  const submissionForm = form
  const generatedDescription = selectedTemplate && submissionForm
    ? buildJourneySummary({ template: selectedTemplate, form: submissionForm, translate: t, audience: selectedTemplateCopy.audience })
    : ''
  const payloadForm = submissionForm
    ? {
        ...submissionForm,
        description: submissionForm.descriptionEdited ? submissionForm.description : generatedDescription
      }
    : null
  const fullPayload = selectedTemplate && payloadForm
    ? buildJourneyPayload({ template: selectedTemplate, form: payloadForm })
    : null
  const payload = draft?.id && fullPayload
    ? buildJourneyUpdatePayload({
      payload: fullPayload,
      dirtyFields,
      descriptionEdited: form?.descriptionEdited,
      requiredPayloadKeys: selectedTemplate.key === 'buy_x_get_y' ? ['include_options'] : []
    })
    : fullPayload
  const channelsStatus = getJourneyChannelsStatus({ promotionId: draft?.id, sitesState })

  const updateForm = changes => {
    setForm(current => ({ ...current, ...changes }))
    setDirtyFields(current => ({
      ...current,
      ...Object.fromEntries(Object.keys(changes).map(key => [key, true]))
    }))
    setApiError('')
  }

  const closeBuilder = () => {
    setSelectedTemplate(null)
    setForm(null)
    setErrors({})
    setApiError('')
    setDraft(null)
    setDirtyFields({})
    setCloseConfirmationOpen(false)
    setValidationAttempted(false)
  }

  // `?template=<key>` (command palette) starts that quick offer once stores
  // and sites are loaded; unknown keys and loyalty without the addon are ignored
  useOpenFromQuery('template', key => {
    const template = JOURNEY_TEMPLATES.find(item => item.key === key)
    if (template) chooseTemplate(template)
  }, {
    ready: !allBusinessesState.loading && !sitesState?.loading,
    accept: key => JOURNEY_TEMPLATES.some(item => item.key === key)
  })

  const requestCloseBuilder = () => {
    if (Object.keys(dirtyFields).length) {
      setCloseConfirmationOpen(true)
      return
    }
    closeBuilder()
  }

  const chooseTemplate = template => {
    if (template.requiresLoyalty && !loyaltyAvailable) return
    const translatedName = getTranslatedTemplateCopy(template, t).title
    setSelectedTemplate(template)
    setForm({
      ...getInitialJourneyForm(template.key),
      name: translatedName,
      currencySymbol: currencySymbol || '',
      sites: (sitesState.sites || []).map(site => site.id),
      allBusinesses: allBusinessIds
    })
    setErrors({})
    setApiError('')
    setDraft(null)
    setDirtyFields({})
    setValidationAttempted(false)
    captureJourneyEvent('template_selected', { template: template.key, objective: template.objective })
  }

  const editPromotion = promotion => {
    if (hasExcludedRelationships(promotion)) {
      onOpenAdvancedPromotion?.(promotion)
      return
    }
    const { template, form: promotionForm } = getJourneyFormFromPromotion({
      promotion,
      allSiteIds: (sitesState.sites || []).map(site => site.id),
      allBusinessIds: allBusinessesState.businesses.map(business => business.id)
    })
    setSelectedTemplate(template)
    setForm({ ...promotionForm, currencySymbol: currencySymbol || '' })
    setErrors({})
    setApiError('')
    setDraft(promotion)
    setDirtyFields({})
    setValidationAttempted(false)
    captureJourneyEvent('existing_promotion_opened', { template: template.key, promotion_id: promotion.id })
  }

  const runValidation = () => {
    const nextErrors = validateJourneyForm({ template: selectedTemplate, form: submissionForm, loyaltyAvailable, channelsStatus, translate: t })
    setValidationAttempted(true)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      captureJourneyEvent('preflight_failed', { template: selectedTemplate.key, fields: Object.keys(nextErrors) })
      return false
    }
    return true
  }

  const finishSuccessfulAction = async (promotion, isNewPromotion) => {
    if (!isNewPromotion && handleSuccessUpdatePromotions) {
      handleSuccessUpdatePromotions(
        promotionListState.promotions.map(item => item.id === promotion.id ? { ...item, ...promotion } : item)
      )
    }
    await getPromotions(isNewPromotion ? 1 : (paginationProps?.currentPage || 1), 10)
    closeBuilder()
  }

  const handleSaveDraft = async () => {
    if (!runValidation() || saving) return
    const isNewPromotion = !draft?.id
    const enabled = isNewPromotion ? false : !!draft.enabled
    setSaving(true)
    setApiError('')
    try {
      const result = await saveJourney({
        payload,
        promotionId: draft?.id,
        enabled
      })
      setDraft(result)
      captureJourneyEvent('draft_saved', { template: selectedTemplate.key, promotion_id: result?.id })
      await finishSuccessfulAction({ ...draft, ...fullPayload, ...result, enabled }, isNewPromotion)
    } catch (error) {
      setApiError(error.message)
      captureJourneyEvent('api_error', { template: selectedTemplate.key, action: 'save_draft' })
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async () => {
    if (!runValidation() || saving) return
    const isNewPromotion = !draft?.id
    setSaving(true)
    setApiError('')
    try {
      const result = await saveJourney({
        payload,
        promotionId: draft?.id,
        enabled: true
      })
      setDraft(result)
      captureJourneyEvent('activated', { template: selectedTemplate.key, promotion_id: result?.id })
      await finishSuccessfulAction({ ...draft, ...fullPayload, ...result, enabled: true }, isNewPromotion)
    } catch (error) {
      setApiError(error.message)
      captureJourneyEvent('api_error', { template: selectedTemplate.key, action: 'activate' })
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePromotion = async (promotion) => {
    if (togglingPromotionId || deletingPromotionId) return
    const enabled = !promotion.enabled
    const scrollElement = document.scrollingElement || document.documentElement
    const previousScrollTop = scrollElement?.scrollTop
    setTogglingPromotionId(promotion.id)
    setPromotionActionError('')
    try {
      await updateJourneyStatus({ promotionId: promotion.id, enabled })
      await getPromotions(paginationProps?.currentPage || 1, 10)
      window.requestAnimationFrame(() => {
        if (scrollElement && Number.isFinite(previousScrollTop)) scrollElement.scrollTop = previousScrollTop
      })
      captureJourneyEvent('status_changed', { promotion_id: promotion.id, enabled })
    } catch (error) {
      setPromotionActionError(error.message)
    } finally {
      setTogglingPromotionId(null)
    }
  }

  const openDeleteConfirmation = promotion => {
    if (togglingPromotionId || deletingPromotionId) return
    setDeleteConfirmation(promotion)
    setDeleteError('')
    setPromotionActionError('')
  }

  const closeDeleteConfirmation = () => {
    if (deletingPromotionId) return
    setDeleteConfirmation(null)
    setDeleteError('')
  }

  const handleDeletePromotion = async () => {
    if (!deleteConfirmation?.id || deletingPromotionId) return
    const promotion = deleteConfirmation
    const currentPage = paginationProps?.currentPage || 1
    const nextPage = currentPage > 1 && displayedPromotions.length === 1 ? currentPage - 1 : currentPage
    const scrollElement = document.scrollingElement || document.documentElement
    const previousScrollTop = scrollElement?.scrollTop
    setDeletingPromotionId(promotion.id)
    setDeleteError('')
    try {
      await deleteJourney({ promotionId: promotion.id })
      handleSuccessDeletePromotion?.(promotion.id)
      setDeleteConfirmation(null)
      await getPromotions(nextPage, 10)
      window.requestAnimationFrame(() => {
        if (scrollElement && Number.isFinite(previousScrollTop)) scrollElement.scrollTop = previousScrollTop
      })
      showToast(ToastType.Success, t('PROMOTION_DELETED', 'Promotion deleted'))
      captureJourneyEvent('promotion_deleted', { promotion_id: promotion.id })
    } catch (error) {
      setDeleteError(error.message)
      captureJourneyEvent('api_error', { action: 'delete_promotion', promotion_id: promotion.id })
    } finally {
      setDeletingPromotionId(null)
    }
  }

  useEffect(() => {
    const onKeyDown = event => {
      const isDatePicker = event.target instanceof HTMLInputElement && event.target.type === 'datetime-local'
      if (event.defaultPrevented) return
      if (event.key === 'Escape' && deleteConfirmation && !deletingPromotionId) {
        closeDeleteConfirmation()
        return
      }
      if (event.key === 'Escape' && selectedTemplate && !saving && !isDatePicker) requestCloseBuilder()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedTemplate, saving, deleteConfirmation, deletingPromotionId, dirtyFields])

  useEffect(() => {
    if (!selectedTemplate || typeof journeysContainerRef.current?.scrollIntoView !== 'function') return
    journeysContainerRef.current.scrollIntoView({ block: 'start' })
  }, [selectedTemplate?.key])

  useEffect(() => {
    if (!validationAttempted || !selectedTemplate || !form) return
    setErrors(validateJourneyForm({ template: selectedTemplate, form: submissionForm, loyaltyAvailable, channelsStatus, translate: t }))
  }, [form, validationAttempted, selectedTemplate?.key, loyaltyAvailable, draft?.id, channelsStatus])

  const loadAllBusinesses = async () => {
    setAllBusinessesState({ loading: true, businesses: [], error: '' })
    try {
      const pageSize = Math.max(Number(businessesPaginationProps?.totalItems) || 0, 100)
      const businesses = await loadAllJourneyBusinesses({ pageSize })
      setAllBusinessesState({ loading: false, businesses, error: '' })
    } catch (error) {
      setAllBusinessesState({ loading: false, businesses: [], error: error.message })
    }
  }

  useEffect(() => {
    loadAllBusinesses()
  }, [])

  useEffect(() => {
    if (!form || form.scopeMode !== 'all' || !allBusinessIds.length) return
    setForm(current => ({ ...current, allBusinesses: allBusinessIds }))
  }, [allBusinessIds.join(','), form?.scopeMode])

  useEffect(() => {
    if (!form || draft?.id || !sitesState.sites?.length) return
    setForm(current => ({ ...current, sites: sitesState.sites.map(site => Number(site.id)) }))
  }, [sitesState.sites, draft?.id])

  useEffect(() => {
    if (!selectedTemplate?.requiresLoyalty || !loyaltyAvailable || loyaltyLevels.values.length || loyaltyLevels.loading) return
    setLoyaltyLevels({ loading: true, values: [], error: '' })
    loadJourneyLoyaltyLevels()
      .then(values => setLoyaltyLevels({ loading: false, values: Array.isArray(values) ? values : [], error: '' }))
      .catch(error => setLoyaltyLevels({ loading: false, values: [], error: error.message }))
  }, [selectedTemplate?.key, loyaltyAvailable])

  if (promotionListState?.error) {
    const errorMessage = Array.isArray(promotionListState.error)
      ? promotionListState.error.join(' ')
      : promotionListState.error?.message || String(promotionListState.error)
    return (
      <JourneysContainer>
        <EmptyState role='alert'>{errorMessage}</EmptyState>
      </JourneysContainer>
    )
  }

  const renderScope = () => (
    <ScopeBox error={errors.scope || errors.sites || allBusinessesState.error}>
      <h3>{t('JOURNEY_BUSINESSES', 'Businesses')}</h3>
      <p>{t('JOURNEY_BUSINESS_SCOPE_DESCRIPTION', 'Use every business, or choose only the locations that should receive this promotion.')}</p>
      <ScopeMode>
        <ScopeModeButton type='button' active={form.scopeMode === 'all'} onClick={() => updateForm({ scopeMode: 'all', businesses: [] })}>
          {t('ALL_BUSINESSES', 'All businesses')}
          <span>{form.scopeMode === 'all' ? <Check /> : null}</span>
        </ScopeModeButton>
        <ScopeModeButton type='button' active={form.scopeMode === 'selected'} onClick={() => updateForm({ scopeMode: 'selected' })}>
          {t('SELECT_BUSINESSES', 'Choose businesses')}
          <span>{form.scopeMode === 'selected' ? <Check /> : null}</span>
        </ScopeModeButton>
      </ScopeMode>
      {form.scopeMode === 'all' && allBusinessesState.loading && (
        <ScopeHint>{t('LOADING_BUSINESSES', 'Loading businesses...')}</ScopeHint>
      )}
      {form.scopeMode === 'all' && allBusinessesState.error && (
        <ActionButton type='button' onClick={loadAllBusinesses}>
          {t('RETRY', 'Retry')}
        </ActionButton>
      )}
      {form.scopeMode === 'selected' && (
        <>
          <Field full>
            {t('SEARCH', 'Search')}
            <input
              type='search'
              placeholder={t('SEARCH_BUSINESSES', 'Search businesses')}
              onChange={event => searchBusinesses(event.target.value)}
            />
          </Field>
          <BusinessList>
            {businessesList.loading
              ? <span>{t('LOADING', 'Loading')}...</span>
              : businessesList.businesses.map(business => {
                const selected = form.businesses.map(Number).includes(Number(business.id))
                return (
                  <BusinessOption key={business.id} selected={selected}>
                    <span>{business.name}</span>
                    <input
                      type='checkbox'
                      checked={selected}
                      onChange={event => {
                        const businesses = event.target.checked
                          ? [...form.businesses, Number(business.id)]
                          : form.businesses.filter(id => Number(id) !== Number(business.id))
                        updateForm({
                          businesses,
                          ...(!event.target.checked && Number(form.selectedBusinessId) === Number(business.id)
                            ? { selectedBusinessId: '', products: {}, categories: {} }
                            : {})
                        })
                      }}
                    />
                  </BusinessOption>
                )
              })}
          </BusinessList>
          {businessesPaginationProps?.totalPages > 1 && (
            <ChoiceGroup>
              <ActionButton
                type='button'
                disabled={businessesPaginationProps.currentPage <= 1}
                onClick={() => handleChangeBusinessPage(businessesPaginationProps.currentPage - 1)}
              >
                {t('PREVIOUS', 'Previous')}
              </ActionButton>
              <span>{businessesPaginationProps.currentPage} / {businessesPaginationProps.totalPages}</span>
              <ActionButton
                type='button'
                disabled={businessesPaginationProps.currentPage >= businessesPaginationProps.totalPages}
                onClick={() => handleChangeBusinessPage(businessesPaginationProps.currentPage + 1)}
              >
                {t('NEXT', 'Next')}
              </ActionButton>
            </ChoiceGroup>
          )}
          <ScopeHint>{form.businesses.length} {t('BUSINESSES_SELECTED', 'businesses selected')}</ScopeHint>
        </>
      )}
      <FormError message={errors.scope || errors.sites || allBusinessesState.error} />
    </ScopeBox>
  )

  const renderTemplateSpecificFields = () => {
    if (selectedTemplate.key === 'buy_x_get_y') {
      const availableBusinesses = allBusinessesState.businesses.length
        ? allBusinessesState.businesses
        : businessesList.businesses
      const selectedBusiness = availableBusinesses.find(business => Number(business.id) === Number(form.selectedBusinessId))
      return (
        <ScopeBox error={errors.eligibility || errors.eligibilityBusiness || errors.rate || errors.minimum}>
          <h3>{t('QUICK_OFFER_BUY_X_RULE', 'Buy X, get Y rule')}</h3>
          <p>{t('QUICK_OFFER_BUY_X_RULE_HINT', 'Choose one store and the products that can qualify. The free items will come from this same product selection.')}</p>
          <FormGrid>
            <Field full error={errors.eligibilityBusiness}>
              {t('QUICK_OFFER_PROMOTION_STORE', 'Promotion store')}
              <select
                value={form.selectedBusinessId}
                onChange={event => updateForm({
                  selectedBusinessId: event.target.value,
                  scopeMode: 'selected',
                  businesses: event.target.value ? [Number(event.target.value)] : [],
                  products: {},
                  categories: {}
                })}
              >
                <option value=''>{t('SELECT', 'Select')}</option>
                {availableBusinesses.map(business => (
                  <option key={business.id} value={business.id}>{business.name}</option>
                ))}
              </select>
              <FormError message={errors.eligibilityBusiness} />
            </Field>
          </FormGrid>
          {selectedBusiness && form.eligibilityKind === 'products' && (
            <JourneyProductPicker
              key={selectedBusiness.id}
              businessId={selectedBusiness.id}
              businessSlug={selectedBusiness.slug}
              selectedProductsIds={form.products}
              setSelectedProductsIds={products => updateForm({ products })}
            />
          )}
          {selectedBusiness && form.eligibilityKind === 'categories' && (
            <SelectBusinessCategories
              slug={selectedBusiness.slug}
              selectedCategoryIds={form.categories}
              setSelectedCategoryIds={categories => updateForm({ categories })}
              include
            />
          )}
          <FormError message={errors.eligibility} />
          <FormGrid>
            <Field error={errors.minimum}>
              {t('QUICK_OFFER_ELIGIBLE_ITEMS_REQUIRED', 'Eligible items required in cart')}
              <input type='number' min='2' step='1' value={form.minimum} onChange={event => updateForm({ minimum: event.target.value })} />
              <FieldHint>{t('QUICK_OFFER_ELIGIBLE_ITEMS_REQUIRED_HINT', 'Total quantity the customer must add from the selected products.')}</FieldHint>
              <FormError message={errors.minimum} />
            </Field>
            <Field error={errors.rate}>
              {t('QUICK_OFFER_ELIGIBLE_ITEMS_FREE', 'Eligible items that become free')}
              <input type='number' min='1' step='1' value={form.rate} onChange={event => updateForm({ rate: event.target.value })} />
              <FieldHint>{t('QUICK_OFFER_ELIGIBLE_ITEMS_FREE_HINT', 'The free quantity comes from those same selected products.')}</FieldHint>
              <FormError message={errors.rate} />
            </Field>
            <Field full>
              <FieldHint>{t('QUICK_OFFER_BUY_X_RULE_PREVIEW_PREFIX', 'Rule: When the cart contains')} {form.minimum || '___'} {t('QUICK_OFFER_BUY_X_RULE_PREVIEW_MIDDLE', 'eligible items,')} {form.rate || '___'} {t('QUICK_OFFER_BUY_X_RULE_PREVIEW_SUFFIX', 'of them become free.')}</FieldHint>
              <FieldHint>{t('QUICK_OFFER_BUY_X_CART_HINT', 'Customers must add every unit to the cart. The promotion discounts eligible units already in the cart.')}</FieldHint>
            </Field>
          </FormGrid>
        </ScopeBox>
      )
    }
    if (selectedTemplate.requiresLoyalty) {
      return (
        <ScopeBox error={errors.loyalty || loyaltyLevels.error}>
          <h3>{t('LOYALTY_LEVELS', 'Loyalty Levels')}</h3>
          {loyaltyLevels.loading && <p>{t('LOADING', 'Loading')}...</p>}
          <CheckGrid>
            {loyaltyLevels.values.map(level => (
              <label key={level.id}>
                <input
                  type='checkbox'
                  checked={form.loyaltyLevels.includes(level.id)}
                  onChange={event => updateForm({
                    loyaltyLevels: event.target.checked
                      ? [...form.loyaltyLevels, level.id]
                      : form.loyaltyLevels.filter(id => id !== level.id)
                  })}
                />
                {level.name}
              </label>
            ))}
          </CheckGrid>
          <FormError message={errors.loyalty || loyaltyLevels.error} />
        </ScopeBox>
      )
    }
    if (selectedTemplate.requiresSchedule) {
      return (
        <ScopeBox error={errors.schedule}>
          <h3>{t('SCHEDULE_LIMIT', 'Schedule')}</h3>
          <Schedule scheduleList={form.schedule} handleChangeScheduleState={schedule => updateForm({ schedule })} />
          <FormError message={errors.schedule} />
        </ScopeBox>
      )
    }
    if (selectedTemplate.requiresInactivity) {
      return (
        <Field error={errors.inactivityDays}>
          {t('INACTIVE_DAYS', 'Inactive days')}
          <input type='number' min='1' value={form.inactivityDays} onChange={event => updateForm({ inactivityDays: event.target.value })} />
          <FormError message={errors.inactivityDays} />
        </Field>
      )
    }
    return null
  }

  const renderConfigure = () => (
    <BuilderBody>
      <FormGrid>
        <Field full error={errors.name}>
          {t('NAME', 'Promotion name')}
          <input value={form.name} onChange={event => updateForm({ name: event.target.value })} autoFocus />
          <FieldHint>{t('QUICK_OFFER_NAME_CHECKOUT_HINT', 'This will be the offer name your customers see at checkout.')}</FieldHint>
          <FormError message={errors.name} />
        </Field>
        {!selectedTemplate.fields?.hideRate && selectedTemplate.key !== 'buy_x_get_y' && (
          <Field>
            {Number(form.rateType) === 1
              ? t('DISCOUNT_PERCENTAGE', 'Discount (%)')
              : `${t('DISCOUNT', 'Discount')} (${currencySymbol || t('PROJECT_CURRENCY', 'project currency')})`}
            <input type='number' min='0' step='0.01' value={form.rate} onChange={event => updateForm({ rate: event.target.value })} />
            <FormError message={errors.rate} />
          </Field>
        )}
        {selectedTemplate.key !== 'buy_x_get_y' && (
          <Field error={errors.minimum}>
            {t('MINIMUM_PURCHASE', 'Minimum purchase')}
            <input type='number' min='0' step='0.01' value={form.minimum} onChange={event => updateForm({ minimum: event.target.value })} />
            <FormError message={errors.minimum} />
          </Field>
        )}
        {!selectedTemplate.fields?.hideLimit && (
          <Field error={errors.limitPerUser}>
            {t('OFFER_LIMIT_TIMES_PER_USER', 'Uses per customer')}
            <input type='number' min='1' step='1' value={form.limitPerUser} onChange={event => updateForm({ limitPerUser: event.target.value })} />
            <FormError message={errors.limitPerUser} />
          </Field>
        )}
        {Number(form.rateType) === 1 && selectedTemplate.key !== 'buy_x_get_y' && selectedTemplate.key !== 'free_delivery' && (
          <Field error={errors.maxDiscount}>
            {t('MAX_AMOUNT_TO_DISCOUNT', 'Maximum discount')}
            <input type='number' min='0' step='0.01' value={form.maxDiscount} onChange={event => updateForm({ maxDiscount: event.target.value })} />
            <FormError message={errors.maxDiscount} />
          </Field>
        )}
        {selectedTemplate.key === 'buy_x_get_y' && (
          <Field as='div'>
            {t('QUICK_OFFER_PRODUCT_OPTIONS', 'Product options')}
            <UnavailableNotice role='note'>
              {t('QUICK_OFFER_BUY_X_PRODUCT_OPTIONS_UNAVAILABLE', 'Product options are not available for Buy X, get Y promotions yet. Extra option charges will not be discounted.')}
            </UnavailableNotice>
          </Field>
        )}
        {selectedTemplate.fields?.target !== 2 && selectedTemplate.key !== 'buy_x_get_y' && (
          <Field>
            {t('QUICK_OFFER_PRODUCT_OPTIONS', 'Product options')}
            <select
              value={form.includeOptions ? 'include' : 'exclude'}
              onChange={event => updateForm({ includeOptions: event.target.value === 'include' })}
            >
              <option value='exclude'>{t('QUICK_OFFER_EXCLUDE_PRODUCT_OPTIONS', 'Do not include product options')}</option>
              <option value='include'>{t('QUICK_OFFER_INCLUDE_PRODUCT_OPTIONS', 'Include product options')}</option>
            </select>
            <FieldHint>{t('QUICK_OFFER_PRODUCT_OPTIONS_HINT', 'Choose whether the discount also applies to product options.')}</FieldHint>
          </Field>
        )}
        <Field error={errors.coupon}>
          {t('QUESTION_HOW_GOING_APPLIED', 'Application')}
          <select value={form.application} onChange={event => updateForm({ application: event.target.value, applicationEdited: true })}>
            <option value='automatic'>{t('AUTOMATIC_OFFER', 'Automatic')}</option>
            <option value='coupon'>{t('COUPON', 'Coupon')}</option>
          </select>
          {form.application === 'coupon' && (
            <input placeholder={t('COUPON_CODE', 'Coupon code')} value={form.coupon} onChange={event => updateForm({ coupon: event.target.value.replace(/\s+/g, '') })} />
          )}
          <FormError message={errors.coupon} />
        </Field>
        <Field error={errors.start}>
          {t('START_DATE', 'Start Date')}
          <input
            type='datetime-local'
            value={form.start}
            onClick={event => event.currentTarget.showPicker?.()}
            onInput={event => updateForm({
              start: getJourneyValueWithDefaultTime({
                value: event.target.value,
                previousValue: form.start,
                type: 'start'
              })
            })}
          />
          <FormError message={errors.start} />
        </Field>
        <Field error={errors.end}>
          {t('END_DATE', 'End date')}
          <input
            type='datetime-local'
            value={form.end}
            onClick={event => event.currentTarget.showPicker?.()}
            onInput={event => updateForm({
              end: getJourneyValueWithDefaultTime({
                value: event.target.value,
                previousValue: form.end,
                type: 'end'
              })
            })}
          />
          <FormError message={errors.end} />
        </Field>
        {renderTemplateSpecificFields()}
        {selectedTemplate.key !== 'buy_x_get_y' && renderScope()}
        {errors.channels && (
          <Field full>
            <FormError message={errors.channels} />
            {sitesState.error && loadPromotionSites && (
              <ActionButton type='button' onClick={loadPromotionSites}>
                {t('RETRY', 'Retry')}
              </ActionButton>
            )}
          </Field>
        )}
        <Field full>
          {t('DESCRIPTION', 'Description')}
          <textarea
            value={form.descriptionEdited ? form.description : generatedDescription}
            onChange={event => updateForm({ description: event.target.value, descriptionEdited: true })}
          />
          <FieldHint>{t('JOURNEY_DESCRIPTION_HINT', 'Generated from this configuration. You can edit it before saving.')}</FieldHint>
        </Field>
      </FormGrid>
    </BuilderBody>
  )

  const renderActions = () => (
    <ActionBar>
      <ActionButton type='button' onClick={requestCloseBuilder} disabled={saving}>{t('CANCEL', 'Cancel')}</ActionButton>
      <div>
        <ActionButton type='button' disabled={saving} onClick={handleSaveDraft}>
          {saving ? `${t('LOADING', 'Loading')}...` : (draft ? t('SAVE_CHANGES', 'Save changes') : t('SAVE_DRAFT', 'Save draft'))}
        </ActionButton>
        <ActionButton type='button' primary disabled={saving} onClick={handleActivate}>
          {saving ? `${t('LOADING', 'Loading')}...` : t('ACTIVATE', 'Activate')}
        </ActionButton>
      </div>
    </ActionBar>
  )

  const displayedPromotions = promotionListState.promotions.slice(0, 10)

  return (
    <JourneysContainer ref={journeysContainerRef} data-testid='promotion-journeys'>
      {!selectedTemplate
        ? (
          <>
            <Hero>
              <div>
                <h2>{t('PROMOTION_TEMPLATES', 'Promotion templates')}</h2>
                <p>{t('QUICK_OFFERS_DESCRIPTION', 'Choose a proven promotion and configure it on one screen.')}</p>
              </div>
            </Hero>
            <TemplateGrid>
              {translatedTemplates.map(template => {
                const Icon = template.icon
                const disabled = template.requiresLoyalty && !loyaltyAvailable
                const templateCopy = template.copy
                return (
                  <TemplateCard
                    key={template.key}
                    disabled={disabled}
                    onClick={() => chooseTemplate(template)}
                    data-template-key={template.key}
                  >
                    <TemplateContent>
                      <h3>{templateCopy.title}</h3>
                      <p>{templateCopy.description}</p>
                      <TemplateMeta>{disabled ? t('REQUIRES_LOYALTY_LEVELS', 'Requires Loyalty Levels') : templateCopy.audience}</TemplateMeta>
                    </TemplateContent>
                    <TemplateVisual aria-hidden='true'>
                      <Icon />
                      <TemplateAction><ArrowRight /></TemplateAction>
                    </TemplateVisual>
                  </TemplateCard>
                )
              })}
            </TemplateGrid>
            <Section>
              <h2>{t('YOUR_PROMOTIONS', 'Your promotions')}</h2>
              <p>{t('QUICK_OFFERS_YOUR_PROMOTIONS_DESCRIPTION', 'Open any promotion to review or update it without leaving Quick Offers.')}</p>
              {promotionActionError && <ApiError role='alert'>{promotionActionError}</ApiError>}
              {promotionListState.loading && !displayedPromotions.length
                ? <EmptyState>{t('LOADING', 'Loading')}...</EmptyState>
                : displayedPromotions.length
                  ? (
                    <>
                      <PromotionGrid>
                        {displayedPromotions.map(promotion => (
                          <PromotionCard key={promotion.id} data-promotion-id={promotion.id} data-promotion-name={promotion.name}>
                            <header>
                              <h3>{promotion.name}</h3>
                              <PromotionControls>
                                <Status active={promotion.enabled}>{promotion.enabled ? t('ACTIVE', 'Active') : t('DRAFT', 'Draft')}</Status>
                                <PromotionToggle>
                                  <input
                                    type='checkbox'
                                    role='switch'
                                    aria-label={`${promotion.enabled ? t('DISABLE', 'Disable') : t('ENABLE', 'Enable')} ${promotion.name}`}
                                    checked={!!promotion.enabled}
                                    disabled={togglingPromotionId === promotion.id}
                                    onChange={() => handleTogglePromotion(promotion)}
                                  />
                                  <span aria-hidden='true' />
                                </PromotionToggle>
                              </PromotionControls>
                            </header>
                            <p>{promotion.description || t('NO_DESCRIPTION', 'No description')}</p>
                            <PromotionCardActions>
                              <PromotionAction type='button' onClick={() => editPromotion(promotion)}>{t('EDIT_PROMOTION', 'Edit promotion')} <ArrowRight /></PromotionAction>
                              <PromotionDeleteAction
                                type='button'
                                aria-label={`${t('DELETE', 'Delete')} ${promotion.name}`}
                                disabled={togglingPromotionId === promotion.id || deletingPromotionId === promotion.id}
                                onClick={() => openDeleteConfirmation(promotion)}
                              >
                                <Trash aria-hidden='true' /> {t('DELETE', 'Delete')}
                              </PromotionDeleteAction>
                            </PromotionCardActions>
                          </PromotionCard>
                        ))}
                      </PromotionGrid>
                      {paginationProps.totalPages > 1 && (
                        <PromotionPagination aria-label={t('PROMOTIONS_PAGINATION', 'Promotions pagination')}>
                          <ActionButton
                            type='button'
                            disabled={promotionListState.loading || paginationProps.currentPage <= 1}
                            onClick={() => getPromotions(paginationProps.currentPage - 1, 10)}
                          >
                            {t('PREVIOUS', 'Previous')}
                          </ActionButton>
                          <span>{paginationProps.currentPage} / {paginationProps.totalPages}</span>
                          <ActionButton
                            type='button'
                            disabled={promotionListState.loading || paginationProps.currentPage >= paginationProps.totalPages}
                            onClick={() => getPromotions(paginationProps.currentPage + 1, 10)}
                          >
                            {t('NEXT', 'Next')}
                          </ActionButton>
                        </PromotionPagination>
                      )}
                    </>
                    )
                  : <EmptyState>{t('NO_PROMOTIONS', 'No promotions yet. Choose a template to create your first draft.')}</EmptyState>}
            </Section>
          </>
          )
        : (
          <Builder role='region' aria-label={`${selectedTemplateCopy.title} ${t('QUICK_OFFER_BUILDER', 'promotion builder')}`}>
            <BuilderHeader>
              <div>
                <h2>{draft?.id ? t('EDIT_PROMOTION', 'Edit promotion') : selectedTemplateCopy.title}</h2>
                <p>{selectedTemplateCopy.audience}</p>
              </div>
              <CloseButton aria-label={t('CLOSE', 'Close')} onClick={requestCloseBuilder} disabled={saving}><X /></CloseButton>
            </BuilderHeader>
            {renderConfigure()}
            {apiError && <ApiError role='alert'>{apiError}</ApiError>}
            {renderActions()}
          </Builder>
          )}
      <Confirm
        open={!!deleteConfirmation}
        width='min(380px, calc(100vw - 72px))'
        title={deleteConfirmation ? `${t('DELETE', 'Delete')}: ${deleteConfirmation.name}` : t('DELETE', 'Delete')}
        content={t('QUESTION_DELETE_OFFER', 'Are you sure that you want to delete the offer?')}
        acceptText={deletingPromotionId ? `${t('LOADING', 'Loading')}...` : t('DELETE', 'Delete')}
        cancelText={t('CANCEL', 'Cancel')}
        onAccept={handleDeletePromotion}
        onCancel={closeDeleteConfirmation}
        onClose={closeDeleteConfirmation}
      >
        {deleteError && <ApiError role='alert'>{deleteError}</ApiError>}
      </Confirm>
      <Confirm
        open={closeConfirmationOpen}
        width='min(420px, calc(100vw - 72px))'
        title={t('QUICK_OFFER_UNSAVED_CHANGES', 'Discard unsaved changes?')}
        content={t('QUICK_OFFER_UNSAVED_CHANGES_DESCRIPTION', 'Your promotion changes have not been saved.')}
        acceptText={t('DISCARD', 'Discard')}
        cancelText={t('KEEP_EDITING', 'Keep editing')}
        onAccept={closeBuilder}
        onCancel={() => setCloseConfirmationOpen(false)}
        onClose={() => setCloseConfirmationOpen(false)}
      />
    </JourneysContainer>
  )
}

export const PromotionJourneysListing = props => {
  const journeysProps = {
    ...props,
    UIComponent: PromotionJourneysListingUI,
    paginationSettings: {
      initialPage: 1,
      pageSize: 10,
      controlType: 'pages'
    },
    isSearchByPromotionName: true,
    isSearchByPromotionDescription: true
  }
  return <EnterprisePromotionListController {...journeysProps} />
}

export { PromotionJourneysListingUI }
