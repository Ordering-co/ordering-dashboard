import React from 'react'

import { TriangleAlert } from '../../Shared/Icon'
import { Button, InlineNotice } from '../../Shared/Product'

/**
 * Keeps a failing part of the editor (a section, a component) from blanking
 * the dashboard: it shows a notice there, with a way to try it again, and the
 * rest keeps working. React catches render errors only in a class component,
 * so this one is a class; `t` comes in as a prop. A new `resetKey` (another
 * section or component) tries again on its own.
 */
export class EditorErrorBoundary extends React.Component {
  constructor (props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError () {
    return { failed: true }
  }

  componentDidCatch (error, info) {
    console.error('[ThemeSchemaEditor]', error, info?.componentStack)
  }

  componentDidUpdate (prevProps) {
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render () {
    const { t, children } = this.props
    if (!this.state.failed) return children
    // redesign B3b: a P/InlineNotice (still an alert) with a P/Button to try again
    return (
      <InlineNotice
        tone='danger'
        icon={TriangleAlert}
        role='alert'
        action={<Button onClick={() => this.setState({ failed: false })}>{t('BUILDER_RETRY', 'Try again')}</Button>}
      >
        {t('BUILDER_THEME_PART_ERROR', 'This part of the editor couldn’t be shown. The rest still works.')}
      </InlineNotice>
    )
  }
}
