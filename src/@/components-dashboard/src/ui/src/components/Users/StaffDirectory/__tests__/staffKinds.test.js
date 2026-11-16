// redesign BO-B3 (decisions 1 and 10): the pure part of Users/StaffDirectory: which sections a record shows (by the level OF THE
// RECORD), what main's `?tab=` means, which section to fall back to, and how a kind's text is said.
import { describe, expect, it } from 'vitest'

import { STAFF_KINDS, STAFF_SECTION_IDS, fromStaffTab, say, sectionOrDefault, seedStaffKindsI18n, staffSectionIds, staffStoresKey } from '../staffKinds'

describe('staffSectionIds', () => {
  it('level 2 (business owner): Profile, Saved places, Businesses, Orders; Schools changes nothing', () => {
    const expected = ['profile', 'saved_places', 'businesses', 'orders']
    expect(staffSectionIds({ level: 2 })).toEqual(expected)
    expect(staffSectionIds({ level: 2, isSchoolsOn: true })).toEqual(expected)
  })

  it('level 9 (call center agent) without Schools: no School students, Businesses after Orders, Push tokens', () => {
    expect(staffSectionIds({ level: 9 })).toEqual(['profile', 'saved_places', 'orders', 'businesses', 'push_tokens'])
    expect(staffSectionIds({ level: 9, isSchoolsOn: false })).toEqual(['profile', 'saved_places', 'orders', 'businesses', 'push_tokens'])
  })

  it('level 9 with Schools adds School students at the end', () => {
    expect(staffSectionIds({ level: 9, isSchoolsOn: true })).toEqual(['profile', 'saved_places', 'orders', 'businesses', 'push_tokens', 'school_students'])
  })

  it('level 3 (customer): four sections with Push tokens (five with Schools), no Businesses', () => {
    expect(staffSectionIds({ level: 3 })).toEqual(['profile', 'saved_places', 'orders', 'push_tokens'])
    expect(staffSectionIds({ level: 3, isSchoolsOn: true })).toEqual(['profile', 'saved_places', 'orders', 'push_tokens', 'school_students'])
  })

  it('no argument is a level that is not 2: the user list without Businesses', () => {
    expect(staffSectionIds()).toEqual(['profile', 'saved_places', 'orders', 'push_tokens'])
  })

  it('every id it returns is a known section id', () => {
    ;[2, 3, 9].forEach(level => staffSectionIds({ level, isSchoolsOn: true }).forEach(id => expect(STAFF_SECTION_IDS).toContain(id)))
  })
})

describe('fromStaffTab · main\'s ?tab=', () => {
  it.each(STAFF_SECTION_IDS)('%s is itself and opens no dialog', (id) => {
    expect(fromStaffTab(id)).toEqual({ section: id, customFields: false })
  })

  it('metafields is Profile with the Custom fields open', () => {
    expect(fromStaffTab('metafields')).toEqual({ section: 'profile', customFields: true })
  })

  it('personalization (a disabled entry in main), unknown and missing tabs are Profile', () => {
    expect(fromStaffTab('personalization')).toEqual({ section: 'profile', customFields: false })
    expect(fromStaffTab('nonsense')).toEqual({ section: 'profile', customFields: false })
    expect(fromStaffTab(undefined)).toEqual({ section: 'profile', customFields: false })
    expect(fromStaffTab(null)).toEqual({ section: 'profile', customFields: false })
  })
})

describe('sectionOrDefault', () => {
  it('keeps a section the record has and falls back to Profile for one it has not', () => {
    const owner = staffSectionIds({ level: 2 })
    expect(sectionOrDefault('businesses', owner)).toBe('businesses')
    expect(sectionOrDefault('push_tokens', owner)).toBe('profile')
    expect(sectionOrDefault('nonsense', owner)).toBe('profile')
    expect(sectionOrDefault(undefined, owner)).toBe('profile')
  })
})

describe('say', () => {
  const t = (_key, text) => text
  const kind = STAFF_KINDS.business_owner

  it('says the text as it is with no count', () => {
    expect(say(t, kind.text.add)).toBe('Add business owner')
  })

  it('fills _count_, with zero too', () => {
    expect(say(t, kind.text.countOther, 12)).toBe('12 business owners')
    expect(say(t, kind.text.countOther, 0)).toBe('0 business owners')
  })

  it('a count on a text without _count_ leaves it alone', () => {
    expect(say(t, kind.text.countOne, 1)).toBe('1 business owner')
  })

  it('uses the translation when there is one', () => {
    expect(say((key) => `[${key}]`, kind.text.title)).toBe('[BUSINESS_OWNERS]')
    expect(say(() => 'Hay _count_', kind.text.countOther, 3)).toBe('Hay 3')
  })

  it('a count with a $ pattern is not read as a replacement pattern', () => {
    expect(say(() => 'x _count_ y', kind.text.countOther, '$&')).toBe('x $& y')
  })

  it('call center agents: «3 call center agents» and the singular', () => {
    const agents = STAFF_KINDS.callcenter_agent
    expect(say(t, agents.text.countOther, 3)).toBe('3 call center agents')
    expect(say(t, agents.text.countOne)).toBe('1 call center agent')
    expect(say(t, agents.text.add)).toBe('Add call center agent')
  })
})

