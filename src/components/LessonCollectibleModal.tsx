import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  useMediaQuery,
  Box,
} from '@chakra-ui/react'
import hljs from 'highlight.js'
import { useEffect, useState } from 'react'
import styled from '@emotion/styled'

import { LessonType } from 'entities/lesson'

const StyledMarkdown = styled(Box)`
  font-family: Menlo, Monaco, 'Courier New', monospace;
  font-size: 11.8px;
  word-wrap: break-word;
  white-space: pre-wrap;
  /* .hljs-section {
    display: block;
  }
  .hljs-bullet {
    display: table-column;
  } */
`

function replaceImagesInMarkdown(markdownString) {
  // Regular expression to match image Markdown syntax
  const imageRegex =
    /!\[<span class="hljs-string">(.*?)<\/span>\]\(<span class="hljs-link">(.*?)<\/span>\)/g

  // Replace each image syntax with an <img> tag
  const replacedString = markdownString.replace(
    imageRegex,
    '<img alt="$1" src="$2" width="400px" />'
  )

  return replacedString
}

const LessonCollectibleModal = ({
  isOpen,
  onClose,
  lesson,
}: {
  isOpen: boolean
  onClose: () => void
  lesson: LessonType
}): React.ReactElement => {
  const [isMobileScreen] = useMediaQuery(['(max-width: 480px)'])
  const [intro, setIntro] = useState('')
  const [content, setContent] = useState('')

  const html = hljs.highlight(content, {
    language: 'markdown',
  }).value

  useEffect(() => {
    if (lesson?.slug) {
      fetch(`/lesson/${lesson.slug}.md`)
        .then((response) => response.text())
        .then((md) => {
          const [intro, content] = md?.split('<< LESSON START >>')
          setIntro(intro + '<< LESSON START >>')
          setContent(content)
        })
    }
  }, [lesson])
  return (
    <Modal
      onClose={onClose}
      size={isMobileScreen ? 'full' : '6xl'}
      isCentered
      isOpen={isOpen}
    >
      <ModalOverlay backdropFilter="blur(10px)" />
      <ModalContent
        bg="linear-gradient(180deg, #f4c137bf 0%, #e9966a9c 100%)"
        border={isMobileScreen ? '0' : '2px solid #c17e3c'}
        borderRadius={isMobileScreen ? '0' : '3xl'}
        backdropFilter="blur(10px)"
      >
        <ModalHeader>LESSON DATADISK™ CONTENT</ModalHeader>
        <ModalCloseButton />
        <ModalBody padding={isMobileScreen ? '0' : 'default'}>
          <StyledMarkdown overflow="scroll" maxHeight="85vh">
            <Box
              dangerouslySetInnerHTML={{ __html: intro }}
              width="min-content"
              overflowX="scroll"
            />
            <Box
              dangerouslySetInnerHTML={{
                __html: replaceImagesInMarkdown(html),
              }}
              width="inherit"
            />
          </StyledMarkdown>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default LessonCollectibleModal
