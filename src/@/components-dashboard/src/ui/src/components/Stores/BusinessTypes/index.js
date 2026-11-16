import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { EDITOR_PANEL_WIDE_FROM } from '../../../../../utils/editorPanel'
import { ChevronRight, Ellipsis, Plus, TriangleAlert } from '../../Shared/Icon'
import { Avatar, Button, Checkbox, InlineNotice, Menu, SearchField, SectionSplit } from '../../Shared/Product'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { BusinessTypeDetail } from '../BusinessTypeDetail'
import './business-types.css'

// redesign stores 5.2 (; decisions 5, D4–D7; G2-11, G2-12, G2-41): the Categories (business types) of a store on P/SectionSplit.
// - The list: a search, and one row per type of the project with a checkbox named by the type (is this store of this type?) and, for
//   level 0, the name as a native button that opens the type's detail (a click anywhere on the row opens it, as in `main`).
// - A tick saves at once, as in `main` (`POST /business/:id { types }`), but straight through `handleUpdateBusinessClick` with
//   `keepPendingChanges`: it no longer goes through, nor empties, the editor's shared form (other subsections' pending edits stay).
//   It goes back and says why when the save fails; a store keeps at least one type, as before, said here instead of a modal.
// - The detail (`S/BusinessTypeDetail`) beside the list from 1000px of window (`EDITOR_PANEL_WIDE_FROM`, where `main` opened its
//   SideBar) and instead of it below, with «‹ Back». «Delete» is in its «⋯», only for a saved type.
// - `?business_type=<id>` opens that type, `?business_type=new` the new one (main wrote `undefined`); an id that is not in the
//   project opens nothing and says so (main opened «Add new»). Level 2 sees the list and the checkboxes only, as in `main`.

const NEW = 'new'

// «cafe» finds «Café»
const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const idsOf = types => (Array.isArray(types) ? types.map(type => type?.id).filter(id => id != null) : [])

