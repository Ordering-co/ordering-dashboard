import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage, ProductExtras as ProductExtrasController } from '../../../../../index'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { Button, Checkbox, IconButton, Input, LinkButton } from '../../../styles'
import { Alert, Confirm, Modal } from '../../Shared'
import { Button as ProductButton, Dialog } from '../../Shared/Product'
import { ProductExtraOptions } from '../ProductExtraOptions'
import { ChevronRight, Pencil } from 'react-bootstrap-icons'
import { useTheme } from 'styled-components'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { SnoozeComponent } from '../SnoozeComponent'

import {
  MainContainer,
  ProductExtrasContainer,
  Header,
  ExtraOption,
  CheckboxContainer,
  MoreContainer,
  Details,
  ExtraAddForm,
  AddButtonWrapper,
  DragImageWrapper,
  OptionNameWrapper,
  ExtraOptionEditContainer,
  FormControl
} from './styles'

const ProductExtrasUI = (props) => {
  const {
    productState,
    extrasState,
    isAddMode,
    handleOpenAddForm,
    handleChangeExtraInput,
    handleAddExtra,
    setIsExtendExtraOpen,
    business,
    handleUpdateBusinessState,
    handleProductExtraState,
    dragoverExtaId,
    isExtrasBottom,
    handleDragStart,
    hanldeDragOver,
    handleDrop,
    handleDragEnd,
    handleUpdateExtraState,
    setExtrasState
  } = props
  const query = new URLSearchParams(useLocation().search)
  const theme = useTheme()
  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const conatinerRef = useRef(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })

  const [openExtraDetails, setOpenExtraDetails] = useState(false)
  const [openExtraEdit, setOpenExtraEdit] = useState(false)
  const [currentExtra, setCurrentExtra] = useState(null)
  const [extraIds, setExtraIds] = useState([])
  const [isCheckboxClicked, setIsCheckboxClicked] = useState(false)
  // bugs E: the name of the new option; it is created with Enter or «Add», not after a pause in the typing
  const [newExtraName, setNewExtraName] = useState('')
  const [extraSelected, setExtraSelected] = useState(null)
  const [isProductExtraSnooze, setProductExtraSnooze] = useState(false)

  const extraInputRef = useRef()

  const handleOpenExtraDetails = (e, extra, isInitialRender) => {
    if (e?.target?.closest('.extra-checkbox') || e?.target?.closest('.draggable-dots')) return
    setIsExtendExtraOpen(true)
    setCurrentExtra(extra)
    setOpenExtraDetails(true)
    if (!isInitialRender) {
      addQueryToUrl({ extra: extra.id })
    }
  }

  const handleCloseExtraDetails = () => {
    setOpenExtraDetails(false)
    setIsExtendExtraOpen(false)
    setCurrentExtra(null)
    removeQueryToUrl(['extra'])
  }

  const handleExtraState = (id, checked) => {
    if (checked) {
      setExtraIds(prevState => ([...prevState, id]))
    } else {
      setExtraIds(prevState => prevState.filter(extraId => extraId !== id))
    }
    setIsCheckboxClicked(true)
  }

  const handleOpenEdit = (event, extra) => {
    event.stopPropagation()
    setExtraSelected(extra)
    setOpenExtraEdit(true)
  }

  const handleCloseEdit = () => {
    setOpenExtraEdit(false)
    setExtraSelected(null)
  }

  // With nothing typed, the controller closes the form (as before)
  const handleSubmitNewExtra = (e) => {
    e.preventDefault()
    if (extrasState?.loading) return
    const name = newExtraName.trim()
    name ? handleAddExtra({ name }) : handleAddExtra()
  }

  const handleChangeExtra = async (id, changes) => {
    if (!extraInputRef?.current?.value) {
      setAlertState({
        open: true,
        content: [t(
          'VALIDATION_ERROR_REQUIRED',
          'Name is required'
        ).replace('_attribute_', t('NAME', 'Name'))]
      })
      return { ok: false }
    }
    // redesign stores 2.F: the caller gets how the save went; nothing else changes here
    const result = await handleUpdateExtraState(id, changes)
    handleCloseEdit()
    return result
  }

  useEffect(() => {
    if (!isAddMode) setNewExtraName('')
  }, [isAddMode])

  useEffect(() => {
    let _extraIds = []
    if (productState.product?.extras) {
      _extraIds = productState.product.extras?.reduce((ids, extra) => [...ids, extra.id], [])
    }
    setExtraIds(_extraIds)
  }, [])

  useEffect(() => {
    if (!isCheckboxClicked) return
    setIsCheckboxClicked(false)
    handleProductExtraState(extraIds)
  }, [isCheckboxClicked, extraIds])

  useEffect(() => {
    if (productState?.product?.error || extrasState?.extras?.error) {
      setAlertState({
        open: true,
        content: productState?.product?.error || extrasState?.extras?.error
      })
    }
  }, [productState, extrasState])

  useEffect(() => {
    const extraId = query.get('extra')
    if (extraId) {
      const initExtra = extrasState?.extras?.find(extra => extra.id === Number(extraId))
      initExtra && handleOpenExtraDetails(null, initExtra, true)
    }
  }, [])

  return (
    <MainContainer>
      <ProductExtrasContainer>
        <Header>
          <h1>{t('PRODUCT_OPTIONS', 'Product options')}</h1>
          <Button
            borderRadius='8px'
            color='lightPrimary'
            onClick={() => handleOpenAddForm()}
          >
            {t('ADD_PRODUCT_OPTION', 'Add product option')}
          </Button>
        </Header>
        {extrasState?.extras && extrasState?.extras?.sort((a, b) => a.rank - b.rank).map((extra, index) => {
          const isLastExtra = index === extrasState.extras.length - 1
          return (
            <ExtraOption
              key={extra.id}
              active={extra.id === currentExtra?.id}
              onClick={e => handleOpenExtraDetails(e, extra)}
              isDragOver={dragoverExtaId === extra.id}
              isBorderBottom={isExtrasBottom && isLastExtra}
              onDragOver={e => hanldeDragOver(e, extra, isLastExtra)}
              onDrop={e => handleDrop(e, extra)}
              onDragEnd={handleDragEnd}
              className='draggable-extra'
            >
              <DragImageWrapper className='draggable-dots'>
                <img
                  src={theme.images.icons?.sixDots}
                  alt='six dots'
                  draggable={!extrasState?.loading}
                  onDragStart={e => handleDragStart(e, extra)}
                />
              </DragImageWrapper>
              <CheckboxContainer
                className='extra-checkbox'
              >
                <Checkbox
                  checked={extraIds.includes(extra.id) ?? false}
                  onChange={e => handleExtraState(extra.id, e.target.checked)}
                />
              </CheckboxContainer>
              <MoreContainer>
                <OptionNameWrapper>
                  <span className='name'>{extra.name}</span>
                  {/* redesign bugs F row 25 (S-5): the pencil gets a name, «Edit <option>» (the key MenuEditor already uses) */}
                  <IconButton aria-label={`${t('EDIT', 'Edit')} ${extra.name}`} onClick={(e) => handleOpenEdit(e, extra)}>
                    <Pencil />
                  </IconButton>
                </OptionNameWrapper>
                <Details>
                  <ChevronRight />
                </Details>
              </MoreContainer>
            </ExtraOption>
          )
        })}
        {isAddMode && (
          <ExtraAddForm
            ref={conatinerRef}
            onSubmit={handleSubmitNewExtra}
          >
            <input
              name='name'
              aria-label={t('NAME', 'Name')}
              placeholder={t('WRITE_A_NAME', 'Write a name')}
              value={newExtraName}
              onChange={(e) => setNewExtraName(e.target.value)}
              // a disabled «Add» blocks the form's Enter, so an empty Enter closes the form here (as before)
              onKeyDown={(e) => e.key === 'Enter' && !newExtraName.trim() && handleSubmitNewExtra(e)}
              autoComplete='off'
              readOnly={extrasState?.loading}
            />
            <ProductButton
              type='submit'
              variant='primary'
              disabled={!newExtraName.trim() || extrasState?.loading}
            >
              {t('ADD', 'Add')}
            </ProductButton>
          </ExtraAddForm>
        )}
        <AddButtonWrapper>
          <LinkButton
            onClick={() => handleOpenAddForm()}
          >
            {t('ADD_PRODUCT_OPTION', 'Add product option')}
          </LinkButton>
        </AddButtonWrapper>
      </ProductExtrasContainer>
      {width >= 1000
        ? (
        <>
          {openExtraDetails && (
            <ProductExtraOptions
              open={openExtraDetails}
              onClose={() => handleCloseExtraDetails()}
              business={business}
              extra={currentExtra}
              handleChangeExtraName={handleChangeExtraInput}
              handleUpdateBusinessState={handleUpdateBusinessState}
              handleUpdateExtraState={handleUpdateExtraState}
              extrasState={extrasState}
              setExtrasState={setExtrasState}
            />
          )}
        </>
          )
        : (
        <>
          {openExtraDetails && (
            <Modal
              width='80%'
              open={openExtraDetails}
              onClose={() => handleCloseExtraDetails()}
              padding='20px 0 0 0'
            >
              <ProductExtraOptions
                open={openExtraDetails}
                onClose={() => handleCloseExtraDetails()}
                business={business}
                extra={currentExtra}
                handleChangeExtraName={handleChangeExtraInput}
                handleUpdateBusinessState={handleUpdateBusinessState}
                handleUpdateExtraState={handleUpdateExtraState}
                extrasState={extrasState}
                setExtrasState={setExtrasState}
              />
            </Modal>
          )}
        </>
          )}
      {openExtraEdit && (
        <Modal
          width='760px'
          open={openExtraEdit}
          onClose={() => handleCloseEdit()}
          padding='20px'
        >
          <ExtraOptionEditContainer>
            <h2>{t('PRODUCT_OPTION', 'Product option')}</h2>
            <FormControl>
              <label>{t('NAME', 'Name')}</label>
              <Input
                placeholder={t('NAME', 'Name')}
                defaultValue={extraSelected?.name}
                ref={extraInputRef}
              />
            </FormControl>
            <div className='buttons-container'>
              <Button
                className='snooze'
                color='lightGreen'
                borderRadius='8px'
                onClick={() => setProductExtraSnooze(true)}
              >
                {t('SNOOZE', 'Snooze')}
              </Button>
              <Button color='primary' onClick={() => handleChangeExtra(extraSelected?.id, { name: extraInputRef?.current?.value })}>{t('SAVE', 'Save')}</Button>
            </div>
          </ExtraOptionEditContainer>
        </Modal>
      )}
      {/* redesign bugs F row 25 (S-4): the Product Dialog with a title, like the store's Snooze (it was an untitled legacy Modal) */}
      <Dialog
        open={isProductExtraSnooze}
        onOpenChange={setProductExtraSnooze}
        size='lg'
        title={t('SNOOZE', 'Snooze')}
        closeLabel={t('CLOSE', 'Close')}
      >
        <SnoozeComponent
          isAutomaticUpdate
          dataState={extraSelected}
          handleUpdate={(data) => handleChangeExtra(extraSelected?.id, { snooze_until: data.snooze_until })}
          setFormState={setExtrasState}
          formState={extrasState}
          onClose={() => setProductExtraSnooze(false)}
        />
      </Dialog>
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
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
    </MainContainer>
  )
}

export const ProductExtras = (props) => {
  const productExtrasProps = {
    ...props,
    UIComponent: ProductExtrasUI
  }
  return <ProductExtrasController {...productExtrasProps} />
}
