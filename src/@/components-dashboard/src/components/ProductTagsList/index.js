import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const ProductTagsList = (props) => {
  const {
    tags,
    businessId,
    product,
    UIComponent,
    handleSuccessProductUpdate
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [tagsState, setTagsState] = useState({ loading: false, tags: [], error: null })
  const [selectedTagIds, setSelectedTagIds] = useState([])
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [searchValue, setSearchValue] = useState(null)

  /**
   * Method to get the product tags from API
   */
  const getProductTags = async () => {
    try {
      setTagsState({ ...tagsState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      let where = null
      const conditions = []
      if (searchValue) {
        conditions.push(
          {
            attribute: 'name',
            value: {
              condition: 'ilike',
              value: encodeURI(`%${searchValue}%`)
            }
          }
        )
      }

      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }

      const fetchEndpoint = where
        ? `${ordering.root}/tags?where=${JSON.stringify(where)}`
        : `${ordering.root}/tags`

      const response = await fetch(fetchEndpoint, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setTagsState({ ...tagsState, loading: false, tags: content.result })
      } else {
        setTagsState({ ...tagsState, loading: false, error: content.result })
      }
    } catch (err) {
      setTagsState({ ...tagsState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to handle the product tags from API
   * @param tagIds selected tag ids
   */
  const handleUpdateProductTags = async (tagIds) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const changes = { tags: JSON.stringify(tagIds) }
      const { content: { error, result } } = await ordering.businesses(businessId).categories(product.category_id).products(product.id).save(changes, {
        accessToken: token
      })
      if (!error) {
        setActionState({ loading: false, error: null })
        handleSuccessProductUpdate && handleSuccessProductUpdate(result)
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      } else {
        setActionState({ loading: false, error: result })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
    }
  }

  const handleSuccessUpdate = (updatedTag) => {
    const tags = tagsState.tags.map(tag => {
      if (tag.id === updatedTag.id) {
        return { ...tag, ...updatedTag }
      }
      return tag
    })
    setTagsState({ ...tagsState, tags })
  }

  const handleSuccessDelete = (tagId) => {
    const tags = tagsState.tags.filter(tag => tag.id !== tagId)
    setTagsState({ ...tagsState, tags })
  }

  const handleSuccessAdd = (tag) => {
    setTagsState({ ...tagsState, tags: [...tagsState.tags, tag] })
  }

  /**
   * Method to enable or diable product tag
   */
  const handleChangeProductTag = (checked, tagId) => {
    let tagIds = []
    if (checked) {
      tagIds = [...selectedTagIds, tagId]
    } else {
      tagIds = selectedTagIds.filter(id => id !== parseInt(tagId))
    }
    setSelectedTagIds(tagIds)
    handleUpdateProductTags(tagIds)
  }

  const handleSelectNoneTags = () => {
    setSelectedTagIds([])
    handleUpdateProductTags([])
  }

  const handleSelectAllTags = () => {
    const tagIds = tagsState.tags?.reduce((ids, tag) => [...ids, tag.id], [])
    setSelectedTagIds(tagIds)
    handleUpdateProductTags(tagIds)
  }

  useEffect(() => {
    const tagIds = tags?.reduce((ids, tag) => [...ids, tag.id], [])
    setSelectedTagIds(tagIds)
  }, [tags])

  useEffect(() => {
    getProductTags()
  }, [searchValue])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          tagsState={tagsState}
          searchValue={searchValue}
          onSearch={setSearchValue}
          selectedTagIds={selectedTagIds}
          actionState={actionState}
          handleSuccessUpdate={handleSuccessUpdate}
          handleSuccessDelete={handleSuccessDelete}
          handleSuccessAdd={handleSuccessAdd}
          handleChangeProductTag={handleChangeProductTag}
          handleSelectNoneTags={handleSelectNoneTags}
          handleSelectAllTags={handleSelectAllTags}
        />
      )}
    </>
  )
}

ProductTagsList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
