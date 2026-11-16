// ST8: a log row reads «Chrome 155 · macOS» instead of the whole user agent (the detail keeps the string whole).
// Pure and small on purpose: browser and major version, then system. Anything that is not a browser (okhttp, axios, curl, an app's own
// agent) or that it does not know is shown as it came, trimmed, so nothing is guessed.

const RAW_LIMIT = 48

// The order matters: Edge, Opera and Chrome on iOS also say «Chrome» or «Safari»; Safari says «Version/» only when it is Safari.
const BROWSERS = [
  ['Edge', /\b(?:Edg|EdgA|EdgiOS|Edge)\/(\d+)/],
  ['Opera', /\b(?:OPR|OPiOS)\/(\d+)/],
  ['Firefox', /\b(?:Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /\b(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /\bVersion\/(\d+)[^]*\bSafari\//]
]

// iPhone and iPad agents say «like Mac OS X» and Android ones say «Linux»: the narrower system goes first.
const SYSTEMS = [
  ['iOS', /\b(?:iPhone|iPad|iPod)\b/],
  ['Android', /\bAndroid\b/],
  ['Windows', /\bWindows\b/],
  ['ChromeOS', /\bCrOS\b/],
  ['macOS', /\b(?:Macintosh|Mac OS X)\b/],
  ['Linux', /\b(?:Linux|X11)\b/]
]

const raw = (clean) => ({
  text: clean.length > RAW_LIMIT ? `${clean.slice(0, RAW_LIMIT - 1).trimEnd()}…` : clean,
  parsed: false
})

/**
 * @param {string} [agent] the `user_agent` of a log
 * @returns {{ text: string, parsed: boolean }} `text` is the short form; `parsed` says it is «Browser N · System» and not the raw agent
 */
export const summarizeUserAgent = (agent) => {
  const clean = String(agent ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return { text: '', parsed: false }
  // every browser says «Mozilla/»; the rest (okhttp, axios, curl, apps) is not a browser and is shown as it is
  if (!clean.startsWith('Mozilla/')) return raw(clean)

  const browser = BROWSERS.find(([, pattern]) => pattern.test(clean))
  const bareBrowser = browser ? null : [['Firefox', /\bFirefox\b/], ['Chrome', /\bChrome\b/]].find(([, pattern]) => pattern.test(clean))
  if (!browser && !bareBrowser) return raw(clean)

  const name = browser ? browser[0] : bareBrowser[0]
  const major = browser ? clean.match(browser[1])?.[1] : undefined
  const system = SYSTEMS.find(([, pattern]) => pattern.test(clean))?.[0]
  return { text: [major ? `${name} ${major}` : name, system].filter(Boolean).join(' · '), parsed: true }
}
