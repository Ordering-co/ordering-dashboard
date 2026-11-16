/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// redesign SL-F2 (B1)
const spy = vi.hoisted(() => ({
  calls: {},
  names: [
    'BusinessDetail', 'BusinessSchedule', 'BusinessMenu', 'BusinessDeliveryPickupMore',
    'BusinessPaymentMethods', 'BusinessPreorderDetails', 'BusinessTaxAndFees', 'BusinessPromotionList',
    'BusinessCustomFields', 'BusinessWebhooks', 'BusinessNotifications', 'BusinessOrderingChannels',
    'BusinessFrontLayout', 'BusinessPlaceGroupList', 'SpoonityApiKey', 'BusinessLogs', 'BusinessSalesChannel',
    'BusinessQRCodeOptions', 'BusinessReservations', 'BusinessConfigs', 'BusinessMarkups', 'BusinessFees',
    'BusinessPaymentAccount', 'BusinessWhiteLabel'
  ]
}))

vi.mock('../../index', async () => {
  const { createElement } = await import('react')
  const make = (name) => (props) => {
    spy.calls[name] = [...(spy.calls[name] || []), props]
    return createElement('div', { 'data-testid': name })
  }
  return Object.fromEntries(spy.names.map(name => [name, make(name)]))
})

// main, White Label sites are hidden (WHITE_LABEL_SITES_ENABLED false), so the access rule closes white_label to
// everyone. The branch cases run as if it were on, to keep covering the branch for when it comes back; one case runs with main's rule.
const whiteLabel = vi.hoisted(() => ({ asIfEnabled: true }))
vi.mock('../../../../../../utils/businessDetailSections', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    canAccessBusinessSection: (key, access = {}) => key === 'white_label' && whiteLabel.asIfEnabled
      ? !!access.isAdmin
      : actual.canAccessBusinessSection(key, access)
  }
})

import { StoreSectionBody } from '../StoreSectionBody'

const lastProps = (name) => spy.calls[name]?.at(-1)

const fn = () => vi.fn()
const makeProps = () => ({
  isAdmin: true,
  businessState: {
    loading: false,
    business: {
      id: 42,
      name: 'Fast Bite Centro', // redesign stores 5.18: the sections that name the store get it (toEqual skips undefined)
      types: [{ id: 1 }],
      offers: [{ id: 9 }],
      metafields: [{ id: 5 }],
      configs: []
    }
  },
  handleSucessUpdateBusiness: fn(),
  handleDeleteBusinessOwner: fn(),
  handleAddBusinessOwner: fn(),
  businessTypes: [{ id: 2 }],
  formState: { changes: {} },
  setFormState: fn(),
  handleUpdateBusinessClick: fn(),
  setBusinessTypes: fn(),
  handleSuccessAddBusinessItem: fn(),
  handleSuccessDeleteBusinessItem: fn(),
  handleUpdateBusinessState: fn(),
  actionStatus: { loading: false, error: null },
  handleUpdateBusinessConfigs: fn(),
  handleUpdateSpoonityKey: fn(),
  spoonityKeyState: { loading: false },
  spoonityConfig: { id: 7, key: 'spoonity_integration_api_key' },
  siteState: { sites: [] },
  createCustomTax: fn(),
  getCustomTaxes: fn(),
  setCustomTaxes: fn(),
  taxes: [{ id: 1 }],
  fees: [{ id: 2 }],
  formTaxState: { loading: false },
  taxToEdit: { id: null },
  handleChangeTax: fn(),
  setTaxToEdit: fn(),
  handleSaveTax: fn(),
  handleDeleteTax: fn(),
  formTaxChanges: {},
  setFormTaxChanges: fn(),
  isGoogleRedirectPluginActive: true,
  googleRedirectPluginRoot: 'root',
  googleRedirectPluginLoading: false,
  googleFeedSecondaryIncludedIds: [41, '42'],
  googleFeedInclusionListLoading: true,
  googleFeedSavingBusinessId: 42,
  googleFeedSavingChannel: 'secondary',
  handleGoogleFeedToggle: fn(),
  googleFeedExcludedBusinessIds: [],
  isExtendExtraOpen: false,
  setIsExtendExtraOpen: fn()
})

