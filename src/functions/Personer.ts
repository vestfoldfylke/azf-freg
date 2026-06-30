import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { logger } from '@vestfoldfylke/loglady'
import { config } from '../config.js'
import { decodeAadToken } from '../lib/decode-bearer-token.js'
import { getMaskinportenToken } from '../lib/maskinporten-token.js'
import { type FregPerson, repackFreg } from '../lib/repack/repack-freg.js'

type PersonerRequestBody = {
  ssn?: unknown
  name?: unknown
  birthdate?: unknown
  includeRawFreg?: unknown
  includeFortrolig?: unknown
  includeForeldreansvar?: unknown
  includeFamilie?: unknown
}

export const handler = async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
  logger.info('azf-freg - Personer - new request, checking token')

  const decoded = decodeAadToken(request.headers.get('authorization') ?? undefined)
  if (!decoded.verified) {
    return { status: 401, body: decoded.msg }
  }
  if (!decoded.roles.includes(config.API_ROLE)) {
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

  let body: PersonerRequestBody | null = null
  try {
    body = (await request.json()) as PersonerRequestBody | null
  } catch {
    return { status: 400, body: 'Body is missing or not valid JSON' }
  }
  if (!body) {
    return { status: 400, body: 'Body is missing' }
  }

  const { ssn, name, birthdate, includeRawFreg, includeFortrolig, includeForeldreansvar, includeFamilie } = body

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
    url = `${config.FREG.URL}/${config.FREG.RETTIGHET}/api/v1/personer/${ssn}?${defaultParts}`
  } else if (name && birthdate) {
    if (typeof name !== 'string') {
      return { status: 400, body: 'Property "name" must be string' }
    }
    if (typeof birthdate !== 'string' || birthdate.length !== 8) {
      return { status: 400, body: 'Property "birthdate" must be format "YYYYMMDD"' }
    }
    url = `${config.FREG.URL}/${config.FREG.RETTIGHET}/api/v1/personer/entydigsoek?foedselsdato=${birthdate}&navn=${encodeURIComponent(name)}&${defaultParts}`
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
      return {
        status: 200,
        jsonBody: { foedselsEllerDNummer: null, status: 'fant ingen med denne identifikasjonen' }
      }
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
    return { status: 200, jsonBody: repacked }
  } catch (error) {
    logger.error('azf-freg - Personer - {Caller} - error calling FREG: {Error}', {
      Caller: caller,
      Error: String(error)
    })
    return { status: 500, body: String(error) }
  }
}

app.http('Personer', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler
})
