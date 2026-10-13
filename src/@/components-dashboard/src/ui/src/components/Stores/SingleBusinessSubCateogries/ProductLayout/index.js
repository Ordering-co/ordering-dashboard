import React, { useState, useEffect } from 'react'
import { CaretRightFill } from 'react-bootstrap-icons'
import { SingleBusinessCategory as SingleBusinessCategoryController } from '../../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { Circle as UnCheckIcon, RecordCircleFill as CheckIcon } from 'react-bootstrap-icons'
import { addQueryToUrl } from '../../../../utils'
import {
  AccordionSection,
  Accordion,
  AccordionContent,
  AccordionItem,
  CheckWrapper
} from './styles'

const SingleBusinessSubCateogriesUI = (props) => {
  const {
    index,
    category,
    isSkeleton,
    dataSelected,
    isCategoriesBottom,
    isLastCategory,
    product,
    handleUpdateClickProduct,
    setParentActiveState,
    setParentRotateState,
    setProductCategorySelected,
    productCategorySelected,
    setNextParentCategoryId,
    handleCloseExtraOpen
  } = props

  const [setActive, setActiveState] = useState('')
  const [setRotate, setRotateState] = useState('accordion__icon')
  const [parentCategoryId, setParentCategoryId] = useState(null)

  const hasSubcategories = category?.subcategories && category.subcategories.length > 0

  const toggleAccordion = (e, category) => {
    if (!hasSubcategories) {
      handleChangeCategoryProduct(category)
      return
    }
    setActiveState(setActive === '' ? 'active' : '')
    setRotateState(
      setActive === 'active' ? 'accordion__icon' : 'accordion__icon rotate'
    )
  }

  const handleChangeCategoryProduct = async (category) => {
    await setProductCategorySelected(category)
    await handleUpdateClickProduct({ category_id: category?.id }, { refreshProducts: true })
    addQueryToUrl({ category: category?.id, product: product?.id })
    handleCloseExtraOpen && handleCloseExtraOpen()
  }

  useEffect(() => {
    if (category && !category?.enabled) {
      setActiveState('')
      setRotateState('accordion__icon rotate')
    }
    if (category && category?.enabled && productCategorySelected?.id === category?.id) {
      setActiveState('active')
      setRotateState('accordion__icon rotate')
      setParentActiveState?.('active')
      setParentRotateState?.('accordion__icon rotate')
      setNextParentCategoryId?.(category?.parent_category_id)
    }
    if (!setParentActiveState || !setParentRotateState) return
    if (parentCategoryId && category?.id === parentCategoryId) {
      setNextParentCategoryId?.(category?.parent_category_id || null)
      setParentActiveState('active')
      setParentRotateState('accordion__icon rotate')
    }
  }, [productCategorySelected?.id, parentCategoryId])

  return (
    <AccordionSection>
      {isSkeleton
        ? (
          <>
            <Accordion>
              <AccordionItem>
                <div><Skeleton width={120} /></div>
                <Skeleton width={30} />
              </AccordionItem>
            </Accordion>
          </>
          )
        : (
          <>
            <Accordion
              onClick={(e) => toggleAccordion(e, category)}
            >
              <AccordionItem
                margin={20 * index}
                active={!isSkeleton && (category?.id === productCategorySelected?.id)}
                data-index={category?.id}
                isAccept={dataSelected && dataSelected === category?.id.toString()}
                isBorderBottom={isCategoriesBottom && isLastCategory}
                hasNotSubcategoriesAndPrincipal={index === 0 && !(category?.subcategories && (category?.subcategories.length > 0))}
                isLastCategory={index > 0 && isLastCategory && !(category?.subcategories && (category?.subcategories.length > 0))}
              >
                <div>
                  {category?.subcategories && (
                    category?.subcategories.length > 0 && (
                      <CaretRightFill className={setRotate} />
                    )
                  )}
                  <CheckWrapper>
                    <div
                      name='preselected'
                      className={category?.id === productCategorySelected?.id ? 'checked default' : 'default'}
                    >
                      <span className='radio' onClick={(e) => {
                        e.stopPropagation()
                        handleChangeCategoryProduct(category)
                      }}>
                        {category?.id === productCategorySelected?.id ? <CheckIcon /> : <UnCheckIcon />}
                      </span>
                    </div>
                  </CheckWrapper>
                  <span>{category?.name}</span>
                </div>
              </AccordionItem>
            </Accordion>
            <AccordionContent
              style={{
                maxHeight: !setActive && '0px'
              }}
            >
              {category?.subcategories?.length > 0 && (
                category.subcategories.sort((a, b) => a.rank - b.rank).map((subCategory, i) => (
                  <SingleBusinessSubCateogries
                    {...props}
                    key={subCategory.id}
                    category={subCategory}
                    index={index + 1}
                    isLastCategory={category?.subcategories?.length - 1 === i}
                    setParentActiveState={setActiveState}
                    setParentRotateState={setRotateState}
                    setNextParentCategoryId={setParentCategoryId}
                  />
                ))
              )}
            </AccordionContent>
          </>
          )}
    </AccordionSection>
  )
}

export const SingleBusinessSubCateogries = (props) => {
  const { isSkeleton } = props
  const singleBusinessSubCateogriesProps = {
    ...props,
    UIComponent: SingleBusinessSubCateogriesUI
  }
  return (
    <>
      {isSkeleton
        ? (
          <SingleBusinessSubCateogriesUI {...props} />
          )
        : (
          <SingleBusinessCategoryController {...singleBusinessSubCateogriesProps} />
          )}
    </>
  )
}

SingleBusinessSubCateogries.displayName = 'SingleBusinessSubCateogries'
