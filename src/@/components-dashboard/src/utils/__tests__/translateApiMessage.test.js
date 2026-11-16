import { describe, expect, it } from 'vitest'

import { API_MESSAGE_DEFAULTS, getApiMessageDefault, translateApiMessage } from '../translateApiMessage'
import { stringToSlug } from '../../ui/src/utils/stringToSlug'

// redesign W0-2d (T0-7): a `t` like the app's (LanguageContext): the dictionary entry, else the default text, else the key.
const dictionary = {
  INTERNAL_ERROR: 'Error interno',
  ORDER_NOT_FOUND: 'Pedido no encontrado',
  ERROR_REPORT_VERY_LONG_PERIOD: 'Periodo demasiado largo'
}
const t = (key, fallback = null) => dictionary[key] ?? fallback ?? key

describe('translateApiMessage', () => {
  it('translates a message whose slug is a known key', () => {
    expect(translateApiMessage(t, 'Internal error', 'nothing')).toBe('Error interno')
    expect(translateApiMessage(t, 'Order not found', 'nothing')).toBe('Pedido no encontrado')
  })

  it('slugs the message the way the legacy Alert did (case, punctuation, trim)', () => {
    expect(translateApiMessage(t, '  INTERNAL_ERROR  ', 'nothing')).toBe('Error interno')
    expect(translateApiMessage(t, 'Order not found.', 'nothing')).toBe('Pedido no encontrado')
  })

  it('returns the message itself when its slug is not in the dictionary', () => {
    expect(translateApiMessage(t, 'The card was declined', 'nothing')).toBe('The card was declined')
  })

  it('says the fallback when there is no message', () => {
    expect(translateApiMessage(t, '', 'nothing')).toBe('nothing')
  })

  it('says the fallback when the message is blank', () => {
    expect(translateApiMessage(t, '   \n ', 'nothing')).toBe('nothing')
  })

  it.each([[undefined], [null], [42], [{ message: 'Internal error' }], [['Internal error']], [true]])(
    'says the fallback when the message is not a string (%j)',
    (message) => {
      expect(translateApiMessage(t, message, 'nothing')).toBe('nothing')
    }
  )

  it('passes the fallback through as it comes (not a string either)', () => {
    const fallback = { kept: true }
    expect(translateApiMessage(t, null, fallback)).toBe(fallback)
    expect(translateApiMessage(t, null)).toBeUndefined()
  })

  it('uses the defaultText as the text of t when the key is unknown', () => {
    expect(translateApiMessage(t, 'Unknown thing', 'nothing', 'Texto por defecto')).toBe('Texto por defecto')
  })

  it('prefers the dictionary over the defaultText', () => {
    expect(translateApiMessage(t, 'Internal error', 'nothing', 'Texto por defecto')).toBe('Error interno')
  })

  it('defaults the defaultText to the message itself', () => {
    expect(translateApiMessage(t, 'Unknown thing', 'nothing', undefined)).toBe('Unknown thing')
  })

  it('does not use the defaultText for a message without text', () => {
    expect(translateApiMessage(t, ' ', 'nothing', 'Texto por defecto')).toBe('nothing')
  })
})

// redesign W0-2d (T0-7): the old copy of each site, as it was, against the call the site makes now, over the same
// inputs, edges included. The `t` records what it is asked, so the key and the default text are compared too.
const recordingT = () => {
  const calls = []
  const fn = (key, fallback = null) => {
    calls.push([key, fallback])
    return dictionary[key] ?? fallback ?? key
  }
  return { fn, calls }
}

const strings = [
  'Internal error',
  'INTERNAL_ERROR',
  '  Order not found  ',
  'Order not found.',
  'The card was declined',
  'ERROR_REPORT_MAX_A_DAY_AS_PERIOD',
  'Error report, very long period',
  'ERROR_REPORT_VERY_LONG_PERIOD',
  'Éxito: pedido ñandú / listo',
  '???',
  '123',
  'a'.repeat(300)
]
const blanks = ['', ' ', '   \n\t ', '\u00a0']
const notStrings = [undefined, null, 0, 42, false, true, {}, { message: 'Internal error' }, ['Internal error'], [], () => 'x']

const sameOutput = (oldFn, newFn, inputs) => {
  for (const input of inputs) {
    const a = recordingT()
    const b = recordingT()
    const expected = oldFn(a.fn, input)
    expect(newFn(b.fn, input), `output for ${JSON.stringify(input)}`).toBe(expected)
  }
}
const sameAsk = (oldFn, newFn, inputs) => {
  for (const input of inputs) {
    const a = recordingT()
    const b = recordingT()
    oldFn(a.fn, input)
    newFn(b.fn, input)
    expect(b.calls, `what t was asked for ${JSON.stringify(input)}`).toEqual(a.calls)
  }
}

describe.each([
  ['AlertDialog.jsx:36 (translateMessage)', 'getMessages'],
  ['OrdersExportCSV/index.js:156 (translateMessage)', 'getErrorMessages']
])('equivalence · %s', (_site, filter) => {
  // The old copy, literal (as it was before W0-2d).
  const oldTranslateMessage = (t, message) => t(stringToSlug(message).toUpperCase(), message)
  // The call the site makes now.
  const newTranslateMessage = (t, message) => translateApiMessage(t, message, message)
  // `filter` hands the site only truthy strings, blank ones included.
  const inputs = [...strings, ...blanks.filter(Boolean)]

  it(`says the same for every message ${filter} can hand it`, () => {
    sameOutput(oldTranslateMessage, newTranslateMessage, inputs)
  })

  it('asks t the same key and default text for every message with text', () => {
    sameAsk(oldTranslateMessage, newTranslateMessage, strings)
  })
})

