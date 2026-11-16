import React, { useCallback, useEffect, useState } from 'react'

import { CampaignSignUpOption } from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignSignUpOption'

const campaignRule = condition => condition === 'range'
  ? { type: 'signup_date', date_condition: '><', date: '2024-06-10T12:00:00', max_date: '2024-06-12T12:00:00' }
  : { type: 'signup_date', date_condition: '<', date: '2024-06-15T12:00:00', max_date: null }

const resyncedCampaignRule = condition => condition === 'range'
  ? { type: 'signup_date', date_condition: '><', date: '2024-07-21T12:00:00', max_date: '2024-07-23T12:00:00' }
  : { type: 'signup_date', date_condition: '<', date: '2024-07-20T12:00:00', max_date: null }

const SyntheticCampaignController = props => {
  const {
    UIComponent,
    fixtureRule,
    onFixtureEvent,
    onFixtureState
  } = props
  const [ruleFormState, setRuleFormState] = useState({ loading: false, changes: fixtureRule, error: null })

  useEffect(() => {
    setRuleFormState({ loading: false, changes: fixtureRule, error: null })
  }, [fixtureRule])

  useEffect(() => {
    onFixtureState(ruleFormState)
  }, [onFixtureState, ruleFormState])

  const handleChangeOption = value => {
    onFixtureEvent({ kind: 'option', args: [value] })
    setRuleFormState(current => ({
      ...current,
      changes: { ...current.changes, date_condition: value, date: null }
    }))
  }
  const handleChangeDateTime = value => {
    onFixtureEvent({ kind: 'single', args: [value] })
    setRuleFormState(current => ({
      ...current,
      changes: { ...current.changes, date: value, max_date: null }
    }))
  }
  const handleChangeDate = (from, to) => {
    onFixtureEvent({ kind: 'range', args: [from, to] })
    setRuleFormState(current => ({
      ...current,
      changes: { ...current.changes, date: `${from} 00:00:00`, max_date: `${to} 00:00:00` }
    }))
  }

  return (
    <UIComponent
      {...props}
      ruleFormState={ruleFormState}
      handleChangeValue={() => {}}
      handleUpdateRule={() => onFixtureEvent({ kind: 'update', args: [] })}
      handleAddRule={() => onFixtureEvent({ kind: 'add', args: [] })}
      handleChangeDate={handleChangeDate}
      handleChangeOption={handleChangeOption}
      handleChangeDateTime={handleChangeDateTime}
    />
  )
}

const CampaignConsumer = () => {
  const query = new URLSearchParams(window.location.search)
  const condition = query.get('condition') === 'range' ? 'range' : 'single'
  const [rule, setRule] = useState(() => campaignRule(condition))
  const [ruleFormState, setRuleFormState] = useState(null)
  const [events, setEvents] = useState([])
  const record = useCallback(event => setEvents(current => [...current, event]), [])

  globalThis.__OD_CAMPAIGN_SIGN_UP_CONTROLLER__ = SyntheticCampaignController
  useEffect(() => () => {
    delete globalThis.__OD_CAMPAIGN_SIGN_UP_CONTROLLER__
  }, [])

  return (
    <main data-testid='c4-campaign-consumer' style={{ boxSizing: 'border-box', display: 'grid', gap: 16, maxWidth: 720, padding: 24 }}>
      <CampaignSignUpOption
        type='signup_date'
        title='Customer sign-up date'
        isAddMode
        formState={{ changes: { conditions: [rule] } }}
        fixtureRule={rule}
        onFixtureEvent={record}
        onFixtureState={setRuleFormState}
        handleChangeItem={(...args) => record({ kind: 'save', args })}
        onClose={() => record({ kind: 'close', args: [] })}
      />
      <button type='button' onClick={() => setRule(resyncedCampaignRule(condition))}>Resync campaign date props</button>
      <button data-testid='c4-linked-outside' type='button'>Outside campaign rule</button>
      <output data-testid='c4-campaign-events'>{JSON.stringify({ condition, events, rule, ruleFormState })}</output>
    </main>
  )
}

export const C4LinkedConsumersFixture = () => <CampaignConsumer />