// redesign CA-B1: the call center agent kind, level 9
describe('STAFF_KINDS.callcenter_agent', () => {
  const agents = STAFF_KINDS.callcenter_agent
  const owners = STAFF_KINDS.business_owner

  it('is level 9, keeps its stores in businesses_agent and asks no admin confirmation to switch (main: only level 0 rows)', () => {
    expect(agents.level).toBe(9)
    expect(agents.storesKey).toBe('businesses_agent')
    expect(agents.confirmAdminOnToggle).toBe(false)
  })

  it('has no Learn entries (main passes none to this page), its own panel storage key and the owners\' sheet fields', () => {
    expect(agents.learn).toEqual([])
    expect(agents.storageKey).toBe('od.callcenter-agents.panel')
    expect(agents.storageKey).not.toBe(owners.storageKey)
    expect(agents.sheetKeys).toEqual(owners.sheetKeys)
  })

  it('its own keys start with CALL_CENTER_AGENTS_; only the menu\'s two and the shared export ones are not', () => {
    const shared = ['CALL_CENTER_AGENTS', 'CALL_CENTER_AGENT']
    ;[agents.text, agents.exportCopy].forEach((group) => {
      Object.values(group).forEach(({ key }) => {
        if (shared.includes(key) || key.startsWith('CUSTOMERS_EXPORT_')) return
        expect(key, key).toMatch(/^CALL_CENTER_AGENTS_/)
      })
    })
    expect(agents.text.title).toEqual({ key: 'CALL_CENTER_AGENTS', text: 'Call center agents' })
    expect(agents.text.one).toEqual({ key: 'CALL_CENTER_AGENT', text: 'Call center agent' })
  })

  it('counts the orders column as «Own orders», zero as a number; owners bring neither', () => {
    expect(agents.text.ordersColumn).toEqual({ key: 'CALL_CENTER_AGENTS_OWN_ORDERS', text: 'Own orders' })
    expect(agents.ordersZeroAsNumber).toBe(true)
    expect(owners.text).not.toHaveProperty('ordersColumn')
    expect(owners).not.toHaveProperty('ordersZeroAsNumber')
  })

  it('exports every call center agent, with the same sentence whatever the filters, and the customers\' result words', () => {
    const copy = agents.exportCopy
    expect(copy.button.text).toBe('Export CSV')
    expect(copy.confirm.text).toBe('Export CSV')
    expect(copy.title.text).toBe('Export call center agents to CSV?')
    expect(copy.scopeAll).toEqual(copy.scopeFiltered)
    expect(copy.scopeAll.text).toBe("The file includes all call center agents, active and inactive. The search, the tab and the filters don't apply.")
    expect(copy.resultTitle).toEqual(owners.exportCopy.resultTitle)
    expect(copy.requested).toEqual(owners.exportCopy.requested)
    expect(copy.error).toEqual(owners.exportCopy.error)
  })

  it('no key of a kind carries another text in another kind', () => {
    const seen = new Map()
    Object.entries(STAFF_KINDS).forEach(([name, kind]) => {
      ;[kind.text, kind.exportCopy].forEach((group) => {
        Object.values(group).forEach(({ key, text }) => {
          if (seen.has(key)) expect(text, `${key} in ${name}`).toBe(seen.get(key))
          else seen.set(key, text)
        })
      })
    })
  })
})

