import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { logger } from '@vestfoldfylke/loglady'
import { config } from '../config.js'
import { decodeAadToken } from '../lib/decode-bearer-token.js'
import { getMaskinportenToken } from '../lib/maskinporten-token.js'
import { type FregPerson, repackFreg } from '../lib/repack/repack-freg.js'

type PersonerRequestBody = {
  ssn?: string
  name?: string
  birthdate?: string
  includeRawFreg?: boolean
  includeFortrolig?: boolean
  includeForeldreansvar?: boolean
  includeFamilie?: boolean
}

type PersonerQuery = { kind: 'ssn'; ssn: string } | { kind: 'name'; name: string; birthdate: string }

type PersonerOptions = {
  includeRawFreg: boolean
  includeFortrolig: boolean
  includeForeldreansvar: boolean
  includeFamilie: boolean
}

type ParseResult = { ok: true; query: PersonerQuery; options: PersonerOptions } | { ok: false; error: string }

const optionFields = ['includeRawFreg', 'includeFortrolig', 'includeForeldreansvar', 'includeFamilie'] as const

const parsePersonerRequest = (body: PersonerRequestBody): ParseResult => {
  for (const field of optionFields) {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      return { ok: false, error: `Property "${field}" must be a boolean` }
    }
  }
  const options: PersonerOptions = {
    includeRawFreg: body.includeRawFreg ?? false,
    includeFortrolig: body.includeFortrolig ?? false,
    includeForeldreansvar: body.includeForeldreansvar ?? false,
    includeFamilie: body.includeFamilie ?? false
  }
  if (body.ssn) {
    if (typeof body.ssn !== 'string' || !/^\d{11}$/.test(body.ssn)) {
      return { ok: false, error: 'Property "ssn" must be 11 digits' }
    }
    return { ok: true, query: { kind: 'ssn', ssn: body.ssn }, options }
  }
  if (body.name && body.birthdate) {
    if (typeof body.name !== 'string') {
      return { ok: false, error: 'Property "name" must be string' }
    }
    if (typeof body.birthdate !== 'string' || !/^\d{8}$/.test(body.birthdate)) {
      return { ok: false, error: 'Property "birthdate" must be format "YYYYMMDD"' }
    }
    return { ok: true, query: { kind: 'name', name: body.name, birthdate: body.birthdate }, options }
  }
  return { ok: false, error: 'Body is missing required property "ssn" or "name" and "birthdate"' }
}

const buildPersonerUrl = (query: PersonerQuery): URL => {
  if (!config.FREG.URL || !config.FREG.RETTIGHET) {
    throw new Error('FREG URL or RETTIGHET is not configured')
  }

  const base = `${config.FREG.URL}/${config.FREG.RETTIGHET}/api/v1/personer`
  if (query.kind === 'ssn') {
    return new URL(`${base}/${query.ssn}`)
  }
  const url = new URL(`${base}/entydigsoek`)
  url.searchParams.set('foedselsdato', query.birthdate)
  url.searchParams.set('navn', query.name)
  return url
}

export const handler = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  const correlationId = context.invocationId

  const internalError = (source: string): HttpResponseInit => ({
    status: 500,
    body: `Internal error in ${source}. Reference id: ${correlationId}`
  })

  logger.info('azf-freg - Personer - new request, checking token')

  const decoded = decodeAadToken(request.headers.get('authorization') ?? undefined)

  if (!decoded.ok) {
    return { status: 401, body: decoded.reason }
  }

  if (!decoded.roles.includes(config.API_ROLE)) {
    return { status: 401, body: 'Access token does not include required role for this operation' }
  }

  const caller = `${decoded.appid}${decoded.upn ? ` - ${decoded.upn}` : ''}`
  logger.info('azf-freg - Personer - {@Caller} - token ok, fetching Maskinporten token', caller)

  let accessToken: string
  try {
    accessToken = await getMaskinportenToken()
  } catch (error) {
    logger.errorException(error, 'azf-freg - Personer - {Caller} - error getting Maskinporten token - {CorrelationId}', caller, correlationId)
    return internalError('fetching token from Maskinporten')
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

  const parsed = parsePersonerRequest(body)
  if (!parsed.ok) {
    return { status: 400, body: parsed.error }
  }

  const url = buildPersonerUrl(parsed.query)
  url.searchParams.append('part', 'person-basis')
  url.searchParams.append('part', 'relasjon-utvidet')

  try {
    logger.info('azf-freg - Personer - {Caller} - calling FREG', caller)

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
      const errorMessage = await response.text().catch(() => `HTTP ${response.status}`)
      logger.error(
        'azf-freg - Personer - {Caller} - {CorrelationId} - FREG returned error {Status}: {ErrorMessage}',
        caller,
        correlationId,
        response.status,
        errorMessage
      )
      return internalError('calling freg api')
    }

    const data = (await response.json()) as FregPerson
    logger.info('azf-freg - Personer - {Caller} - got data, repacking result', caller)

    const repacked = repackFreg(data, parsed.options)
    logger.info('azf-freg - Personer - {Caller} - successfully repacked result', caller)
    return { status: 200, jsonBody: repacked }
  } catch (error) {
    logger.errorException(
      error,
      'azf-freg - Personer - {Caller} - {CorrelationId} - error calling FREG: {Error}',
      caller,
      correlationId,
      String(error)
    )
    return internalError('azure function api call')
  }
}

app.http('Personer', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler
})
