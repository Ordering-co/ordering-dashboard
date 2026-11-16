// fila 47: the touch probe counts a touch on a frame for the control the frame focuses (focusFrameControl).
// Its frame list is static (the probe runs inside the page, without imports), so this test fails when a call site of
// focusFrameControl appears, moves, changes its frame or its control selector, or a frame class is used without the handler.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { touchProbeSource } from '../../../scripts/redesign/tools/touch-probe.mjs'

const root = resolve('src/@/components-dashboard/src')
const FOCUSABLE = 'input:not([type="hidden"]), select, textarea' // Field.jsx's default for focusFrameControl

// file (relative to components-dashboard/src) → [frame selector in the probe, control the call focuses] of each call, in order
const FRAMES = {
  'ui/src/components/Shared/Product/Field.jsx': [['.odc-field-control', FOCUSABLE], ['.odc-field-box', FOCUSABLE], ['.odc-field-box', FOCUSABLE]],
  'ui/src/components/Shared/Product/SecretField.jsx': [['.odc-field-box', FOCUSABLE]],
  'ui/src/components/Shared/Product/DatePicker.jsx': [['.odc-dp-input-frame', FOCUSABLE]],
  'ui/src/components/Shared/Product/TimeField.jsx': [['.odc-time-field-part', 'select']],
  'ui/src/components/Shared/Product/ScheduleEditor.jsx': [['.odc-sched-time', 'select']],
  'ui/src/components/Shared/Product/PhoneField.jsx': [['.odc-phone-field-control .PhoneInput', 'input.PhoneInputInput']],
  'ui/src/components/Delivery/DriversTimeCalendar/TimeSelect.jsx': [['.odc-time-field-part', 'select']],
  'ui/src/components/Marketing/CampaignDirectory/CampaignDelivery.jsx': [['.odc-campaign-time', 'select']],
  'ui/src/components/Connect/Importers/ImporterLogs.jsx': [['.isp-select-part', 'select']]
}

// Uses of a frame class without focusFrameControl. Their control is a FirstSelect trigger (div[role=button]), which the
// probe's control selector of that frame (inputs, selects, textareas) never names, so a touch on them is never credited.
const WITHOUT_HANDLER = {
  'ui/src/components/Users/UserFormDetails/index.js': 'odc-field-control',
  'ui/src/components/Delivery/DriversCompaniesDirectory/TimezoneSelect.jsx': 'odc-field-control'
}

const FRAME_CLASSES = ['odc-field-control', 'odc-field-box', 'odc-dp-input-frame', 'odc-time-field-part', 'odc-sched-time', 'odc-campaign-time', 'isp-select-part', 'odc-phone-field-control']

const sources = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name)
  if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : sources(path)
  return /\.jsx?$/.test(entry.name) ? [path] : []
})
const files = sources(root).map(path => [relative(root, path), readFileSync(path, 'utf8')])
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The third argument of each call: a string literal, a constant of the file, or none (Field's FOCUSABLE)
const controlsCalled = text => [...text.matchAll(/focusFrameControl\(([^)]*)\)/g)].map(([, args]) => {
  const third = args.split(',').map(arg => arg.trim())[2]
  if (!third) return FOCUSABLE
  if (/^'.*'$/.test(third)) return third.slice(1, -1)
  return text.match(new RegExp(`const ${third} = '([^']+)'`))?.[1] ?? third
})

describe('touch probe frames (fila 47)', () => {
  it('every call site of focusFrameControl is listed, with the control each call focuses', () => {
    const found = Object.fromEntries(files.map(([file, text]) => [file, controlsCalled(text)]).filter(([, calls]) => calls.length))
    expect(found).toEqual(Object.fromEntries(Object.entries(FRAMES).map(([file, frames]) => [file, frames.map(([, control]) => control)])))
  })

  it.each(Object.entries(FRAMES))('%s has those frames, and the probe pairs each with the same control', (file, frames) => {
    const text = files.find(([name]) => name === file)[1]
    for (const [frame, control] of frames) {
      const own = frame.split(' ')[0].slice(1)
      expect(text, `${file}: ${own}`).toMatch(new RegExp(`['\\s.]${own}['\\s]`))
      // the probe's pair: a frame list that names this frame, then this control
      expect(touchProbeSource, frame).toMatch(new RegExp(`\\['[^']*${escape(frame)}[^']*', '${escape(control)}'\\]`))
    }
  })

  it('a frame class appears only where focusFrameControl runs, or in the explained list without a handler', () => {
    const users = files.filter(([, text]) => FRAME_CLASSES.some(name => new RegExp(`className=['{][^'}]*\\b${name}\\b`).test(text))).map(([file]) => file)
    expect(users.filter(file => !FRAMES[file] && !WITHOUT_HANDLER[file])).toEqual([])
    for (const [file, name] of Object.entries(WITHOUT_HANDLER)) expect(users, `${file}: ${name}`).toContain(file)
  })
})
