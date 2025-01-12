/* eslint-disable no-console */
import { NextApiRequest, NextApiResponse } from 'next'
// import { Passport } from '@gitcoinco/passport-sdk-types'
// import { PassportReader } from '@gitcoinco/passport-sdk-reader'

import { db, TABLE, TABLES, getUserId } from 'utils/db'
import { GENERIC_ERROR_MESSAGE } from 'constants/index'
import { NUMBER_OF_STAMP_REQUIRED } from 'constants/passport'
import { filterValidStamps } from 'utils/passport'
import { trackBE } from 'utils/mixpanel'
import axios from 'axios'

// const reader = new PassportReader(CERAMIC_PASSPORT, '1')

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const DEV_SECRET = process.env.DEV_SECRET
  const param =
    DEV_SECRET && req.query?.dev === DEV_SECRET ? req.query : req.body
  const { address, embed } = param

  if (!address || typeof address === 'object')
    return res.status(400).json({ error: 'Wrong params' })

  console.log('address', address)

  const isBot =
    req.headers['user-agent'].includes('python') ||
    req.headers['user-agent'].includes('curl') ||
    false
  console.log('isBot', isBot)

  const userId = await getUserId(address, embed, isBot)
  console.log(userId)
  if (!(userId && Number.isInteger(userId)))
    return res.status(403).json({ error: 'userId not found' })

  const [user] = await db(TABLES.users)
    .select('sybil_user_id')
    .where('address', 'ilike', `%${address}%`)

  // TODO: make this dynamic
  type SybilCheckTypes = 'GITCOIN_PASSPORT' | '35kBANK'
  const SYBIL_CHECK: SybilCheckTypes = 'GITCOIN_PASSPORT'

  const requirement = `At least ${NUMBER_OF_STAMP_REQUIRED} Gitcoin Passport stamps`

  // TEMP: bypass passport check (accounts having issues with Ceramic API)
  const TEMP_PASSPORT_WHITELIST = [
    // '0xda1d8a345Fc6934Da60E81b392F485cbfd350eaE'.toLowerCase(),
    '0x1EC1CcEF3e1735bdA3F4BA698e8a524AA7c93274'.toLowerCase(),
    '0x5B1899D88b4Ff0Cf5A34651e7CE7164398211C66'.toLowerCase(),
    '0xd9c1570148E36FF9657b67AcE540052341DDF7de'.toLowerCase(),
    '0xBDe4CB8d858adFaDDc5517bd54479a066559E575'.toLowerCase(),
    '0xda1d8a345Fc6934Da60E81b392F485cbfd350eaE'.toLowerCase(),
    '0xB30dD1198Feed1e22EC969f61EEd04cB75937adf'.toLowerCase(),
    '0xb749A586080436e616f097f193Ba9CB6A25E7Ea6'.toLowerCase(),
  ]
  if (TEMP_PASSPORT_WHITELIST.includes(address.toLowerCase())) {
    return res.status(200).json({
      verified: true,
      requirement,
      validStampsCount: 99,
    })
  }

  if (SYBIL_CHECK === 'GITCOIN_PASSPORT') {
    try {
      // read passport
      // const passportReader: Passport = await reader.getPassport(address)
      // console.log(passportReader)
      const gitcoinConfig = {
        headers: {
          accept: 'application/json',
          'X-API-Key': process.env.GITCOIN_PASSPORT_API_KEY,
        },
      }
      const passportRes = await axios.get(
        `https://api.scorer.gitcoin.co/registry/stamps/${address}?limit=1000`,
        gitcoinConfig
      )
      const passport: any = passportRes.data
      // console.log('** passport **', passport)
      let validStamps = []
      const stampHashes = {}
      const stampProviders = {}
      const stampHashesSearch = []
      let whereCondition = 'gitcoin_stamps @> ?'
      let sybil = []
      if (passport?.items?.length) {
        // eslint-disable-next-line no-unsafe-optional-chaining
        for (const stamp of passport?.items) {
          const provider = stamp.credential?.credentialSubject?.provider
          // console.log(stamp)
          if (stamp.credential?.credentialSubject?.hash)
            stampHashes[provider] = stamp.credential?.credentialSubject?.hash
        }
        // eslint-disable-next-line no-unsafe-optional-chaining
        for (const stamp of passport?.items) {
          const provider = stamp.credential?.credentialSubject?.provider
          stampProviders[provider] = { provider, stamp: stamp.credential }
        }
        // console.log('stampHashes', stampHashes)
        validStamps = filterValidStamps(Object.values(stampProviders))
        // console.log('validStamps', validStamps)
        // merge previous data without deleting other keys
        const updated = await db.raw(
          `update "users" set "gitcoin_stamps" = gitcoin_stamps || ? where "users"."id" = ?`,
          [stampHashes, userId]
        )
        // console.log('updated', updated)
        if (updated) console.log('stamps updated:', updated?.rowCount)
        Object.keys(stampHashes).map((key, index) => {
          const stampHash = {}
          stampHash[key] = stampHashes[key]
          stampHashesSearch.push(stampHash)
          if (index > 0) whereCondition += ' OR gitcoin_stamps @> ?'
        })
        const sybilQuery = db(TABLES.users)
          .select('id', 'address')
          .whereNot(TABLE.users.id, userId)
          .whereNull(TABLE.users.sybil_user_id)
          // query for json instead of jsonb: .where(db.raw('gitcoin_stamps::TEXT LIKE ANY(?)', [stampHashesSearch]))
          .where(db.raw(`(${whereCondition})`, stampHashesSearch))
          .orWhereNot(TABLE.users.id, userId)
          .where(TABLE.users.sybil_user_id, '=', 12)
          .where(db.raw(`(${whereCondition})`, stampHashesSearch))
        // console.log(sybilQuery.toString())
        sybil = await sybilQuery
        console.log('sybil', sybil)
      }
      if (isBot) {
        // HACK: bot
        console.log('bot detected:', address)
        trackBE(address, 'bot_detected', {
          ua: req.headers['user-agent'],
          embed,
        })
        await db(TABLES.users)
          .where(TABLE.users.id, userId)
          .update({ sybil_user_id: 12 })
        res.status(403).json({
          verified: false,
          requirement,
          validStampsCount: 0,
        })
      }
      if (sybil?.length) {
        // mark this user as a sybil attacker
        console.log('fraud detected:', sybil)
        trackBE(address, 'duplicate_stamps', {
          sybil_id: sybil[0]?.id,
          sybil_address: sybil[0]?.address,
          embed,
        })
        await db(TABLES.users)
          .where(TABLE.users.id, userId)
          .update({ sybil_user_id: sybil[0]?.id })
        return res.status(200).json({
          verified: false,
          requirement,
          fraud: sybil[0]?.address,
          validStampsCount: validStamps?.length,
          stamps: stampProviders,
        })
      }
      if (validStamps?.length >= NUMBER_OF_STAMP_REQUIRED) {
        // console.log('verified:', validStamps?.length)
      } else {
        console.log('not verified')
      }
      return res.status(200).json({
        verified: validStamps?.length >= NUMBER_OF_STAMP_REQUIRED,
        fraud:
          user?.sybil_user_id === 12
            ? '0x0000000000000000000000000000000000000000'
            : null,
        requirement,
        validStampsCount: validStamps?.length,
        stamps: stampProviders,
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({
        verified: false,
        requirement,
        validStampsCount: 0,
        error: `error ${error?.code}: ${GENERIC_ERROR_MESSAGE}`,
      })
    }
  } else if (SYBIL_CHECK === '35kBANK') {
    // not implemented yet
    const NUMBER_OF_BANK_REQUIRED = 35000
    const requirement = `Hold a minimum of ${NUMBER_OF_BANK_REQUIRED} BANK tokens for at least 1 month˝`
    return res.status(200).json({ verified: 'TODO', requirement })
  }
}
