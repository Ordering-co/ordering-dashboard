import React, { useEffect, useState } from 'react'
import { Pencil, Trash } from 'react-bootstrap-icons'
import { useLanguage } from '../../../../../index'
import { Button, Input, Switch } from '../../../styles'

import {
  Container,
  SwitchWrapper,
  FormController,
  ActionButtonsWrapper,
  SelectedTaxesList,
  SelectedTaxItem,
  SelectedTaxInfo,
  TaxItemActions
} from './styles'
import { Alert, Modal, Tab, Tabs } from '../../Shared'
import { MultiSelect } from '../../../styles/MultiSelect'
import { EditTaxManager } from '../EditTaxManager'
import { CustomerFees } from '../CustomerFees'

const TAX = Symbol('tax')
const FEE = Symbol('fee')

const getBusinessTaxIds = (business, changes = {}) => {
  let ids = []
  if (Array.isArray(changes?.taxes)) {
    ids = changes.taxes
  } else if (Array.isArray(business?.taxes) && business.taxes.length > 0) {
    ids = business.taxes.map(tax => (typeof tax === 'object' ? tax.id : tax))
  } else if (business?.tax_id) {
    ids = [business.tax_id]
  }
  return ids.map(Number).filter(id => !Number.isNaN(id))
}

const TAX_MULTI_SELECT_PROPS = {
  optionBottomBorder: true,
  optionInnerMaxHeight: '240px',
  optionInnerMargin: '4px',
  dropdownMinWidth: '100%',
  optionsPosition: 'left',
  isFullWidthOptions: true
}

