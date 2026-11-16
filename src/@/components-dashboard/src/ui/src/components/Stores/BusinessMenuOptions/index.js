import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { BusinessMenuOptions as BusinessMenuOptionsController } from '../../../../../components/BusinessMenuOptions'

import { IntegrationLogs } from '../../Shared'
import { Button, ConfirmDialog, Dialog, InlineNotice, Menu, Tabs, useLeaveGuard, useSectionSplit } from '../../Shared/Product'
import { CircleAlert, Ellipsis, SlidersHorizontal, Trash2 } from '../../Shared/Icon'
import { SnoozeComponent } from '../SnoozeComponent'
import { BusinessMenuShare } from '../BusinessMenuShare'
import { BusinessMenuBasicOptions } from '../BusinessMenuBasicOptions'
import { validateMenuForm } from '../BusinessMenuBasicOptions/treeModel'
import { BusinessMenuCustomFields } from '../BusinessMenuCustomFields'
import { BusinessSharedMenuProducts } from '../BusinessSharedMenuProducts'
import { BusinessMenuChannels } from '../BusinessMenuChannels'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import './business-menu-options.css'

// redesign stores 5.5a (S1, S4-S6): the detail of a menu lives inside P/SectionSplit, which draws the title (the name of
// the menu), the X or «‹ Back», handles Esc and owns the focus. This draws what is inside: the tabs (own saved menus), the actions
// (Snooze and the ⋯ menu, saved menus), the body of the tab and the Delete confirmation. The width is the piece's (G3-13): nothing
// here measures or sets a width.

const SETTING_TABS = ['basic', 'channels', 'share_with', 'logs']

// the first message of what the controller answers (a string or a list of them), or null
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