export const BusinessTypes = (props) => {
  const {
    businessTypes = [],
    business,
    handleUpdateBusinessClick,
    setBusinessTypes,
    setIsExtendExtraOpen
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const canEdit = user?.level !== 2
  const splitRef = useRef(null)
  const deleteRef = useRef(null)
  const deepLinkDone = useRef(false)

  const [selected, setSelected] = useState(() => idsOf(business?.types))
  const [saving, setSaving] = useState(null) // the id of the type whose tick is being saved
  const [notice, setNotice] = useState(null)
  const [query, setQuery] = useState('')
  const [openKey, setOpenKey] = useState(null) // a type id, NEW, or null

  // the store's types, as the editor holds them (a save that worked lands there). Only a list of types counts: an answer that
  // carries them in another shape (the ids as a string) leaves the ticks as the user left them.
  const storeTypes = Array.isArray(business?.types) ? business.types : null
  const storeTypeIds = storeTypes ? idsOf(storeTypes).join(',') : null
  useEffect(() => {
    if (storeTypes) setSelected(idsOf(storeTypes))
  }, [storeTypeIds])

  const types = (businessTypes || []).filter(type => type?.id != null)
  const needle = fold(query.trim())
  const shown = needle ? types.filter(type => fold(type?.name).includes(needle)) : types
  const openType = openKey === NEW ? null : types.find(type => String(type.id) === String(openKey)) ?? null
  const isOpen = openKey === NEW || !!openType

  // ── Open and close the detail ──
  const showDetail = (key) => {
    setNotice(null)
    setOpenKey(key)
    addQueryToUrl({ business_type: key })
  }

  const requestOpen = (key) => {
    if (!canEdit || String(key) === String(openKey)) return
    if (splitRef.current) splitRef.current.requestLeave(() => showDetail(key))
    else showDetail(key)
  }

  const closeDetail = () => {
    setOpenKey(null)
    removeQueryToUrl(['business_type'])
  }

  // the deep link, once the project's types are there
  useEffect(() => {
    if (deepLinkDone.current) return
    const wanted = new URLSearchParams(window.location.search).get('business_type')
    if (!wanted || !canEdit) {
      deepLinkDone.current = true
      return
    }
    if (wanted === NEW) {
      deepLinkDone.current = true
      setOpenKey(NEW)
      return
    }
    if (types.length === 0) return
    deepLinkDone.current = true
    if (types.some(type => String(type.id) === wanted)) {
      setOpenKey(wanted)
      return
    }
    removeQueryToUrl(['business_type'])
    setNotice(t('BUSINESS_TYPE_NOT_FOUND', 'This category no longer exists.'))
  }, [types.length])

  // a type deleted while open (or gone from the list) closes its detail
  useEffect(() => {
    if (openKey != null && openKey !== NEW && types.length > 0 && !openType) closeDetail()
  }, [openKey, openType, types.length])

  // ── The checkbox of a row: saves at once, goes back when it fails ──
  const toggle = async (type, next) => {
    if (saving != null) return
    setNotice(null)
    const previous = selected
    const ids = next ? [...previous, type.id] : previous.filter(id => id !== type.id)
    if (ids.length === 0) {
      setNotice(t('STORE_NEEDS_ONE_CATEGORY', 'A store needs at least one category.'))
      return
    }
    setSelected(ids)
    setSaving(type.id)
    let result
    try {
      result = await handleUpdateBusinessClick({ types: ids }, { keepPendingChanges: true })
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    setSaving(null)
    if (result?.ok) return
    // the reason is said here, under the search (with keepPendingChanges the controller shows no toast: stores 5.18, )
    setSelected(previous)
    setNotice(t('BUSINESS_TYPE_TICK_FAILED', '_name_ was not changed: _reason_')
      .replace('_name_', type.name ?? '')
      .replace('_reason_', translateApiMessage(t, firstMessage(result?.error), t('STORES_CHANGE_FAILED', "We couldn't save the change."))))
  }

  // ── The list ──
  const list = (
    <div className='odc-bt-pane'>
      <div className='odc-bt-tools'>
        <SearchField
          className='odc-bt-search'
          value={query}
          onChange={setQuery}
          label={t('SEARCH_CATEGORIES', 'Search categories')}
          placeholder={t('SEARCH', 'Search')}
          clearLabel={t('CLEAR', 'Clear')}
        />
        {canEdit && (
          <Button icon={Plus} onClick={() => requestOpen(NEW)}>
            {t('ADD_NEW_BUSINESS_CATEGORY', 'Add new business category')}
          </Button>
        )}
      </div>
      {notice && <InlineNotice tone='warning' icon={TriangleAlert} className='odc-bt-notice'>{notice}</InlineNotice>}
      {shown.length === 0
        ? <p className='odc-bt-empty'>{needle ? t('NO_RESULTS_FOUND', 'No results found') : t('NO_BUSINESS_TYPES', 'There are no categories yet.')}</p>
        : (
          <ul className='odc-bt-rows' aria-label={t('BUSINESS_CATEGORIES', 'Categories')}>
            {shown.map(type => {
              const name = type.name ?? ''
              const active = isOpen && String(type.id) === String(openKey)
              return (
                <li
                  key={type.id}
                  className='odc-bt-row'
                  data-section-split-key={type.id}
                  aria-current={active ? 'true' : undefined}
                >
                  <Checkbox
                    className='odc-bt-check'
                    checked={selected.includes(type.id)}
                    label={name}
                    disabled={saving != null}
                    aria-busy={saving === type.id || undefined}
                    onCheckedChange={next => toggle(type, next)}
                  />
                  <Avatar kind='business' name={name} src={type.image || undefined} />
                  {canEdit
                    ? (
                      <button
                        type='button'
                        className='odc-bt-name'
                        aria-label={`${name}, ${t('VIEW_DETAILS', 'View details')}`}
                        onClick={() => requestOpen(type.id)}
                      >
                        <span className='odc-bt-name-text' title={name}>{name}</span>
                      </button>
                      )
                    : <span className='odc-bt-label'><span className='odc-bt-name-text' title={name}>{name}</span></span>}
                  {canEdit && <ChevronRight className='odc-icon odc-icon-flip odc-bt-chevron' aria-hidden='true' />}
                </li>
              )
            })}
          </ul>
          )}
    </div>
  )

  const headerActions = openType
    ? (
      <Menu
        icon={Ellipsis}
        label={t('MORE_ACTIONS', 'More actions')}
        items={[{
          key: 'delete',
          label: t('DELETE', 'Delete'),
          tone: 'danger',
          onSelect: () => deleteRef.current?.()
        }]}
      />
      )
    : null

  return (
    <div className='odc-root odc-bt'>
      <SectionSplit
        revealDetail // redesign bugs F row 6 (D5 of 5.18): stacked, the detail opens at its header
        ref={splitRef}
        splitFrom={EDITOR_PANEL_WIDE_FROM}
        open={isOpen}
        detailKey={openKey}
        onClose={closeDetail}
        onExtendChange={value => setIsExtendExtraOpen?.(value)}
        detailTitle={openType ? (openType.name ?? '') : t('NEW_BUSINESS_CATEGORY', 'New business category')}
        closeLabel={t('CLOSE', 'Close')}
        backLabel={t('BACK', 'Back')}
        headerActions={headerActions}
        list={list}
        detail={isOpen
          ? (
            <BusinessTypeDetail
              key={openKey}
              businessType={openType}
              businessTypes={businessTypes}
              setBusinessTypes={setBusinessTypes}
              deleteRef={deleteRef}
              onClose={closeDetail}
            />
            )
          : null}
      />
    </div>
  )
}
