import React, { useEffect, useId, useRef, useState } from 'react'

import { SingleBusinessCategory as SingleBusinessCategoryController, useLanguage, useToast } from '../../../../../index'
import { AsyncSwitch, IconButton, Menu } from '../../Shared/Product'
import { focusReorderTrigger, getReorderState, reorderMenuItems, reorderTriggerProps } from '../../Shared/Product/reorder'
import { ChevronDown, ChevronRight, Ellipsis, GripVertical } from '../../Shared/Icon'
import './catalog-categories.css'

// redesign SP-FB: one category of the tree of /stores/products.
//
// The row is the UIComponent of the SingleBusinessCategory controller, mounted once per category exactly as
// S/SingleBusinessSubCateogries did (the controller owns the rank change by drag and the enable/disable save). What changes is the
// markup: the name is a native <button> that selects and expands as before (`toggleAccordion`: it only expands an enabled
// category), an extra chevron button expands without selecting, the drag handle is on every row (subcategories too), and the Enable
// switch is CONTROLLED by the stored value of the category: it shows the value being saved while it is busy and, when the save
// fails, goes back to the stored value and says why in the row. In `main` it kept the flipped position with nothing said (M-12).
//
// `handelChangeCategoryActive(enabled)` returns `{ ok, error }` (the controller changed in this batch). A controller that returns
// nothing is read as a success: what the switch shows afterwards is the record either way.

export const nameLabel = (template, name) => template.replace('_name_', name ?? '')

const bySortedRank = (categories) => (Array.isArray(categories) ? [...categories].sort((a, b) => a.rank - b.rank) : [])

const containsCategory = (category, id) => (
  id != null && Array.isArray(category?.subcategories) &&
  category.subcategories.some(sub => sub?.id === id || containsCategory(sub, id))
)

// redesign J2 (row 9): the siblings of a category are the categories that share its parent (the top level has no parent).
const siblingsOf = (categories, id) => {
  if (!Array.isArray(categories)) return null
  if (categories.some(item => item?.id === id)) return categories
  for (const item of categories) {
    const found = siblingsOf(item?.subcategories, id)
    if (found) return found
  }
  return null
}

