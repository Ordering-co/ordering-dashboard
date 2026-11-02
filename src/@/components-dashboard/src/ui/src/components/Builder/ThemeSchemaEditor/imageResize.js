/**
 * Fitting an uploaded image to what its slot asks for (the node's `hints`:
 * `size`, `ratio`, `alpha`, `max_kb`) and to the API's hard limits
 * (`format.images`: `max_bytes`, `max_side`, `max_pixels`), without making
 * it heavier than the file the user picked.
 *
 * The decisions are pure functions (tested); `readImage` and `renderCrop`
 * use the browser's image decoding and canvas.
 */

/** Formats a canvas can crop and save again. SVG and ICO are never cropped; GIF may be animated. */
export const CROPPABLE_FORMATS = ['jpg', 'png', 'webp', 'avif']

/** A proportion within 2% of the hint is the same proportion (1366 × 768 is 16:9). */
export const RATIO_TOLERANCE = 0.02

/**
 * Lossy qualities tried in order. 0.85 is visually clean for photos; lower
 * steps are only used to get under the hint's weight (down to 0.7) or under
 * the API's hard limit (down to 0.6).
 */
export const LOSSY_QUALITIES = [0.85, 0.78, 0.7, 0.6]
const SOFT_QUALITY_FLOOR = 0.7

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' }
const FROM_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico'
}

export const normalizeFormat = (format) => {
  const value = String(format || '').toLowerCase().replace(/^\./, '')
  return value === 'jpeg' ? 'jpg' : value
}

/** A file's format: by its type, else by its extension. */
export const fileFormat = (file) => {
  if (file?.type && FROM_MIME[file.type]) return FROM_MIME[file.type]
  const match = /\.([a-z0-9]+)$/i.exec(file?.name || '')
  return match ? normalizeFormat(match[1]) : ''
}

/** The proportion the hints ask for, as width / height: `ratio` ("16:9"), else `size`. */
export const parseRatio = (hints) => {
  const match = /^\s*(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)\s*$/i.exec(String(hints?.ratio || ''))
  if (match && Number(match[1]) > 0 && Number(match[2]) > 0) return Number(match[1]) / Number(match[2])
  const [width, height] = Array.isArray(hints?.size) ? hints.size : []
  return width > 0 && height > 0 ? width / height : null
}

const hintSize = (hints) => {
  const [width, height] = Array.isArray(hints?.size) ? hints.size : []
  return width > 0 && height > 0 ? { width, height } : null
}

/**
 * The size a `width` × `height` image is saved at: as big as it is, at most
 * the recommended size and the API's `max_side` / `max_pixels`, keeping its
 * proportion. Never bigger than it is (upscaling adds bytes, not detail).
 */
export const fitSize = (width, height, { hints, limits } = {}) => {
  const recommended = hintSize(hints)
  const scales = [1]
  if (recommended) scales.push(recommended.width / width, recommended.height / height)
  if (limits?.max_side > 0) scales.push(limits.max_side / Math.max(width, height))
  if (limits?.max_pixels > 0) scales.push(Math.sqrt(limits.max_pixels / (width * height)))
  const scale = Math.min(...scales)
  // Rounding up could cross `max_pixels`: then round down
  const round = limits?.max_pixels > 0 && Math.round(width * scale) * Math.round(height * scale) > limits.max_pixels ? Math.floor : Math.round
  return {
    width: Math.max(1, round(width * scale)),
    height: Math.max(1, round(height * scale))
  }
}

/**
 * Whether a picked image needs the crop dialog, and why:
 * - `ratio`: its proportion is not the hint's,
 * - `size`: it is larger than the recommended size,
 * - `limit`: the API would refuse it (`max_side`, `max_pixels`, `max_bytes`).
 * `overLimit` means "Upload as is" would fail. `small`: it is under the
 * recommended size (cropping can't fix that; the editor asks before uploading).
 */
export const planImage = ({ width, height, bytes, hints, limits } = {}) => {
  const ratio = parseRatio(hints)
  const recommended = hintSize(hints)
  const reasons = []
  if (ratio && width > 0 && height > 0 && Math.abs(width / height - ratio) / ratio > RATIO_TOLERANCE) reasons.push('ratio')
  if (recommended && (width > recommended.width || height > recommended.height)) reasons.push('size')
  const overLimit = Boolean(
    (limits?.max_side > 0 && Math.max(width, height) > limits.max_side) ||
    (limits?.max_pixels > 0 && width * height > limits.max_pixels) ||
    (limits?.max_bytes > 0 && bytes > limits.max_bytes)
  )
  if (overLimit) reasons.push('limit')
  const small = Boolean(recommended && width > 0 && height > 0 && (width < recommended.width || height < recommended.height))
  return { ratio, recommended, reasons, overLimit, small, needsDialog: reasons.length > 0 }
}

/**
 * The format a cropped image is saved in, among the slot's `formats`:
 * - with transparency (the hint asks for it, or the image has it) WebP keeps
 *   it at a fraction of PNG's weight; PNG when WebP isn't allowed (or the
 *   browser can't save it: renderCrop falls back);
 * - a JPEG or WebP keeps its format;
 * - a PNG or AVIF without transparency becomes WebP (about a third lighter
 *   than JPEG at the same quality), else JPEG. Browsers can't save AVIF.
 */
