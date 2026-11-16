import React, { useState, useRef, useEffect, useId } from 'react'
import GoTriangleDown from '@meronex/icons/go/GoTriangleDown'
import { DashSquareFill, CheckSquareFill, Square } from 'react-bootstrap-icons'

import {
  AccordionSection,
  Accordion,
  AccordionContent,
  AccordionToggle,
  AccordionItem,
  CheckboxWrapper
} from './styles'

// redesign stores 5.5b (S3, S7): optional props for Basic's tree toolbar. `expandedIds` (a Set of category ids) makes the
// open state Basic's: the row and the chevron call `onToggleExpanded(id)` instead of toggling here; `forceExpanded` opens every
// category (while searching); `visibleProductIds` (a Set) lists only those products and drops a category with none of them. Without
// them the node is what it was: collapsed on open, toggled by itself, every product listed. The category checkbox still acts on the
// whole category (S4, as in main).
export const BusinessMenuCategoryTreeNode = (props) => {
  const {
    category,
    index,
    selectedProductsIds,
    setSelectedProductsIds,

    selectedProducts,
    setSelectedProducts,

    subCategoriesList,

    expandedIds,
    onToggleExpanded,
    forceExpanded,
    visibleProductIds
  } = props

  const content = useRef(null)
  const contentId = useId()
  const checkboxRef = useRef(null)
  const categoryRef = useRef(null)

  const [setActive, setActiveState] = useState('')
  const [isCategoryState, setIsCategoryState] = useState(0)

  const isControlled = expandedIds instanceof Set
  const isOpen = !!forceExpanded || (isControlled ? expandedIds.has(category.id) : setActive === 'active')

  const toggleAccordion = (e) => {
    const isActionsClick = categoryRef.current?.contains(e.target) || checkboxRef.current?.contains(e.target)
    if (isActionsClick) return
    // Searching shows everything open: a toggle would only change the hidden state, and clearing the search would show a surprise.
    if (forceExpanded) return
    if (isControlled) {
      onToggleExpanded && onToggleExpanded(category.id)
      return
    }
    setActiveState(setActive === '' ? 'active' : '')
  }

  const descendantIds = subCategoriesList.find(_category => _category.id === category.id)?.productIds || []
  const isVisibleProduct = (id) => !(visibleProductIds instanceof Set) || visibleProductIds.has(id)
  const hasVisibleProducts = descendantIds.some(isVisibleProduct)
  const products = (category?.products || []).filter(product => isVisibleProduct(product.id))

  const isCheckedCategory = () => {
    const _category = subCategoriesList.find(item => item.id === category.id)
    if (_category?.productIds.every(id => selectedProductsIds.includes(id))) {
      return 2
    } else if (_category?.productIds.some(id => selectedProductsIds.includes(id))) {
      return 1
    }
    return 0
  }

  const handleClickProduct = (product) => {
    if (selectedProductsIds.includes(product.id)) {
      const _selectedProductsIds = selectedProductsIds.filter(id => id !== product.id)
      setSelectedProductsIds(_selectedProductsIds)

      if (selectedProducts) {
        const _selectedProducts = selectedProducts.filter(_product => _product.id !== product.id)
        setSelectedProducts(_selectedProducts)
      }
    } else {
      setSelectedProductsIds([...selectedProductsIds, product.id])
      if (selectedProducts) {
        setSelectedProducts([...selectedProducts, product])
      }
    }
  }

  const handleChangeSelectCategory = () => {
    const productsIds = subCategoriesList.find(item => item.id === category.id)?.productIds || []

    const everyContain = productsIds.every(id => selectedProductsIds.includes(id))
    let _selectedProductsIds = []
    let _selectedProducts = []
    if (!everyContain) {
      _selectedProductsIds = [...selectedProductsIds, ...productsIds].filter((value, index, self) => self.indexOf(value) === index)
      setSelectedProductsIds(_selectedProductsIds)

      if (selectedProducts) {
        const uniqueArr = []
        _selectedProducts = [...selectedProducts, ...category.products].filter(product => {
          const index = uniqueArr.findIndex(item => (item.id === product.id))
          if (index <= -1) {
            uniqueArr.push(product)
          }
          return null
        })

        setSelectedProducts(uniqueArr)
      }
    } else {
      _selectedProductsIds = selectedProductsIds.filter(id => !productsIds.includes(id))
      setSelectedProductsIds(_selectedProductsIds)

      if (selectedProducts) {
        _selectedProducts = selectedProducts.filter(product => !productsIds.includes(product.id))
        setSelectedProducts(_selectedProducts)
      }
    }
  }

  useEffect(() => {
    setIsCategoryState(isCheckedCategory())
  }, [selectedProductsIds])

  return (
    <>
      {hasVisibleProducts && (
        <AccordionSection>
          <Accordion
            onClick={(e) => toggleAccordion(e, category.id)}
          >
            <AccordionItem
              margin={20 * index}
            >
              <div>
                <CheckboxWrapper
                  ref={categoryRef}
                  as='button'
                  type='button'
                  role='checkbox'
                  aria-checked={isCategoryState === 2 ? true : isCategoryState === 1 ? 'mixed' : false}
                  aria-label={category.name}
                  active={isCategoryState}
                  onClick={() => handleChangeSelectCategory()}
                >
                  {isCategoryState === 2
                    ? (
                    <CheckSquareFill aria-hidden='true' />
                      )
                    : (
                        isCategoryState === 1 ? <DashSquareFill aria-hidden='true' /> : <Square aria-hidden='true' />
                      )}
                </CheckboxWrapper>
                <span>{category.name}</span>
              </div>
              {/* Keyboard and screen-reader equivalent of the row click: Enter / Space fire a
                  click that bubbles to the Accordion's onClick, which does the toggle. */}
              <AccordionToggle
                aria-expanded={isOpen}
                aria-controls={contentId}
                aria-label={category.name}
              >
                <GoTriangleDown className={isOpen ? 'accordion__icon rotate' : 'accordion__icon'} aria-hidden='true' />
              </AccordionToggle>
            </AccordionItem>
          </Accordion>
          <AccordionContent
            ref={content}
            id={contentId}
            // Collapsed content is only clipped by max-height: `inert` keeps Tab (and
            // assistive tech) out of the product checkboxes nobody can see.
            inert={isOpen ? undefined : ''}
            style={{
              maxHeight: !isOpen && '0px'
            }}
          >
            {products.map(product => (
              <AccordionItem
                key={product.id}
                margin={20 * (index + 1)}
                isProduct
              >
                <div>
                  <CheckboxWrapper
                    ref={checkboxRef}
                    as='button'
                    type='button'
                    role='checkbox'
                    aria-checked={selectedProductsIds.includes(product.id)}
                    aria-label={product.name}
                    active={selectedProductsIds.includes(product.id)}
                    onClick={() => handleClickProduct(product)}
                  >
                    {selectedProductsIds.includes(product.id) ? <CheckSquareFill aria-hidden='true' /> : <Square aria-hidden='true' />}
                  </CheckboxWrapper>
                  <span>{product.name}</span>
                </div>
              </AccordionItem>
            ))}
            {(category?.subcategories && category?.subcategories?.length > 0) && (
              category.subcategories.map(subCategory => (
                <BusinessMenuCategoryTreeNode
                  {...props}
                  key={subCategory.id}
                  category={subCategory}
                  index={index + 1}
                />
              ))
            )}
          </AccordionContent>
        </AccordionSection>
      )}
    </>
  )
}
