import React from 'react'
import PropTypes from 'prop-types'

export const BusinessOption = (props) => {
  props = { ...defaultProps, ...props }
  const {
    optionToShow,
    UIComponent
  } = props

  const handleClickOption = (option) => {
    const val = option === optionToShow ? null : option
    props.handleChangeOption(val)
  }

  const formatUrlVideo = (url) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/
    const match = url.match(regExp)
    const id = (match && match[7].length === 11) ? match[7] : false
    return `https://www.youtube-nocookie.com/embed/${id}`
  }

  const openingTime = ({ open, close }) => {
    const checkTime = (val) => val < 10 ? `0${val}` : val
    return `${checkTime(open?.hour)}:${checkTime(open?.minute)} - ${checkTime(close?.hour)}:${checkTime(close?.minute)}`
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          handleClickOption={handleClickOption}
          formatUrlVideo={formatUrlVideo}
          openingTime={openingTime}
        />
      )}
    </>
  )
}

BusinessOption.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Name to show in buttom
   */
  label: PropTypes.string,
  /**
   * Array of business schedule, photos or videos, depends of label type
   */
  contentData: PropTypes.arrayOf(PropTypes.object),
  /**
   * This must be containt all location info
   */
  locationData: PropTypes.object
}

const defaultProps = {
  contentData: []
}
