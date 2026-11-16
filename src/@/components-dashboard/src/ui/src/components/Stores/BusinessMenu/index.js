import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage, BusinessMenu as BusinessMenuController } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { EDITOR_PANEL_WIDE_FROM } from '../../../../../utils/editorPanel'
import { BusinessMenuOptions } from '../BusinessMenuOptions'
import { AsyncSwitch, Button, InlineNotice, SearchField, SectionSplit, Skeleton, Tabs } from '../../Shared/Product'
import { ChevronRight, Plus, TriangleAlert } from '../../Shared/Icon'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import './business-menu.css'

// redesign stores 5.5a: the list of menus of the store is the list of a P/SectionSplit and the menu editor is its
// detail. «Available» is a P/AsyncSwitch (saves at once, goes back and says why when it fails). The states are visible (a skeleton
// only while loading, an error with Retry, an empty state per tab, an unknown ?menu= that says so). The controller (C/BusinessMenu)
// answers `{ ok, error }` for the switch and `loading` is true until the first load ends.

const TAB_MENU = 'menu'
const TAB_SHARED = 'shared_menus'
const URL_KEYS_OF_DETAIL = ['menu', 'product', 'setting_tab']
const SKELETON_WIDTHS = ['44%', '60%', '36%', '52%']

// the first text of what the controller answers: a string, or a list of them
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error.find(item => typeof item === 'string' && item.trim()) : error
  return typeof message === 'string' && message.trim() ? message : null
}

