import { createContext, useContext } from 'react'

/**
 * true below the dashboard shell's own <main id='main-content'> (src/components/ShellMain). A page that draws its own
 * <main> reads this and falls back to a plain box, so the page never holds two main landmarks. The default is false: the docs.ordering.co
 * connection popup (`?docs_connect=`) is drawn outside the shell, and there the auth form is the page's only main.
 */
export const MainLandmarkContext = createContext(false)

export const useInsideMainLandmark = () => useContext(MainLandmarkContext)