// Expected props per section, as the branches of BusinessDetailsUI (:251-474)
const branches = (p) => {
  const business = p.businessState.business
  return {
    store_details: ['BusinessDetail', {
      business,
      handleDeleteBusinessOwner: p.handleDeleteBusinessOwner,
      handleAddBusinessOwner: p.handleAddBusinessOwner,
      formState: p.formState,
      setFormState: p.setFormState,
      businessTypes: p.businessTypes,
      handleUpdateBusinessClick: p.handleUpdateBusinessClick,
      setBusinessTypes: p.setBusinessTypes,
      handleSuccessAddBusinessItem: p.handleSuccessAddBusinessItem,
      handleSuccessDeleteBusinessItem: p.handleSuccessDeleteBusinessItem,
      handleSucessUpdateBusiness: p.handleSucessUpdateBusiness,
      setIsExtendExtraOpen: p.setIsExtendExtraOpen,
      isExtendExtraOpen: p.isExtendExtraOpen,
      handleUpdateBusinessState: p.handleUpdateBusinessState,
      isGoogleRedirectPluginActive: p.isGoogleRedirectPluginActive,
      googleRedirectPluginRoot: p.googleRedirectPluginRoot,
      googleRedirectPluginLoading: p.googleRedirectPluginLoading,
      feedInclusionLoading: p.googleFeedInclusionListLoading,
      feedInclusionSaving: true,
      isSecondaryIncluded: true,
      onGoogleFeedToggle: expect.any(Function),
      feedPrimarySaving: false,
      isPrimaryIncluded: true,
      onGoogleFeedPrimaryToggle: expect.any(Function)
    }],
    schedule: ['BusinessSchedule', { business, handleSuccessUpdate: p.handleUpdateBusinessState }],
    menu: ['BusinessMenu', {
      business,
      handleSuccessBusinessMenu: p.handleUpdateBusinessState,
      setIsExtendExtraOpen: p.setIsExtendExtraOpen
    }],
    delivery_pickup_more: ['BusinessDeliveryPickupMore', {
      business,
      setIsExtendExtraOpen: p.setIsExtendExtraOpen,
      handleUpdateBusinessState: p.handleUpdateBusinessState
    }],
    notifications: ['BusinessNotifications', {
      business,
      handleSuccessUpdate: p.handleUpdateBusinessState,
      handleUpdateBusinessClick: p.handleUpdateBusinessClick,
      formState: p.formState,
      setFormState: p.setFormState
    }],
    payment_methods: ['BusinessPaymentMethods', {
      business,
      setIsExtendExtraOpen: p.setIsExtendExtraOpen,
      handleSuccessUpdate: p.handleUpdateBusinessState
    }],
    tax_fees: ['BusinessTaxAndFees', {
      formState: p.formState,
      setFormState: p.setFormState,
      business,
      handleUpdateBusinessClick: p.handleUpdateBusinessClick,
      createCustomTax: p.createCustomTax,
      getCustomTaxes: p.getCustomTaxes,
      setCustomTaxes: p.setCustomTaxes,
      taxes: p.taxes,
      fees: p.fees,
      formTaxState: p.formTaxState,
      formTaxChanges: p.formTaxChanges,
      taxToEdit: p.taxToEdit,
      handleChangeTax: p.handleChangeTax,
      setTaxToEdit: p.setTaxToEdit,
      handleSaveTax: p.handleSaveTax,
      handleDeleteTax: p.handleDeleteTax,
      setFormTaxChanges: p.setFormTaxChanges,
      // redesign stores 5.12: a tax or a customer fee open in its editor takes the full width
      setIsExtendExtraOpen: p.setIsExtendExtraOpen,
      isExtendExtraOpen: p.isExtendExtraOpen
    }],
    promotions: ['BusinessPromotionList', {
      promotions: business.offers,
      businessId: 42,
      business,
      setIsExtendExtraOpen: p.setIsExtendExtraOpen,
      handleSuccessUpdate: p.handleUpdateBusinessState
    }],
    preorder: ['BusinessPreorderDetails', {
      formState: p.formState,
      setFormState: p.setFormState,
      business,
      actionStatus: p.actionStatus,
      handleUpdateBusinessClick: p.handleUpdateBusinessClick,
      handleUpdatePreorderConfigs: p.handleUpdateBusinessConfigs
    }],
    custom_fields: ['BusinessCustomFields', {
      businessId: 42,
      metafields: business.metafields,
      handleSuccessAddMetaFields: expect.any(Function),
      handleSuccessDeleteBusinessMetaFields: expect.any(Function)
    }],
    ordering_channels: ['BusinessOrderingChannels', {
      business,
      handleSuccessUpdate: p.handleUpdateBusinessState,
      handleUpdateBusinessClick: p.handleUpdateBusinessClick,
      formState: p.formState,
      setFormState: p.setFormState
    }],
    publishing: ['BusinessQRCodeOptions', { business, setIsExtendExtraOpen: p.setIsExtendExtraOpen }],
    sales_channels: ['BusinessSalesChannel', {
      business,
      setIsExtendExtraOpen: p.setIsExtendExtraOpen,
      siteState: p.siteState
    }],
    // redesign stores 5.18 (from 5.15b): Layout saves front_layout alone (keepPendingChanges); the shared form is not its own
    layout: ['BusinessFrontLayout', {
      business,
      handleSuccessUpdate: p.handleUpdateBusinessState,
      handleUpdateBusinessClick: p.handleUpdateBusinessClick
    }],
    webhooks: ['BusinessWebhooks', { business, handleSuccessUpdate: p.handleUpdateBusinessState }],
    places: ['BusinessPlaceGroupList', {
      business,
      handleSuccessUpdate: p.handleUpdateBusinessState,
      setIsExtendExtraOpen: p.setIsExtendExtraOpen
    }],
    spoonity_key: ['SpoonityApiKey', {
      business,
      handleSuccessUpdate: p.handleUpdateBusinessState,
      handleUpdateBusinessClick: p.handleUpdateBusinessClick,
      spoonityConfig: p.spoonityConfig,
      handleUpdateSpoonityKey: p.handleUpdateSpoonityKey,
      spoonityKeyState: p.spoonityKeyState
    }],
    logs: ['BusinessLogs', { businessId: 42 }],
    reservations: ['BusinessReservations', {
      business,
      businessId: 42,
      handleUpdateBusinessConfigs: p.handleUpdateBusinessConfigs,
      actionStatus: p.actionStatus
    }],
    configs: ['BusinessConfigs', { business, handleSuccessUpdate: p.handleUpdateBusinessState }],
    // redesign stores 5.13: a fee or a markup open in its detail takes the full width, as tax_fees
    markups: ['BusinessMarkups', { businessId: 42, setIsExtendExtraOpen: p.setIsExtendExtraOpen, isExtendExtraOpen: p.isExtendExtraOpen }],
    business_fees: ['BusinessFees', { businessId: 42, businessName: business.name, setIsExtendExtraOpen: p.setIsExtendExtraOpen, isExtendExtraOpen: p.isExtendExtraOpen }],
    // redesign stores 5.18 (F5 of 5.11): the dissociate confirmation names the store, with the prop 5.13 gave business_fees
    business_payment_account: ['BusinessPaymentAccount', { businessId: 42, businessName: business.name }],
    white_label: ['BusinessWhiteLabel', {
      business,
      handleUpdateBusinessState: p.handleUpdateBusinessState,
      setIsExtendExtraOpen: p.setIsExtendExtraOpen
    }]
  }
}

