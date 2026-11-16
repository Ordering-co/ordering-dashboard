import React, { useId, useState, useRef } from 'react'
import {
  useApi,
  BusinessProductsListing as BusinessProductsListingController
} from '../../../../../index'
import { ChevronDown as GoTriangleDown } from '../Icon'
import { Checkbox } from '../../../styles/Checkbox'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import {
  Container,
  AccordionSection,
  Accordion,
  AccordionToggle,
  AccordionContent,
  AccordionItem,
  SkeletonWrapper
} from './select-business-categories-styles'

const CategoryTreeNode = (props) => {
  const {
    category,
    index,
    selectedCategoryIds,
    setSelectedCategoryIds,
    include
  } = props

  const content = useRef(null)
  const checkboxRef = useRef(null)
  const categoryRef = useRef(null)
  const nodeId = useId()
  const contentId = `${nodeId}-content`
  const labelId = `${nodeId}-label`

  const [setActive, setActiveState] = useState('')
  const isExpanded = setActive === 'active'

  const toggleAccordion = (e) => {
    const isActionsClick = categoryRef.current?.contains(e.target) || checkboxRef.current?.contains(e.target)
    if (isActionsClick) return
    setActiveState(setActive === '' ? 'active' : '')
  }

  const handleChangeSelectCategory = (include) => {
    let categoryIds = []
    if (category?.subcategories?.length > 0) {
      category.subcategories.forEach(function iterate (category) {
        categoryIds = [...categoryIds, category.id]
        Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
      })
    }
    let _selectedCaetegoryIds = {}
    if (selectedCategoryIds[category.id] && selectedCategoryIds[category.id].include === include) {
      _selectedCaetegoryIds = { ...selectedCategoryIds }
      delete _selectedCaetegoryIds[category.id]
    } else {
      _selectedCaetegoryIds = {
        ...selectedCategoryIds
      }
      _selectedCaetegoryIds[category.id] = { id: category.id, include }
      categoryIds.forEach(id => {
        _selectedCaetegoryIds[id] = { id, include }
      })
    }
    setSelectedCategoryIds(_selectedCaetegoryIds)
  }

  return (
    <AccordionSection>
      <Accordion
        onClick={(e) => toggleAccordion(e, category.id)}
      >
        <AccordionItem
          margin={20 * index}
        >
          <AccordionToggle
            type='button'
            aria-controls={contentId}
            aria-expanded={isExpanded}
            aria-labelledby={labelId}
          >
            <GoTriangleDown className='accordion__icon' />
          </AccordionToggle>
          <div className='od-selection-tree-selection'>
            <Checkbox
              ref={categoryRef}
              aria-labelledby={labelId}
              checked={!!selectedCategoryIds[category.id] && selectedCategoryIds[category.id].include === include}
              onChange={e => handleChangeSelectCategory(include)}
            />
            <span id={labelId}>{category.name}</span>
          </div>
        </AccordionItem>
      </Accordion>
      <AccordionContent
        id={contentId}
        ref={content}
        role='group'
        aria-hidden={!isExpanded}
        aria-labelledby={labelId}
        data-state={isExpanded ? 'open' : 'closed'}
        inert={isExpanded ? undefined : ''}
        style={{
          maxHeight: !setActive && '0px'
        }}
      >
        <div className='od-selection-tree-content-inner'>
          {(category?.subcategories && category?.subcategories?.length > 0) && (
            category.subcategories.map(subCategory => (
              <CategoryTreeNode
                {...props}
                key={subCategory.id}
                category={subCategory}
                index={index + 1}
              />
            ))
          )}
        </div>
      </AccordionContent>
    </AccordionSection>
  )
}

const SelectBusinessCategoriesUI = (props) => {
  const {
    businessState,
    selectedCategoryIds,
    setSelectedCategoryIds,
    include
  } = props

  return (
    <Container>
      {businessState?.loading
        ? (
        <>
          {[...Array(10).keys()].map(i => (
            <SkeletonWrapper key={i}>
              <Skeleton width={16} height={16} />
              <Skeleton width={16} height={16} />
              <Skeleton width={120} height={20} />
            </SkeletonWrapper>
          ))}
        </>
          )
        : (
            businessState.business?.categories.sort((a, b) => a.rank - b.rank).map(category => (
          <CategoryTreeNode
            key={category.id}
            index={0}
            category={category}
            selectedCategoryIds={selectedCategoryIds}
            setSelectedCategoryIds={setSelectedCategoryIds}
            include={include}
          />
            ))
          )}
    </Container>
  )
}

export const SelectBusinessCategories = (props) => {
  const [ordering] = useApi()
  const [isInitialRender, setIsInitialRender] = useState(false)

  const businessProductslistingProps = {
    ...props,
    ordering,
    UIComponent: SelectBusinessCategoriesUI,
    isInitialRender,
    isAllCategoryProducts: true,
    isSearchByName: true,
    isSearchByDescription: true,
    handleUpdateInitialRender: (val) => setIsInitialRender(val)
  }
  return (
    <BusinessProductsListingController {...businessProductslistingProps} />
  )
}
