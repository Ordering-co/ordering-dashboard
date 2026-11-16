import React from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { StoreSharePicker } from '../StoreSharePicker'

// redesign stores 2.H: «Share with» of a menu is the common StoreSharePicker; this alias only says what to
// save (the same SDK PUT /business/:id/menus/:menuId { business_id, shared } as before) and how the menu list learns it.
export const BusinessMenuShare = (props) => {
  const {
    business,
    menu,
    setMenuList,
    menuList,
    setCurrentMenu
  } = props

  const [ordering] = useApi()

  // The SDK answers with an ApiResponse: the API body (`{ error, result }`) is its `content`.
  const saveShare = async (ids) => {
    const { content } = await ordering.businesses(business.id).menus(menu.id).save({
      business_id: business.id,
      shared: ids
    })
    return content
  }

  const onShared = (stores) => {
    const _businessMenu = {
      ...menu,
      businesses: stores.map(({ id, name }) => ({ id, name, pivot: { business_id: id, menu_id: menu.id } }))
    }
    const menus = menuList?.menus?.filter(_menu => {
      if (_menu.id === _businessMenu.id) {
        Object.assign(_menu, _businessMenu)
      }
      return true
    })
    setCurrentMenu && setCurrentMenu({ menu: _businessMenu })
    setMenuList({
      ...menuList,
      menus
    })
  }

  return (
    <StoreSharePicker
      {...props}
      sharedBusinesses={menu?.businesses}
      saveShare={saveShare}
      onShared={onShared}
    />
  )
}

BusinessMenuShare.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
