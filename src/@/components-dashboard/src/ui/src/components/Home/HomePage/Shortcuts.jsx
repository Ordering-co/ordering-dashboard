import React, { useId, useMemo } from 'react'

import { useLanguage } from '../../../../../index'
import { getDashboardNavSections, getDashboardRoleFlags } from '../../../../../utils/dashboardNavigation'
import { buildOpenActionEntries, canOpenNavDestination } from '../../../../../utils/commandPaletteActions'
import { buildCreateActionEntries } from '../../../../../utils/commandPaletteCreateActions'
import './blocks.css'

// redesign home C2 (D10, auditor 12): at most four, in this order, each one only if the user has it
const OPEN_CARTS_PATH = '/cart-recovery/open-carts'

// redesign home C2 (D4): a plain click navigates inside the dashboard, a modified or middle click stays the browser's
const isPlainClick = (event) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

/**
 * Shortcuts (redesign home C2, D10): title and route come from the ⌘K entries, so the permissions are the palette's
 * and the menu's; this block adds no rule of its own.
 */
export const Shortcuts = ({ user, configs, project, sites = [], onNavigate }) => {
  const [, t] = useLanguage()
  const headingId = useId()

  const shortcuts = useMemo(() => {
    const sections = getDashboardNavSections({ t, user, configs, sites }) // (main): sites, no longer the project
    const { level } = getDashboardRoleFlags(user)
    const can = (url) => canOpenNavDestination({ sections, url, level })
    const create = buildCreateActionEntries({ t, can, user, configs })
    const open = buildOpenActionEntries({ t, user, configs, sites, project })
    const pick = (entries, id) => entries.find(entry => entry.id === id)
    const list = [
      pick(create, 'create:custom_order'),
      pick(open, 'action:stores-add'),
      pick(create, 'create:promotion'),
      can(OPEN_CARTS_PATH) ? { id: 'open-carts', title: t('OPEN_CARTS', 'Open carts'), path: OPEN_CARTS_PATH } : null
    ]
    return list.filter(Boolean).map(({ id, title, path }) => ({ id, title, path }))
  }, [t, user, configs, project, sites])

  if (!shortcuts.length) return null

  return (
    <section className='odc-home-block odc-shortcuts' data-slot='home-shortcuts' aria-labelledby={headingId}>
      <h2 className='odc-home-block-title' id={headingId}>{t('HOME_SHORTCUTS', 'Shortcuts')}</h2>
      <div className='odc-shortcuts-row'>
        {shortcuts.map(({ id, title, path }) => (
          <a
            key={id}
            className='odc-btn'
            href={path}
            data-variant='secondary'
            data-size='md'
            onClick={(event) => {
              if (event.defaultPrevented || !isPlainClick(event) || !onNavigate) return
              event.preventDefault()
              onNavigate(path)
            }}
          >
            {title}
          </a>
        ))}
      </div>
    </section>
  )
}
