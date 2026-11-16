import React, { useState } from 'react'
import { useLanguage, useSession } from '../../../../../index'

import { Menu } from '../Product/Menu'
import { BookOpen as Book, ExternalLink } from '../Icon'
import { LearnDropDownContainer } from './learn-drop-down-styles'

const HELP_CENTER_URL = 'https://docs.ordering.co/'

// The menu draws its item icon as a component: the book for the trigger, the external-link mark for
// every item (each one opens a help article in a new tab, like the sidebar's external links).
const LearnIcon = (props) => <Book {...props} />
// (its mirroring in right-to-left is in learn-drop-down.css)
const NewTabIcon = (props) => <ExternalLink {...props} />

/**
 * The items of the Learn menu (`{ value, name, url }` options → Menu items), for the menu that holds
 * them: LearnDropDown's own, and the page's «More actions» menu on phones. Empty unless the session is
 * level zero and there are options. The labels are fixed at mount and the URL is looked up in the
 * current options when one is chosen.
 */
export const useLearnMenuItems = (learnOptions) => {
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [labels] = useState(() => learnOptions?.map(({ value, name }) => ({ value, name })) ?? [])

  const openArticle = (value) => {
    const url = learnOptions.find((option) => (option.value === value))?.url
    window.open(url ?? HELP_CENTER_URL, '_blank', 'noopener,noreferrer')
  }

  if (user?.level !== 0 || !Array.isArray(learnOptions) || learnOptions.length === 0) return []

  return labels.map(({ value, name }) => ({
    key: value,
    label: name,
    icon: NewTabIcon,
    description: t('OPENS_IN_NEW_TAB', 'opens in a new tab'),
    onSelect: () => openArticle(value)
  }))
}

/**
 * Help articles of the page (level-zero sessions only). A menu of links on the Product Menu:
 * `menu` / `menuitem`, arrows, Home and End, Escape back to the trigger. Every consumer passes
 * only `learnOptions` (`{ value, name, url }`); the labels are fixed at mount and the URL is
 * looked up in the current options when one is chosen.
 */
export const LearnDropDown = (props) => {
  const { learnOptions } = props
  const [, t] = useLanguage()
  const items = useLearnMenuItems(learnOptions)

  if (items.length === 0) return null

  const label = t('LEARN', 'Learn')
  return (
    <LearnDropDownContainer>
      <Menu
        label={<span className='od-learn-label'>{label}</span>}
        triggerVariant='ghost'
        align='start'
        className='learn-drop-down'
        triggerProps={{ icon: LearnIcon, title: label }}
        data-learn-menu=''
        items={items}
      />
    </LearnDropDownContainer>
  )
}

LearnDropDown.displayName = 'OrderingLearnDropDown'
