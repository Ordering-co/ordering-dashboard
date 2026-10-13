import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

export const BusinessInformation = (props) => {
  props = { ...defaultProps, ...props }
  const {
    googleMapsControls,
    business,
    optionToShow,
    UIComponent
  } = props

  const [showOption, setShowOption] = useState(optionToShow)
  const [photos, setPhotos] = useState([])
  const [videos, setVideos] = useState([])
  const [location, setLocation] = useState({})

  const onChangeOption = (value) => {
    setShowOption(value)
  }

  useEffect(() => {
    const photos = business?.gallery?.filter(item => item.file)
    const videos = business?.gallery?.filter(item => item.video)
    const location = {
      location: business?.location,
      address: business?.address,
      address_notes: business?.address_notes,
      googleMapsControls
    }
    setPhotos(photos)
    setVideos(videos)
    setLocation(location)
  }, [business])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessSchedule={business?.schedule || []}
          businessPhotos={photos || []}
          businessVideos={videos || []}
          businessLocation={location || {}}
          optionToShow={showOption}
          onChangeOption={onChangeOption}
        />
      )}
    </>
  )
}

BusinessInformation.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Business, object with all data to render
   */
  business: PropTypes.object,
  /**
   * enable/disable business option of accordeon
   */
  optionToShow: PropTypes.string
}

const defaultProps = {
  business: {}
}