// redesign AD-B1: the admin kind, level 0, the only one with no stores
describe('STAFF_KINDS.admin', () => {
  const admins = STAFF_KINDS.admin
  const owners = STAFF_KINDS.business_owner
  const agents = STAFF_KINDS.callcenter_agent

  it('is level 0, has no stores (main neither asks for them nor shows them here) and asks ConfirmAdmin to switch a level 0 row', () => {
    expect(admins.level).toBe(0)
    expect(admins.storesKey).toBeNull()
    expect(admins.confirmAdminOnToggle).toBe(true)
  })

  it('keeps main\'s two Learn entries, its own panel storage key and the owners\' sheet fields', () => {
    expect(admins.learn).toEqual(['managers_general_view', 'manager_details'])
    expect(admins.storageKey).toBe('od.admins.panel')
    expect(admins.storageKey).not.toBe(owners.storageKey)
    expect(admins.storageKey).not.toBe(agents.storageKey)
    expect(admins.sheetKeys).toEqual(owners.sheetKeys)
  })

  it('the other two kinds still have their stores and ask no admin confirmation', () => {
    expect(owners.storesKey).toBe('businesses')
    expect(agents.storesKey).toBe('businesses_agent')
    expect(owners.confirmAdminOnToggle).toBe(false)
    expect(agents.confirmAdminOnToggle).toBe(false)
  })

  it('its own keys start with ADMINS_; only the menu\'s two and the shared export ones are not', () => {
    const shared = ['ADMINS', 'ADMIN']
    ;[admins.text, admins.exportCopy].forEach((group) => {
      Object.values(group).forEach(({ key }) => {
        if (shared.includes(key) || key.startsWith('CUSTOMERS_EXPORT_')) return
        expect(key, key).toMatch(/^ADMINS_/)
      })
    })
    expect(admins.text.title).toEqual({ key: 'ADMINS', text: 'Admins' })
    expect(admins.text.one).toEqual({ key: 'ADMIN', text: 'Admin' })
  })

  it('names its orders column like the owners\' («Orders placed», «New»): no ordersColumn, no ordersZeroAsNumber', () => {
    expect(admins.text).not.toHaveProperty('ordersColumn')
    expect(admins).not.toHaveProperty('ordersZeroAsNumber')
  })

  it('says «3 admins», the singular and the add button', () => {
    const t = (_key, text) => text
    expect(say(t, admins.text.countOther, 3)).toBe('3 admins')
    expect(say(t, admins.text.countOne)).toBe('1 admin')
    expect(say(t, admins.text.add)).toBe('Add admin')
    expect(say(t, admins.text.deleteTitleOther, 2)).toBe('Delete 2 admins?')
  })

  it('exports every admin, with the same sentence whatever the filters, and the customers\' result words', () => {
    const copy = admins.exportCopy
    expect(copy.button.text).toBe('Export CSV')
    expect(copy.confirm.text).toBe('Export CSV')
    expect(copy.title.text).toBe('Export admins to CSV?')
    expect(copy.scopeAll).toEqual(copy.scopeFiltered)
    expect(copy.scopeAll.text).toBe("The file includes all admins, active and inactive. The search, the tab and the filters don't apply.")
    expect(copy.resultTitle).toEqual(owners.exportCopy.resultTitle)
    expect(copy.requested).toEqual(owners.exportCopy.requested)
    expect(copy.error).toEqual(owners.exportCopy.error)
  })

  it('has every text group the other kinds have (the page asks for them by name)', () => {
    expect(Object.keys(admins.text).sort()).toEqual(Object.keys(owners.text).sort())
    expect(Object.keys(admins.exportCopy).sort()).toEqual(Object.keys(owners.exportCopy).sort())
  })
})

describe('staffStoresKey · the stores property is decided by the level of the record (main: U/UserDetails)', () => {
  it('a call center agent (9) keeps them in businesses_agent', () => {
    expect(staffStoresKey(9)).toBe('businesses_agent')
  })

  it('any other level, and none, in businesses', () => {
    ;[2, 0, 3, undefined].forEach(level => expect(staffStoresKey(level)).toBe('businesses'))
  })
})

describe('seedStaffKindsI18n', () => {
  it('names every key a kind passes as data, with the same default text (i18n:generate only sees literal t() calls)', () => {
    const seeded = new Map()
    seedStaffKindsI18n((key, text) => { seeded.set(key, text) })
    Object.values(STAFF_KINDS).forEach((kind) => {
      [kind.text, kind.exportCopy].forEach((group) => {
        Object.values(group).forEach(({ key, text }) => {
          expect(seeded.get(key), key).toBe(text)
        })
      })
    })
  })
})

