import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useLanguage } from '../../contexts/LanguageContext'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const BatchImageForm = (props) => {
  const {
    categorySelected,
    businessState,
    handleUpdateBusinessState,
    UIComponent
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ loading }] = useSession()
  const [, { showToast }] = useToast()
  const [products, setProducts] = useState([])
  const { business } = businessState
  const [formState, setFormState] = useState({ photos: [], loading: false, result: { error: null }, API: false, endPoint: false })
  const [images, setImages] = useState([])

  /**
  * Clean formState
  */
  const cleanFormState = () => setFormState({
    photos: [],
    loading: false,
    result: { error: null },
    API: false
  })

  /**
   * Method to edit a product
   */

  const editProduct = async (product, params) => {
    if (loading) return
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({
        ...formState,
        loading: true,
        API: false
      })
      const { content: { error, result } } = await ordering.businesses(parseInt(business?.id)).categories(parseInt(product?.category_id)).products(product?.id).save(params)
      if (!error) {
        if (handleUpdateBusinessState) {
          const _categories = [...business?.categories]
          _categories.forEach(function iterate (category) {
            if (category.id === product?.category_id && category.products) {
              const _products = category.products.map(_product => {
                if (_product.id === product.id) {
                  return {
                    ..._product,
                    ...params
                  }
                }
                return _product
              })
              category.products = [..._products]
            }
            Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
          })
          handleUpdateBusinessState({ ...business, categories: _categories })
        }

        const photos = formState?.photos?.filter(photo => photo?.name !== result?.id)
        if (photos.length > 0) {
          setFormState({
            ...formState,
            photos,
            API: true
          })
        } else {
          setFormState({
            loading: false,
            photos: [],
            result: {
              error: false,
              result: 'all product updated'
            },
            API: false,
            endPoint: true
          })
        }
        showToast(ToastType.Success, t('PRODUCT_UPDATE', 'Products updated'))
      } else {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: true,
            result
          }
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        result: {
          error: true,
          result: err
        }
      })
    }
  }

  /**
   * Upload product photo data
   * @param {File} file Image to change user photo
   */

  const fileToDataUri = (image) => {
    // eslint-disable-next-line promise/param-names
    return new Promise((res) => {
      const reader = new FileReader()
      const { type, name, size } = image
      reader.addEventListener('load', () => {
        res({
          base64: reader.result,
          name: parseInt(name.split('.')[0]),
          type,
          size
        })
      })
      reader.readAsDataURL(image)
    })
  }

  const handleUploadImages = async (files) => {
    const newImagesPromises = []
    for (let i = 0; i < files.length; i++) {
      newImagesPromises.push(fileToDataUri(files[i]))
    }
    const newImages = await Promise.all(newImagesPromises)
    setImages([...images, ...newImages])
  }

  useEffect(() => {
    setFormState({
      ...formState,
      photos: images
    })
  }, [images])

  /**
 * Save Product
*/
  const updateProduct = () => {
    setFormState({
      ...formState,
      API: true,
      loading: true
    })
  }

  useEffect(() => {
    if (categorySelected && categorySelected?.products && categorySelected?.products.length > 0) {
      setProducts(categorySelected?.products)
    }
  }, [categorySelected])

  useEffect(() => {
    if (formState?.API && formState?.photos?.length > 0) {
      const _photo = formState?.photos[0]
      const params = {
        images: _photo?.base64
      }
      const product = products.find(product => _photo?.name === product?.id)
      editProduct(product, params)
    }
    if (formState?.API && formState?.photos.length === 0) {
      cleanFormState()
    }
  }, [formState?.API])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            handleUploadImages={handleUploadImages}
            cleanFormState={cleanFormState}
            updateProduct={updateProduct}
            formState={formState}
            products={products}
          />
        )
      }
    </>
  )
}

BatchImageForm.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
