import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Table from 'react-bootstrap/Table'
import RiCheckboxBlankLine from '@meronex/icons/ri/RiCheckboxBlankLine'
import RiCheckboxFill from '@meronex/icons/ri/RiCheckboxFill'
import { useTheme } from 'styled-components'
import { ThreeDots, XLg } from 'react-bootstrap-icons'
import BsTrash from '@meronex/icons/bs/BsTrash'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import { useForm } from 'react-hook-form'

import { useLanguage } from '../../../../../index'
import { Button, Input, IconButton, SecondSelect, LinkButton } from '../../../styles'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { Alert, Confirm, Modal } from '../../Shared'
import { addQueryToUrl, epaycoInputFields, epaycoSplitRecieveInputs } from '../../../utils'

import {
  Container,
  FieldName,
  Header,
  CloseButton,
  ActionSelectorWrapper,
  BodyContainer,
  SelectContent,
  FormControl
} from './styles'

import { Tab, TabsContainer } from '../BusinessMenu/styles'
import { TabOption, TabOptionName } from '../PaymentOptionStripeDirect/styles'

export const PaymentOptionEpayco = (props) => {
  const {
    open,
    onClose,
    changesState,
    cleanChangesState,
    actionState,
    sitesState,
    orderTypes,
    handleChangeInput,
    handleSaveClick,
    businessPaymethod,
    handleChangeBusinessPaymentState,
    handleDeletePaymethod
  } = props

  const query = new URLSearchParams(useLocation().search)
  const theme = useTheme()
  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const formMethods = useForm()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [paymentTabs, setPaymentTabs] = useState(0)
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [localState, setLocalState] = useState({ allowed_order_types: businessPaymethod?.allowed_order_types, sites: businessPaymethod?.sites })
  const [openModal, setOpenModal] = useState({ open: false, title: null, isSandbox: false })
  const [splitRecieversValue, setSplitRecieversValue] = useState(businessPaymethod?.data?.split_receivers || [])
  const [splitRecieversValueSandbox, setSplitRecieversValueSandbox] = useState(businessPaymethod?.data_sandbox?.split_receivers || [])
  const [splitRecieverState, setSplitRecieverState] = useState({})
  const filteredOptions = localState?.sites ?? businessPaymethod?.sites?.filter(a => sitesState?.sites?.find(b => a.id === b.id))
  const [all, setAll] = useState(!filteredOptions?.length)
  const [alertState, setAlertState] = useState({ open: false, content: [] })

  const actionSidebar = (value) => {
    if (!value) {
      props.onClose()
    }
    setIsMenuOpen(value)
  }

  const setPaymethodInfo = (values) => {
    const data = {}
    if (values?.value === 'All') {
      data[values.key] = []
      setAll(!all)
    } else {
      let array = changesState?.[values.key] ?? (values.key === 'allowed_order_types'
        ? businessPaymethod?.[values.key]
        : businessPaymethod?.[values.key]?.map(i => i.id)) ?? []

      array = [...new Set(
        array.includes(values.value)
          ? array.filter(item => item !== values.value)
          : [...array, values.value]
      )]

      data[values.key] = array.length > 0 ? array : []
      if (values.key === 'sites') {
        setAll(!data?.sites?.length)
      }
    }

    handleChangeBusinessPaymentState(data)
  }

  const onClickDeletePaymethod = () => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_ITEM', 'Are you sure to delete this _item_?').replace('_item_', t('PAYMETHOD_ID', 'Paymethod')),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleDeletePaymethod(businessPaymethod?.paymethod?.id)
      }
    })
  }

  const onDeleteReceive = (id, isSandbox) => {
    const array = isSandbox
      ? splitRecieversValueSandbox.filter(value => value?.id !== id)
      : splitRecieversValue.filter(value => value?.id !== id)
    handleChangeInput({ target: { name: 'split_receivers', value: array } }, openModal.isSandbox)
    isSandbox ? setSplitRecieversValueSandbox(array) : setSplitRecieversValue(array)
  }

  const onSubmit = () => {
    const array = openModal.isSandbox ? splitRecieversValueSandbox : splitRecieversValue
    if (array.some(splitRecieve => splitRecieverState?.id === splitRecieve?.id)) {
      setAlertState({
        open: true,
        content: [t('ERROR_ID_EQUAL_SPLIT_RECIEVE', 'Id cannot be equal to another split recieve id')]
      })
      return
    }
    array.push(splitRecieverState)
    handleChangeInput({ target: { name: 'split_receivers', value: array } }, openModal.isSandbox)
    setSplitRecieverState(() => ({}))
    setOpenModal(() => ({ ...openModal, open: false }))
  }

  const renderInputField = ({ label, name, isSandbox, options, type }) => {
    const splitArray = isSandbox ? splitRecieversValueSandbox : splitRecieversValue
    return (
      <>
        <FieldName>{t(label, label.replace(/_/g, ' '))}</FieldName>
        {name === 'split_receivers' ? renderSplitReceiversTable(splitArray, isSandbox) : renderInput(name, label, isSandbox, options, type)}
      </>
    )
  }

  const renderSplitReceiversTable = (splitArray, isSandbox) => (
    <>
      <Table striped bordered hover>
        <thead>
          <tr>
            {epaycoSplitRecieveInputs?.map?.(input => (
              <th key={input.name}>
                {t(input.label, input.label.replace(/_/g, ' '))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {splitArray?.map?.(input => (
            <tr key={input.id}>
              {Object.values(input)?.map((value, i) => (
                <th key={i}>
                  {value}
                </th>
              ))}
              <th>
                <BsTrash className='delete' onClick={() => onDeleteReceive(input.id, isSandbox)} />
              </th>
            </tr>
          ))}
        </tbody>
      </Table>
      <LinkButton onClick={() => setOpenModal({ open: true, isSandbox, title: t('ADD_NEW_RECEIVER', 'Add new receiver') })}>{t('ADD_NEW_RECEIVER', 'Add new receiver')}</LinkButton>
    </>
  )

  const renderInput = (name, label, isSandbox, options, type) => (
    <>
      {options
        ? (
          <SelectContent>
            <SecondSelect
              selectStyle={props.selectStyle}
              defaultValue={changesState?.[isSandbox ? 'data_sandbox' : 'data']?.[name] ??
                businessPaymethod?.[isSandbox ? 'data_sandbox' : 'data']?.[name]}
              options={options.map(option => ({ value: option.value, content: t(option.content, label.replace(/_/g, ' ')) }))}
              onChange={(typeValue) => handleChangeInput({ target: { name, value: typeValue } }, isSandbox)}
              placeholder={t('SELECT_A_OPTION', 'Select a option')}
            />
          </SelectContent>
          )
        : (
          <Input
            name={name}
            defaultValue={
              changesState?.[isSandbox ? 'data_sandbox' : 'data']?.[name] ??
              businessPaymethod?.[isSandbox ? 'data_sandbox' : 'data']?.[name]
            }
            placeholder={t(label, label.replace(/_/g, ' '))}
            onChange={e => handleChangeInput(e, isSandbox)}
            onKeyPress={(e) => {
              if (!/^[0-9.]$/.test(e.key) && type === 'number') {
                e.preventDefault()
              }
            }}
          />
          )}
    </>
  )

  useEffect(() => {
    if (isMenuOpen) {
      if (width < 1000) {
        document.getElementById('epayco').style.width = '100%'
      } else {
        document.getElementById('epayco').style.width = '500px'
      }
    }
  }, [width])

  useEffect(() => {
    if (!open) return
    actionSidebar(true)
  }, [open])

  useEffect(() => {
    if (actionState.loading) return
    const initState = {
      sandbox: businessPaymethod?.sandbox,
      allowed_order_types: businessPaymethod?.allowed_order_types || [1, 2, 3, 4, 5]
    }
    if (businessPaymethod?.data) {
      initState.data = businessPaymethod.data
    }
    if (businessPaymethod?.data_sandbox) {
      initState.data_sandbox = businessPaymethod.data_sandbox
    }
    cleanChangesState(initState)
  }, [actionState.loading])

  useEffect(() => {
    const changes = {}
    if (changesState?.allowed_order_types) changes.allowed_order_types = changesState?.allowed_order_types
    if (changesState?.sites) changes.sites = changesState?.sites
    if (Object.keys(changes).length > 0) setLocalState(JSON.parse(JSON.stringify(changes)))
  }, [changesState?.sites, changesState?.allowed_order_types])

  const handleTabClick = (tab, isInitialRender) => {
    setPaymentTabs(tab)
    if (!isInitialRender) {
      addQueryToUrl({ paymethod_tab: tab })
    }
  }

  useEffect(() => {
    const payemthodTab = query.get('paymethod_tab')
    if (payemthodTab) {
      handleTabClick(Number(payemthodTab), true)
    } else {
      handleTabClick(0)
    }
  }, [])

  useEffect(() => {
    if (Object.keys(formMethods.errors).length > 0) {
      setAlertState({
        open: true,
        content: Object.values(formMethods.errors).map(error => error.message)
      })
    }
  }, [formMethods.errors])

  return (
    <>
      <Container id='epayco'>
        <Header>
          <h1>{t('EPAYCO', 'Epayco')}</h1>
          <ActionSelectorWrapper>
            <DropdownButton
              menuAlign={theme?.rtl ? 'left' : 'right'}
              title={<ThreeDots />}
              id={theme?.rtl ? 'dropdown-menu-align-left' : 'dropdown-menu-align-right'}
            >
              <Dropdown.Item
                onClick={() => onClickDeletePaymethod()}
              >
                {t('DELETE', 'Delete')}
              </Dropdown.Item>
            </DropdownButton>
          </ActionSelectorWrapper>
          <CloseButton>
            <IconButton
              color='black'
              onClick={() => onClose()}
            >
              <XLg />
            </IconButton>
          </CloseButton>
        </Header>

        <TabsContainer>
          <Tab
            active={paymentTabs === 0}
            onClick={() => handleTabClick(0)}
          >
            {t('GENERAL', 'General')}
          </Tab>
          {sitesState?.sites?.length > 0 && (
            <Tab
              active={paymentTabs === 1}
              onClick={() => handleTabClick(1)}
            >
              {t('CHANNELS', 'Channels')}
            </Tab>
          )}
          <Tab
            active={paymentTabs === 2}
            onClick={() => handleTabClick(2)}
          >
            {t('ORDER_TYPE', 'Order type')}
          </Tab>
        </TabsContainer>
        <BodyContainer>
          <h2>{t('ONLY_AVAILABLE_FOR_COP_AND_USD', 'Only available for COP and USD currency')}</h2>
          {paymentTabs === 0 && (
            <>
              {epaycoInputFields.map(field => renderInputField(field))}
            </>
          )}

          {paymentTabs === 1 && sitesState?.sites?.length > 0 && (
            <>
              <TabOption
                key='all'
                onClick={() => setPaymethodInfo({ key: 'sites', value: 'All' })}
              >
                {all
                  ? (
                    <RiCheckboxFill className='fill' />
                    )
                  : (
                    <RiCheckboxBlankLine />
                    )}
                <TabOptionName>{t('ALL', 'All')}</TabOptionName>
              </TabOption>
              {!all && sitesState?.sites.map(site => (
                <TabOption
                  key={site.id}
                  onClick={() => setPaymethodInfo({ key: 'sites', value: site.id })}
                >
                  {(localState?.sites ?? businessPaymethod?.sites?.map(s => s.id))?.includes(site.id)
                    ? (
                      <RiCheckboxFill className='fill' />
                      )
                    : (
                      <RiCheckboxBlankLine />
                      )}
                  <TabOptionName>{site.name}</TabOptionName>
                </TabOption>
              ))}
            </>
          )}

          {paymentTabs === 2 && (
            orderTypes.map(type => (
              <TabOption
                key={type.value}
                onClick={() => setPaymethodInfo({ key: 'allowed_order_types', value: type.value })}
              >
                {(localState?.allowed_order_types ?? businessPaymethod?.allowed_order_types)?.includes(type.value)
                  ? (
                    <RiCheckboxFill className='fill' />
                    )
                  : (
                    <RiCheckboxBlankLine />
                    )}
                <TabOptionName>{type.text}</TabOptionName>
              </TabOption>
            ))
          )}
          <Button
            borderRadius='5px'
            color='primary'
            disabled={actionState.loading || Object.keys(changesState).length === 0}
            onClick={() => handleSaveClick(businessPaymethod.id)}
          >
            {actionState.loading ? t('LOADING', 'Loading') : t('SAVE', 'Save')}
          </Button>
        </BodyContainer>
      </Container>
      <Modal
        width='500px'
        padding='30px'
        open={openModal.open}
        title={openModal.title}
        onClose={() => setOpenModal({ ...openModal, open: false })}
      >
        <FormControl
          onSubmit={formMethods.handleSubmit(onSubmit)}
          autoComplete='off'
        >
          <BodyContainer>
            {epaycoSplitRecieveInputs.map(input => (
              <div key={input.name}>
                <FieldName>{t(input.label, input.label.replace(/_/g, ' '))}</FieldName>
                <Input
                  name={input.name}
                  placeholder={t(input.label, input.label.replace(/_/g, ' '))}
                  onChange={(e) => {
                    setSplitRecieverState((prevProps) => ({ ...prevProps, [e.target.name]: e.target.value }))
                  }}
                  ref={formMethods.register({
                    required: (`VALIDATION_ERROR_${input.label}_REQUIRED`, `The field ${input.label.replace(/_/g, ' ')} is required`)
                  })}
                  onKeyPress={(e) => {
                    if (!/^[0-9.]$/.test(e.key)) {
                      e.preventDefault()
                    }
                  }}
                  maxLength={input.name === 'id' ? 6 : undefined}
                />
              </div>
            ))}
            <Button
              borderRadius='5px'
              color='primary'
              type='submit'
            >
              {t('ADD', 'Add')}
            </Button>
          </BodyContainer>
        </FormControl>
      </Modal>
      <Confirm
        width='700px'
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
      <Alert
        width='800px'
        title={t('SPLIT_RECEIVERS', 'Split receivers')}
        content={alertState.content}
        acceptText={t('ACCEPT')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </>
  )
}