const BusinessMenuUI = (props) => {
  const {
    business,
    setIsExtendExtraOpen,
    businessMenusState,
    handleChangeBusinessMenuActiveState,
    handleSuccessBusinessMenu,
    isSelectedSharedMenus,
    setIsSelectedSharedMenus,
    sitesState,
    setBusinessMenusState,
    reloadMenus
  } = props

  const [, t] = useLanguage()
  const search = useLocation().search
  const splitRef = useRef(null)

  const loading = !!businessMenusState?.loading
  const error = businessMenusState?.error
  // `error` is null or the messages of the failed load
  const loadError = Array.isArray(error) ? (error.length > 0 ? error : null) : (error || null)
  const menus = businessMenusState?.menus
  const menusShared = businessMenusState?.menusShared

  // `menu` is the open menu: a saved one, `{}` for a new one, `null` when nothing is open
  const [currentMenuState, setCurrentMenuState] = useState({ menu: null, loading: false })
  const [isOpenSharedProduct, setIsOpenSharedProduct] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [notFound, setNotFound] = useState(false)

  // the controller of the editor merges `{ menu, loading }` into the state: a functional merge, so it never closes over an old one
  const setCurrentMenu = useCallback((data) => {
    setCurrentMenuState(previous => ({ ...previous, ...data }))
  }, [])

  const currentMenu = currentMenuState.menu
  const isOpen = !!currentMenu
  const detailKey = currentMenu?.id ?? 'new'
  const busy = !!currentMenuState.loading

  const closeDetail = useCallback(() => {
    setCurrentMenuState({ menu: null, loading: false })
    setIsOpenSharedProduct(false)
    removeQueryToUrl(URL_KEYS_OF_DETAIL)
  }, [])

  // ── The URL on arrival: `tab` and `menu` are read once; the menu is looked up when the list has loaded ──
  const initial = useRef(null)
  if (initial.current === null) {
    const query = new URLSearchParams(search)
    initial.current = { tab: query.get('tab'), menu: query.get('menu') }
  }
  const resolved = useRef(false)

  useEffect(() => {
    setIsSelectedSharedMenus(initial.current.tab === TAB_SHARED)
  }, [])

  useEffect(() => {
    if (resolved.current || loading || loadError) return
    resolved.current = true
    const id = initial.current.menu
    if (!id) return
    const list = (initial.current.tab === TAB_SHARED ? menusShared : menus) || []
    const found = list.find(menu => menu.id === Number(id))
    if (found) {
      // it is what the URL already says: nothing is rewritten (setting_tab stays)
      setCurrentMenu({ menu: found })
    } else {
      setNotFound(true)
      removeQueryToUrl(URL_KEYS_OF_DETAIL)
    }
  }, [loading, loadError, menus, menusShared, setCurrentMenu])

  // ── What the list shows ──
  const menuList = useMemo(() => {
    const source = (isSelectedSharedMenus ? menusShared : menus) || []
    const term = searchValue.trim().toLowerCase()
    if (!term) return source
    return source.filter(menu => (menu?.name || '').toLowerCase().includes(term))
  }, [menus, menusShared, searchValue, isSelectedSharedMenus])
  const ownList = (isSelectedSharedMenus ? menusShared : menus) || []

  // ── The ways to open, switch and leave: all of them go through the guards of the detail ──
  const openMenu = (menu) => {
    if (busy || menu.id === currentMenu?.id) return
    splitRef.current?.requestLeave(() => {
      setNotFound(false)
      setIsOpenSharedProduct(false)
      setCurrentMenu({ menu })
      // a product of the menu that was open is not one of this menu
      removeQueryToUrl(['product'])
      addQueryToUrl({ menu: menu.id })
    })
  }

  const handleAddMenu = () => {
    splitRef.current?.requestLeave(() => {
      setNotFound(false)
      setIsOpenSharedProduct(false)
      if (isSelectedSharedMenus) {
        // a new menu is always the store's own: it is made where it lives, in the Menu tab
        setIsSelectedSharedMenus(false)
        addQueryToUrl({ tab: TAB_MENU })
      }
      setCurrentMenu({ menu: {} })
      removeQueryToUrl(URL_KEYS_OF_DETAIL)
    })
  }

  const handleTab = (value) => {
    const shared = value === TAB_SHARED
    if (shared === !!isSelectedSharedMenus) return
    splitRef.current?.requestLeave(() => {
      setNotFound(false)
      closeDetail()
      setIsSelectedSharedMenus(shared)
      addQueryToUrl({ tab: shared ? TAB_SHARED : TAB_MENU })
    })
  }

  // the title follows the list: a rename shows without waiting for the editor to hand the new menu back
  const liveMenu = currentMenu?.id != null ? ownList.find(menu => menu.id === currentMenu.id) : null
  const detailTitle = currentMenu?.id != null
    ? (liveMenu?.name ?? currentMenu.name ?? '')
    : t('STORES_MENU_NEW', 'New menu')

  const hasRows = menuList.length > 0
  const showEmpty = !loading && !loadError && ownList.length === 0
  const showNoResults = !loading && !loadError && ownList.length > 0 && !hasRows

  const list = (
    <div className='odc-menu-pane'>
      <div className='odc-menu-head'>
        <h1 className='odc-menu-title'>{t('MENU_V21', 'Menu')}</h1>
        <Button icon={Plus} onClick={handleAddMenu}>
          {t('ADD_MENU', 'Add menu')}
        </Button>
      </div>

      <Tabs
        value={isSelectedSharedMenus ? TAB_SHARED : TAB_MENU}
        onValueChange={handleTab}
        label={t('MENU_V21', 'Menu')}
        items={[
          { value: TAB_MENU, label: t('MENU_V21', 'Menu') },
          { value: TAB_SHARED, label: t('SHARED_MENUS', 'Shared menus') }
        ]}
      />

      <SearchField
        className='odc-menu-search'
        value={searchValue}
        onChange={setSearchValue}
        label={t('SEARCH', 'Search')}
        placeholder={t('SEARCH', 'Search')}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
      />

      {notFound && (
        <InlineNotice tone='warning' icon={TriangleAlert} className='odc-menu-notice'>
          {t('STORES_MENU_NOT_FOUND', "This menu doesn't exist or was deleted.")}
        </InlineNotice>
      )}

      {!loading && loadError && (
        <InlineNotice
          tone='danger'
          icon={TriangleAlert}
          role='alert'
          className='odc-menu-notice'
          action={
            <Button size='sm' onClick={() => reloadMenus?.()}>
              {t('RETRY', 'Retry')}
            </Button>
          }
        >
          {translateApiMessage(t, firstMessage(loadError), t('STORES_MENUS_LOAD_ERROR', "We couldn't load the menus."))}
        </InlineNotice>
      )}

      {loading && <span className='odc-sr-only' role='status'>{t('LOADING', 'Loading')}</span>}
      {(loading || hasRows) && (
        <ul className='odc-menu-list' aria-busy={loading || undefined}>
          {loading && SKELETON_WIDTHS.map(width => (
            <li key={width} className='odc-menu-item'>
              <div className='odc-menu-row' data-skeleton=''>
                <Skeleton size='var(--od-x-switch-width)' block='var(--od-x-switch-height)' shape='round' />
                <Skeleton size={width} />
              </div>
            </li>
          ))}
          {!loading && menuList.map(menu => {
            const isCurrent = menu.id === currentMenu?.id
            return (
              <li key={menu.id} className='odc-menu-item'>
                <div
                  className='odc-menu-row'
                  data-section-split-key={menu.id}
                  tabIndex={-1}
                  data-current={isCurrent ? '' : undefined}
                  data-busy={busy ? '' : undefined}
                  onClick={() => openMenu(menu)}
                >
                  {/* the switch and what it says on a failure belong to the row, but a press on them is not a press on the row */}
                  <span className='odc-menu-switch' onClick={event => event.stopPropagation()}>
                    <AsyncSwitch
                      checked={!!menu.enabled}
                      onToggle={next => handleChangeBusinessMenuActiveState(menu.id, next)}
                      failureText={t('STORES_CHANGE_FAILED', "We couldn't save the change.")}
                      label={t('STORES_MENU_AVAILABLE', 'Available: _name_').replace('_name_', menu.name ?? '')}
                    />
                  </span>
                  <button
                    type='button'
                    className='odc-menu-name'
                    disabled={busy}
                    aria-current={isCurrent ? 'true' : undefined}
                    onClick={(event) => {
                      event.stopPropagation()
                      openMenu(menu)
                    }}
                  >
                    <span className='odc-menu-label' dir='auto'>{menu.name}</span>
                  </button>
                  <ChevronRight className='odc-icon odc-icon-flip odc-menu-chevron' aria-hidden='true' />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {showEmpty && (
        <p className='odc-menu-empty'>
          {isSelectedSharedMenus
            ? t('STORES_MENUS_SHARED_EMPTY', 'No menus are shared with this store.')
            : t('STORES_MENUS_EMPTY', 'No menus yet.')}
        </p>
      )}
      {showNoResults && <p className='odc-menu-empty'>{t('NO_RESULTS', 'No results')}</p>}

      {/* J2 row 16 (stores-5-5a-menu, noted): the repeated «Add menu» at the foot is gone; the one in the head stays */}
    </div>
  )

  const detail = isOpen
    ? (
      <BusinessMenuOptions
        key={detailKey}
        business={business}
        menu={currentMenu || {}}
        onClose={closeDetail}
        handleUpdateBusinessState={handleSuccessBusinessMenu}
        isSelectedSharedMenus={isSelectedSharedMenus}
        isOpenSharedProduct={isOpenSharedProduct}
        setIsOpenSharedProduct={setIsOpenSharedProduct}
        sitesState={sitesState}
        menuList={businessMenusState}
        setMenuList={setBusinessMenusState}
        setCurrentMenu={setCurrentMenu}
      />
      )
    : null

  return (
    <SectionSplit
      ref={splitRef}
      className='odc-menu'
      revealDetail // redesign stores 5.18 (R5.8-02): a menu opened low in the list starts at its header on a phone
      open={isOpen}
      detailKey={detailKey}
      splitFrom={EDITOR_PANEL_WIDE_FROM}
      onExtendChange={setIsExtendExtraOpen}
      detailTitle={detailTitle}
      closeLabel={t('CLOSE', 'Close')}
      backLabel={t('BACK', 'Back')}
      onClose={closeDetail}
      list={list}
      detail={detail}
    />
  )
}

export const BusinessMenu = (props) => {
  const businessMenuProps = {
    ...props,
    UIComponent: BusinessMenuUI
  }
  return <BusinessMenuController {...businessMenuProps} />
}