const CatalogCategoryRowUI = (props) => {
  const {
    category,
    depth = 0,
    business,
    categorySelected,
    dataSelected,
    isLastCategory,
    isCategoriesBottom,
    onClickCategory,
    setCurrentCategory,
    setDataSelected,
    setCategorySelected,
    handleUpdateBusinessState,
    handelChangeCategoryActive,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleMoveCategory
  } = props

  const [, t] = useLanguage()
  const [, { hideToast }] = useToast()
  const subListId = useId()
  const nameRef = useRef(null)
  const [expanded, setExpanded] = useState(false)

  const enabled = Boolean(category?.enabled)
  const subcategories = bySortedRank(category?.subcategories)
  const hasSubcategories = subcategories.length > 0
  const isCurrent = categorySelected?.id != null && categorySelected.id === category?.id
  const hasSelectedInside = containsCategory(category, categorySelected?.id)

  // As in main: a disabled category folds, a selected enabled one starts open.
  useEffect(() => {
    if (category && !enabled) setExpanded(false)
    if (category && enabled && isCurrent) setExpanded(true)
  }, [enabled])

  // redesign SP-FB: a selected subcategory is never hidden inside a folded parent (its row has to be on screen to be scrolled to)
  useEffect(() => {
    if (hasSelectedInside && enabled) setExpanded(true)
  }, [hasSelectedInside])

  // SP-11: the list scrolls on its own on a desktop, and the chosen row used to be hidden in it (on a phone it folds, tanda AG)
  useEffect(() => {
    if (isCurrent) nameRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [isCurrent])

  const toggleAccordion = (event) => {
    if (enabled) setExpanded(open => !open)
    setCurrentCategory?.(category)
    onClickCategory?.(event, category)
  }

  // redesign bugs F row 24: the switch is the Product AsyncSwitch. The controller returns the Error it caught (a network
  // failure) as `error`, and AsyncSwitch would show its raw `message`; here that is the row's failure text, so the Error is dropped.
  // An API error (a string, `{ message }` or a list of them) goes through untouched and is translated by AsyncSwitch as before.
  // redesign bugs F (live check L-4): a failure is said in the row, so the controller's «Loading» toast is taken down (it
  // stayed up until it timed out); the legacy subcategories sheet, which says nothing of its own, keeps the controller as it was.
  const handleEnabled = async (next) => {
    let result
    try {
      result = await handelChangeCategoryActive(next)
    } catch (_) {
      hideToast?.()
      return { ok: false }
    }
    if (result && result.ok === false) hideToast?.()
    if (result && result.ok === false && result.error instanceof Error) return { ok: false }
    return result
  }

  const name = category?.name

  // redesign J2 (, row 9, D-43 (a)): Move up / Move down send the request of the drag with the rank of the neighbour. The
  // controller shows the toasts; when it ends the tree is in its new order and the row may be mounted again, so the focus is put back.
  const handleMove = async (rank) => {
    await handleMoveCategory(rank)
    focusReorderTrigger('category', category?.id)
  }
  const moveItems = typeof handleMoveCategory === 'function'
    ? reorderMenuItems({
      state: getReorderState(siblingsOf(business?.categories, category?.id), category?.id),
      labels: { up: t('MOVE_UP', 'Move up'), down: t('MOVE_DOWN', 'Move down') },
      onMove: handleMove
    })
    : null
  const isAccept = Boolean(dataSelected) && String(dataSelected) === String(category?.id)

  return (
    <li className='odc-cc-item' data-depth={depth}>
      <div
        className='odc-cc-row draggable-category'
        data-index={category?.id}
        data-depth={depth}
        data-current={isCurrent ? '' : undefined}
        data-disabled={enabled ? undefined : ''}
        data-accept={isAccept ? '' : undefined}
        data-border-bottom={isCategoriesBottom && isLastCategory ? '' : undefined}
        style={{ '--odc-cc-depth': depth }}
        onDrop={handleDrop}
        onDragOver={event => handleDragOver?.(event, isLastCategory)}
        onDragEnd={handleDragEnd}
      >
        <span
          className='odc-cc-grip'
          draggable
          aria-hidden='true'
          onDragStart={event => handleDragStart?.(event)}
        >
          <GripVertical className='odc-icon' />
        </span>
        {hasSubcategories
          ? (
            <IconButton
              size='sm'
              flipInRtl={!expanded}
              icon={expanded ? ChevronDown : ChevronRight}
              label={nameLabel(
                expanded
                  ? t('CATALOG_COLLAPSE_CATEGORY', 'Collapse _name_')
                  : t('CATALOG_EXPAND_CATEGORY', 'Expand _name_'),
                name
              )}
              className='odc-cc-chevron'
              aria-expanded={expanded}
              aria-controls={subListId}
              disabled={!enabled}
              onClick={() => setExpanded(open => !open)}
            />
            )
          : <span className='odc-cc-spacer' aria-hidden='true' />}
        <button
          ref={nameRef}
          type='button'
          className='odc-cc-name'
          aria-current={isCurrent ? 'true' : undefined}
          onClick={toggleAccordion}
        >
          <span className='odc-cc-label' dir='auto'>{name}</span>
        </button>
        <AsyncSwitch
          checked={enabled}
          className='odc-cc-switch'
          label={nameLabel(t('CATALOG_ENABLE_CATEGORY', 'Enable _name_'), name)}
          failureText={t('STORES_CHANGE_FAILED', "We couldn't save the change.")}
          onToggle={handleEnabled}
        />
        {moveItems && (
          <Menu
            icon={Ellipsis}
            label={nameLabel(t('CATALOG_ROW_ACTIONS', 'More actions for _name_'), name)}
            triggerProps={{ size: 'sm', ...reorderTriggerProps('category', category?.id) }}
            items={moveItems}
          />
        )}
      </div>
      {hasSubcategories && (
        <ul id={subListId} className='odc-cc-sublist' hidden={!expanded}>
          {subcategories.map((sub, index) => (
            <CatalogCategoryRow
              key={sub.id}
              category={sub}
              depth={depth + 1}
              business={business}
              categorySelected={categorySelected}
              dataSelected={dataSelected}
              setDataSelected={setDataSelected}
              setCategorySelected={setCategorySelected}
              handleUpdateBusinessState={handleUpdateBusinessState}
              onClickCategory={onClickCategory}
              setCurrentCategory={setCurrentCategory}
              isLastCategory={index === subcategories.length - 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// The assistant changes records (`useAssistantRecordChanges` of the listing controller): name, enabled and the subcategories are
// compared as well as the identity, so a renamed, switched or re-parented category redraws.
const areEqual = (prev, next) => (
  prev.category?.id === next.category?.id &&
  prev.category?.name === next.category?.name &&
  prev.category?.enabled === next.category?.enabled &&
  prev.category?.rank === next.category?.rank &&
  prev.category?.subcategories === next.category?.subcategories &&
  prev.categorySelected?.id === next.categorySelected?.id &&
  prev.dataSelected === next.dataSelected &&
  prev.business === next.business &&
  prev.depth === next.depth &&
  prev.isLastCategory === next.isLastCategory
)

/**
 * @param {object}   props
 * @param {object}   props.category                    The category of the row (with its `subcategories`).
 * @param {number}   [props.depth=0]                   Nesting level; it indents the row.
 * @param {object}   props.business                    The business the tree belongs to (the controller saves into it).
 * @param {object}   [props.categorySelected]          The chosen category; its row is `aria-current`.
 * @param {string}   [props.dataSelected]              Id of the category being dragged over (the drop target is highlighted).
 * @param {Function} props.setDataSelected
 * @param {Function} props.setCategorySelected
 * @param {Function} props.handleUpdateBusinessState
 * @param {Function} props.onClickCategory             `(event, category)`, the listing's `handleChangeCategory`.
 * @param {Function} props.setCurrentCategory
 * @param {boolean}  [props.isLastCategory]            Last of its siblings (the drop line goes below it).
 */
export const CatalogCategoryRow = React.memo((props) => (
  <SingleBusinessCategoryController {...props} UIComponent={CatalogCategoryRowUI} />
), areEqual)

CatalogCategoryRow.displayName = 'CatalogCategoryRow'