// redesign PR-B1b: the professional kind, level 8, with the opt-in options the other kinds do not have
describe('STAFF_KINDS.professional', () => {
  const professionals = STAFF_KINDS.professional
  const owners = STAFF_KINDS.business_owner
  const t = (_key, text) => text

  it('is level 8, has no stores, asks no admin confirmation, has no Learn entries and its own panel storage key', () => {
    expect(professionals.level).toBe(8)
    expect(professionals.storesKey).toBeNull()
    expect(professionals.confirmAdminOnToggle).toBe(false)
    expect(professionals.learn).toEqual([])
    expect(professionals.storageKey).toBe('od.professionals.panel')
    ;['business_owner', 'callcenter_agent', 'admin'].forEach(name => expect(STAFF_KINDS[name].storageKey).not.toBe(professionals.storageKey))
  })

  it('its sheet fields are main\'s: name, last name, email, country phone code, phone number (no orders)', () => {
    expect(professionals.sheetKeys).toEqual(['name', 'lastname', 'email', 'countryPhoneCode', 'cellphone'])
  })

  it('carries every opt-in option of the spec', () => {
    expect(professionals.isProfessional).toBe(true)
    expect(professionals).not.toHaveProperty('requiresAddon')
    expect(professionals.columns).toEqual(['owner', 'occupation', 'city', 'phone', 'email', 'status'])
    expect(professionals.columnManager).toBe(true)
    expect(professionals.columnsStorageKey).toBe('od.professionals.columns')
    expect(professionals.showLoyalty).toBe(false)
    expect(professionals.extraPropsToFetch).toEqual(['schedule', 'max_days_in_future', 'occupation_id', 'occupation', 'timezone'])
    expect(professionals.addForm).toBe('professional')
    expect(professionals.afterAddSection).toBe('business_services')
    expect(professionals.calendarSync).toBe(true)
    expect(professionals.deleteRequiresLevel0).toBe(true)
  })

  it('the other kinds carry none of those options (their behavior is today\'s)', () => {
    const optIns = ['isProfessional', 'columns', 'columnManager', 'columnsStorageKey', 'showLoyalty', 'extraPropsToFetch', 'addForm', 'afterAddSection', 'calendarSync', 'deleteRequiresLevel0', 'info']
    ;['business_owner', 'callcenter_agent', 'admin'].forEach((name) => {
      optIns.forEach(option => expect(STAFF_KINDS[name], `${name}.${option}`).not.toHaveProperty(option))
      expect(STAFF_KINDS[name].text).not.toHaveProperty('occupations')
    })
  })

  it('the ⓘ text is main\'s PROFESSIONALS_INFO, literally', () => {
    expect(professionals.info).toEqual({
      key: 'PROFESSIONALS_INFO',
      text: 'Create, assign and manage your professionals. Once the professional link his Google account, continue synchronizing your appointments with the professionals user using the Synchronize button inside of the account. Select the stores and configure the schedules for your services.'
    })
  })

  it('the words: main\'s keys for the menu and the add button, PROFESSIONALS_ for the rest', () => {
    expect(professionals.text.title).toEqual({ key: 'PROFESSIONALS', text: 'Professionals' })
    expect(professionals.text.one).toEqual({ key: 'PROFESSIONAL', text: 'Professional' })
    expect(professionals.text.add).toEqual({ key: 'ADD_PROFESSIONAL', text: 'Add professional' })
    expect(professionals.text).not.toHaveProperty('addonOff')
    expect(professionals.text.occupations).toEqual({ key: 'PROFESSIONALS_OCCUPATION_FILTER', text: 'Occupation' })
    const shared = ['PROFESSIONALS', 'PROFESSIONAL', 'ADD_PROFESSIONAL']
    ;[professionals.text, professionals.exportCopy].forEach((group) => {
      Object.values(group).forEach(({ key }) => {
        if (shared.includes(key) || key.startsWith('CUSTOMERS_EXPORT_')) return
        expect(key, key).toMatch(/^PROFESSIONALS_/)
      })
    })
  })

  it('says «3 professionals», the singular and the delete titles', () => {
    expect(say(t, professionals.text.countOther, 3)).toBe('3 professionals')
    expect(say(t, professionals.text.countOne)).toBe('1 professional')
    expect(say(t, professionals.text.deleteTitleOther, 2)).toBe('Delete 2 professionals?')
    expect(say(t, professionals.text.deleteOne, 1)).toBe('Delete 1 professional')
  })

  it('has every text group of the admin kind, plus occupations (the page asks for it by name)', () => {
    const adminKeys = Object.keys(STAFF_KINDS.admin.text)
    expect(Object.keys(professionals.text).sort()).toEqual([...adminKeys, 'occupations'].sort())
    expect(Object.keys(professionals.exportCopy).sort()).toEqual(Object.keys(STAFF_KINDS.admin.exportCopy).sort())
  })

  it('exports every professional, with the same sentence whatever the filters, and the customers\' result words', () => {
    const copy = professionals.exportCopy
    expect(copy.title.text).toBe('Export professionals to CSV?')
    expect(copy.scopeAll).toEqual(copy.scopeFiltered)
    expect(copy.scopeAll.text).toBe("The file includes all professionals, active and inactive. The search, the tab and the filters don't apply.")
    expect(copy.resultTitle).toEqual(owners.exportCopy.resultTitle)
    expect(copy.requested).toEqual(owners.exportCopy.requested)
    expect(copy.error).toEqual(owners.exportCopy.error)
  })
})

