import React, { useEffect, useMemo, useRef } from 'react'
import { Schedule } from '../../../components/Shared/Schedule'
import { schedulePayload } from '../../../../../utils/storeOnboarding'
import { ScheduleFrame } from './styles'
import { useStoreOnboardingLanguage } from '../../../../../utils/useStoreOnboardingLanguage'

export const HoursEditor = ({ form, disabled, onChange }) => {
  const [, t] = useStoreOnboardingLanguage()
  const frame = useRef(null)

  const schedule = useMemo(() => (form.schedule || schedulePayload(form.hours)).map(day => !day.enabled && !day.lapses.length
    ? { ...day, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 22, minute: 0 } }] }
    : day), [form.schedule, form.hours])
  useEffect(() => {
    const root = frame.current
    const visibility = new WeakMap()
    const closing = new WeakSet()
    const button = (element, label, blocked) => {
      if (!element) return
      for (const [key, value] of Object.entries({ role: 'button', 'aria-label': label, 'aria-disabled': String(Boolean(disabled || blocked)), tabindex: disabled || blocked ? '-1' : '0', 'data-onboarding-action': '' })) {
        if (element.getAttribute(key) !== value) element.setAttribute(key, value)
      }
    }
    const enhance = () => {
      root.querySelectorAll('.day-title').forEach(title => {
        const day = title.querySelector('h4')?.textContent || ''
        const checkbox = title.querySelector('input[type=checkbox]')
        checkbox?.setAttribute('aria-label', day)
        const row = title.parentElement
        const closed = !checkbox?.checked
        button(row.querySelector('svg.bi-plus-square'), `${t('ADD', 'Add')} ${t('SCHEDULE', 'Schedule')} ${day}`, closed)
        row.querySelectorAll('svg.bi-trash, svg.bi-plus-circle-fill, svg.bi-dash-circle-fill').forEach(svg => button(svg, `${t(svg.classList.contains('bi-trash') ? 'DELETE' : svg.classList.contains('bi-plus-circle-fill') ? 'ADD' : 'CANCEL', svg.classList.contains('bi-trash') ? 'Delete' : svg.classList.contains('bi-plus-circle-fill') ? 'Add' : 'Cancel')} ${t('SCHEDULE', 'Schedule')} ${day}`, closed || getComputedStyle(svg.parentElement).opacity === '0'))
        row.querySelectorAll('.select').forEach((select, i) => {
          const label = `${day}, ${i % 4 < 2 ? t('OPENING_TIME', 'Opening time') : t('CLOSING_TIME', 'Closing time')}, ${i % 2 ? t('MINUTE', 'Minute') : t('STORE_ONBOARDING_HOUR', 'Hour')}, ${Math.floor(i / 4) + 1}`
          button(select, label, closed)
          const list = select.parentElement.querySelector('.list')
          const hidden = !list || getComputedStyle(list).display === 'none'
          select.setAttribute('aria-expanded', String(!hidden))
          if (hidden && list) closing.delete(list)
          if (!hidden) {
            const pane = root.closest('[data-onboarding-content]')?.getBoundingClientRect() || { top: 0, bottom: window.innerHeight }
            const rect = select.getBoundingClientRect()
            if (rect.top < pane.top || rect.bottom > pane.bottom) {
              if (!closing.has(list)) { closing.add(list); select.dispatchEvent(new MouseEvent('click', { bubbles: true })) }
              return
            }
            const above = rect.top - pane.top
            const below = pane.bottom - rect.bottom
            const opensAbove = below < 300 && above > below
            const height = Math.max(44, Math.min(300, Math.floor((opensAbove ? above : below) - 8)))
            const width = Math.max(100, rect.width)
            list.setAttribute('data-onboarding-popover', '')
            list.style.setProperty('--onboarding-popover-top', `${opensAbove ? rect.top - height - 8 : rect.bottom + 8}px`)
            list.style.setProperty('--onboarding-popover-left', `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`)
            list.style.setProperty('--onboarding-popover-width', `${width}px`)
            list.style.setProperty('--onboarding-popover-height', `${height}px`)
          }
          if (!hidden) list?.querySelectorAll('.option').forEach(option => button(option, option.textContent, closed || option.classList.contains('disabled')))
          else list?.querySelectorAll('[data-onboarding-action]').forEach(option => { option.removeAttribute('role'); option.removeAttribute('data-onboarding-action'); option.setAttribute('tabindex', '-1') })
        })
        row.querySelectorAll('.days > div > div').forEach(wrapper => {
          if (wrapper.querySelector('svg.bi-trash')) wrapper.setAttribute('data-onboarding-hidden', String(getComputedStyle(wrapper).opacity === '0'))
        })
        const copy = row.querySelector('.icons > div > div:first-child')
        button(copy, `${day}, ${t('COPY_TIMES_TO', 'Copy times to')}`, closed)
        copy?.nextElementSibling?.querySelectorAll('svg').forEach(svg => {
          button(svg.parentElement, `${t('COPY_TIMES_TO', 'Copy times to')} ${svg.parentElement.textContent}`, svg.parentElement.hasAttribute('disabled'))
          svg.parentElement.setAttribute('aria-pressed', String(svg.id.includes('fill')))
        })
      })
    }
    const keydown = event => {
      const target = event.target.closest?.('[data-onboarding-action]')
      if (!target || !root.contains(target)) return
      if (disabled || target.getAttribute('aria-disabled') === 'true') { event.preventDefault(); event.stopPropagation(); return }
      if (['Enter', ' '].includes(event.key)) {
        event.preventDefault()
        target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        if (target.classList.contains('select')) {
          queueMicrotask(() => {
            const list = target.parentElement.querySelector('.list')
            if (root.contains(target) && list && getComputedStyle(list).display !== 'none') list.querySelector('.option:not(.disabled)')?.focus()
          })
        }
        if (target.classList.contains('option')) {
          queueMicrotask(() => {
            if (root.contains(target)) target.closest('.select-wrapper')?.querySelector('.select')?.focus()
          })
        }
      }
      if (target.classList.contains('option') && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        const options = [...target.closest('.list').querySelectorAll('.option:not(.disabled)')]
        options[(options.indexOf(target) + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length]?.focus()
      }
    }
    const clickDay = event => {
      if (disabled || event.target.tagName === 'INPUT') return
      const title = event.target.closest?.('.day-title')
      if (title && root.contains(title)) title.querySelector('input[type=checkbox]')?.click()
    }
    enhance()
    const observer = new MutationObserver(records => {
      const changed = records.some(record => {
        if (record.type === 'childList') return true
        if (!record.target.classList.contains('list')) return false
        const display = record.target.style.display
        if (visibility.get(record.target) === display) return false
        visibility.set(record.target, display)
        return true
      })
      if (changed) enhance()
    })
    root.querySelectorAll('.list').forEach(list => visibility.set(list, list.style.display))
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] })
    root.addEventListener('keydown', keydown)
    root.addEventListener('click', clickDay)
    window.addEventListener('resize', enhance)
    const pane = root.closest('[data-onboarding-content]')
    pane?.addEventListener('scroll', enhance)
    return () => { observer.disconnect(); root.removeEventListener('keydown', keydown); root.removeEventListener('click', clickDay); window.removeEventListener('resize', enhance); pane?.removeEventListener('scroll', enhance) }
  }, [disabled, t])
  return <ScheduleFrame ref={frame} disabled={disabled} aria-disabled={disabled} inert={disabled ? '' : undefined}><Schedule scheduleList={schedule} handleChangeScheduleState={onChange} disableSchedule={disabled} /></ScheduleFrame>
}
