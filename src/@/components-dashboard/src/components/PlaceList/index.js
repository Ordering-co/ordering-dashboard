import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const PlaceList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    cityMangersPropsToFetch
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [countriesState, setCountriesState] = useState({ countries: [], loading: false, error: null })
  const [dropdownOptionsState, setDropdownOptionsState] = useState({ options: [], loading: false, error: null })
  const [cityManagerList, setCityMangerList] = useState({ users: [], loading: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [selectedCity, setSelectedCity] = useState(null)
  const [changesState, setChangesState] = useState({})
  const [openCity, setOpenCity] = useState(false)
  const [selectedCityList, setSelectedCityList] = useState([])

  const [openZoneDropdown, setOpenZonedropdown] = useState(false)
  const [selectedZoneDropdown, setSelectedZoneDropdown] = useState(null)
  const [selectedZoneList, setSelectedZoneList] = useState([])
  const [selectedCountries, setSelectedCountries] = useState([])
  const [startSeveralDeleteStart, setStartSeveralDeleteStart] = useState(false)

  /**
   * Method to get the countries from API
   */
  const getCountries = async () => {
    try {
      setCountriesState({ ...countriesState, loading: true })
      const { content: { error, result } } = await ordering.countries().get()
      if (!error) {
        setCountriesState({ ...countriesState, loading: false, countries: result })
      } else {
        setCountriesState({ ...countriesState, loading: false, error: result })
      }
    } catch (err) {
      setCountriesState({ ...countriesState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to get the dropdown options from API
   */
  const getDropdownOptions = async () => {
    try {
      setDropdownOptionsState({ ...dropdownOptionsState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/dropdownoptions`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setDropdownOptionsState({ ...dropdownOptionsState, loading: false, options: content.result })
      } else {
        setDropdownOptionsState({ ...dropdownOptionsState, loading: false, error: content.result })
      }
    } catch (err) {
      setDropdownOptionsState({ ...dropdownOptionsState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to update country from API
   */
  const handleUpdateCountry = async (countryId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const { content: { error, result } } = await ordering.countries(countryId).save(changes)
      if (!error) {
        const countries = countriesState.countries.filter(country => {
          if (country.id === countryId) {
            Object.assign(country, result)
          }
          return true
        })
        setCountriesState({ ...countriesState, countries })
        showToast(ToastType.Success, t('COUNTRY_SAVED', 'Country saved'))
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to add new country from API
   */
  const handleAddCountry = async (changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const { content: { error, result } } = await ordering.countries().save(changes)
      if (!error) {
        const newCountry = { ...result }
        newCountry.enabled = true
        newCountry.cities = []
        setCountriesState({
          ...countriesState,
          countries: [...countriesState.countries, newCountry]
        })
        showToast(ToastType.Success, t('COUNTRY_ADDED', 'Country added'))
        setActionState({ ...actionState, loading: false })
      } else {
        setActionState({ loading: false, error: result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to delete the country from API
   */
  const handleDeleteCountry = async (countryId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const { content: { error, result } } = await ordering.countries(countryId).delete()
      if (!error) {
        const countries = countriesState.countries.filter(country => country.id !== countryId)
        setCountriesState({ ...countriesState, countries })
        showToast(ToastType.Success, t('COUNTRY_DELETED', 'Country deleted'))
        if (startSeveralDeleteStart) {
          const contriesList = [...selectedCountries]
          contriesList.shift()
          if (contriesList.length === 0) {
            setStartSeveralDeleteStart(false)
          }
          setSelectedCountries(contriesList)
        }
        setActionState({ ...actionState, loading: false })
      } else {
        setActionState({ ...actionState, loading: false, error: result })
        setStartSeveralDeleteStart(false)
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      setStartSeveralDeleteStart(false)
    }
  }

  /**
   * Method to update the city from API
   */
  const handleUpdateCity = async (countryId, cityId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const { content: { error, result } } = await ordering.countries(countryId).cities(cityId).save(changes)
      if (!error) {
        const countries = countriesState.countries.map(country => {
          if (country.id === countryId) {
            const cities = country.cities.filter(city => {
              if (city.id === cityId) {
                Object.assign(city, result)
              }
              return true
            })
            country.cities = cities
          }
          return country
        })
        setCountriesState({ ...countriesState, countries })
        showToast(ToastType.Success, t('CITY_SAVED', 'City saved'))
        setChangesState({})
      } else {
        setActionState({ ...actionState, loading: false, error: result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to delete the city from API
   */
  const handleDeleteCity = async (countryId, cityId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const { content: { error, result } } = await ordering.countries(countryId).cities(cityId).delete()
      if (!error) {
        const countries = countriesState.countries.map(country => {
          if (parseInt(country.id) === parseInt(countryId)) {
            const cities = country.cities.filter(city => city.id !== cityId)
            country.cities = cities
          }
          return country
        })
        setCountriesState({ ...countriesState, countries })
        showToast(ToastType.Success, t('CITY_REMOVED', 'City removed'))
        if (startSeveralDeleteStart) {
          const cityList = [...selectedCityList]
          cityList.shift()
          if (cityList.length === 0) {
            setStartSeveralDeleteStart(false)
          }
          setSelectedCityList(cityList)
        }
      } else {
        setActionState({ ...actionState, loading: false, error: result })
        setStartSeveralDeleteStart(false)
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      setStartSeveralDeleteStart(false)
    }
  }

  /**
   * Method to get city managers from API
   */
  const getCityManagers = async () => {
    try {
      setCityMangerList({ ...cityManagerList, loading: true })
      const source = {}
      const { content: { result } } = await ordering
        .setAccessToken(token)
        .users()
        .select(cityMangersPropsToFetch)
        .where([{ attribute: 'level', value: [1] }])
        .get({ cancelToken: source })

      setCityMangerList({
        ...cityManagerList,
        loading: false,
        users: result
      })
    } catch (err) {
      setCityMangerList({
        ...cityManagerList,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to add new city from API
   */
  const handleAddCity = async () => {
    if (!changesState?.country_id) {
      setActionState({
        ...actionState,
        error: t('SELECT_COUNTRY', 'Select a country')
      })
      return
    }
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      changesState.enabled = true
      const { content: { error, result } } = await ordering.countries(changesState?.country_id).cities().save(changesState)
      if (!error) {
        const countries = countriesState.countries.map(country => {
          if (country.id === changesState?.country_id) {
            const cities = [...country.cities, result]
            country.cities = cities
          }
          return country
        })
        setCountriesState({ ...countriesState, countries })
        showToast(ToastType.Success, t('CITY_ADDED', 'City added'))
        setChangesState({})
        setOpenCity(false)
      } else {
        setActionState({ ...actionState, loading: false, error: result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  const handleChangesState = (key, val) => {
    setChangesState({
      ...changesState,
      [key]: val
    })
  }

  const handleSaveCity = () => {
    handleUpdateCity(selectedCity?.country_id, selectedCity?.id, changesState)
  }

  const handleCheckboxClick = (city) => {
    const found = selectedCityList.find(_city => _city?.id === city.id)
    if (!found) {
      setSelectedCityList([...selectedCityList, city])
    } else {
      const cities = selectedCityList.filter(_city => _city.id !== city.id)
      setSelectedCityList(cities)
    }
  }

  const handleAllCheckboxClick = () => {
    const cities = countriesState.countries?.reduce((_cities, country) => [..._cities, ...country?.cities], [])
    if (cities.length === selectedCityList.length) {
      setSelectedCityList([])
    } else {
      setSelectedCityList(cities)
    }
  }

  /**
   * Method to delete the several cities from API
   */
  const handleSeveralDeleteCities = () => {
    setStartSeveralDeleteStart(true)
  }

  /**
   * Method to update the city from API
   */
  const handleUpdateDropdown = async (dropdownId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/dropdownoptions/${dropdownId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        const dropdownOptions = dropdownOptionsState.options.filter(option => {
          if (option.id === dropdownId) {
            Object.assign(option, content.result)
          }
          return true
        })
        setDropdownOptionsState({ ...dropdownOptionsState, options: dropdownOptions })
        showToast(ToastType.Success, t('ZONE_SAVED', 'Zone saved'))
        setChangesState({})
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  const handleSaveZone = () => {
    handleUpdateDropdown(selectedZoneDropdown?.id, changesState)
  }

  /**
   * Method to add new city from API
   */
  const handleAddZone = async () => {
    if (!changesState?.name) {
      setActionState({
        ...actionState,
        error: t('NAME_REQUIRED', 'The name is required.')
      })
      return
    }
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      changesState.enabled = true
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changesState)
      }
      const response = await fetch(`${ordering.root}/dropdownoptions`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const dropdownOptions = [...dropdownOptionsState.options, content.result]
        setDropdownOptionsState({ ...dropdownOptionsState, options: dropdownOptions })
        showToast(ToastType.Success, t('ZONE_ADDED', 'Zone added'))
        setChangesState({})
        setOpenZonedropdown(false)
        setActionState({ ...actionState, loading: false })
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to delete the city from API
   */
  const handleDeleteZone = async (zoneId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/dropdownoptions/${zoneId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const dropdownOptions = dropdownOptionsState.options.filter(zone => zone.id !== zoneId)
        setDropdownOptionsState({ ...dropdownOptionsState, options: dropdownOptions })
        showToast(ToastType.Success, t('ZONE_REMOVED', 'Zone removed'))

        if (startSeveralDeleteStart) {
          const zoneList = [...selectedZoneList]
          zoneList.shift()
          if (zoneList.length === 0) {
            setStartSeveralDeleteStart(false)
          }
          setSelectedZoneList(zoneList)
        }
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
        setStartSeveralDeleteStart(false)
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      setStartSeveralDeleteStart(false)
    }
  }

  const handleCheckboxZoneClick = (zone) => {
    const found = selectedZoneList.find(_zone => _zone?.id === zone.id)
    if (!found) {
      setSelectedZoneList([...selectedZoneList, zone])
    } else {
      const zones = selectedZoneList.filter(_zone => _zone.id !== zone.id)
      setSelectedZoneList(zones)
    }
  }

  const handleAllCheckboxZoneClick = () => {
    const zones = [...dropdownOptionsState.options]
    if (zones.length === selectedZoneList.length) {
      setSelectedZoneList([])
    } else {
      setSelectedZoneList(zones)
    }
  }

  /**
   * Method to delete the several cities from API
   */
  const handleSeveralDeleteZones = () => {
    setStartSeveralDeleteStart(true)
  }

  useEffect(() => {
    if (!startSeveralDeleteStart || selectedZoneList.length === 0) return
    handleDeleteZone(selectedZoneList[0]?.id)
  }, [selectedZoneList, startSeveralDeleteStart])

  useEffect(() => {
    if (!startSeveralDeleteStart || selectedCityList.length === 0) return
    handleDeleteCity(selectedCityList[0]?.country_id, selectedCityList[0]?.id)
  }, [selectedCityList, startSeveralDeleteStart])

  useEffect(() => {
    if (!startSeveralDeleteStart || selectedCountries.length === 0) return
    handleDeleteCountry(selectedCountries[0]?.id)
  }, [selectedCountries, startSeveralDeleteStart])

  useEffect(() => {
    setChangesState({})
  }, [selectedCity])

  useEffect(() => {
    getCityManagers()
    getCountries()
    getDropdownOptions()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          countriesState={countriesState}
          dropdownOptionsState={dropdownOptionsState}
          cityManagerList={cityManagerList}
          actionState={actionState}
          handleUpdateCountry={handleUpdateCountry}
          handleAddCountry={handleAddCountry}
          setSelectedCountries={setSelectedCountries}
          selectedCountries={selectedCountries}
          handleDeleteCountry={handleDeleteCountry}
          handleUpdateCity={handleUpdateCity}
          handleDeleteCity={handleDeleteCity}
          selectedCity={selectedCity}
          setSelectedCity={setSelectedCity}
          openCity={openCity}
          setOpenCity={setOpenCity}
          changesState={changesState}
          handleChangesState={handleChangesState}
          cleanChagesState={() => setChangesState({})}
          handleSaveCity={handleSaveCity}
          handleAddCity={handleAddCity}
          selectedCityList={selectedCityList}
          handleCheckboxClick={handleCheckboxClick}
          handleAllCheckboxClick={handleAllCheckboxClick}
          handleSeveralDeleteCities={handleSeveralDeleteCities}
          handleSeveralDeleteCountries={() => setStartSeveralDeleteStart(true)}
          handleUpdateDropdown={handleUpdateDropdown}
          openZoneDropdown={openZoneDropdown}
          setOpenZonedropdown={setOpenZonedropdown}
          selectedZoneDropdown={selectedZoneDropdown}
          setSelectedZoneDropdown={setSelectedZoneDropdown}
          handleSaveZone={handleSaveZone}
          handleAddZone={handleAddZone}
          handleDeleteZone={handleDeleteZone}
          selectedZoneList={selectedZoneList}
          handleCheckboxZoneClick={handleCheckboxZoneClick}
          handleAllCheckboxZoneClick={handleAllCheckboxZoneClick}
          handleSeveralDeleteZones={handleSeveralDeleteZones}
        />
      )}
    </>
  )
}

PlaceList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  cityMangersPropsToFetch: ['id', 'name', 'lastname']
}