describe('the professional record\'s sections (level 8)', () => {
  it('are Profile, Schedule and Business & Services, in that order; Schools changes nothing', () => {
    expect(staffSectionIds({ level: 8 })).toEqual(['profile', 'schedule', 'business_services'])
    expect(staffSectionIds({ level: 8, isSchoolsOn: true })).toEqual(['profile', 'schedule', 'business_services'])
  })

  it('schedule and business_services are known section ids and main\'s ?tab= values', () => {
    expect(STAFF_SECTION_IDS).toContain('schedule')
    expect(STAFF_SECTION_IDS).toContain('business_services')
    expect(fromStaffTab('schedule')).toEqual({ section: 'schedule', customFields: false })
    expect(fromStaffTab('business_services')).toEqual({ section: 'business_services', customFields: false })
  })

  it('the other levels do not get them', () => {
    ;[0, 2, 3, 9, undefined].forEach((level) => {
      const ids = staffSectionIds({ level, isSchoolsOn: true })
      expect(ids, String(level)).not.toContain('schedule')
      expect(ids, String(level)).not.toContain('business_services')
    })
  })

  it('a level 8 record falls back to Profile for a section it has not', () => {
    const ids = staffSectionIds({ level: 8 })
    expect(sectionOrDefault('schedule', ids)).toBe('schedule')
    expect(sectionOrDefault('orders', ids)).toBe('profile')
  })
})

describe('seedStaffKindsI18n · the professional kind\'s info', () => {
  it('seeds the ⓘ text too (it is not in text or exportCopy)', () => {
    const seeded = new Map()
    seedStaffKindsI18n((key, text) => { seeded.set(key, text) })
    expect(seeded.get(STAFF_KINDS.professional.info.key)).toBe(STAFF_KINDS.professional.info.text)
  })
})

// redesign D-1 (owner, 2026-10-19, decision 25 C8): the words of the confirmation before deactivating, one set per kind that asks
// (the admin's is ConfirmAdmin, on its own, so its kind carries none: `confirmDeactivate` must stay null for it)
describe('the deactivation confirmation of each kind', () => {
  const t = (_key, text) => text
  const words = {
    business_owner: {
      body: "They can't sign in to the dashboard until you activate them again.",
      confirm: 'Deactivate business owner',
      keys: ['BUSINESS_OWNERS_DEACTIVATE_TITLE', 'BUSINESS_OWNERS_DEACTIVATE_BODY', 'BUSINESS_OWNERS_DEACTIVATE_CONFIRM']
    },
    callcenter_agent: {
      body: "They can't sign in to the call center app or take orders until you activate them again.",
      confirm: 'Deactivate call center agent',
      keys: ['CALL_CENTER_AGENTS_DEACTIVATE_TITLE', 'CALL_CENTER_AGENTS_DEACTIVATE_BODY', 'CALL_CENTER_AGENTS_DEACTIVATE_CONFIRM']
    },
    professional: {
      body: "They can't sign in until you activate them again.",
      confirm: 'Deactivate professional',
      keys: ['PROFESSIONALS_DEACTIVATE_TITLE', 'PROFESSIONALS_DEACTIVATE_BODY', 'PROFESSIONALS_DEACTIVATE_CONFIRM']
    }
  }

  it.each(Object.keys(words))('%s: «Deactivate _name_?», its sentence of consequence, its «Deactivate …» button and its own keys', (id) => {
    const copy = STAFF_KINDS[id].deactivateCopy
    expect(say(t, copy.title)).toBe('Deactivate _name_?')
    expect(say(t, copy.body)).toBe(words[id].body)
    expect(say(t, copy.confirm)).toBe(words[id].confirm)
    expect([copy.title.key, copy.body.key, copy.confirm.key]).toEqual(words[id].keys)
  })

  it('the admin kind carries none: ConfirmAdmin is its only question', () => {
    expect(STAFF_KINDS.admin).not.toHaveProperty('deactivateCopy')
  })

  it('every one of those keys is seeded with the same default text', () => {
    const seeded = new Map()
    seedStaffKindsI18n((key, text) => { seeded.set(key, text) })
    Object.keys(words).forEach((id) => {
      Object.values(STAFF_KINDS[id].deactivateCopy).forEach(({ key, text }) => {
        expect(seeded.get(key), key).toBe(text)
      })
    })
  })
})
