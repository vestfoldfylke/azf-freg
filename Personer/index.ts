import { logger } from '@vestfoldfylke/loglady'
import { config } from '../config.js'
import { decodeAadToken } from '../lib/decodeAadToken.js'
import { getMaskinportenToken } from '../lib/maskinporten-token.js'
import { type FregPerson, repackFreg } from '../lib/repackFreg.js'

// Minimal Azure Functions v3/v4 typings (legacy programming model with function.json)
interface AzureHttpRequest {
  headers: Record<string, string | undefined>
  body?: {
    ssn?: unknown
    name?: unknown
    birthdate?: unknown
    includeRawFreg?: unknown
    includeFortrolig?: unknown
    includeForeldreansvar?: unknown
    includeFamilie?: unknown
  }
}

interface AzureHttpResponse {
  status: number
  body: unknown
}

export const handler = async (_context: unknown, req: AzureHttpRequest): Promise<AzureHttpResponse> => {
  logger.info('azf-freg - Personer - new request, checking token')

  const decoded = decodeAadToken(req.headers.authorization)
  if (!decoded.verified) {
    return { status: 401, body: decoded.msg }
  }
  if (!decoded.roles.includes(config.apiRole)) {
    return { status: 401, body: 'Access token does not include required role for this operation' }
  }

  const caller = `${decoded.appid}${decoded.upn ? ` - ${decoded.upn}` : ''}`
  logger.info('azf-freg - Personer - {Caller} - token ok, fetching Maskinporten token', { Caller: caller })

  let accessToken: string
  try {
    accessToken = await getMaskinportenToken()
  } catch (error) {
    logger.error('azf-freg - Personer - {Caller} - error getting Maskinporten token: {Error}', {
      Caller: caller,
      Error: String(error)
    })
    return { status: 500, body: String(error) }
  }

  if (!req.body) {
    return { status: 400, body: 'Body is missing' }
  }

  const { ssn, name, birthdate, includeRawFreg, includeFortrolig, includeForeldreansvar, includeFamilie } = req.body

  if (!ssn && !(name && birthdate)) {
    return { status: 400, body: 'Body is missing required property "ssn" or "name" and "birthdate"' }
  }

  const options = {
    includeRawFreg: Boolean(includeRawFreg),
    includeFortrolig: Boolean(includeFortrolig),
    includeForeldreansvar: Boolean(includeForeldreansvar),
    includeFamilie: Boolean(includeFamilie)
  }

  const defaultParts = 'part=person-basis&part=relasjon-utvidet'
  let url: string

  if (ssn) {
    if (typeof ssn !== 'string' || ssn.length !== 11) {
      return { status: 400, body: 'Property "ssn" must be a string of length 11' }
    }
    url = `${config.freg.url}/${config.freg.rettighet}/api/v1/personer/${ssn}?${defaultParts}`
  } else if (name && birthdate) {
    if (typeof name !== 'string') {
      return { status: 400, body: 'Property "name" must be string' }
    }
    if (typeof birthdate !== 'string' || birthdate.length !== 8) {
      return { status: 400, body: 'Property "birthdate" must be format "YYYYMMDD"' }
    }
    url = `${config.freg.url}/${config.freg.rettighet}/api/v1/personer/entydigsoek?foedselsdato=${birthdate}&navn=${encodeURIComponent(name)}&${defaultParts}`
  } else {
    throw new Error('Huh, dette skal ikke være mulig...')
  }

  try {
    logger.info('azf-freg - Personer - {Caller} - calling FREG', { Caller: caller })

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    })

    if (response.status === 404) {
      return { status: 200, body: { foedselsEllerDNummer: null, status: 'fant ingen med denne identifikasjonen' } }
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => `HTTP ${response.status}`)
      logger.error('azf-freg - Personer - {Caller} - FREG returned error {Status}: {Body}', {
        Caller: caller,
        Status: response.status,
        Body: errorBody
      })
      return { status: 500, body: errorBody }
    }

    const data = (await response.json()) as FregPerson
    logger.info('azf-freg - Personer - {Caller} - got data, repacking result', { Caller: caller })
    const repacked = repackFreg(data, options)
    logger.info('azf-freg - Personer - {Caller} - successfully repacked result', { Caller: caller })
    return { status: 200, body: repacked }
  } catch (error) {
    logger.error('azf-freg - Personer - {Caller} - error calling FREG: {Error}', {
      Caller: caller,
      Error: String(error)
    })
    return { status: 500, body: String(error) }
  }
}
