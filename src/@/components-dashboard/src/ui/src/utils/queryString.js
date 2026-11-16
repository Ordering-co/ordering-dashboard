export const queryStringToObject = url => {
  const params = new URLSearchParams(url.split('?')[1])
  return Object.fromEntries(params)
}

export const addQueryToUrl = (newObj) => {
  const queryObj = queryStringToObject(location.href)
  for (const key in newObj) {
    queryObj[key] = newObj[key]
  }
  const query = new URLSearchParams(queryObj)
  history.replaceState(null, '', `${location.pathname}?${query}`)
}

export const removeQueryToUrl = (removeKeys) => {
  const queryObj = queryStringToObject(location.href)
  for (const key of removeKeys) {
    delete queryObj[key]
  }
  if (Object.keys(queryObj).length) {
    const query = new URLSearchParams(queryObj)
    history.replaceState(null, '', `${location.pathname}?${query}`)
  } else {
    history.replaceState(null, '', `${location.pathname}`)
  }
}