export const pickOutputFormat = ({ source, formats, alpha }) => {
  const allowed = new Set((formats || []).map(normalizeFormat))
  const can = (format) => allowed.has(format)
  source = normalizeFormat(source)
  if (alpha) {
    if (can('webp')) return 'webp'
    if (can('png')) return 'png'
    return can('jpg') ? 'jpg' : null
  }
  if ((source === 'jpg' || source === 'webp') && can(source)) return source
  return ['webp', 'jpg', 'png'].find(can) || null
}

/** Byte targets: the hint's `max_kb` (soft; a KB is 1000 bytes, as the API counts it) and the API's `max_bytes` (hard). */
export const byteTargets = (hints, limits) => {
  const hard = limits?.max_bytes > 0 ? limits.max_bytes : Infinity
  const soft = hints?.max_kb > 0 ? Math.min(hints.max_kb * 1000, hard) : hard
  return { soft, hard }
}

/** Whether a lossy encode at `quality` weighing `bytes` can stop the quality ladder. */
export const goodEnough = (bytes, quality, { soft, hard }) =>
  bytes <= soft || (quality <= SOFT_QUALITY_FLOOR && bytes <= hard)

/** Whether the crop `rect` is the whole `width` × `height` image (give or take a pixel of rounding). */
export const isWholeImage = (rect, width, height) =>
  rect.x <= 1 && rect.y <= 1 && Math.abs(rect.width - width) <= 1 && Math.abs(rect.height - height) <= 1

/** Keep the picked file when nothing was cut or scaled and saving it again only made it heavier. */
export const keepOriginal = ({ whole, resized, outputBytes, originalBytes }) =>
  whole && !resized && outputBytes >= originalBytes

/** The file name with the extension of `format`. */
export const renamed = (name, format) => {
  const base = String(name || 'image').replace(/\.[^./\\]+$/, '') || 'image'
  return `${base}.${format}`
}

/** A crop rectangle in natural pixels, inside the image. */
export const clampRect = (rect, width, height) => {
  const x = Math.min(Math.max(0, Math.round(rect.x)), width - 1)
  const y = Math.min(Math.max(0, Math.round(rect.y)), height - 1)
  return {
    x,
    y,
    width: Math.max(1, Math.min(Math.round(rect.width), width - x)),
    height: Math.max(1, Math.min(Math.round(rect.height), height - y))
  }
}

/* browser */

/** Decodes `file`: `{ url, image, width, height }`. The caller revokes `url`. */
export const readImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const image = new window.Image()
  image.onload = () => resolve({ url, image, width: image.naturalWidth, height: image.naturalHeight })
  image.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('image.unreadable'))
  }
  image.src = url
})

/** Whether any pixel of the canvas is not fully opaque. */
const hasTransparency = (context, width, height) => {
  const { data } = context.getImageData(0, 0, width, height)
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) return true
  }
  return false
}

/** The canvas as a Blob of `format`, or null when the browser can't save that format (it falls back to PNG). */
const encode = (canvas, format, quality) => new Promise(resolve => {
  canvas.toBlob(blob => resolve(blob && blob.type === MIME[format] ? blob : null), MIME[format], quality)
})

/** The lightest encode that is still good: down the quality ladder until it fits the targets. */
const encodeWithin = async (canvas, format, targets) => {
  if (format === 'png') return encode(canvas, 'png')
  let blob = null
  for (const quality of LOSSY_QUALITIES) {
    blob = await encode(canvas, format, quality)
    if (!blob || goodEnough(blob.size, quality, targets)) break
  }
  return blob
}

/**
 * The crop of `image` as a File for upload, at most the recommended size,
 * in the format `pickOutputFormat` chooses. Returns the picked `file` itself
 * when nothing was cut or scaled and saving it again would be heavier.
 */
export const renderCrop = async ({ file, image, rect, hints, limits, formats }) => {
  const width = image.naturalWidth
  const height = image.naturalHeight
  const area = clampRect(rect, width, height)
  const whole = isWholeImage(area, width, height)
  const size = fitSize(area.width, area.height, { hints, limits })
  const resized = size.width !== area.width || size.height !== area.height

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size.width, size.height)

  const source = fileFormat(file)
  const allowed = (formats || []).map(normalizeFormat)
  // A JPEG has no transparency; any other source is checked pixel by pixel
  const transparent = source !== 'jpg' && hasTransparency(context, size.width, size.height)
  const alpha = Boolean(hints?.alpha) || transparent
  const targets = byteTargets(hints, limits)
  let format = pickOutputFormat({ source, formats, alpha })
  if (!format) throw new Error('image.no_format')

  if (format === 'jpg' && transparent) {
    // Only when the slot takes nothing with transparency: lay it on white, not black
    context.globalCompositeOperation = 'destination-over'
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, size.width, size.height)
  }

  let blob = await encodeWithin(canvas, format, targets)
  if (!blob && format === 'webp') {
    // This browser can't save WebP
    format = !alpha && allowed.includes('jpg') ? 'jpg' : 'png'
    blob = await encodeWithin(canvas, format, targets)
  }
  if (blob && format === 'png' && blob.size > targets.hard && allowed.includes('webp')) {
    // A PNG over the API's limit: WebP keeps the transparency at a fraction of the weight
    const webp = await encodeWithin(canvas, 'webp', targets)
    if (webp && webp.size < blob.size) {
      blob = webp
      format = 'webp'
    }
  }
  if (!blob) throw new Error('image.encode_failed')

  if (keepOriginal({ whole, resized, outputBytes: blob.size, originalBytes: file.size })) return file
  return new window.File([blob], renamed(file.name, format), { type: blob.type, lastModified: Date.now() })
}
