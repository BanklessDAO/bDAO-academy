import Web3Modal from 'web3modal'
import React, { useState, useEffect } from 'react'
import WalletConnectProvider from '@walletconnect/web3-provider'
import {
  Button,
  Text,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  SimpleGrid,
  Box,
  Image,
  Link,
  useToast,
} from '@chakra-ui/react'
import { Wallet } from 'phosphor-react'
import axios from 'axios'
import Davatar from '@davatar/react'

import ENSName from 'components/ENSName'
import { useWalletWeb3React } from 'hooks'
import { walletConnect, injected } from 'utils'
import { LESSONS, INFURA_ID, DOMAIN_URL, IS_WHITELABEL } from 'constants/index'
import {
  MINTKUDOS_API,
  MINTKUDOS_COMMUNITY_ID,
  KUDOS_IDS,
} from 'constants/kudos'
import { KudosType } from 'entities/kudos'
import { SUPPORTED_NETWORKS_IDS } from 'constants/networks'

let web3Modal: Web3Modal

const ConnectWalletButton = ({
  isSmallScreen,
}: {
  isSmallScreen: boolean
}): React.ReactElement => {
  const [web3Provider, setWeb3Provider] = useState()
  const walletWeb3ReactContext = useWalletWeb3React()
  const isConnected = walletWeb3ReactContext.active
  const walletAddress = walletWeb3ReactContext.account
  const [connectClick, setConnectClick] = useState(false)
  const [walletIsLoading, setWalletIsLoading] = useState(false)
  const [kudos, setKudos] = useState<KudosType[]>([])
  const toast = useToast()
  const web3ModalFrame = {
    cacheProvider: true,
    theme: {
      background: '#010101',
      main: 'white',
      secondary: 'white',
      border: '#252525',
      hover: '#363636',
    },
    providerOptions: {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: INFURA_ID,
        },
        connector: async () => {
          return 'walletconnect'
        },
      },
      injected: {
        package: null,
        connector: async () => {
          return 'injected'
        },
      },
    },
  }

  function web3ModalConnect(web3Modal) {
    web3Modal
      .connect()
      .then((provider) => {
        if (
          !SUPPORTED_NETWORKS_IDS.includes(
            parseInt(provider?.networkVersion || provider?.chainId)
          )
        ) {
          // wrong network
          toast.closeAll()
          toast({
            title: 'Wrong network detected',
            description: 'Please switch back to Ethereum Mainnet',
            status: 'warning',
            duration: null,
          })
        } else {
          // correct network
          toast.closeAll()
        }
        setWeb3Provider(provider)
        if (provider.isMetaMask) {
          return walletWeb3ReactContext.activate(injected)
        } else {
          return walletWeb3ReactContext.activate(walletConnect)
        }
      })
      .then(() => {
        setConnectClick(false)
      })
      .catch((e) => {
        setWalletIsLoading(false)
        setConnectClick(false)
        console.error(e)
      })
  }

  useEffect(() => {
    if (
      localStorage.getItem('WEB3_CONNECT_CACHED_PROVIDER') &&
      // don't prompt MetaMask popup if wallet isn't unlocked
      !(window?.ethereum?.isMetaMask && !window?.ethereum?.selectedAddress)
    ) {
      web3Modal = new Web3Modal(web3ModalFrame)
      web3ModalConnect(web3Modal)
    }
  }, [])

  useEffect(() => {
    if (connectClick) {
      setWalletIsLoading(true)
      web3Modal = new Web3Modal(web3ModalFrame)
      web3ModalConnect(web3Modal)
    }
  }, [connectClick])

  useEffect(() => {
    if (walletAddress) {
      axios
        .get(
          `${MINTKUDOS_API}/v1/wallets/${walletAddress}/tokens?limit=100&communityId=${MINTKUDOS_COMMUNITY_ID}&claimStatus=claimed`
        )
        .then((res) => {
          const data = res.data.data
          if (Array.isArray(data)) {
            setKudos(
              data.filter(
                (kudos: KudosType) =>
                  KUDOS_IDS.includes(kudos.kudosTokenId) &&
                  // TODO: remove after API is fixed
                  kudos.claimStatus === 'claimed'
              )
            )
          }
        })
    }
  }, [walletAddress])

  return (
    <>
      {isConnected ? (
        <Popover trigger={isSmallScreen ? 'click' : 'hover'}>
          <PopoverTrigger>
            <Button
              variant="secondary"
              size={isSmallScreen ? 'sm' : 'md'}
              // TODO: fix bug when switching wallets
              leftIcon={<Davatar address={walletAddress} size={25} />}
            >
              <Text maxW="200px" display="flex" alignItems="center" isTruncated>
                <ENSName provider={web3Provider} address={walletAddress} />
              </Text>
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <PopoverArrow />
            <PopoverBody>
              <Box textAlign="center" m="2">
                <Button
                  isFullWidth
                  size={isSmallScreen ? 'sm' : 'md'}
                  leftIcon={<Wallet weight="bold" />}
                  onClick={() => {
                    walletWeb3ReactContext.deactivate()
                    web3Modal.clearCachedProvider()
                    localStorage.removeItem('walletconnect')
                    setWalletIsLoading(false)
                    setKudos([])
                  }}
                >
                  Disconnect wallet
                </Button>
              </Box>
              {/* TODO: move to dedicated component? */}
              {!IS_WHITELABEL && kudos?.length > 0 && (
                <>
                  <Text fontSize="xl" fontWeight="bold" textAlign="center">
                    My Academy Credentials
                  </Text>
                  <Box
                    maxHeight="320px"
                    overflow="scroll"
                    backgroundColor="blackAlpha.200"
                    borderRadius="10px"
                  >
                    <SimpleGrid columns={3} spacing={3} p={3}>
                      {kudos?.map((k, index) => {
                        const lesson = LESSONS.find(
                          (lesson) => lesson.kudosId === k.kudosTokenId
                        )
                        if (lesson) {
                          const share = `${lesson.description}
${
  IS_WHITELABEL
    ? ''
    : 'Level up your #web3 knowledge thanks to @BanklessAcademy 👨‍🚀🚀'
}
${DOMAIN_URL}/lessons/${lesson.slug}`
                          const twitterLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
                            share
                          )}`
                          return (
                            <Box
                              key={`poap-${index}`}
                              justifySelf="center"
                              boxShadow="0px 0px 4px 2px #00000060"
                              borderRadius="3px"
                              backgroundColor="blackAlpha.300"
                              p={1}
                            >
                              <Link href={twitterLink} target="_blank">
                                <Image
                                  src={k.assetUrl}
                                  width="70px"
                                  height="70px"
                                  alt={lesson.name}
                                  title={lesson.name}
                                />
                              </Link>
                            </Box>
                          )
                        }
                      })}
                    </SimpleGrid>
                  </Box>
                </>
              )}
            </PopoverBody>
          </PopoverContent>
        </Popover>
      ) : (
        <Button
          onClick={() => {
            setConnectClick(true)
          }}
          size={isSmallScreen ? 'sm' : 'md'}
          leftIcon={<Wallet weight="bold" />}
          isLoading={walletIsLoading}
          loadingText="Connecting wallet"
        >
          Connect wallet
        </Button>
      )}
    </>
  )
}

export default ConnectWalletButton
