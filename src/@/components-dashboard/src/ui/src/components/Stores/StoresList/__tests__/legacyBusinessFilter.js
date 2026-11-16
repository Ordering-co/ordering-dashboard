// The oracle of the stores filters: what the old filter modal held and sent on «Accept». It replays, literally, the state and
// the two handlers of the BusinessFilter controller of main (C/components/BusinessFilter), deleted as dead code in
// once nothing mounted it. The list still reads that shape, so the tests keep comparing with it.
const INITIAL = {
  name: null,
  cityIds: [],
  availableMenus: { value: '', condition: '=' },
  menus: { value: '', condition: '=' },
  enabled: null,
  featured: null,
  externalId: null
}

export const legacyBusinessFilter = () => {
  let filterValues = JSON.parse(JSON.stringify(INITIAL))
  const handlers = {
    handleChangeValue: (changes) => {
      filterValues = { ...filterValues, ...changes }
    },
    handleChangeCity: (cityId) => {
      let cityIds = [...filterValues.cityIds]
      if (!cityIds.includes(cityId)) cityIds.push(cityId)
      else cityIds = cityIds.filter((id) => id !== cityId)
      filterValues = { ...filterValues, cityIds }
    }
  }
  return {
    get values () { return filterValues },
    change: (gesture) => gesture(handlers)
  }
}
