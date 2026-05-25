import { createPrivateKey, randomUUID, sign } from 'node:crypto'
import { logger } from '@vestfoldfylke/loglady'
import config from '../config.js'
import { TtlCache } from './ttl-cache'

interface MaskinportenTokenResponse {
  access_token: string
  expires_in: number
}

interface MaskinportenDiscoveryData {
  token_endpoint: string
  issuer: string
}

const cache = new TtlCache()

const getNewMaskinportenToken = async (): Promise<MaskinportenTokenResponse> => {
  if (!config.maskinporten.discoveryUrl) {
    throw new Error('Discovery URL for Maskinporten is not configured')
  }

  if (!config.maskinporten.privateKeyBase64) {
    throw new Error('Private key for Maskinporten is not configured')
  }

  if (!config.maskinporten.kid) {
    throw new Error('Key ID (kid) for Maskinporten is not configured')
  }

  if (!config.maskinporten.clientId) {
    throw new Error('Client ID for Maskinporten is not configured')
  }

  if (!config.maskinporten.scope) {
    throw new Error('Scope for Maskinporten is not configured')
  }

  const discoveryResponse = await fetch(config.maskinporten.discoveryUrl)

  if (!discoveryResponse.ok) {
    try {
      const errorText = await discoveryResponse.text()

      logger.error('Failed to fetch discovery document, status: {Status}, response: {Response}', {
        Status: discoveryResponse.status,
        Response: errorText
      })
    } catch (error) {
      logger.errorException(error, 'Failed to read discovery document error response')
    }

    throw new Error(`Failed to fetch discovery document, status: ${discoveryResponse.status}`)
  }

  const discoveryData: MaskinportenDiscoveryData = await discoveryResponse.json()

  const privateKeyPem: string = Buffer.from(config.maskinporten.privateKeyBase64, 'base64').toString('utf8')
  const keyObject = createPrivateKey(privateKeyPem)

  const tokenRequestHeader = {
    alg: 'RS256',
    kid: config.maskinporten.kid
  }

  const tokenRequestPayload = {
    aud: discoveryData.issuer,
    iss: config.maskinporten.clientId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 120, // 2 minutes expiration
    jti: randomUUID(),
    scope: config.maskinporten.scope
  }

  const encodedHeader = Buffer.from(JSON.stringify(tokenRequestHeader)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(tokenRequestPayload)).toString('base64url')

  const dataToSign = `${encodedHeader}.${encodedPayload}`
  const signed = sign('RSA-SHA256', Buffer.from(dataToSign), keyObject).toString('base64url')

  const clientAssertion = `${dataToSign}.${signed}`

  const tokenResponse = await fetch(discoveryData.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: clientAssertion
    })
  })

  if (!tokenResponse.ok) {
    try {
      const errorText = await tokenResponse.text()
      logger.error('Failed to fetch token, status: {Status}, response: {Response}', { Status: tokenResponse.status, Response: errorText })
    } catch (error) {
      logger.errorException(error, 'Failed to read token response error')
    }

    throw new Error(`Failed to fetch token, status: ${tokenResponse.status}`)
  }

  return await tokenResponse.json()
}

export const getMaskinportenToken = async (forceNew = false): Promise<string> => {
  const cacheKey = 'maskinportenTokenKrr'

  if (!forceNew) {
    const cached = cache.get<string>(cacheKey)

    if (cached) {
      logger.info('getMaskinportenToken - Found valid token in cache, will use that instead of fetching new')
      return cached
    }
  }

  logger.info('getMaskinportenToken - No valid token in cache, fetching new token from Maskinporten')
  const token = await getNewMaskinportenToken()

  logger.info('getMaskinportenToken - Got token from Maskinporten, expires in {ExpiresIn} seconds.', token.expires_in)
  cache.set(cacheKey, token.access_token, token.expires_in)
  logger.info('getMaskinportenToken - Token stored in cache')

  return token.access_token
}
