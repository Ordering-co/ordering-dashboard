import React, { useState, useEffect } from 'react'
import { useLanguage } from '../../../../../index'
import { useForm } from 'react-hook-form'
import { Alert, Modal, Tab, Tabs } from '../../Shared'
import {
  ButtonGroup,
  EditTaxContainer,
  WrapperRow,
  LinkText
} from './styles'
import { Button } from '../../../styles/Buttons'
import { InputsFields } from './InputFields'

const orderTypes = ['delivery', 'pickup', 'eatin']

export const EditTaxManager = (props) => {
  const {
    type,
    handleSave,
    data,
    formChanges,
    onChange,
    onClose
  } = props

  const [, t] = useLanguage()
  const formMethods = useForm()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [showOption, setShowOption] = useState('delivery')
  const [openModal, setOpenModal] = useState(false)
  const [deliveryState, setDeliveryState] = useState({
    rate: data?.order_type_rates?.delivery?.rate ?? '',
    type: data?.order_type_rates?.delivery?.type ?? 1
  })
  const [pickupState, setPickupState] = useState({
    rate: data?.order_type_rates?.pickup?.rate ?? '',
    type: data?.order_type_rates?.pickup?.type ?? 1
  })
  const [eatInState, setEatInState] = useState({
    rate: data?.order_type_rates?.eatin?.rate ?? '',
    type: data?.order_type_rates?.eatin?.type ?? 1
  })

  const handleCloseModal = () => {
    setOpenModal(false)
    onChange('order_type_rates', null)
    setDeliveryState({
      rate: data?.order_type_rates?.delivery?.rate ?? '',
      type: data?.order_type_rates?.delivery?.type ?? 1
    })
    setPickupState({
      rate: data?.order_type_rates?.pickup?.rate ?? '',
      type: data?.order_type_rates?.pickup?.type ?? 1
    })
    setEatInState({
      rate: data?.order_type_rates?.eatin?.rate ?? '',
      type: data?.order_type_rates?.eatin?.type ?? 1
    })
  }

  const setInitialState = () => {
    setDeliveryState({
      rate: '',
      type: 1
    })
    setPickupState({
      rate: '',
      type: 1
    })
    setEatInState({
      rate: '',
      type: 1
    })
  }

  const handleCloseTaxEditor = () => {
    setInitialState()
    onClose()
  }

  const handleAcceptModal = () => {
    setOpenModal(false)
  }

  useEffect(() => {
    if (Object.keys(formMethods.errors).length > 0) {
      const content = Object.values(formMethods.errors).map(error => error.message)
      setAlertState({
        open: true,
        content
      })
    }
  }, [formMethods.errors])

  useEffect(() => {
    setDeliveryState({
      rate: formChanges?.order_type_rates?.delivery?.rate ?? data?.order_type_rates?.delivery?.rate ?? '',
      type: formChanges?.order_type_rates?.delivery?.type ?? data?.order_type_rates?.delivery?.type ?? 1
    })
    setPickupState({
      rate: formChanges?.order_type_rates?.pickup?.rate ?? data?.order_type_rates?.pickup?.rate ?? '',
      type: formChanges?.order_type_rates?.pickup?.type ?? data?.order_type_rates?.pickup?.type ?? 1
    })
    setEatInState({
      rate: formChanges?.order_type_rates?.eatin?.rate ?? data?.order_type_rates?.eatin?.rate ?? '',
      type: formChanges?.order_type_rates?.eatin?.type ?? data?.order_type_rates?.eatin?.type ?? 1
    })
  }, [formChanges, data])

  return (
    <EditTaxContainer onSubmit={formMethods.handleSubmit(() => {
      onClose()
      handleSave(data?.value, type)
    })}>
      <WrapperRow>
        <InputsFields
          formChanges={formChanges}
          onChange={onChange}
          type={type}
          data={data}
          formMethods={formMethods}
        />
        {type === 'taxes' && (
          <LinkText onClick={() => setOpenModal(true)}>
            {t('CHANGE_BY_ORDER_TYPES', 'Change by order types')}
          </LinkText>
        )}
      </WrapperRow>
      <ButtonGroup>
        <Button
          type='submit'
          color='primary'
          borderRadius='8px'
        >
          {t('ACCEPT', 'Accept')}
        </Button>
        <Button
          color='secundaryDark'
          borderRadius='8px'
          onClick={() => handleCloseTaxEditor()}
        >
          {t('CLOSE', 'Close')}
        </Button>
      </ButtonGroup>
      <Modal
        open={openModal}
        onClose={handleCloseModal}
        title={t('ORDER_TYPES', 'Order types')}
        height='50vh'
      >
        <Tabs>
          {orderTypes.map(orderType => (
            <Tab
              key={orderType}
              onClick={() => setShowOption(orderType)}
              active={showOption === orderType}
            >
              {t(orderType.toUpperCase(), orderType)}
            </Tab>
          ))}
        </Tabs>
        <InputsFields
          orderType={showOption}
          hideDefaultInputs
          formChanges={formChanges}
          onChange={onChange}
          type={type}
          data={data}
          deliveryState={deliveryState}
          setDeliveryState={setDeliveryState}
          pickupState={pickupState}
          setPickupState={setPickupState}
          eatInState={eatInState}
          setEatInState={setEatInState}
          formMethods={formMethods}
        />
        <ButtonGroup>
          <Button
            color='primary'
            borderRadius='8px'
            onClick={handleAcceptModal}
          >
            {t('ACCEPT', 'Accept')}
          </Button>
          <Button
            color='secundaryDark'
            borderRadius='8px'
            onClick={handleCloseModal}
          >
            {t('CLOSE', 'Close')}
          </Button>
        </ButtonGroup>
      </Modal>
      <Alert
        title={t('ERROR')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </EditTaxContainer>
  )
}
