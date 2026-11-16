import { describe, expect, it } from 'vitest'

import { toAlertContent } from '../alertContent'

// redesign UC-B6 (M-13): the legacy Alert only paints strings or lists of strings, so whatever the API (or the SDK
// cast) leaves in `result` has to become that, or the generic message.
const fallback = 'We couldn\'t save the changes. Try again.'

describe('toAlertContent (UC-B6, M-13)', () => {
  it('a string is a one-line list', () => {
    expect(toAlertContent('Email already exists', fallback)).toEqual(['Email already exists'])
  })

  it('a list keeps its strings in order', () => {
    expect(toAlertContent(['First', 'Second'], fallback)).toEqual(['First', 'Second'])
  })

  it('flattens nested lists at any depth', () => {
    expect(toAlertContent(['First', ['Second', ['Third']]], fallback)).toEqual(['First', 'Second', 'Third'])
  })

  it('drops what is not text and what is blank, keeping the rest', () => {
    expect(toAlertContent(['Kept', 4, null, undefined, {}, { code: 1 }, '', '   ', ['Also kept', false]], fallback)).toEqual(['Kept', 'Also kept'])
  })

  it('an object with a text message is that message', () => {
    expect(toAlertContent({ message: 'Not allowed' }, fallback)).toEqual(['Not allowed'])
  })

  it.each([
    ['an empty string', ''],
    ['a blank string', '   '],
    ['an empty list', []],
    ['a list with nothing to paint', [1, null, {}, ['']]],
    ['an object with a message that is not text', { message: { deep: 'x' } }],
    ['an object with a blank message', { message: ' ' }],
    ['an object without a message', { id: 7, name: 'Ana' }],
    ['a class instance with no message (the SDK User cast)', new (class User { constructor () { this.id = 7 } })()],
    ['an Error', new Error('Failed to fetch')],
    ['a ProgressEvent', new window.ProgressEvent('error')],
    ['undefined', undefined],
    ['null', null],
    ['a number', 500],
    ['true', true]
  ])('%s gives the generic message', (_label, value) => {
    expect(toAlertContent(value, fallback)).toEqual([fallback])
  })

  it('always gives a list of non-empty strings', () => {
    const shapes = ['x', ['a', ['b']], { message: 'm' }, {}, undefined, new Error('e'), [[], [[]]]]
    shapes.forEach((shape) => {
      const content = toAlertContent(shape, fallback)
      expect(Array.isArray(content)).toBe(true)
      expect(content.length).toBeGreaterThan(0)
      content.forEach(line => {
        expect(typeof line).toBe('string')
        expect(line.trim()).not.toBe('')
      })
    })
  })
})
