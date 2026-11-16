export const checkSiteUrl = (url, fallback) => {
  if (!url) return fallback
  return url[url?.length - 1] === '/' ? url : `${url}/`
}
