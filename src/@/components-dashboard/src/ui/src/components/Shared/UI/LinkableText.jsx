import React from 'react'
import Linkify from 'react-linkify'

import { LinkableTextContainer } from './outbound-link-styles'

export const LinkableText = (props) => {
  const { text } = props
  return (
    <LinkableTextContainer>
      <Linkify
        componentDecorator={(decoratedHref, decoratedText, key) => (
          <a
            className='od-outbound-link'
            data-outbound-link-slot='generated-link'
            target='blank'
            href={decoratedHref}
            key={key}
          >
            {decoratedText}
          </a>
        )}
      >
        {text}
      </Linkify>
    </LinkableTextContainer>
  )
}
