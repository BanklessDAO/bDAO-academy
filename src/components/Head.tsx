import NextHead from 'next/head'

import { PROJECT_NAME } from 'constants/'

export interface PageMetaProps {
  title: string
  description: string
}

const Head = ({
  title = '',
  description = '',
}: PageMetaProps): React.ReactElement => {
  // TODO social images
  return (
    <NextHead>
      <title>{title ? `${title} | ${PROJECT_NAME}` : PROJECT_NAME}</title>
      <meta name="description" content={description} />
      <link rel="shortcut icon" type="image/png" href="/favicon.png" />
    </NextHead>
  )
}

export default Head