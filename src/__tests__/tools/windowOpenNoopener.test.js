/* eslint-disable no-template-curly-in-string */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Closing Part 1, B: every `window.open(` in the dashboard tree must
// pass 'noopener,noreferrer' so the opened page cannot reach `window.opener`.
// The exceptions below are a CLOSED list. Each one must still exist in the tree:
// if an exception stops matching (call removed, or it now has noopener), the
// test fails so the list never goes stale.

const ROOT = path.resolve(__dirname, '../../@/components-dashboard/src')
const NOOPENER = "'noopener,noreferrer'"
const MIN_PROTECTED = 41

const EXCLUDED_DIRS = new Set(['__tests__', 'node_modules'])

const EXCEPTIONS = [
  {
    // tel: scheme, it does not open a document that could hold an opener.
    id: 'tel:',
    file: null,
    startsWith: 'window.open(`tel:'
  },
  {
    // OAuth popup; the code uses the returned handle.
    id: 'mercadoPagoConnect',
    file: 'ui/src/utils/mercadoPagoConnect.js',
    contains: 'mercado_pago_setup'
  },
  {
    // Google permissions popup; uses the `connect` handle. it opens empty on the click (a window opened after the API
    // answers is blocked), then the code sets `connect.location.href`; with noopener window.open returns null.
    id: 'UserDetails',
    file: 'components/UserDetails/index.js',
    contains: "window.open('', '_blank', 'directories=no"
  },
  {
    // Stripe Connect popup; uses the `connect` handle.
    id: 'BusinessPaymethods',
    file: 'components/BusinessPaymethods/index.js',
    contains: 'connect.stripe.com/oauth/authorize'
  },
  {
    // main, Stripe Connect v2 onboarding. Opened empty before the link is asked for (a window opened after
    // waiting is blocked), then the code sets `popup.location.href` and watches the handle; with noopener window.open returns null.
    id: 'StripeConnectAccount',
    file: 'components/StripeConnectAccount/index.js',
    contains: "window.open('', '_blank', POPUP_FEATURES)"
  },
  {
    // main #400, the Start Setup of a delivery plugin with links.launch. Opened empty on the click (a window opened after
    // the launch answers is blocked), then the code sets `opener = null` and `location.href` on the handle; with noopener
    // window.open returns null.
    id: 'CredentialsSection',
    file: 'ui/src/components/Connect/DeliveryServicesDirectory/CredentialsSection.jsx',
    contains: "window.open('', '_blank')"
  },
  {
    // «AI agents» asks api-core for a one-time code before ai.ordering.co opens. Opened empty on the click (a window
    // opened after the code arrives is blocked), then the code sets `opener = null` and `location.replace` on the handle; with
    // noopener window.open returns null.
    id: 'SidebarMenuAiAgents',
    file: 'ui/src/components/Shared/UI/SidebarMenu.jsx',
    contains: "window.open('', '_blank')"
  },
  {
    // Calls `.focus()` on the handle; with noopener window.open returns null.
    id: 'LoginForm',
    file: 'components/LoginForm/index.js',
    contains: 'billingUrl'
  }
]

const isSourceFile = (name) => /\.(js|jsx)$/.test(name) && !/\.test\./.test(name)

const walk = async (dir) => {
  const out = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const rel = path.relative(ROOT, full).split(path.sep).join('/')
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue
      out.push(...await walk(full))
    } else if (isSourceFile(entry.name)) {
      out.push({ full, rel })
    }
  }
  return out
}

// From `window.open(` up to the parenthesis that closes it (balanced), not the line.
const extractCalls = (source) => {
  const calls = []
  const needle = 'window.open('
  let from = 0
  for (;;) {
    const start = source.indexOf(needle, from)
    if (start === -1) break
    let depth = 0
    let end = -1
    for (let i = start + needle.length - 1; i < source.length; i++) {
      if (source[i] === '(') depth++
      else if (source[i] === ')') {
        depth--
        if (depth === 0) { end = i; break }
      }
    }
    const text = end === -1 ? null : source.slice(start, end + 1)
    calls.push({ text, line: source.slice(0, start).split('\n').length })
    from = start + needle.length
  }
  return calls
}

const matchesException = (ex, rel, text) => {
  if (ex.file && ex.file !== rel) return false
  if (ex.startsWith && !text.startsWith(ex.startsWith)) return false
  if (ex.contains && !text.includes(ex.contains)) return false
  return true
}

let scanned = null
const scan = () => {
  if (!scanned) scanned = doScan()
  return scanned
}

const doScan = async () => {
  const files = await walk(ROOT)
  const calls = []
  for (const { full, rel } of files) {
    const source = await fs.readFile(full, 'utf8')
    for (const call of extractCalls(source)) calls.push({ ...call, rel })
  }
  return calls
}

// fila 48: the scan reads every source file (fs bound): 0.55s alone, past the 5s default on a loaded machine (a full
// `pnpm test` beside lint and a family gate), so the suite gets its own budget; the assertions are untouched.
describe('window.open uses noopener,noreferrer', { timeout: 30_000 }, () => {
  it('extracts balanced calls across lines', () => {
    const [call] = extractCalls("x()\nwindow.open(\n  `a${f(1)}`,\n  '_blank'\n)\ny()")
    expect(call.text).toBe("window.open(\n  `a${f(1)}`,\n  '_blank'\n)")
    expect(call.line).toBe(2)
  })

  it(`protects every call outside the closed exception list (>= ${MIN_PROTECTED} protected)`, async () => {
    const calls = await scan()
    expect(calls.length).toBeGreaterThan(0)

    const unclosed = calls.filter((c) => c.text === null).map((c) => `${c.rel}:${c.line}`)
    expect(unclosed, 'window.open( calls whose closing parenthesis was not found').toEqual([])

    const protectedCalls = []
    const unprotected = []
    for (const call of calls) {
      if (call.text.includes(NOOPENER)) protectedCalls.push(call)
      else unprotected.push(call)
    }

    const offenders = unprotected
      .filter((c) => !EXCEPTIONS.some((ex) => matchesException(ex, c.rel, c.text)))
      .map((c) => `${c.rel}:${c.line}  ${c.text.replace(/\s+/g, ' ').slice(0, 120)}`)
    expect(offenders, 'window.open without noopener,noreferrer and not in the exception list').toEqual([])

    expect(protectedCalls.length).toBeGreaterThanOrEqual(MIN_PROTECTED)
  })

  it.each(EXCEPTIONS.map((ex) => [ex.id, ex]))('exception %s still exists and still lacks noopener', async (_id, ex) => {
    const calls = await scan()
    const hits = calls.filter((c) => c.text !== null && !c.text.includes(NOOPENER) && matchesException(ex, c.rel, c.text))
    expect(hits.length, `exception ${ex.id} no longer matches any unprotected window.open (stale list)`).toBeGreaterThan(0)
  })
})
