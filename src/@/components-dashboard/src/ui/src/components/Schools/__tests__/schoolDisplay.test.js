// redesign SC-B1 (M-SC05): the visible words of the school catalog values. The dynamic keys are literal `t()` calls in maps.
import { describe, expect, it } from 'vitest'

import { SCHOOL_ALLERGENS, SCHOOL_DIETARY_TAGS, SCHOOL_GRADE_CODES } from '../../../../../constants/school'
import {
  allergenLabel,
  dietaryLabel,
  gradeCodeLabel,
  gradeCodeOptions,
  labelTemplateName,
  personName
} from '../schoolDisplay'

// `t` of a project with no translations: the default text
const plain = (_key, text) => text
// `t` that shows which key was asked for
const keyed = (key) => `[${key}]`

describe('allergenLabel', () => {
  it.each(SCHOOL_ALLERGENS.map(({ value, name }) => [value, name]))('%s is «%s», never the raw value', (value, name) => {
    expect(allergenLabel(plain, value)).toBe(name)
    expect(allergenLabel(plain, value)).not.toBe(value)
  })

  it('asks for SCHOOL_ALLERGEN_<VALUE> for each of the ten', () => {
    expect(SCHOOL_ALLERGENS).toHaveLength(10)
    SCHOOL_ALLERGENS.forEach(({ value }) => {
      expect(allergenLabel(keyed, value)).toBe(`[SCHOOL_ALLERGEN_${value.toUpperCase()}]`)
    })
  })

  it('takes the translation of the catalog over the default', () => {
    expect(allergenLabel((key, text) => (key === 'SCHOOL_ALLERGEN_DAIRY' ? 'Lácteos' : text), 'dairy')).toBe('Lácteos')
  })

  it('an unknown value is shown as it is, never undefined or empty', () => {
    expect(allergenLabel(plain, 'lupin')).toBe('lupin')
    expect(allergenLabel(plain, 'constructor')).toBe('constructor')
    expect(allergenLabel(plain, 'toString')).toBe('toString')
  })

  it.each([[null], [undefined], ['']])('%j is an empty text', (value) => {
    expect(allergenLabel(plain, value)).toBe('')
  })
})

describe('dietaryLabel', () => {
  it.each(SCHOOL_DIETARY_TAGS.map(({ value, name }) => [value, name]))('%s is «%s», never the raw value', (value, name) => {
    expect(dietaryLabel(plain, value)).toBe(name)
    expect(dietaryLabel(plain, value)).not.toBe(value)
  })

  it('asks for SCHOOL_DIETARY_<VALUE> for each of the eight', () => {
    expect(SCHOOL_DIETARY_TAGS).toHaveLength(8)
    SCHOOL_DIETARY_TAGS.forEach(({ value }) => {
      expect(dietaryLabel(keyed, value)).toBe(`[SCHOOL_DIETARY_${value.toUpperCase()}]`)
    })
  })

  it('an unknown value is shown as it is; nothing is an empty text', () => {
    expect(dietaryLabel(plain, 'pescatarian')).toBe('pescatarian')
    expect(dietaryLabel(plain, 'hasOwnProperty')).toBe('hasOwnProperty')
    expect(dietaryLabel(plain, null)).toBe('')
    expect(dietaryLabel(plain, '')).toBe('')
  })
})

describe('gradeCodeLabel and gradeCodeOptions', () => {
  it.each(SCHOOL_GRADE_CODES.map(({ value, name }) => [value, name]))('%s is «%s»', (value, name) => {
    expect(gradeCodeLabel(plain, value)).toBe(name)
  })

  it('asks for the keys main built: SCHOOL_GRADE_PRE_K, SCHOOL_GRADE_K, SCHOOL_GRADE_G1 … G12', () => {
    expect(SCHOOL_GRADE_CODES).toHaveLength(14)
    SCHOOL_GRADE_CODES.forEach(({ value }) => {
      expect(gradeCodeLabel(keyed, value)).toBe(`[SCHOOL_GRADE_${value.toUpperCase()}]`)
    })
  })

  it('an unknown code is shown as it is; nothing is an empty text', () => {
    expect(gradeCodeLabel(plain, 'g13')).toBe('g13')
    expect(gradeCodeLabel(plain, null)).toBe('')
  })

  it('the options follow the order of the catalog', () => {
    const options = gradeCodeOptions(plain)
    expect(options).toHaveLength(14)
    expect(options.map(option => option.value)).toEqual(SCHOOL_GRADE_CODES.map(grade => grade.value))
    expect(options[0]).toEqual({ value: 'pre_k', content: 'Pre-K' })
    expect(options[1]).toEqual({ value: 'k', content: 'Kindergarten' })
    expect(options[13]).toEqual({ value: 'g12', content: 'Grade 12' })
  })
})

describe('personName', () => {
  it('joins name and last name', () => {
    expect(personName({ name: 'Ana', lastname: 'Pérez' })).toBe('Ana Pérez')
  })

  it('a missing part leaves no stray space', () => {
    expect(personName({ name: 'Ana' })).toBe('Ana')
    expect(personName({ name: null, lastname: 'Pérez' })).toBe('Pérez')
  })

  it('no person is an empty text', () => {
    expect(personName(null)).toBe('')
    expect(personName(undefined)).toBe('')
    expect(personName({})).toBe('')
  })
})

describe('labelTemplateName', () => {
  it('writes the template of the labels as main did', () => {
    expect(labelTemplateName('avery_5160')).toBe('Avery 5160')
    expect(labelTemplateName('avery_5163')).toBe('Avery 5163')
  })

  it('nothing is an empty text', () => {
    expect(labelTemplateName(null)).toBe('')
    expect(labelTemplateName(undefined)).toBe('')
  })
})