describe('equivalence · Confirm (translateAlertMessage, both copies)', () => {
  const errors = {
    ERROR_REPORT_MAX_A_DAY_AS_PERIOD: 'Error report, max a day as period',
    ERROR_REPORT_VERY_LONG_PERIOD: 'Error report, very long period'
  }
  // The old copy, literal (Confirm.jsx:64-68 and :214-218 before W0-2d).
  const oldTranslateAlertMessage = (t, message) => {
    if (typeof message !== 'string') return message
    const key = stringToSlug(message).toUpperCase()
    return t(key, errors[message] || message)
  }
  // The call Confirm.jsx makes now.
  const newTranslateAlertMessage = (t, message) => {
    if (typeof message !== 'string') return message
    return translateApiMessage(t, message, message, errors[message] || message)
  }
  const inputs = [...strings, ...blanks, ...notStrings]

  it('says the same for strings, blank strings and what is not a string', () => {
    sameOutput(oldTranslateAlertMessage, newTranslateAlertMessage, inputs)
  })

  it('gives back what is not a string as it came (same reference)', () => {
    for (const input of notStrings) {
      const { fn } = recordingT()
      expect(newTranslateAlertMessage(fn, input)).toBe(input)
    }
  })

  it('asks t the same key and default text for every string with text', () => {
    sameAsk(oldTranslateAlertMessage, newTranslateAlertMessage, strings)
  })

  it('keeps the table as the default text for the two report messages', () => {
    const { fn } = recordingT()
    expect(newTranslateAlertMessage(fn, 'ERROR_REPORT_MAX_A_DAY_AS_PERIOD')).toBe('Error report, max a day as period')
    expect(newTranslateAlertMessage(fn, 'ERROR_REPORT_VERY_LONG_PERIOD')).toBe('Periodo demasiado largo')
  })
})

// redesign W0-2 r2 (W0-P1-05): the table Confirm kept as `errors`, now one export the three sites read.
describe('API_MESSAGE_DEFAULTS · getApiMessageDefault', () => {
  it('is the table Confirm had, word for word', () => {
    expect({ ...API_MESSAGE_DEFAULTS }).toEqual({
      ERROR_REPORT_MAX_A_DAY_AS_PERIOD: 'Error report, max a day as period',
      ERROR_REPORT_VERY_LONG_PERIOD: 'Error report, very long period'
    })
    expect(Object.isFrozen(API_MESSAGE_DEFAULTS)).toBe(true)
  })

  it('gives the text of the table for its keys and the message itself for anything else', () => {
    expect(getApiMessageDefault('ERROR_REPORT_VERY_LONG_PERIOD')).toBe('Error report, very long period')
    expect(getApiMessageDefault('The card was declined')).toBe('The card was declined')
    expect(getApiMessageDefault('error_report_very_long_period')).toBe('error_report_very_long_period')
  })

  it('does not read the prototype (a message called constructor is just a message)', () => {
    for (const message of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(getApiMessageDefault(message)).toBe(message)
    }
  })

  it('gives back what is not a string as it came', () => {
    const object = { message: 'x' }
    expect(getApiMessageDefault(object)).toBe(object)
    expect(getApiMessageDefault(42)).toBe(42)
    expect(getApiMessageDefault(undefined)).toBeUndefined()
  })

  it('with the table as defaultText, a key the dictionary lacks shows the text, one it has shows its translation', () => {
    const empty = (key, fallback = null) => fallback ?? key
    const key = 'ERROR_REPORT_MAX_A_DAY_AS_PERIOD'
    expect(translateApiMessage(empty, key, key, getApiMessageDefault(key))).toBe('Error report, max a day as period')
    const key2 = 'ERROR_REPORT_VERY_LONG_PERIOD'
    expect(translateApiMessage(t, key2, key2, getApiMessageDefault(key2))).toBe('Periodo demasiado largo')
  })
})

// redesign W0-2 r2 (W0-P1-04): `getErrorMessages` (OrdersExportCSV) takes `item?.message` of whatever the controller
// kept in `actionStatus.error`, so the helper can be handed an object without `.message`, a number or a list.
// It never throws and says the fallback; with the table as defaultText nothing changes for them either.
describe('translateApiMessage · what getErrorMessages can give that is not a string (W0-P1-04)', () => {
  const odd = [{}, { code: 500 }, { message: { deep: 'x' } }, { message: 42 }, 0, 42, -1, NaN, Infinity, [], [1, 2], Symbol.for('x'), () => 'x', new Date(0), 10n]

  it.each(odd.map(value => [typeof value === 'symbol' || typeof value === 'bigint' ? String(value) : JSON.stringify(value) ?? String(value), value]))(
    'does not throw and says the fallback for %s',
    (_label, value) => {
      const asked = []
      const spy = (key, fallback) => { asked.push(key); return fallback }
      expect(() => translateApiMessage(spy, value, 'nothing', getApiMessageDefault(value))).not.toThrow()
      expect(translateApiMessage(spy, value, 'nothing', getApiMessageDefault(value))).toBe('nothing')
      expect(asked).toEqual([])
    }
  )

  it('hands the fallback back as it is, so a caller that passes the message itself gets it untouched (not made up)', () => {
    const message = { message: 42 }
    expect(translateApiMessage(t, message, message)).toBe(message)
  })
})