const SECTION_KEYS = Object.keys(branches(makeProps()))
// redesign stores 4.A (decision 11): markups and business_fees are level 0 only in the body too, as in the menu
const ADMIN_ONLY = ['publishing', 'configs', 'white_label', 'markups', 'business_fees']

describe('StoreSectionBody', () => {
  beforeEach(() => {
    spy.calls = {}
  })

  // `support` and `personalization` were deleted as dead code (decision 8, n.º 22)
  it('covers the 24 sections of the menu', () => {
    expect(SECTION_KEYS).toHaveLength(24)
  })

  it.each(SECTION_KEYS)('%s mounts its component with the props BusinessDetails gives it', (section) => {
    const props = makeProps()
    const [name, expected] = branches(props)[section]

    render(<StoreSectionBody section={section} {...props} />)

    expect(screen.getByTestId(name)).toBeInTheDocument()
    expect(lastProps(name)).toEqual(expected)
    // one branch at a time
    const mounted = spy.names.filter(other => spy.calls[other])
    expect(mounted).toEqual([name])
  })

  it('white_label renders nothing, even for an administrator, while White Label sites are hidden (main)', () => {
    whiteLabel.asIfEnabled = false
    try {
      const { container } = render(<StoreSectionBody section='white_label' {...makeProps()} />)
      expect(screen.queryByTestId('BusinessWhiteLabel')).toBeNull()
      expect(container).toBeEmptyDOMElement()
    } finally {
      whiteLabel.asIfEnabled = true
    }
  })

  it.each(ADMIN_ONLY)('%s renders nothing without isAdmin', (section) => {
    const props = { ...makeProps(), isAdmin: false }
    const [name] = branches(props)[section]

    const { container } = render(<StoreSectionBody section={section} {...props} />)

    expect(screen.queryByTestId(name)).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it.each(SECTION_KEYS.filter(section => !ADMIN_ONLY.includes(section)))('%s renders for a store owner (the menu offers it to some project)', (section) => {
    const props = { ...makeProps(), isAdmin: false }
    const [name] = branches(props)[section]

    render(<StoreSectionBody section={section} {...props} />)

    expect(screen.getByTestId(name)).toBeInTheDocument()
  })

  // redesign stores 4.A (decision 11): the role rule it names, from `sectionAccess`
  it.each([
    ['business_payment_account', { isAdmin: false, isSelectedAccessRole: true, project: 'ordering' }]
  ])('%s renders nothing for the selected access role', (section, sectionAccess) => {
    const props = { ...makeProps(), isAdmin: false, sectionAccess }
    const [name] = branches(props)[section]

    const { container } = render(<StoreSectionBody section={section} {...props} />)

    expect(screen.queryByTestId(name)).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  // redesign bugs C: the rest of the menu's role rules too; the sections the menu gives the role still render
  it.each([
    ['payment_methods', { isAdmin: false, isSelectedAccessRole: true, project: 'ordering' }],
    ['delivery_pickup_more', { isAdmin: false, isSelectedAccessRole: true, project: 'ordering' }],
    ['tax_fees', { isAdmin: true, isSelectedAccessRole: false, project: 'eatstreet' }],
    ['tax_fees', { isAdmin: false, isSelectedAccessRole: false, project: 'ordering' }]
  ])('%s renders for a role whose menu has it', (section, sectionAccess) => {
    const props = { ...makeProps(), isAdmin: sectionAccess.isAdmin, sectionAccess }
    const [name] = branches(props)[section]

    render(<StoreSectionBody section={section} {...props} />)

    expect(screen.getByTestId(name)).toBeInTheDocument()
  })

  it.each([
    // the EatStreet owner rows went with main
    ['store_details', { isAdmin: false, isSelectedAccessRole: true, project: 'ordering' }]
  ])('%s renders nothing for a role whose menu hides it', (section, sectionAccess) => {
    const props = { ...makeProps(), isAdmin: sectionAccess.isAdmin, sectionAccess }
    const [name] = branches(props)[section]

    const { container } = render(<StoreSectionBody section={section} {...props} />)

    expect(screen.queryByTestId(name)).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it.each([undefined, null, '', 'overview', 'unknown_key', 'pos_menu'])('renders nothing for the key %s', (section) => {
    const { container } = render(<StoreSectionBody section={section} {...makeProps()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('switches branch when the section changes', () => {
    const props = makeProps()
    const { rerender } = render(<StoreSectionBody section='schedule' {...props} />)
    expect(screen.getByTestId('BusinessSchedule')).toBeInTheDocument()

    rerender(<StoreSectionBody section='logs' {...props} />)

    expect(screen.queryByTestId('BusinessSchedule')).toBeNull()
    expect(screen.getByTestId('BusinessLogs')).toBeInTheDocument()
  })

  describe('store_details', () => {
    it('falls back to business.types when businessTypes is not set', () => {
      const props = { ...makeProps(), businessTypes: undefined }

      render(<StoreSectionBody section='store_details' {...props} />)

      expect(lastProps('BusinessDetail').businessTypes).toBe(props.businessState.business.types)
    })

    it('passes the Google feed toggles bound to this store', () => {
      const props = makeProps()

      render(<StoreSectionBody section='store_details' {...props} />)
      const detail = lastProps('BusinessDetail')
      detail.onGoogleFeedToggle(true)
      detail.onGoogleFeedPrimaryToggle(false)

      expect(props.handleGoogleFeedToggle).toHaveBeenNthCalledWith(1, 42, 'secondary', true)
      expect(props.handleGoogleFeedToggle).toHaveBeenNthCalledWith(2, 42, 'primary', false)
    })

    it('has no toggles without handleGoogleFeedToggle or without a store id', () => {
      const noHandler = { ...makeProps(), handleGoogleFeedToggle: undefined }
      render(<StoreSectionBody section='store_details' {...noHandler} />)
      expect(lastProps('BusinessDetail').onGoogleFeedToggle).toBeUndefined()
      expect(lastProps('BusinessDetail').onGoogleFeedPrimaryToggle).toBeUndefined()

      spy.calls = {}
      const noBusiness = { ...makeProps(), businessState: { loading: true, business: null } }
      render(<StoreSectionBody section='store_details' {...noBusiness} />)
      const detail = lastProps('BusinessDetail')
      expect(detail.business).toBeNull()
      expect(detail.onGoogleFeedToggle).toBeUndefined()
      expect(detail.onGoogleFeedPrimaryToggle).toBeUndefined()
      expect(detail.isSecondaryIncluded).toBe(false)
      expect(detail.feedInclusionSaving).toBe(false)
    })

    it.each([
      ['secondary saving for this store', { googleFeedSavingBusinessId: '42', googleFeedSavingChannel: 'secondary' }, { feedInclusionSaving: true, feedPrimarySaving: false }],
      ['primary saving for this store', { googleFeedSavingBusinessId: 42, googleFeedSavingChannel: 'primary' }, { feedInclusionSaving: false, feedPrimarySaving: true }],
      ['saving for another store', { googleFeedSavingBusinessId: 7, googleFeedSavingChannel: 'primary' }, { feedInclusionSaving: false, feedPrimarySaving: false }],
      ['nothing saving', { googleFeedSavingBusinessId: null, googleFeedSavingChannel: null }, { feedInclusionSaving: false, feedPrimarySaving: false }],
      ['store excluded from the primary feed', { googleFeedExcludedBusinessIds: ['42'] }, { isPrimaryIncluded: false }],
      ['store not in the secondary list', { googleFeedSecondaryIncludedIds: [1, 2] }, { isSecondaryIncluded: false }],
      ['secondary list not an array', { googleFeedSecondaryIncludedIds: undefined }, { isSecondaryIncluded: false }],
      ['exclusion list not an array', { googleFeedExcludedBusinessIds: undefined }, { isPrimaryIncluded: true }]
    ])('derives the feed flags: %s', (_name, overrides, expected) => {
      render(<StoreSectionBody section='store_details' {...makeProps()} {...overrides} />)

      expect(lastProps('BusinessDetail')).toMatchObject(expected)
    })
  })

  it('custom_fields forwards add and delete to the metafields handlers', () => {
    const props = makeProps()

    render(<StoreSectionBody section='custom_fields' {...props} />)
    const fields = lastProps('BusinessCustomFields')
    fields.handleSuccessAddMetaFields({ id: 1 })
    fields.handleSuccessDeleteBusinessMetaFields(3)

    expect(props.handleSuccessAddBusinessItem).toHaveBeenCalledWith('metafields', { id: 1 })
    expect(props.handleSuccessDeleteBusinessItem).toHaveBeenCalledWith('metafields', 3)
  })
})