const BusinessMenuOptionsUI = (props) => {
  const {
    menu,
    business,
    handleUpdateBusinessState,
    isSelectedSharedMenus,
    handleDeleteMenu,
    handleUpdateBusinessMenuOption,
    handleAddBusinessMenuOption,
    handleChangeInput,
    setIsOpenSharedProduct,
    sitesState,
    setMenuList,
    menuList,
    formState,
    businessMenuState,
    setCurrentMenu,
    isDirty,
    pendingChangeKeys,
    discardChanges,
    selectedProductsIds
  } = props

  const [, t] = useLanguage()
  const location = useLocation()
  const { registerCloseGuard } = useSectionSplit()
  const mounted = useRef(true)
  const actionsRef = useRef(null)
  const [isCustomFieldsOpen, setIsCustomFieldsOpen] = useState(false)
  const [isMenuSnooze, setIsMenuSnooze] = useState(false)
  // how many times the leave guard's Save found something missing: Basic marks it (the notice, the focus) each time this goes up
  const [validationAttempt, setValidationAttempt] = useState(0)
  const [deleteState, setDeleteState] = useState({ open: false, busy: false, error: null })

  const isNew = !menu || Object.keys(menu).length === 0
  const isShared = !isNew && !!isSelectedSharedMenus
  const isOwnSaved = !isNew && !isSelectedSharedMenus
  const hasSites = sitesState?.sites?.length > 0

  // The tab is local. It is read from the URL once, when the menu opens (so `?menu=&setting_tab=` opens what it did), and written
  // only when the user clicks a tab: opening a menu never writes it, and a new menu does not inherit one (G3-10).
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('setting_tab') || 'basic')
  const activeTab = isOwnSaved && SETTING_TABS.includes(tab) && (tab !== 'channels' || hasSites) ? tab : 'basic'

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (isNew) removeQueryToUrl(['setting_tab'])
  }, [isNew])

  const handleTabChange = (next) => {
    setTab(next)
    addQueryToUrl({ setting_tab: next })
  }

  // Save of the guard validates with the same rule as Basic's Save: a blank name or a new menu without products never reaches the API.
  // It brings the user to Basic, which shows what is missing, and the guard keeps them where they are.
  const saveFromGuard = () => {
    const { ok } = validateMenuForm({ menu: businessMenuState?.menu || menu, changes: formState?.changes, selectedProductsIds })
    if (!ok) {
      if (activeTab !== 'basic') {
        setTab('basic')
        if (isOwnSaved) addQueryToUrl({ setting_tab: 'basic' })
      }
      setValidationAttempt(attempt => attempt + 1)
      return { ok: false }
    }
    return menu?.id ? handleUpdateBusinessMenuOption() : handleAddBusinessMenuOption()
  }

  // Closing the detail by any way (X, «‹ Back», Esc, another row, the editor) asks first when there is unsaved work.
  useLeaveGuard({
    dirty: Boolean(isDirty),
    count: pendingChangeKeys?.length || 1,
    save: saveFromGuard,
    discard: () => discardChanges?.(),
    registerCloseGuard
  })

  const handleChangeSnooze = (changes) => {
    const _changes = {
      target: {
        name: 'snooze_until',
        value: changes.snooze_until
      }
    }
    handleChangeInput(_changes)
  }

  // Delete (S6, G3-01): asks with the name; if the API refuses, the dialog stays open and says why. When it works the controller
  // closes the detail.
  const closeDelete = () => {
    if (deleteState.busy) return
    setDeleteState({ open: false, busy: false, error: null })
  }

  const confirmDelete = async () => {
    if (deleteState.busy) return
    setDeleteState({ open: true, busy: true, error: null })
    let result
    try {
      result = await handleDeleteMenu()
    } catch (error) {
      result = { ok: false, error: error?.message }
    }
    if (!mounted.current) return
    if (result?.ok === false) {
      setDeleteState({
        open: true,
        busy: false,
        error: translateApiMessage(t, firstMessage(result.error), t('STORES_MENU_DELETE_ERROR', "We couldn't delete this menu. Try again."))
      })
      return
    }
    setDeleteState({ open: false, busy: false, error: null })
  }

  const tabItems = [
    { value: 'basic', label: t('BASIC', 'Basic') },
    ...(hasSites ? [{ value: 'channels', label: t('CHANNELS', 'Channels') }] : []),
    { value: 'share_with', label: t('SHARE_WITH', 'Share with') },
    { value: 'logs', label: t('MENU_LOGS', 'Logs') }
  ]

  const menuItems = [
    ...(!isSelectedSharedMenus
      ? [{
          key: 'custom_fields',
          label: t('CUSTOM_FIELDS', 'Custom fields'),
          icon: SlidersHorizontal,
          onSelect: () => setIsCustomFieldsOpen(true)
        }]
      : []),
    {
      key: 'delete',
      label: t('DELETE', 'Delete'),
      icon: Trash2,
      tone: 'danger',
      separatorBefore: !isSelectedSharedMenus,
      onSelect: () => setDeleteState({ open: true, busy: false, error: null })
    }
  ]

  let body
  if (isShared) {
    body = (
      <BusinessSharedMenuProducts
        menu={menu}
        business={business}
        handleUpdateBusinessState={handleUpdateBusinessState}
        setIsOpenSharedProduct={setIsOpenSharedProduct}
        setMenuList={setMenuList}
        menuList={menuList}
      />
    )
  } else if (activeTab === 'channels') {
    body = <BusinessMenuChannels {...props} />
  } else if (activeTab === 'share_with') {
    body = (
      <BusinessMenuShare
        menu={menu}
        setCurrentMenu={setCurrentMenu}
        business={business}
        handleUpdateBusinessState={handleUpdateBusinessState}
        setMenuList={setMenuList}
        menuList={menuList}
      />
    )
  } else if (activeTab === 'logs') {
    body = <IntegrationLogs model='Menu' modelId={menu?.id} />
  } else {
    body = <BusinessMenuBasicOptions {...props} validationAttempt={validationAttempt} />
  }

  return (
    <div className='odc-bmo'>
      {!isNew && (
        <div className='odc-bmo-tools'>
          {isOwnSaved && (
            <div className='odc-bmo-tabs'>
              <Tabs
                label={t('MENU_SETTINGS', 'Menu settings')}
                value={activeTab}
                onValueChange={handleTabChange}
                items={tabItems}
              />
            </div>
          )}
          <div className='odc-bmo-actions' ref={actionsRef}>
            <Button onClick={() => setIsMenuSnooze(true)}>{t('SNOOZE', 'Snooze')}</Button>
            <Menu icon={Ellipsis} label={t('MORE_ACTIONS', 'More actions')} items={menuItems} />
          </div>
        </div>
      )}
      <div className='odc-bmo-body'>{body}</div>
      {isOwnSaved && (
        <BusinessMenuCustomFields
          open={isCustomFieldsOpen}
          onClose={() => setIsCustomFieldsOpen(false)}
          returnFocus={() => actionsRef.current?.querySelector('button[aria-haspopup]')}
          businessId={business?.id}
          menuId={menu.id}
        />
      )}
      {!isNew && (
        // redesign bugs F row 25 (S-4): the Product Dialog with a title, like the store's Snooze (it was an untitled legacy Modal)
        <Dialog
          open={isMenuSnooze}
          onOpenChange={setIsMenuSnooze}
          size='lg'
          title={t('SNOOZE', 'Snooze')}
          closeLabel={t('CLOSE', 'Close')}
        >
          <SnoozeComponent
            dataState={businessMenuState?.menu}
            handleUpdate={handleUpdateBusinessMenuOption}
            handleChangeFormState={handleChangeSnooze}
            formState={formState}
            onClose={() => setIsMenuSnooze(false)}
          />
        </Dialog>
      )}
      {!isNew && (
        <ConfirmDialog
          open={deleteState.open}
          tone='danger'
          busy={deleteState.busy}
          title={t('STORES_MENU_DELETE_TITLE', 'Delete menu "_name_"?').replace('_name_', menu?.name ?? '')}
          confirmLabel={t('STORES_MENU_DELETE_CONFIRM', 'Delete menu')} // redesign tanda AB (S-5): verb + object
          cancelLabel={t('CANCEL', 'Cancel')}
          closeLabel={t('CLOSE', 'Close')}
          onCancel={closeDelete}
          onConfirm={confirmDelete}
        >
          <p className='odc-bmo-delete-body'>{t('STORES_MENU_DELETE_BODY', "This can't be undone.")}</p>
          {deleteState.error && (
            <InlineNotice tone='danger' icon={CircleAlert} role='alert' className='odc-bmo-delete-error'>
              {deleteState.error}
            </InlineNotice>
          )}
        </ConfirmDialog>
      )}
    </div>
  )
}

export const BusinessMenuOptions = (props) => {
  const businessMenuOptionFormProps = {
    ...props,
    UIComponent: BusinessMenuOptionsUI
  }
  return <BusinessMenuOptionsController {...businessMenuOptionFormProps} />
}
