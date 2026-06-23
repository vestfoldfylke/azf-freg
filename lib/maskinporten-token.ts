import { randomUUID } from 'node:crypto'
import { logger } from '@vestfoldfylke/loglady'
import { importPKCS8, SignJWT } from 'jose'
import * as client from 'openid-client'
import { ResponseBodyError } from 'openid-client'
import { config } from '../config.js'
import { TtlCache } from './ttl-cache.js'

type MaskinportenTokenResponse = {
  access_token: string
  expires_in: number
}

const cache = new TtlCache()

let maskinportenClientConfig: client.Configuration | null = null
let privateKey: CryptoKey | null = null

const getNewMaskinportenToken = async (): Promise<MaskinportenTokenResponse> => {
  if (!config.MASKINPORTEN.DISCOVERY_URL) {
    throw new Error('Discovery URL for Maskinporten is not configured')
  }

  if (!config.MASKINPORTEN.PRIVATE_KEY_BASE64) {
    throw new Error('Private key for Maskinporten is not configured')
  }

  if (!config.MASKINPORTEN.KID) {
    throw new Error('Key ID (kid) for Maskinporten is not configured')
  }

  if (!config.MASKINPORTEN.CLIENT_ID) {
    throw new Error('Client ID for Maskinporten is not configured')
  }

  if (!config.MASKINPORTEN.SCOPE) {
    throw new Error('Scope for Maskinporten is not configured')
  }

  if (!maskinportenClientConfig) {
    maskinportenClientConfig = await client.discovery(new URL(config.MASKINPORTEN.DISCOVERY_URL), config.MASKINPORTEN.CLIENT_ID)
  }

  if (!privateKey) {
    const pemPrivateKey = Buffer.from(config.MASKINPORTEN.PRIVATE_KEY_BASE64, 'base64').toString('utf-8')
    privateKey = await importPKCS8(pemPrivateKey, 'RS256')
  }

  const assertion = await new SignJWT({ scope: config.MASKINPORTEN.SCOPE })
    .setProtectedHeader({ alg: 'RS256', kid: config.MASKINPORTEN.KID })
    .setIssuer(config.MASKINPORTEN.CLIENT_ID)
    .setAudience(maskinportenClientConfig.serverMetadata().issuer)
    .setIssuedAt()
    .setExpirationTime('2m')
    .setJti(randomUUID())
    .sign(privateKey)

  let token: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
  try {
    token = await client.genericGrantRequest(maskinportenClientConfig, 'urn:ietf:params:oauth:grant-type:jwt-bearer', {
      assertion
    })
  } catch (error) {
    if (error instanceof ResponseBodyError) {
      logger.error(
        'Error response from Maskinporten token endpoint: {@cause} - {@description}',
        error.cause,
        error.error_description || 'No error description provided'
      )
      throw new Error(`Error fetching token from Maskinporten: ${error.error_description || 'No error description provided'}`, { cause: error })
    }
    logger.errorException(error, 'Unexpected error while fetching token from Maskinporten')
    throw new Error(`Error fetching token from Maskinporten: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }

  if (!token.access_token || !token.expires_in) {
    throw new Error('Invalid token response from Maskinporten, missing access_token or expires_in')
  }

  return {
    access_token: token.access_token,
    expires_in: token.expires_in
  }
}

export const getMaskinportenToken = async (): Promise<string> => {
  const cacheKey = 'maskinportenTokenKrr'

  const cached = cache.get<string>(cacheKey)

  if (cached) {
    logger.info('getMaskinportenToken - Found valid token in cache, will use that instead of fetching new')
    return cached
  }

  logger.info('getMaskinportenToken - No valid token in cache, fetching new token from Maskinporten')
  const token = await getNewMaskinportenToken()

  logger.info('getMaskinportenToken - Got token from Maskinporten, expires in {ExpiresIn} seconds.', token.expires_in)
  cache.set(cacheKey, token.access_token, token.expires_in - 5)
  logger.info('getMaskinportenToken - Token stored in cache')

  return token.access_token
}
