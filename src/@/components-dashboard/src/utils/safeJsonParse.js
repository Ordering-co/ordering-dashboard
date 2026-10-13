export const safeJsonParse = (value, fallback) => {
  if (value == null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch (error) {
    return fallback
  }
}

export const getStoredLanguageCode = (raw, fallback = 'en') => {
  const parsed = safeJsonParse(raw, null)
  if (parsed && typeof parsed === 'object' && typeof parsed.code === 'string' && parsed.code) {
    return parsed.code
  }
  return fallback
}

export const parseJsonObject = (value) => {
  const parsed = safeJsonParse(value, {})
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

export const parseJsonArray = (value) => {
  const parsed = safeJsonParse(value, [])
  return Array.isArray(parsed) ? parsed : []
}

export const parseLogData = (data) => {
  if (data && typeof data === 'object') {
    return Object.values(data)
  }
  if (typeof data === 'string') {
    return safeJsonParse(data, [])
  }
  return data
}
