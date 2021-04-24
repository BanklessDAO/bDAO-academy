import * as React from 'react'
import { normalize } from 'polished'
import { createGlobalStyle, css } from 'styled-components'

import { fontStyles } from 'src/theme'

import Head from '../Head'
import Header from '../Header'
import Footer from '../Footer'

const styles = css`
  ${normalize()}

  * {
    box-sizing: border-box;
    font-family: 'ClearSans', Helvetica, sans-serif;
    ${fontStyles.P};
  }
`

const GlobalStyle = createGlobalStyle`
  ${styles}
`

const SiteLayout = ({ pageMeta, children }) => (
  <React.Fragment>
    <GlobalStyle />
    <Head {...pageMeta} />
    <Header />
    <main>{children}</main>
    <Footer />
  </React.Fragment>
)

export default SiteLayout