export const BusinessTaxAndFees = (props) => {
  const {
    formState,
    setFormState,
    business,
    handleUpdateBusinessClick,
    taxes,
    handleSaveTax,
    setTaxToEdit,
    taxToEdit,
    handleChangeTax,
    formTaxChanges,
    setFormTaxChanges,
    formTaxState,
    handleDeleteTax
  } = props

  const [, t] = useLanguage()
  const [showOption, setShowOption] = useState(TAX)
  const [taxToDelete, setTaxToDelete] = useState({ action: null, id: null })
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [activeAdvancedTax, setActiveAdvancedTax] = useState(
    Boolean(business?.tax_id) || (Array.isArray(business?.taxes) && business.taxes.length > 0)
  )

  const handleChangeOption = (option) => {
    setShowOption(option)
  }

  const handleChangeFormState = (newChange) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        ...newChange
      }
    })
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
    setTaxToDelete({ action: null, payload: null })
  }

  const handleAddTax = (action) => {
    setTaxToEdit({ action, payload: true })
    if (action === 'taxes') handleChangeTax('type', 1)
  }

  const handleEditTax = (tax) => {
    setTaxToEdit({ action: 'taxes', payload: { ...tax, value: tax.id } })
  }

  const handleRequestDeleteTax = (tax) => {
    setTaxToDelete({ action: 'taxes', id: tax.id })
  }

  const handleCloseModal = () => {
    setTaxToEdit({ action: null, payload: null })
    setFormTaxChanges({})
  }

  const deleteTax = (data) => {
    handleDeleteTax(data.id, data.action)
    if (data.action === 'taxes') {
      const remainingIds = getBusinessTaxIds(business, formState.changes)
        .filter(id => id !== Number(data.id))
      const newChanges = { ...formState.changes, taxes: remainingIds }
      delete newChanges.tax_id
      setFormState({
        ...formState,
        changes: newChanges
      })
    }
    closeAlert()
  }

  const getTaxOrFeeString = (string) => {
    return string === 'taxes' ? 'tax' : 'fee'
  }

  const options = [
    {
      label: t('TAX', 'Tax'),
      value: TAX
    },
    {
      label: t('FEES', 'Fees'),
      value: FEE
    }
  ]
  useEffect(() => {
    setFormState({
      ...formState,
      changes: {}
    })
  }, [])

  useEffect(() => {
    if (taxToDelete.action) {
      setAlertState({
        open: true,
        content: t(
          `ARE_YOUR_SURE_DELETE_${getTaxOrFeeString(taxToDelete.action).toUpperCase()}`,
          `Are you sure do you want delete this ${getTaxOrFeeString(taxToDelete.action)}?`
        )
      })
    }
  }, [taxToDelete])

  return (
    <Container>
      <h1>{t('TAX_AND_FEES', 'Tax & fees')}</h1>
      <Tabs>
        {options.map((option) => (
          <Tab
            key={option.label?.description}
            active={showOption === option.value}
            onClick={() => handleChangeOption(option.value)}
          >
            {option.label}
          </Tab>
        ))}
      </Tabs>
      {showOption === TAX && (
        <>
          {!activeAdvancedTax
            ? (
              <>
                <SwitchWrapper>
                  <p>{t('TAX_INCLUDED', 'Tax included on price')}</p>
                  <Switch
                    defaultChecked={business?.tax_type === 1}
                    onChange={checked => handleChangeFormState({ tax_type: checked ? 1 : 2 })}
                  />
                </SwitchWrapper>
                <FormController>
                  <label>{t('TAX_PERCENTAGE', 'Tax percentage')}</label>
                  <Input
                    placeholder='0.00%'
                    defaultValue={business?.tax}
                    onChange={e => handleChangeFormState({ tax: e.target.value })}
                  />
                </FormController>

                <SwitchWrapper>
                  <p>{t('DELIVERY_TAX_INCLUDED_ON_DELIVERY_FEE', 'Delivery tax included on delivery fee')}</p>
                  <Switch
                    defaultChecked={business?.delivery_tax_type === 1}
                    onChange={checked => handleChangeFormState({ delivery_tax_type: checked ? 1 : 2 })}
                  />
                </SwitchWrapper>
                <FormController>
                  <label>{t('DELIVERY_TAX_PERCENTAGE', 'Delivery tax porcentage %')}</label>
                  <Input
                    placeholder='0.00%'
                    defaultValue={business?.delivery_tax_rate}
                    onChange={e => handleChangeFormState({ delivery_tax_rate: e.target.value })}
                  />
                </FormController>
                <FormController>
                  <Button
                    color='primary'
                    isDisabled={formState.loading || formTaxState.loading}
                    borderRadius='8px'
                    onClick={() => setActiveAdvancedTax(true)}>
                    {t('USE_ADVANCED_TAX', 'Use advanced tax settings')}
                  </Button>
                </FormController>
              </>
              )
            : (
              <>
                <FormController>
                  <label>{t('CUSTOM_TAXES', 'Custom taxes')}</label>
                  <MultiSelect
                    placeholder={t('SELECT_TAXES', 'Select taxes')}
                    options={Object.values(taxes).map(tax => ({
                      value: tax.id,
                      content: `${tax.name} (${tax.rate ?? 0}% ${tax.type === 1 ? t('INCLUDED_ON_PRICE', 'Included on price') : t('NOT_INCLUDED_ON_PRICE', 'Not included on price')})`
                    }))}
                    defaultValue={getBusinessTaxIds(business, formState.changes)}
                    onChange={(val) => {
                      const current = getBusinessTaxIds(business, formState.changes).map(Number)
                      const exists = current.some(id => id === Number(val))
                      const ids = exists
                        ? current.filter(id => id !== Number(val))
                        : [...current, Number(val)]
                      const newChanges = { ...formState.changes, taxes: ids }
                      delete newChanges.tax_id
                      setFormState({
                        ...formState,
                        changes: newChanges
                      })
                    }}
                    {...TAX_MULTI_SELECT_PROPS}
                  />
                  {(() => {
                    const selectedIds = getBusinessTaxIds(business, formState.changes)
                    const selectedTaxes = selectedIds
                      .map(id => taxes[`id:${id}`])
                      .filter(Boolean)
                    if (selectedTaxes.length === 0) return null
                    return (
                      <SelectedTaxesList>
                        {selectedTaxes.map(tax => (
                          <SelectedTaxItem key={tax.id}>
                            <SelectedTaxInfo>
                              <span>{tax.name}</span>
                              <small>
                                {`${tax.rate ?? 0}% ${tax.type === 1 ? t('INCLUDED_ON_PRICE', 'Included on price') : t('NOT_INCLUDED_ON_PRICE', 'Not included on price')}`}
                              </small>
                            </SelectedTaxInfo>
                            <TaxItemActions>
                              <Pencil
                                tabIndex={0}
                                aria-label={t('EDIT_TAX', 'Edit tax')}
                                onClick={() => handleEditTax(tax)}
                                onKeyDown={(e) => e.key === 'Enter' && handleEditTax(tax)}
                              />
                              <Trash
                                tabIndex={0}
                                aria-label={t('DELETE_TAX', 'Delete tax')}
                                onClick={() => handleRequestDeleteTax(tax)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRequestDeleteTax(tax)}
                              />
                            </TaxItemActions>
                          </SelectedTaxItem>
                        ))}
                      </SelectedTaxesList>
                    )
                  })()}
                  <ActionButtonsWrapper>
                    <Button
                      color='primary'
                      borderRadius='8px'
                      isDisabled={formState.loading || formTaxState.loading}
                      onClick={() => handleAddTax('taxes')}
                    >
                      {t('ADD_NEW_TAX', 'Add new tax')}
                    </Button>
                    <Button
                      color='secundaryDark'
                      borderRadius='8px'
                      isDisabled={formState.loading || formTaxState.loading}
                      onClick={() => setActiveAdvancedTax(false)}
                    >
                      {t('USE_SIMPLE_TAX', 'Use simple tax settings')}
                    </Button>
                  </ActionButtonsWrapper>
                </FormController>
              </>
              )}
        </>
      )}
      {showOption === FEE && (
        <CustomerFees
          businessId={business?.id}
          business={business}
          formState={formState}
          setFormState={setFormState}
          handleUpdateBusinessClick={handleUpdateBusinessClick}
        />
      )}
      <Button
        borderRadius='8px'
        color='primary'
        disabled={formState.loading || Object.keys(formState.changes).length === 0}
        onClick={() => handleUpdateBusinessClick(formState.changes)}
      >
        {t('SAVE', 'Save')}
      </Button>
      {!!taxToEdit?.action && (
        <Modal
          open={!!taxToEdit?.action}
          width='80%'
          padding='30px'
          title={typeof taxToEdit?.payload === 'boolean'
            ? t(`ADD_${getTaxOrFeeString(taxToEdit?.action).toUpperCase()}`, `Add ${getTaxOrFeeString(taxToEdit?.action)}`)
            : t(`EDIT_${getTaxOrFeeString(taxToEdit?.action).toUpperCase()}`, `Edit ${getTaxOrFeeString(taxToEdit?.action)}`)}
          onClose={handleCloseModal}
        >
          <EditTaxManager
            type={taxToEdit?.action}
            data={taxToEdit?.payload}
            onChange={handleChangeTax}
            formChanges={formTaxChanges}
            onClose={handleCloseModal}
            handleSave={handleSaveTax}
          />
        </Modal>
      )}
      <Alert
        title={taxToDelete.action ? t(`DELETE_${getTaxOrFeeString(taxToDelete?.action).toUpperCase()}`, `Delete ${getTaxOrFeeString(taxToDelete?.action)}`) : t('ERROR')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => taxToDelete.action ? deleteTax(taxToDelete) : closeAlert()}
        closeOnBackdrop={false}
      />
    </Container>
  )
}
