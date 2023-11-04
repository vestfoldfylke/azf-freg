const getAccessToken = require('../lib/getAccessToken')
const axios = require('axios')
const repack = require('../lib/repackFreg')
const decodeAccessToken = require('../lib/decodeAadToken')
const { logConfig, logger } = require('@vtfk/logger')
const { freg, apiRole } = require('../config')

module.exports = async function (context, req) {
  logConfig({
    prefix: 'azf-freg - Personer',
    azure: {
      context,
      excludeInvocationId: true
    }
  })
  logger('info', ['new Request. Checking token'])
  const decoded = decodeAccessToken(req.headers.authorization)
  if (!decoded.verified) return { status: 401, body: decoded.msg }
  if (!decoded.roles.includes(apiRole)) return { status: 401, body: 'Access token does not include required role for this operation' }
  logConfig({
    prefix: `azf-freg - Personer - ${decoded.appid}${decoded.upn ? ' - ' + decoded.upn : ''}`,
    azure: {
      context,
      excludeInvocationId: true
    }
  })

  let accessToken
  try {
    accessToken = await getAccessToken()
  } catch (error) {
    logger('error', ['error when getting access token', error.toString()])
    return { status: 500, body: error.toString() }
  }

  if (!req.body) return { status: 400, body: 'Body is missing' }
  const { ssn, name, birthdate, includeRawFreg, includeFortrolig, includeForeldreansvar } = req.body

  if ((!ssn) && !(name && birthdate)) return { status: 400, body: 'Body is missing required property "ssn" or "name" and "birthdate"' }

  let url = 'dinna_blir_lagd_lenger_ned.vtfk.no'

  const options = {
    includeRawFreg: includeRawFreg || false,
    includeFortrolig: includeFortrolig || false,
    includeForeldreansvar: includeForeldreansvar || false
  }

  const defaultParts = 'part=person-basis&part=relasjon-utvidet'

  if (ssn) {
    if (ssn.length !== 11) return { status: 400, body: 'Property "ssn" must be lenght 11' }
    url = `${freg.url}/${freg.rettighet}/api/v1/personer/${ssn}?${defaultParts}`
  } else if (name && birthdate) {
    if (typeof name !== 'string') return { status: 400, body: 'Property "name" must be string' }
    if (birthdate.length !== 8) return { status: 400, body: 'Property "birthdate" must be format "YYYYMMDD"' }
    url = `${freg.url}/${freg.rettighet}/api/v1/personer/entydigsoek?foedselsdato=${birthdate}&navn=${encodeURIComponent(name)}&${defaultParts}`
  } else {
    throw new Error('Huh, dette skal ikke være mulig...')
  }

  try {
    const headers = {
      Authorization: `Bearer ${accessToken.access_token}`,
      Accept: 'application/json'
    }
    const config = { headers }
    logger('info', ['calling freg', 'ssn', ssn])
    const { data } = await axios.get(url, config)
    logger('info', ['got data. Trying to repack result'])
    const repacked = repack(data, options)
    logger('info', ['successfully repacked result'])
    return { status: 200, body: repacked }
  } catch (error) {
    logger('error', ['error when calling freg', error.response?.data || error.stack || error.toString()])
    if (error.response?.status === 404) {
      return { status: 200, body: { foedselsEllerDNummer: null, status: 'fant ingen med denne identifikasjonen' } }
    }
    return { status: 500, body: error.response?.data || error.stack || error.toString() }
  }
}
