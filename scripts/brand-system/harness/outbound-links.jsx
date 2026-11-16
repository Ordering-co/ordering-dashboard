import React, { useState } from 'react'
import { useTheme } from 'styled-components'

import { Personalization } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Personalization'
import { LinkableText } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/LinkableText'

const Section = ({ children, label, testId }) => (
  <section aria-label={label} className='outbound-links-section' data-testid={testId}>
    <h2>{label}</h2>
    {children}
  </section>
)

export const OutboundLinksFixture = () => {
  const theme = useTheme()
  const [submits, setSubmits] = useState(0)
  return (
    <main
      className='outbound-links-fixture'
      data-testid='outbound-links-fixture'
      style={{ background: theme.ordering?.semantic?.background, color: theme.ordering?.semantic?.text?.default }}
    >
      <style>{`
        .outbound-links-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
        .outbound-links-fixture * { box-sizing: border-box; }
        .outbound-links-fixture h1, .outbound-links-fixture h2 { margin: 0; }
        .outbound-links-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 12px; min-width: 0; padding: 16px; }
        .outbound-links-case { border-bottom: 1px dashed currentColor; min-width: 0; padding: 8px 0; }
        .outbound-links-case:last-child { border-bottom: 0; }
        @media (max-width: 420px) { .outbound-links-fixture { gap: 12px; padding: 12px; } .outbound-links-section { padding: 12px; } }
      `}</style>
      <h1>Ordering.co outbound link fixtures</h1>

      <Section label='Personalization with title' testId='personalization-title'>
        <form onSubmit={event => { event.preventDefault(); setSubmits(current => current + 1) }}>
          <Personalization isShowTitle />
        </form>
        <output data-testid='personalization-submits'>{submits}</output>
      </Section>
      <Section label='Personalization without title' testId='personalization-no-title'>
        <Personalization />
      </Section>

      <Section label='Linkable text cases' testId='linkable-text-cases'>
        <div className='outbound-links-case' data-testid='link-bare'>
          <LinkableText text='Bare docs.ordering.co/guides link.' />
        </div>
        <div className='outbound-links-case' data-testid='link-short'>
          <LinkableText text='Short g.co link.' />
        </div>
        <div className='outbound-links-case' data-testid='link-email'>
          <LinkableText text='Email fixture.person@example.com for support.' />
        </div>
        <div className='outbound-links-case' data-testid='link-https-punctuation'>
          <LinkableText text='Read (https://example.com/path?q=one), then continue.' />
        </div>
        <div className='outbound-links-case' data-testid='link-raw-text'>
          <LinkableText text='Raw <strong>customer content</strong> at example.net.' />
        </div>
        <div className='outbound-links-case' data-testid='link-nested'>
          <LinkableText text={<span>Nested <strong>label</strong> links to status.example.org/health safely.</span>} />
        </div>
        <div className='outbound-links-case' data-testid='link-long'>
          <LinkableText text='Long https://example.com/a-very-long-customer-supplied-path/with-another-segment/and-a-query?tenant=ordering-co-dashboard&source=fixture remains available.' />
        </div>
      </Section>
    </main>
  )
}
